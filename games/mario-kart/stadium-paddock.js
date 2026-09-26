/** Trackside hospitality and landmark details derived from the playback review. */
import * as THREE from "three";
import { buildServiceCompound } from "./stadium-service.js";
import { surfaceAt, project, trackAt } from "./track.js";
export function buildPaddock(
  world,
  { mesh, box, standard, basic, canvasTexture },
) {
  const concrete = standard("#a9a995", { roughness: 0.88 }),
    blue = standard("#1e408b", { roughness: 0.52 }),
    steel = standard("#677480", { metalness: 0.68, roughness: 0.37 }),
    warm = standard("#e0d0a5", {
      emissive: "#d9d1a9",
      emissiveIntensity: 0.25,
      roughness: 0.7,
    }),
    gold = standard("#bca144", { metalness: 0.3, roughness: 0.52 }),
    glow = new THREE.MeshBasicMaterial({
      color: new THREE.Color("#edf7fa").multiplyScalar(2.6),
    });
  const windows = canvasTexture(1024, 512, (c, w, h) => {
    c.fillStyle = "#173445";
    c.fillRect(0, 0, w, h);
    for (let b = 0; b < 6; b++) {
      const x = (b * w) / 6,
        warm = b % 3 === 0;
      const g = c.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, warm ? "#a49877" : "#7092a2");
      g.addColorStop(0.34, warm ? "#5d655e" : "#294658");
      g.addColorStop(1, "#122737");
      c.fillStyle = g;
      c.fillRect(x + 7, 8, w / 6 - 14, h - 16);
      c.fillStyle = warm ? "#f3da9c" : "#bbdef0";
      c.fillRect(x + 19, 38, w / 6 - 38, 6);
      c.fillStyle = "#0b1e2a";
      c.fillRect(x + 16, 331, w / 6 - 32, 9);
      c.fillRect(x + 30, 278, 38, 53);
      c.fillRect(x + 95, 290, 28, 41);
      c.fillStyle = "#dae7ef18";
      c.beginPath();
      c.moveTo(x + 87, 0);
      c.lineTo(x + 160, 0);
      c.lineTo(x + 75, h);
      c.lineTo(x + 36, h);
      c.fill();
      c.fillStyle = "#092536";
      c.fillRect(x, 0, 6, h);
    }
  });
  const litGlass = standard("#b8cad1", {
    map: windows,
    emissiveMap: windows,
    emissive: "#d8dfcc",
    emissiveIntensity: 0.22,
    metalness: 0.23,
    roughness: 0.3,
  });
  const bannerMap = canvasTexture(512, 1024, (c, w, h) => {
    const gradient = c.createLinearGradient(0, 0, w, h);
    gradient.addColorStop(0, "#315eb1");
    gradient.addColorStop(1, "#111e4c");
    c.fillStyle = gradient;
    c.fillRect(0, 0, w, h);
    c.strokeStyle = "#d2b953";
    c.lineWidth = 12;
    c.strokeRect(20, 20, w - 40, h - 40);
    // Stylised mushroom trophy, deliberately authored here rather than a screenshot texture.
    c.fillStyle = "#ceb565";
    c.beginPath();
    c.moveTo(184, 360);
    c.lineTo(328, 360);
    c.lineTo(299, 572);
    c.lineTo(276, 623);
    c.lineTo(276, 690);
    c.lineTo(340, 730);
    c.lineTo(172, 730);
    c.lineTo(236, 690);
    c.lineTo(236, 623);
    c.lineTo(214, 572);
    c.closePath();
    c.fill();
    c.strokeStyle = "#e9d28c";
    c.lineWidth = 20;
    c.beginPath();
    c.ellipse(256, 375, 156, 127, 0, 0, Math.PI * 2);
    c.stroke();
    c.fillStyle = "#fff2cb";
    c.beginPath();
    c.ellipse(256, 318, 104, 70, 0, 0, 7);
    c.fill();
    c.fillStyle = "#d54c38";
    c.beginPath();
    c.ellipse(256, 295, 101, 58, 0, Math.PI, Math.PI * 2);
    c.fill();
    c.fillStyle = "#fff2cb";
    for (const x of [207, 256, 305]) {
      c.beginPath();
      c.arc(x, 268, 13, 0, 7);
      c.fill();
    }
    c.fillStyle = "#112349";
    for (const x of [242, 270]) c.fillRect(x, 320, 8, 21);
    c.fillStyle = "#fff4d2";
    c.textAlign = "center";
    c.font = "italic 900 46px Arial";
    c.fillText("COGUMELO", 256, 842);
    c.font = "900 64px Arial";
    c.fillText("CUP", 256, 912);
  });
  const banner = new THREE.MeshStandardMaterial({
    map: bannerMap,
    roughness: 0.75,
    emissive: "#5378ad",
    emissiveMap: bannerMap,
    emissiveIntensity: 0.15,
    side: THREE.DoubleSide,
  });
  const fascia = canvasTexture(1024, 128, (c, w, h) => {
    c.fillStyle = "#e1d4a8";
    c.fillRect(0, 0, w, h);
    c.fillStyle = "#23394f";
    c.font = "italic 900 76px Arial";
    c.textBaseline = "middle";
    c.fillText("MKTV", 25, 65);
    c.font = "italic 900 46px Arial";
    c.fillText("ESTÁDIO MARIO KART", 300, 64);
    c.fillStyle = "#d3af35";
    c.fillRect(0, 114, w, 14);
  });
  const fasciaMat = standard("#ffffff", {
    map: fascia,
    emissive: "#e3dcba",
    emissiveMap: fascia,
    emissiveIntensity: 0.4,
    roughness: 0.6,
  });
  // Long near-field building follows the climb. Its overhang, suites and banners
  // occupy the right side of the frame seen in the MK8 reference.
  for (let s = 445; s <= 630; s += 15) {
    const p = surfaceAt(s, 36),
      g = new THREE.Group();
    g.position.set(p.x, 0, p.z);
    g.rotation.y = -p.heading;
    if (project(p.x, p.z).d2 < 31 ** 2) continue;
    const top = 58 + Math.max(0, (s - 500) * 0.065);
    world.add(g);
    box(g, [25, top, 15.6], [0, top / 2, 0], concrete);
    box(g, [0.45, 4.5, 15.5], [-12.8, 3, 0], blue);
    for (let floor = 0; floor < 4; floor++) {
      const y = 9 + floor * 11;
      box(g, [0.25, 6.4, 13.5], [-12.9, y, 0], litGlass);
      // Curve-following modules expose their ends during the approach; clad
      // those faces too, rather than leaving giant blank concrete polygons.
      for (const end of [-1, 1]) {
        box(g, [22.6, 6.4, 0.15], [0, y, end * 7.87], litGlass);
        box(g, [25.3, 0.85, 0.5], [0, y + 4.2, end * 7.9], blue);
        for (const x of [-10, -5, 0, 5, 10])
          box(g, [0.23, 6.7, 0.3], [x, y, end * 7.98], steel);
      }
      for (const z of [-6, -2, 2, 6])
        box(g, [0.35, 6.7, 0.23], [-13.2, y, z], steel);
      box(g, [1.7, 0.85, 15.9], [-13, y + 4.2, 0], blue);
      box(g, [0.2, 0.2, 14.4], [-13.9, y + 3.65, 0], glow);
    }
    box(g, [33, 1.3, 16.2], [-2, top, 0], concrete);
    box(g, [0.5, 2.4, 16.2], [-18.3, top - 0.55, 0], gold);
    const sign = mesh(new THREE.PlaneGeometry(15.4, 2.1), fasciaMat, g, [
      -18.62,
      top - 0.6,
      0,
    ]);
    sign.rotation.y = -Math.PI / 2;
    for (const z of [-6, 6]) {
      box(g, [0.7, top, 1.1], [-13.3, top / 2, z], concrete);
      const start = new THREE.Vector3(-12, top - 7, z),
        end = new THREE.Vector3(-19, top - 1, z),
        d = end.clone().sub(start);
      const truss = mesh(
        new THREE.CylinderGeometry(0.22, 0.22, d.length(), 8),
        steel,
        g,
        start.clone().add(end).multiplyScalar(0.5).toArray(),
      );
      truss.quaternion.setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        d.normalize(),
      );
    }
    if (Math.round((s - 445) / 15) % 3 === 0) {
      const flag = mesh(new THREE.PlaneGeometry(6.3, 13), banner, g, [
        -14.2,
        top - 11,
        0,
      ]);
      flag.rotation.y = -Math.PI / 2;
    }
  }
  const compound = buildServiceCompound(world, {
    mesh,
    box,
    standard,
    canvasTexture,
  });
  // Green pipes and warm landscaped runoff frame the landing, replacing trucks
  // as the nearest recognisable infield detail.
  const pipe = standard("#279247", { roughness: 0.36, metalness: 0.12 }),
    inside = standard("#123f2a", { roughness: 0.94 });
  for (const [s, side] of [
    [1180, -1],
    [1200, -1],
    [1225, -1],
    [1260, -1],
    [1280, -1],
    [90, 1],
    [120, 1],
  ]) {
    const p = surfaceAt(s, side * 29);
    if (project(p.x, p.z).d2 < 22 ** 2) continue;
    // Keep the pipe's 2.15m lip outside the cup pylons and their light strips.
    const occupied = world.children.some((object) => {
      const service = object.name === "landing-service-compound";
      if (!service && object.name !== "landing-cup-pylon") return false;
      object.updateWorldMatrix(true, false);
      const local = object.worldToLocal(new THREE.Vector3(p.x, 0, p.z));
      return (
        Math.abs(local.x) < (service ? 20.5 : 7.8) &&
        Math.abs(local.z) < (service ? 24.5 : 7.5)
      );
    });
    if (occupied) continue;
    const g = new THREE.Group();
    g.position.set(p.x, -0.2, p.z);
    world.add(g);
    mesh(new THREE.CylinderGeometry(1.9, 1.9, 3.7, 32), pipe, g, [0, 1.85, 0]);
    mesh(new THREE.CylinderGeometry(2.15, 2.15, 1, 32), pipe, g, [0, 3.8, 0]);
    const hole = mesh(
      new THREE.CircleGeometry(1.72, 32),
      inside,
      g,
      [0, 4.31, 0],
    );
    hole.rotation.x = -Math.PI / 2;
    const lip = mesh(
      new THREE.TorusGeometry(1.95, 0.2, 8, 32),
      pipe,
      g,
      [0, 4.3, 0],
    );
    lip.rotation.x = Math.PI / 2;
  }
  return compound;
}
