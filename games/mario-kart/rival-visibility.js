import * as THREE from 'three';

const bodies = new WeakMap();
const eye = new THREE.Vector3();

/** Cache vertices in model space: a world AABB becomes enormous on a bank,
 * and a skinned bound measured before bind matrices update can be displaced. */
export function rivalBodyBounds(model) {
  if (bodies.has(model)) return bodies.get(model);
  model.updateWorldMatrix(true, false);
  model.updateMatrixWorld(true);
  const inverse = model.matrixWorld.clone().invert();
  const bounds = new THREE.Box3(), point = new THREE.Vector3();
  model.traverse(mesh => {
    if (!mesh.isMesh || !mesh.visible) return;
    if (mesh.isSkinnedMesh) mesh.skeleton.update();
    for (let i = 0; i < mesh.geometry.attributes.position.count; i++) {
      mesh.getVertexPosition(i, point).applyMatrix4(mesh.matrixWorld).applyMatrix4(inverse);
      bounds.expandByPoint(point);
    }
  });
  bodies.set(model, bounds);
  return bounds;
}

/** Suppress an interior view only. A rival next to/in front of the player must
 * remain visible; the near plane already clips geometry behind the eye. */
export function rivalVisible(model, camera) {
  const bounds = rivalBodyBounds(model);
  model.updateWorldMatrix(true, false);
  model.worldToLocal(eye.copy(camera.position));
  return bounds.distanceToPoint(eye) > camera.near * .5;
}
