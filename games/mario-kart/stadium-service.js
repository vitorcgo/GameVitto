import * as THREE from "three";
import { surfaceAt } from "./track.js";
import { stadiumBrand } from "./stadium-brands.js";

/** Low broadcast/service compound observed beside the landing straight. */
export function buildServiceCompound(
  world,
  { mesh, box, standard, canvasTexture },
) {
  const p = surfaceAt(1185, -48),
    hub = new THREE.Group();
  hub.name = "landing-service-compound";
  hub.position.set(p.x, 0, p.z);
  hub.rotation.y = -p.heading;
  world.add(hub);
  const paving = standard("#999e99", { roughness: 0.94 }),
    cream = standard("#e4e8dd", { roughness: 0.78 }),
    fabric = standard("#d2dbd9", { roughness: 0.92, side: THREE.DoubleSide }),
    cyan = standard("#74aabb", { roughness: 0.78 }),
    blue = standard("#345d9f", { metalness: 0.25, roughness: 0.42 }),
    steel = standard("#727d83", { metalness: 0.6, roughness: 0.38 }),
    dark = standard("#222b30", { roughness: 0.76 }),
    glass = standard("#173441", { metalness: 0.6, roughness: 0.24 });
  const label = new THREE.MeshStandardMaterial({
    map: stadiumBrand("MKTV", canvasTexture),
    emissive: "#b8cdcf",
    emissiveIntensity: 0.2,
    roughness: 0.65,
  });
  const rod = (parent, a, b, radius, material) => {
    const av = new THREE.Vector3(...a),
      bv = new THREE.Vector3(...b),
      d = bv.clone().sub(av);
    const m = mesh(
      new THREE.CylinderGeometry(radius, radius, d.length(), 8),
      material,
      parent,
      av.clone().add(bv).multiplyScalar(0.5).toArray(),
    );
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
    return m;
  };
  box(hub, [36, 0.28, 44], [0, 0.02, 0], paving);
  // Subtle slab joints and parking-space paint give the exposed pad scale.
  const seam = standard("#818781");
  for (let z = -20; z <= 20; z += 4)
    box(hub, [35.8, 0.01, 0.055], [0, 0.17, z], seam);
  for (const x of [-12, -6, 0, 6, 12])
    box(hub, [0.055, 0.01, 43.8], [x, 0.17, 0], seam);
  for (const z of [-19, -10, -1])
    box(hub, [9, 0.012, 0.12], [-12, 0.18, z], cream);
  // A broad hipped fabric canopy, open at the track-facing side.
  const tent = new THREE.Group();
  tent.position.set(6, 0.2, 8);
  hub.add(tent);
  for (const x of [-9, 9])
    for (const z of [-8, 8]) rod(tent, [x, 0, z], [x, 4.8, z], 0.12, steel);
  const corners = [
      [-9.5, 4.8, -8.5],
      [9.5, 4.8, -8.5],
      [9.5, 4.8, 8.5],
      [-9.5, 4.8, 8.5],
    ],
    roof = [];
  for (let i = 0; i < 4; i++)
    roof.push(...corners[i], ...corners[(i + 1) % 4], 0, 8.1, 0);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(roof, 3));
  geometry.computeVertexNormals();
  mesh(geometry, fabric, tent);
  for (const z of [-8.5, 8.5]) box(tent, [19, 0.75, 0.08], [0, 4.43, z], cyan);
  for (const x of [-9.5, 9.5]) box(tent, [0.08, 0.75, 17], [x, 4.43, 0], cyan);
  box(tent, [0.08, 3.7, 16], [-9, 2.1, 0], cream);
  box(tent, [18, 3.7, 0.08], [0, 2.1, -8], cream);
  const sign = mesh(
    new THREE.PlaneGeometry(7.2, 1.8),
    label,
    tent,
    [9.6, 4.2, 0],
  );
  sign.rotation.y = Math.PI / 2;
  box(tent, [3, 1.15, 10], [6, 0.72, 0], cream);
  box(tent, [3.2, 0.18, 10.2], [6, 1.38, 0], dark);
  for (const z of [-3, 0, 3]) {
    box(tent, [0.2, 1.1, 1.65], [5.8, 2, z], dark);
    box(
      tent,
      [0.025, 0.85, 1.4],
      [5.92, 2.02, z],
      standard("#678d93", { emissive: "#4c858a", emissiveIntensity: 0.25 }),
    );
    box(tent, [1.4, 0.9, 1.9], [-4, 0.65, z], blue);
  }
  // Compact broadcast van: cab, glass, tires, roof dish and equipment doors.
  const van = new THREE.Group();
  van.position.set(-10, 0.2, -10);
  van.rotation.y = -Math.PI / 2;
  hub.add(van);
  box(van, [4.2, 2.8, 6.5], [0, 2.1, 0.7], cream);
  box(van, [4.1, 1, 9], [0, 0.95, -0.2], blue);
  box(van, [4, 2.4, 2.2], [0, 2, -3.25], blue);
  box(van, [3.7, 1.05, 0.06], [0, 2.5, -4.38], glass);
  for (const x of [-1.99, 1.99])
    box(van, [0.06, 1.05, 1.8], [x, 2.5, -3.2], glass);
  for (const x of [-2.12, 2.12])
    for (const z of [-2.8, 2.5]) {
      const tire = mesh(
        new THREE.CylinderGeometry(0.85, 0.85, 0.42, 16),
        dark,
        van,
        [x, 0.85, z],
      );
      tire.rotation.z = Math.PI / 2;
      const rim = mesh(
        new THREE.CylinderGeometry(0.43, 0.43, 0.44, 12),
        steel,
        van,
        [x, 0.85, z],
      );
      rim.rotation.z = Math.PI / 2;
    }
  for (const side of [-1, 1]) {
    const sign = mesh(new THREE.PlaneGeometry(4.8, 1.2), label, van, [
      side * 2.11,
      2.5,
      1,
    ]);
    sign.rotation.y = (side * Math.PI) / 2;
  }
  rod(van, [0, 3.5, 1], [0, 5.8, 1], 0.09, steel);
  const dish = mesh(
    new THREE.SphereGeometry(1.1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2),
    cream,
    van,
    [0, 5.4, 1],
  );
  dish.rotation.x = 0.65;
  box(van, [2.8, 0.15, 1.2], [0, 3.6, -1], dark);
  // Planters and a small picnic area retain green space around the service pad.
  const leaves = standard("#456b35", { roughness: 0.95 }),
    wood = standard("#a18c65");
  for (const z of [-21, 21]) {
    box(hub, [31, 0.7, 1.7], [0, 0.48, z], cream);
    for (let x = -14; x <= 14; x += 1.8)
      mesh(new THREE.SphereGeometry(1.15, 8, 6), leaves, hub, [x, 1.05, z]);
  }
  for (const z of [5, 13]) {
    box(hub, [5, 0.2, 2], [-11, 1.55, z], wood);
    for (const dz of [-1.7, 1.7])
      box(hub, [5, 0.18, 0.6], [-11, 0.9, z + dz], wood);
    for (const x of [-12.7, -9.3])
      rod(hub, [x, 0.2, z - 1.8], [x, 1.45, z + 0.7], 0.1, steel);
  }
  return { hub };
}
