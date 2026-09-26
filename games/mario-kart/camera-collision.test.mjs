import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { cameraCollision } from "./camera-collision.js";
const origin = new THREE.Vector3(0, 1, 0);
function wall(width = 2, angle = 0) {
  const group = new THREE.Group();
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(width, 4, 1),
    new THREE.MeshBasicMaterial(),
  );
  mesh.position.set(0, 1, -5);
  mesh.rotation.y = angle;
  group.add(mesh);
  return { group, mesh };
}
test("a wall between kart and chase eye pulls the camera to the kart side", () => {
  const { group } = wall();
  const eye = cameraCollision(group)(origin, new THREE.Vector3(0, 1, -10));
  // Independently, the front face of a 1m wall centred at -5 is z=-4.5.
  assert.ok(eye.z > -4.5 && eye.z < -3.5);
  assert.equal(eye.x, 0);
  assert.equal(eye.y, 1);
});
test("a nearby wall outside the view segment does not move the camera", () => {
  const { group } = wall();
  const desired = new THREE.Vector3(8, 1, -10);
  assert.deepEqual(
    cameraCollision(group)(origin, desired).toArray(),
    desired.toArray(),
  );
});
test("an angled thin wall uses its oriented face rather than its broad-phase box", () => {
  const { group } = wall(8, Math.PI / 4);
  const eye = cameraCollision(group)(origin, new THREE.Vector3(0, 1, -10));
  // The centre ray meets this face at z=-5 + .5/cos(45°), not the AABB corner.
  assert.ok(eye.z < -3.6 && eye.z > -4.293);
});
test("collision snapshots survive removal of source meshes for scenery batching", () => {
  const { group, mesh } = wall();
  const resolve = cameraCollision(group);
  mesh.removeFromParent();
  assert.ok(resolve(origin, new THREE.Vector3(0, 1, -10)).z > -4.5);
});
