import test from "node:test";
import assert from "node:assert/strict";
import { kartContact } from "./kart-contact.js";
import { Race } from "./logic.js";
import { surfaceAt, project } from "./track.js";
function kart(x = 0, z = 0, heading = 0) {
  return {
    x,
    z,
    y: 0,
    s: 50,
    lateral: 0,
    heading,
    anti: false,
    gliding: false,
    drift: 0,
    spin: 0,
  };
}
test("finished chassis rear contact starts before the old circular threshold", () => {
  const c = kartContact(kart(), kart(0, 3));
  assert.ok(c && Math.abs(c.z) > 0.32 && Math.abs(c.x) < 1e-8);
  assert.equal(kartContact(kart(), kart(0, 3.5)), null);
});
test("parallel karts can pass with a gap wider than their measured 2.498m bodies", () => {
  assert.equal(kartContact(kart(), kart(2.7)), null);
  assert.ok(kartContact(kart(), kart(2.4)));
  const a = kart(),
    b = kart(3.1);
  a.anti = b.anti = true;
  assert.ok(kartContact(a, b), "hover rims measure 3.244m across");
});
test("contact follows the heading and diagonal drift silhouette", () => {
  assert.ok(kartContact(kart(0, 0, Math.PI / 2), kart(3, 0, Math.PI / 2)));
  assert.equal(
    kartContact(kart(0, 0, Math.PI / 2), kart(0, 2.7, Math.PI / 2)),
    null,
  );
  const a = kart(),
    b = kart(2.7);
  a.drift = 1;
  // One turning kart crosses its straight neighbor: the measured outer front
  // corner rotates to x≈1.64,z≈-1.37, inside that neighbor starting at x≈1.45.
  assert.ok(kartContact(a, b), "rotated rear corners occupy the passing gap");
});
test("crossing road layers and vertically separated flight do not collide", () => {
  const a = kart(),
    b = kart();
  b.s = 420;
  assert.equal(kartContact(a, b), null);
  b.s = 50;
  b.gliding = true;
  b.y = 5;
  assert.equal(kartContact(a, b), null);
});
test("banked neighbors collide using their surface footprint, not world height alone", () => {
  const a = { ...kart(), ...surfaceAt(765, 0), lateral: 0, anti: true },
    b = { ...kart(), ...surfaceAt(765, 1.4), lateral: 1.4, anti: true };
  assert.ok(
    Math.abs(a.y - b.y) > 2,
    "exercise the previous world-height rejection",
  );
  assert.ok(kartContact(a, b));
});
test("pack solver clears independently measured body rectangles and retains steering", () => {
  const race = new Race({ seed: 17 }),
    p = surfaceAt(50);
  for (const [i, r] of race.racers.entries()) {
    Object.assign(r, {
      x: p.x + (i % 2) * 2.0,
      z: p.z + Math.floor(i / 2) * 2.8,
      y: 0,
      s: 50,
      heading: 0,
      drift: 0,
      spin: 0,
      anti: false,
      gliding: false,
      steer: 0.4,
      speed: 25,
      finishTime: null,
    });
    r.lateral = project(r.x, r.z, 50).lateral;
  }
  for (let i = 0; i < 4; i++) race.collisions(1 / 120);
  for (let i = 0; i < 8; i++)
    for (let j = i + 1; j < 8; j++) {
      const a = race.racers[i],
        b = race.racers[j];
      // Independent overlap oracle: measured GLB rectangles at zero heading.
      assert.ok(
        Math.abs(a.x - b.x) >= 2.498 || Math.abs(a.z - b.z) >= 3.324,
        `physical chassis overlap: ${i},${j}`,
      );
    }
  for (const r of race.racers) {
    assert.equal(r.heading, 0);
    assert.equal(r.steer, 0.4);
    assert.equal(r.speed, 25);
  }
});
