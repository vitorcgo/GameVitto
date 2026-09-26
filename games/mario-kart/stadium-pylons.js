import * as THREE from "three";
import { surfaceAt, SECTIONS } from "./track.js";

/** Large illuminated cup markers frame the glider landing in the reference. */
export function buildLandingPylons(
  world,
  { mesh, box, standard, canvasTexture },
) {
  const badge = canvasTexture(512, 512, (c, w, h) => {
    const paper = c.createLinearGradient(0, 0, 0, h);
    paper.addColorStop(0, "#fffef1");
    paper.addColorStop(1, "#e4d598");
    c.fillStyle = paper;
    c.fillRect(0, 0, w, h);
    c.strokeStyle = "#bd903d";
    c.lineWidth = 12;
    c.strokeRect(9, 9, 494, 494);
    // Two chequered flags, a gold medallion and an original mushroom drawing.
    for (const side of [-1, 1]) {
      c.save();
      c.translate(256 + side * 113, 296);
      c.rotate(side * -0.3);
      c.fillStyle = "#fff";
      c.fillRect(-85, -65, 170, 100);
      c.fillStyle = "#272a39";
      for (let x = 0; x < 7; x++)
        for (let y = 0; y < 4; y++)
          if ((x + y) % 2 === 0) c.fillRect(-85 + x * 25, -65 + y * 25, 25, 25);
      c.restore();
    }
    const disk = (x, y, r, color) => {
      c.fillStyle = color;
      c.beginPath();
      c.arc(x, y, r, 0, Math.PI * 2);
      c.fill();
    };
    disk(256, 196, 143, "#bd903d");
    disk(256, 196, 131, "#29254b");
    disk(256, 196, 117, "#e4b74f");
    disk(256, 196, 110, "#352450");
    c.fillStyle = "#f5dfa8";
    c.beginPath();
    c.roundRect(211, 188, 90, 84, 29);
    c.fill();
    c.fillStyle = "#d53940";
    c.beginPath();
    c.ellipse(256, 164, 81, 63, 0, 0, Math.PI * 2);
    c.fill();
    disk(256, 144, 24, "#fff9d9");
    disk(199, 175, 18, "#fff9d9");
    disk(313, 175, 18, "#fff9d9");
    c.fillStyle = "#302830";
    c.fillRect(234, 228, 9, 24);
    c.fillRect(269, 228, 9, 24);
    c.textAlign = "center";
    c.lineJoin = "round";
    c.font = "italic 900 57px Arial Black, Arial";
    c.lineWidth = 12;
    c.strokeStyle = "#fffdf0";
    for (const [text, y] of [
      ["COGUMELO", 393],
      ["CUP", 450],
    ]) {
      c.strokeText(text, 256, y, 452);
      c.fillStyle = "#29283b";
      c.fillText(text, 256, y, 452);
    }
  });
  const face = new THREE.MeshStandardMaterial({
    map: badge,
    emissiveMap: badge,
    emissive: "#ffffff",
    emissiveIntensity: 0.75,
    roughness: 0.52,
  });
  const charcoal = standard("#303438", { roughness: 0.48, metalness: 0.35 }),
    brass = standard("#a18b54", { metalness: 0.5, roughness: 0.35 }),
    red = standard("#9c2839", { metalness: 0.35, roughness: 0.36 }),
    glow = new THREE.MeshBasicMaterial({
      color: new THREE.Color("#e9f4ff").multiplyScalar(2.8),
    });
  for (const distance of [18, 91])
    for (const side of [-1, 1]) {
      const p = surfaceAt(SECTIONS.glideEnd + distance, side * 23.5),
        g = new THREE.Group();
      g.name = "landing-cup-pylon";
      g.position.set(p.x, p.y, p.z);
      g.rotation.y = -p.heading;
      world.add(g);
      box(g, [5, 1, 5], [0, 0.5, 0], charcoal);
      box(g, [2.2, 18, 2.2], [0, 10, 0], charcoal);
      box(g, [2.3, 0.5, 2.3], [0, 8, 0], brass);
      box(g, [9.3, 8.8, 9.3], [0, 21, 0], charcoal);
      box(g, [9.6, 0.6, 9.6], [0, 16.7, 0], brass);
      box(g, [9.8, 0.85, 9.8], [0, 25.6, 0], red);
      for (let i = 0; i < 4; i++) {
        const angle = (i * Math.PI) / 2;
        const panel = mesh(new THREE.PlaneGeometry(8.8, 8.25), face, g, [
          Math.sin(angle) * 4.67,
          21,
          Math.cos(angle) * 4.67,
        ]);
        panel.rotation.y = angle;
      }
      for (const x of [-5.25, 5.25]) {
        box(g, [0.65, 28, 0.85], [x, 14, 4.7], charcoal);
        box(g, [0.42, 26.5, 0.12], [x, 14.1, 5.15], glow);
        box(g, [0.8, 0.4, 1], [x, 28, 4.7], brass);
      }
    }
}
