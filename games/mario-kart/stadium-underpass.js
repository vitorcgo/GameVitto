import * as THREE from "three";
import { trackAt } from "./track.js";

/** The opening crossing reads as an occupied stadium floor, with a broad soffit.
 * The 6.65m underside clears the chase camera; the 7.35m top stays below the
 * return-road deck, including its lower edge at the far outside corner.
 */
export function buildUnderpass(world, { box, standard }) {
  const concrete = standard("#a3aaa5", { roughness: 0.9 }),
    ceiling = standard("#6e756e", {
      roughness: 0.9,
      emissive: "#6e756e",
      emissiveIntensity: 0.045,
    }),
    blue = standard("#31567a", { roughness: 0.65 }),
    trim = standard("#d3d3bd"),
    recess = standard("#29352e"),
    warm = new THREE.MeshBasicMaterial({
      color: new THREE.Color("#fff2c7").multiplyScalar(2),
    });
  const at = (s) => {
    const p = trackAt(s),
      g = new THREE.Group();
    g.position.set(p.x, 0, p.z);
    g.rotation.y = -p.heading;
    world.add(g);
    return g;
  };
  // Short overlapping bays follow the lower bend without cutting into its lane.
  for (let s = 97; s <= 133; s += 4) {
    const g = at(s);
    box(g, [43, 0.7, 4.5], [0, 7, 0], ceiling);
    for (const x of [-20, 20]) {
      box(g, [2.4, 6.7, 4.5], [x, 3.35, 0], concrete);
      box(g, [0.18, 0.55, 4.5], [x - Math.sign(x) * 1.25, 1.3, 0], blue);
    }
    if ((s - 97) % 12 === 0) {
      box(g, [38, 0.2, 0.5], [0, 6.53, 0], trim);
      for (const x of [-12, 0, 12]) {
        box(g, [3.3, 0.12, 1.65], [x, 6.54, 1.1], recess);
        box(g, [2.6, 0.035, 1.15], [x, 6.46, 1.1], warm);
      }
    }
  }
  for (const s of [94.8, 135.2]) {
    const g = at(s);
    box(g, [43, 1.05, 1], [0, 6.97, 0], blue);
    box(g, [43.4, 0.4, 1.35], [0, 7.4, 0], trim);
    for (const x of [-20, 20]) {
      box(g, [3.4, 6.6, 2], [x, 3.3, 0], concrete);
      box(g, [3.7, 0.7, 2.3], [x, 0.35, 0], trim);
    }
  }
}
