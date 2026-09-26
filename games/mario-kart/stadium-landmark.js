/** Original dimensional lettering and planting for the stadium's final approach. */
import * as THREE from "three";
import { surfaceAt, project } from "./track.js";

const glyphs = {
  M: [
    [0, 0],
    [0, 7],
    [1.5, 7],
    [2.5, 4.2],
    [3.5, 7],
    [5, 7],
    [5, 0],
    [3.6, 0],
    [3.6, 3.9],
    [2.5, 1.5],
    [1.4, 3.9],
    [1.4, 0],
  ],
  A: [
    [0, 0],
    [1.7, 7],
    [3.3, 7],
    [5, 0],
    [3.5, 0],
    [3.15, 1.6],
    [1.85, 1.6],
    [1.5, 0],
  ],
  R: [
    [0, 0],
    [0, 7],
    [3.6, 7],
    [5, 5.8],
    [5, 4.1],
    [3.65, 3.1],
    [5.15, 0],
    [3.45, 0],
    [2.1, 2.9],
    [1.5, 2.9],
    [1.5, 0],
  ],
  I: [
    [0, 0],
    [0, 1.2],
    [1.6, 1.2],
    [1.6, 5.8],
    [0, 5.8],
    [0, 7],
    [4.7, 7],
    [4.7, 5.8],
    [3.1, 5.8],
    [3.1, 1.2],
    [4.7, 1.2],
    [4.7, 0],
  ],
  O: [
    [0, 1.1],
    [0, 5.9],
    [1.1, 7],
    [3.9, 7],
    [5, 5.9],
    [5, 1.1],
    [3.9, 0],
    [1.1, 0],
  ],
  K: [
    [0, 0],
    [0, 7],
    [1.5, 7],
    [1.5, 4.3],
    [3.35, 7],
    [5.15, 7],
    [2.8, 3.6],
    [5.2, 0],
    [3.4, 0],
    [1.5, 2.8],
    [1.5, 0],
  ],
  T: [
    [0, 5.5],
    [0, 7],
    [5, 7],
    [5, 5.5],
    [3.25, 5.5],
    [3.25, 0],
    [1.75, 0],
    [1.75, 5.5],
  ],
};
const holes = {
  A: [
    [
      [2.15, 3.0],
      [2.85, 3.0],
      [2.5, 4.7],
    ],
  ],
  R: [
    [
      [1.5, 4.3],
      [3.25, 4.3],
      [3.55, 4.65],
      [3.55, 5.25],
      [3.2, 5.6],
      [1.5, 5.6],
    ],
  ],
  O: [
    [
      [1.5, 1.6],
      [3.5, 1.6],
      [3.5, 5.4],
      [1.5, 5.4],
    ],
  ],
};
export function buildLandmark(world, { box, standard }) {
  const red = standard("#c22a33", { roughness: 0.32, metalness: 0.18 }),
    edge = standard("#172231", { roughness: 0.48, metalness: 0.24 }),
    blue = standard("#214391"),
    soil = standard("#383528", { roughness: 1 });
  const path = (points, Path = THREE.Shape) => {
    const p = new Path();
    // A modest oblique face matches the racing lettering without a font dependency.
    points.forEach(([x, y], i) => p[i ? "lineTo" : "moveTo"](x + y * 0.13, y));
    p.closePath();
    return p;
  };
  const letters = "MARIOKART";
  for (let i = 0; i < letters.length; i++) {
    const s = 1375 - i * 7.8 - (i >= 5 ? 3 : 0),
      p = surfaceAt(s, 23.5);
    if (project(p.x, p.z).d2 < 18 ** 2) continue;
    const g = new THREE.Group();
    g.position.set(p.x, 0, p.z);
    g.rotation.y = -p.heading - Math.PI / 2;
    world.add(g);
    box(g, [8.1, 6, 4], [3, 3, 0], blue);
    box(g, [8.2, 0.7, 5], [3, 6.1, 0], soil);
    const shape = path(glyphs[letters[i]]);
    for (const h of holes[letters[i]] || [])
      shape.holes.push(path(h, THREE.Path));
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: 1.5,
      bevelEnabled: true,
      bevelThickness: 0.11,
      bevelSize: 0.1,
      bevelSegments: 3,
      steps: 1,
      curveSegments: 8,
    });
    const letter = new THREE.Mesh(geo, [red, edge]);
    letter.position.set(0, 7, -0.2);
    letter.castShadow = true;
    letter.receiveShadow = true;
    g.add(letter);
  }
  // Instanced foliage/petals form a continuous planted border beneath the sign.
  const points = [];
  let seed = 704;
  const rand = () =>
    (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
  for (let s = 1300; s < 1383; s += 0.6) {
    const p = surfaceAt(s, 21.5);
    if (project(p.x, p.z).d2 < 18 ** 2) continue;
    points.push(new THREE.Vector3(p.x, 6.65 + rand() * 0.3, p.z));
  }
  const leaves = new THREE.InstancedMesh(
    new THREE.SphereGeometry(0.48, 6, 4),
    standard("#397341", { roughness: 0.9 }),
    points.length * 3,
  );
  const petals = new THREE.InstancedMesh(
    new THREE.SphereGeometry(0.14, 6, 4),
    standard("#e65653", { roughness: 0.8 }),
    points.length * 5,
  );
  const dummy = new THREE.Object3D();
  points.forEach((p, i) => {
    for (let j = 0; j < 3; j++) {
      dummy.position
        .copy(p)
        .add(
          new THREE.Vector3(
            (rand() - 0.5) * 0.9,
            rand() * 0.2,
            (rand() - 0.5) * 0.7,
          ),
        );
      dummy.scale.set(1, 0.55, 1);
      dummy.updateMatrix();
      leaves.setMatrixAt(i * 3 + j, dummy.matrix);
    }
    for (let j = 0; j < 5; j++) {
      const a = (j * Math.PI * 2) / 5;
      dummy.position
        .copy(p)
        .add(new THREE.Vector3(Math.cos(a) * 0.16, 0.33, Math.sin(a) * 0.16));
      dummy.scale.set(1, 0.45, 1);
      dummy.updateMatrix();
      petals.setMatrixAt(i * 5 + j, dummy.matrix);
    }
  });
  world.add(leaves, petals);
}
