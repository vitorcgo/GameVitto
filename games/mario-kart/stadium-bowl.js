import { spectatorAtlas } from "./stadium-crowd.js";
import { STADIUM_BRANDS, stadiumBrand } from "./stadium-brands.js";
/** Continuous three-tier stadium, fitted to the actual course footprint. */
import * as THREE from "three";
import {
  TRACK_SAMPLES,
  TRACK_LENGTH,
  surfaceAt,
  project,
  SECTIONS,
} from "./track.js";
import { roadFrame } from "./visual-frame.js";

// Monotone convex hull gives the bowl an architectural boundary rather than a
// distant circular fence. Offset joints are intersected, so tiers have no gaps.
function hull(points) {
  const p = points
    .map((v) => ({ x: v.x, z: v.z }))
    .sort((a, b) => a.x - b.x || a.z - b.z);
  const cross = (a, b, c) =>
    (b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x);
  const half = (arr) => {
    const h = [];
    for (const v of arr) {
      while (h.length > 1 && cross(h.at(-2), h.at(-1), v) <= 0) h.pop();
      h.push(v);
    }
    return h;
  };
  return [...half(p).slice(0, -1), ...half(p.reverse()).slice(0, -1)];
}
const outline = hull(TRACK_SAMPLES.filter((_, i) => i % 8 === 0));
function offset(d) {
  return outline.map((p, i) => {
    const a = outline[(i + outline.length - 1) % outline.length],
      b = outline[(i + 1) % outline.length];
    const l1 = Math.hypot(p.x - a.x, p.z - a.z),
      l2 = Math.hypot(b.x - p.x, b.z - p.z);
    const n1 = { x: (p.z - a.z) / l1, z: -(p.x - a.x) / l1 },
      n2 = { x: (b.z - p.z) / l2, z: -(b.x - p.x) / l2 };
    const den = 1 + n1.x * n2.x + n1.z * n2.z;
    return {
      x: p.x + (d * (n1.x + n2.x)) / den,
      z: p.z + (d * (n1.z + n2.z)) / den,
    };
  });
}
export function buildStadiumBowl(
  world,
  { mesh, box, standard, basic, canvasTexture },
) {
  const concrete = standard("#a4a79b", { roughness: 0.94 }),
    navy = standard("#263c75", { roughness: 0.6 }),
    steel = standard("#61758d", { metalness: 0.65, roughness: 0.36 }),
    dark = standard("#1d2537"),
    glow = new THREE.MeshBasicMaterial({
      color: new THREE.Color("#fff3ca").multiplyScalar(2.2),
    });
  let seed = 987;
  const rand = () =>
    ((seed = (Math.imul(seed, 1664525) + 1013904223) | 0) >>> 0) / 4294967296;
  const fans = spectatorAtlas(canvasTexture);
  fans.wrapS = fans.wrapT = THREE.RepeatWrapping;
  fans.anisotropy = 8;
  const crowd = standard("#bec3c9", {
    map: fans,
    alphaTest: 0.45,
    roughness: 0.9,
    emissive: "#c4d0dc",
    emissiveMap: fans,
    emissiveIntensity: 0.12,
  });
  function band(d1, y1, d2, y2, material, uvScale = 12, v0 = 0, v1 = 1) {
    const a = offset(d1),
      b = offset(d2),
      pos = [],
      uv = [],
      ind = [];
    let run = 0;
    for (let i = 0; i <= a.length; i++) {
      const j = i % a.length;
      if (i) {
        const prev = a[(i - 1) % a.length];
        run += Math.hypot(a[j].x - prev.x, a[j].z - prev.z);
      }
      pos.push(a[j].x, y1, a[j].z, b[j].x, y2, b[j].z);
      uv.push(run / uvScale, v0, run / uvScale, v1);
      if (i) {
        const n = i * 2;
        ind.push(n - 2, n, n - 1, n, n + 1, n - 1);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(ind);
    g.computeVertexNormals();
    const m = mesh(g, material, world);
    m.material.side = THREE.DoubleSide;
    return m;
  }
  // Structural walls and three spectator decks, with suites between the tiers.
  band(29, -0.3, 29, 6, navy);
  for (let tier = 0; tier < 3; tier++) {
    const y = 6 + tier * 19,
      d = 29 + tier * 7;
    // Real treads/risers give the spectators an upright silhouette in motion.
    // One atlas row per physical row, rather than people painted onto a ramp.
    for (let row = 0; row < 16; row++) {
      const rd = d + (row * 17) / 16,
        ry = y + (row * 11.5) / 16;
      band(rd, ry, rd + 17 / 16, ry, navy);
      band(rd + 17 / 16, ry, rd + 17 / 16, ry + 11.5 / 16, dark);
      const spectator = band(
        rd + 0.7,
        ry + 0.03,
        rd + 0.7,
        ry + 1.22,
        crowd,
        45,
        (row % 8) / 8,
        ((row % 8) + 1) / 8,
      );
      spectator.castShadow = false;
    }
    band(d + 17, y + 11.5, d + 20, y + 11.5, concrete);
    band(d + 20, y + 11.5, d + 20, y + 17, dark);
    band(d + 19.5, y + 12, d + 19.5, y + 12.6, glow);
    band(d + 19.5, y + 16.2, d + 19.5, y + 16.6, glow);
    band(d + 19, y + 17, d + 19, y + 18.8, navy);
  }
  band(36, 66, 75, 72, concrete);
  band(36, 64.8, 36, 66.5, navy);
  band(36, 64.6, 36, 65, glow);
  const suiteTexture = canvasTexture(1024, 256, (c, w, h) => {
    c.fillStyle = "#172e40";
    c.fillRect(0, 0, w, h);
    for (let bay = 0; bay < 8; bay++) {
      const x = bay * 128,
        warm = bay % 3 === 0;
      const g = c.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, warm ? "#ac9971" : "#547181");
      g.addColorStop(0.45, warm ? "#5c5948" : "#273c4c");
      g.addColorStop(1, "#111e30");
      c.fillStyle = g;
      c.fillRect(x + 4, 5, 120, 244);
      c.fillStyle = warm ? "#e6cd96" : "#a8cddc";
      c.fillRect(x + 14, 17, 97, 4);
      c.fillStyle = "#101b28";
      c.fillRect(x + 12, 161, 100, 5);
      for (let person = 0; person < 3; person++) {
        const px = x + 25 + person * 32,
          py = 146 + rand() * 18;
        c.fillStyle = "#182638";
        c.beginPath();
        c.arc(px, py - 8, 6, 0, 7);
        c.fill();
        c.fillRect(px - 7, py, 14, 26);
      }
      c.fillStyle = "#c5dfe21c";
      c.beginPath();
      c.moveTo(x + 88, 0);
      c.lineTo(x + 122, 0);
      c.lineTo(x + 55, h);
      c.lineTo(x + 34, h);
      c.fill();
      c.fillStyle = "#071925";
      c.fillRect(x, 0, 5, h);
    }
  });
  const suiteMaterial = standard("#a1b2bf", {
    map: suiteTexture,
    emissiveMap: suiteTexture,
    emissive: "#fff4cf",
    emissiveIntensity: 0.35,
    roughness: 0.28,
    metalness: 0.28,
  });
  // Box seats and vertical architectural rhythm; 18m bays avoid huge blank walls.
  const inner = offset(48),
    front = offset(29),
    back = offset(75);
  for (let i = 0; i < inner.length; i++) {
    const a = inner[i],
      b = inner[(i + 1) % inner.length],
      len = Math.hypot(b.x - a.x, b.z - a.z),
      n = Math.max(1, Math.round(len / 18));
    for (let j = 0; j < n; j++) {
      const t = (j + 0.5) / n,
        x = a.x + (b.x - a.x) * t,
        z = a.z + (b.z - a.z) * t,
        ang = -Math.atan2(b.z - a.z, b.x - a.x);
      const pillar = box(world, [0.9, 68, 1.1], [x, 33, z], concrete);
      pillar.rotation.y = ang;
      for (let k = 0; k < 3; k++) {
        const deck = offset(48.8 + k * 7),
          da = deck[i],
          db = deck[(i + 1) % deck.length],
          sx = da.x + (db.x - da.x) * t,
          sz = da.z + (db.z - da.z) * t;
        const suite = box(
          world,
          [Math.min(16, len / n - 1.5), 4, 0.4],
          [sx, 20.2 + k * 19, sz],
          suiteMaterial,
        );
        suite.rotation.y = ang;
        for (const dx of [-5, 0, 5]) {
          const mullion = box(
            world,
            [0.25, 4, 0.6],
            [sx + Math.cos(ang) * dx, 20.2 + k * 19, sz - Math.sin(ang) * dx],
            steel,
          );
          mullion.rotation.y = ang;
        }
      }
      const fa = front[i],
        fb = front[(i + 1) % front.length],
        ba = back[i],
        bb = back[(i + 1) % back.length];
      const p = new THREE.Vector3(
          fa.x + (fb.x - fa.x) * t,
          63,
          fa.z + (fb.z - fa.z) * t,
        ),
        q = new THREE.Vector3(
          ba.x + (bb.x - ba.x) * t,
          69,
          ba.z + (bb.z - ba.z) * t,
        );
      const dir = q.clone().sub(p),
        beam = mesh(
          new THREE.CylinderGeometry(0.32, 0.32, dir.length(), 6),
          steel,
          world,
          p.clone().add(q).multiplyScalar(0.5).toArray(),
        );
      beam.quaternion.setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        dir.normalize(),
      );
    }
  }
  // Repeat a designed sponsor atlas along the track, as in the reference.
  const sponsors = STADIUM_BRANDS.map((name) =>
    stadiumBrand(name, canvasTexture),
  );
  const sponsorMats = sponsors.map(
    (map) =>
      new THREE.MeshStandardMaterial({
        map,
        roughness: 0.6,
        emissive: "#ffffff",
        emissiveMap: map,
        emissiveIntensity: 0.26,
        side: THREE.DoubleSide,
      }),
  );
  for (let s = 0; s < TRACK_LENGTH; s += 10) {
    // The pit straight has low barriers so the open bays and crew remain visible.
    if (s < 82 || s > TRACK_LENGTH - 42) continue;
    if (s > SECTIONS.glideStart - 5 && s < SECTIONS.glideEnd + 6) continue;
    for (const side of [-1, 1]) {
      const p = surfaceAt(s, side * 16.7);
      if (project(p.x, p.z).d2 < 15.2 ** 2) continue;
      if (p.anti && s > SECTIONS.antiStart + 70) continue;
      const panel = mesh(
        new THREE.PlaneGeometry(9.7, 2.25),
        sponsorMats[Math.floor(s / 10) % sponsorMats.length],
        world,
        [p.x - p.rx * side * 0.38, p.y + 1.55, p.z - p.rz * side * 0.38],
      );
      panel.rotation.y = -p.heading + (side > 0 ? -Math.PI / 2 : Math.PI / 2);
      const frame = box(world, [0.6, 2.8, 10], [p.x, p.y + 1.4, p.z], navy);
      frame.rotation.y = -p.heading;
    }
  }
  // Warm squat path lamps have a readable lit cap, rather than white poles.
  for (let s = 15; s < TRACK_LENGTH; s += 24) {
    if (s > SECTIONS.glideStart && s < SECTIONS.glideEnd) continue;
    for (const side of [-1, 1]) {
      const p = surfaceAt(s, side * 15.4);
      if (project(p.x, p.z).d2 < 14.8 ** 2) continue;
      const g = new THREE.Group();
      g.position.set(p.x, p.y, p.z);
      world.add(g);
      const f = roadFrame(s, side * 15.4, p.heading);
      g.quaternion.setFromRotationMatrix(
        new THREE.Matrix4().makeBasis(
          new THREE.Vector3(f.right.x, f.right.y, f.right.z),
          new THREE.Vector3(f.up.x, f.up.y, f.up.z),
          new THREE.Vector3(-f.forward.x, -f.forward.y, -f.forward.z),
        ),
      );
      if (p.anti && side === 1) {
        // Outside the bank: a bent arm, recessed blue lens and pink turn marker.
        const arm = new THREE.CatmullRomCurve3([
          new THREE.Vector3(0, 0, 0),
          new THREE.Vector3(0, 3.6, 0),
          new THREE.Vector3(-0.35, 4.5, 0),
          new THREE.Vector3(-1.25, 4.9, 0),
          new THREE.Vector3(-2.25, 4.9, 0),
        ]);
        mesh(new THREE.TubeGeometry(arm, 20, 0.26, 6, false), steel, g);
        box(g, [0.8, 0.22, 0.9], [0, 0.1, 0], navy);
        const head = box(g, [1.35, 0.3, 0.95], [-2.3, 4.75, 0], dark);
        head.rotation.z = -0.25;
        const lens = box(
          g,
          [1.15, 0.07, 0.76],
          [-2.35, 4.56, 0],
          new THREE.MeshBasicMaterial({
            color: new THREE.Color("#89e8ff").multiplyScalar(2.8),
          }),
        );
        lens.rotation.z = -0.25;
        const shape = new THREE.Shape();
        shape.moveTo(0.45, 0.85);
        shape.lineTo(-0.15, 0.85);
        shape.lineTo(-1.05, 0);
        shape.lineTo(-0.15, -0.85);
        shape.lineTo(0.45, -0.85);
        shape.lineTo(-0.4, 0);
        shape.closePath();
        const marker = mesh(
          new THREE.ShapeGeometry(shape),
          new THREE.MeshBasicMaterial({
            color: new THREE.Color("#ff69d8").multiplyScalar(2.8),
            side: THREE.DoubleSide,
          }),
          g,
          [-0.1, 3.1, 4],
        );
        marker.rotation.y = -Math.PI / 2;
      } else {
        box(g, [0.6, 1.7, 0.6], [0, 0.85, 0], steel);
        box(g, [0.85, 0.65, 0.85], [0, 1.9, 0], glow);
        box(g, [1, 0.18, 1], [0, 2.3, 0], navy);
      }
    }
  }
}
