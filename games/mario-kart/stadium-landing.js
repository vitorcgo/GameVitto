import * as THREE from "three";
import { surfaceAt, SECTIONS, controlDistances } from "./track.js";

/** Static diffuse illumination stays attached to the sand and adds no lights
 * to the per-frame shader loop. UVs match the course ribbon's metre spacing. */
export function landingLightMap(canvasTexture, side) {
  const start = SECTIONS.glideEnd,
    end = controlDistances[24],
    length = end - start;
  const texture = canvasTexture(256, 2048, (c, w, h) => {
    c.fillStyle = "#000";
    c.fillRect(0, 0, w, h);
    c.save();
    c.scale(w / 4.5, h / length);
    for (let s = start + 6; s < end - 8; s += 17) {
      const y = s - start;
      const glow = c.createRadialGradient(2.8, y, 0.1, 2.8, y, 5.5);
      glow.addColorStop(0, "#fff");
      glow.addColorStop(0.2, "#dedede");
      glow.addColorStop(0.55, "#777");
      glow.addColorStop(1, "#000");
      c.fillStyle = glow;
      c.fillRect(0, y - 5.5, 4.5, 11);
    }
    c.restore();
  });
  // Canvas rows increase with route distance, just like the ribbon's V.
  texture.flipY = false;
  texture.repeat.set(side < 0 ? -1 : 1, 8 / length);
  texture.offset.set(side < 0 ? 1 : 0, -start / length);
  return texture;
}

/** The sandy landing straight is framed by warm bollards and wire fencing. */
export function buildLanding(world, { mesh, box, standard, canvasTexture }) {
  const steel = standard("#65747b", { metalness: 0.65, roughness: 0.38 }),
    base = standard("#5c6465"),
    warm = new THREE.MeshBasicMaterial({
      color: new THREE.Color("#fff0c3").multiplyScalar(2.1),
    });
  const wire = canvasTexture(128, 128, (c, w, h) => {
    c.clearRect(0, 0, w, h);
    c.strokeStyle = "#82918e";
    c.lineWidth = 2.4;
    for (let x = -w; x <= w * 2; x += 32) {
      c.beginPath();
      c.moveTo(x, 0);
      c.lineTo(x + w, h);
      c.stroke();
      c.beginPath();
      c.moveTo(x, 0);
      c.lineTo(x - w, h);
      c.stroke();
    }
  });
  wire.wrapS = wire.wrapT = THREE.RepeatWrapping;
  wire.repeat.set(6, 1.8);
  wire.anisotropy = 8;
  const fenceMat = standard("#88938f", {
    map: wire,
    alphaTest: 0.4,
    side: THREE.DoubleSide,
    roughness: 0.72,
  });
  const end = controlDistances[24] - 8;
  for (let s = SECTIONS.glideEnd; s < end; s += 9) {
    for (const side of [-1, 1]) {
      const p = surfaceAt(s, side * 17.3),
        g = new THREE.Group();
      g.position.set(p.x, p.y, p.z);
      g.rotation.y = -p.heading;
      world.add(g);
      box(g, [0.13, 4.3, 0.13], [0, 2.15, 0], steel);
      box(g, [0.15, 0.14, 9.15], [0, 4.25, -4.5], steel);
      const fence = mesh(
        new THREE.PlaneGeometry(9.05, 2.1),
        fenceMat,
        g,
        [0, 3.15, -4.5],
      );
      fence.rotation.y = Math.PI / 2;
      fence.castShadow = false;
    }
  }
  for (let s = SECTIONS.glideEnd + 6; s < end; s += 17) {
    for (const side of [-1, 1]) {
      const p = surfaceAt(s, side * 12.8),
        g = new THREE.Group();
      g.position.set(p.x, p.y, p.z);
      world.add(g);
      mesh(
        new THREE.CylinderGeometry(0.29, 0.36, 0.16, 12),
        base,
        g,
        [0, 0.08, 0],
      );
      mesh(
        new THREE.CylinderGeometry(0.17, 0.22, 1.5, 12),
        steel,
        g,
        [0, 0.88, 0],
      );
      for (const y of [1.25, 1.46, 1.67])
        mesh(new THREE.CylinderGeometry(0.215, 0.215, 0.12, 12), warm, g, [
          0,
          y,
          0,
        ]);
      mesh(
        new THREE.CylinderGeometry(0.25, 0.25, 0.11, 12),
        steel,
        g,
        [0, 1.82, 0],
      );
    }
  }
}
