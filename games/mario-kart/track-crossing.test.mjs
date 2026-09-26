import test from "node:test";
import assert from "node:assert/strict";
import { TRACK_SAMPLES, TRACK_LENGTH, trackAt, surfaceAt } from "./track.js";
import { chasePose, cameraClearance } from "./visual-frame.js";
// Independent line-segment intersections; no track.project or known crossing station.
const cross = (x, z, u, v) => x * v - z * u;
const crossings = [];
for (let i = 0; i < TRACK_SAMPLES.length - 1; i++)
  for (let j = i + 2; j < TRACK_SAMPLES.length - 1; j++) {
    const a = TRACK_SAMPLES[i],
      b = TRACK_SAMPLES[i + 1],
      c = TRACK_SAMPLES[j],
      d = TRACK_SAMPLES[j + 1];
    const gap = Math.abs(a.s - c.s);
    if (Math.min(gap, TRACK_LENGTH - gap) < 80) continue;
    const ux = b.x - a.x,
      uz = b.z - a.z,
      vx = d.x - c.x,
      vz = d.z - c.z;
    const den = cross(ux, uz, vx, vz);
    if (Math.abs(den) < 1e-8) continue;
    const t = cross(c.x - a.x, c.z - a.z, vx, vz) / den,
      q = cross(c.x - a.x, c.z - a.z, ux, uz) / den;
    if (t < 0 || t > 1 || q < 0 || q > 1) continue;
    const sa = a.s + (b.s - a.s) * t,
      sb = c.s + (d.s - c.s) * q;
    if (trackAt(sa).glide || trackAt(sb).glide) continue;
    crossings.push([sa, sb].sort((a, b) => trackAt(a).y - trackAt(b).y));
  }
test("all actual road crossings have enough vertical clearance for karts and camera", () => {
  assert.ok(
    crossings.length > 0,
    "the Stadium route must exercise a real crossing",
  );
  for (const [lower, upper] of crossings) {
    const gap = trackAt(upper).y - trackAt(lower).y;
    assert.ok(
      gap >= 8,
      `roads intersect with only ${gap.toFixed(2)}m clearance`,
    );
  }
});
test("a camera under the overpass stays with the lower road layer", () => {
  for (const [lower, upper] of crossings) {
    const p = surfaceAt(lower),
      top = trackAt(upper).y;
    const eye = chasePose({ ...p, lateral: 0, gliding: false }).eye;
    assert.ok(eye.y < top - 1, "camera jumped to the bridge deck");
    const corrected = cameraClearance({ ...p, y: p.y - 0.5 }, lower);
    assert.ok(
      corrected.y > p.y + 1 && corrected.y < top - 1,
      "ground repair selected the upper road",
    );
  }
});
