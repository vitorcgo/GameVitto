import test from "node:test";
import assert from "node:assert/strict";
import { roadFrame, chasePose, cameraClearance, flightFrame } from "./visual-frame.js";
import {
  surfaceAt,
  trackAt,
  TRACK_LENGTH,
  project,
  SECTIONS,
} from "./track.js";
const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
test('flight camera follows a measured 3-4-5 descent with perpendicular up',()=>{
  const frame=flightFrame({heading:Math.PI/2,speed:30,flightV:-40});
  assert.ok(Math.abs(frame.forward.x-.6)<1e-12);
  assert.ok(Math.abs(frame.forward.y-(-.8))<1e-12);
  assert.ok(Math.abs(frame.up.x-.8)<1e-12);
  assert.ok(Math.abs(frame.up.y-.6)<1e-12);
  assert.ok(Math.abs(dot(frame.forward,frame.up))<1e-12);
});
test('airborne loss of forward speed keeps the chase eye behind the canopy',()=>{
  // The recorded failure was a roughly10 m/s fall with less than5 m/s travel.
  // Test the perceptual requirement: camera remains behind, below55 degrees
  // elevation, even at a complete stop. The physics velocity is unchanged.
  for(const heading of [0,Math.PI/2,Math.PI,-Math.PI/2])for(const speed of [0,.01,1,5,10,20]){
    const racer={heading,speed,flightV:-10};const f=flightFrame(racer);
    const eye={x:-8.8*f.forward.x+3.8*f.up.x,y:-8.8*f.forward.y+3.8*f.up.y,z:-8.8*f.forward.z+3.8*f.up.z};
    const behind=-eye.x*Math.sin(heading)+eye.z*Math.cos(heading);
    assert.ok(behind>6,'Canopy must not cover the driver from an overhead eye');
    assert.ok(Math.atan2(eye.y,behind)<55*Math.PI/180);
    assert.equal(racer.flightV,-10);
  }
});
test("render frame is orthogonal and tangent to independently sampled pavement", () => {
  for (let s = 5; s < TRACK_LENGTH; s += 7.3) {
    if (trackAt(s).glide) continue;
    const p = surfaceAt(s, 3),
      a = surfaceAt(s - 0.015, 3),
      b = surfaceAt(s + 0.015, 3),
      c = surfaceAt(s, 3.01),
      d = surfaceAt(s, 2.99);
    const f = roadFrame(s, 3, p.heading);
    assert.ok(Math.abs(dot(f.up, f.forward)) < 1e-10);
    assert.ok(Math.abs(dot(f.up, f.right)) < 1e-10);
    assert.ok(f.up.y > 0);
    const across = { x: c.x - d.x, y: c.y - d.y, z: c.z - d.z };
    assert.ok(Math.abs(dot(f.up, across)) < 0.001);
    const along = { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z };
    assert.ok(Math.abs(dot(f.up, along)) < 0.003);
  }
});
test("chase camera stays above visible road, including climbing and banked shoulders", () => {
  for (let s = 0; s < TRACK_LENGTH; s += 2.7)
    for (const lateral of [-9, 0, 9]) {
      const p = surfaceAt(s, lateral);
      if (p.glide) continue;
      const pose = chasePose({ ...p, lateral, gliding: false });
      // Independent bounded route sampling: a global planar nearest point may
      // be the bridge above this racer and is not the surface under its camera.
      let nearest = { d2: Infinity };
      for (let sample = s - 20; sample <= s + 20; sample += 0.2) {
        const t = trackAt(sample),
          dx = pose.eye.x - t.x,
          dz = pose.eye.z - t.z;
        const d2 = dx * dx + dz * dz;
        if (d2 < nearest.d2)
          nearest = { d2, s: sample, lateral: dx * t.rx + dz * t.rz };
      }
      const q = nearest,
        ground = surfaceAt(q.s, q.lateral);
      if (!ground.glide && Math.abs(q.lateral) < 14.5)
        assert.ok(pose.eye.y - ground.y >= 1, "camera intersects road");
      assert.ok(dot(pose.up, roadFrame(s, lateral, p.heading).up) > 0.9);
      assert.ok(pose.up.y > 0);
    }
});
test("camera correction leaves off-track airspace alone and repairs underground view", () => {
  const p = surfaceAt(SECTIONS.antiStart + 150, 2);
  const corrected = cameraClearance({ ...p, y: p.y - 3 });
  assert.ok(corrected.y > p.y + 1);
  const far = { x: 1000, y: -50, z: 1000 };
  assert.deepEqual(cameraClearance(far), far);
});

// Independent world-space invariant: all course control elevations are above
// the infield; the sampled road may not introduce an underground section.
test("landing interpolation stays above the ground plane", async () => {
  const { CONTROL_POINTS, TRACK_LENGTH, trackAt } = await import("./track.js");
  const lowestControl = Math.min(...CONTROL_POINTS.map((p) => p.y));
  for (let s = 0; s < TRACK_LENGTH; s += 0.25)
    assert.ok(trackAt(s).y >= lowestControl - 1e-7, `buried pavement at ${s}`);
});
