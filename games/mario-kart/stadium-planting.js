import * as THREE from "three";
import { surfaceAt, controlDistances, SECTIONS } from "./track.js";
import { roadFrame } from "./visual-frame.js";

/** Small sculpted flower beds follow the bank's actual surface orientation. */
export function buildPlanting(world) {
  const leaves = [],
    petals = [],
    centers = [];
  const local = new THREE.Object3D(),
    frame = new THREE.Matrix4();
  const place = (list, position, scale, rotation, color) => {
    local.position.set(...position);
    local.scale.set(...scale);
    local.rotation.set(...rotation);
    local.updateMatrix();
    list.push({ matrix: frame.clone().multiply(local.matrix), color });
  };
  let bed = 0;
  for (
    let s = controlDistances[8] + 12;
    s < SECTIONS.glideStart - 18;
    s += 22
  ) {
    for (const side of [-1, 1]) {
      for (let flower = 0; flower < 3; flower++) {
        const at = s + flower * 1.2,
          lateral = side * (12.1 + (flower % 2) * 0.6),
          p = surfaceAt(at, lateral),
          f = roadFrame(at, lateral, p.heading);
        frame.makeBasis(
          new THREE.Vector3(f.right.x, f.right.y, f.right.z),
          new THREE.Vector3(f.up.x, f.up.y, f.up.z),
          new THREE.Vector3(-f.forward.x, -f.forward.y, -f.forward.z),
        );
        frame.setPosition(p.x, p.y + 0.03, p.z);
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * Math.PI * 2 + flower;
          place(
            leaves,
            [Math.sin(a) * 0.27, 0.26, Math.cos(a) * 0.27],
            [0.2, 0.12, 0.52],
            [-0.5, a, 0],
            i % 2 ? "#477b24" : "#69973b",
          );
        }
        const color = ["#edce47", "#e45d67", "#d5a6df"][bed % 3];
        place(leaves, [0, 0.4, 0], [0.05, 0.4, 0.05], [0, 0, 0], "#477b24");
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2;
          place(
            petals,
            [Math.sin(a) * 0.23, 0.78, Math.cos(a) * 0.23],
            [0.18, 0.12, 0.3],
            [0.32, a, 0],
            color,
          );
        }
        place(centers, [0, 0.82, 0], [0.14, 0.08, 0.14], [0, 0, 0], "#d68c24");
      }
      bed++;
    }
  }
  for (const [name, list] of [
    ["leaves", leaves],
    ["petals", petals],
    ["centers", centers],
  ]) {
    const instances = new THREE.InstancedMesh(
      new THREE.SphereGeometry(1, 8, 5),
      new THREE.MeshStandardMaterial({ roughness: 0.88 }),
      list.length,
    );
    instances.name = "bank-flower-" + name;
    list.forEach(({ matrix, color }, i) => {
      instances.setMatrixAt(i, matrix);
      instances.setColorAt(i, new THREE.Color(color));
    });
    instances.instanceMatrix.needsUpdate = true;
    instances.instanceColor.needsUpdate = true;
    instances.receiveShadow = true;
    instances.castShadow = false;
    world.add(instances);
  }
}
