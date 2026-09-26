/** Close-range architectural layers, authored around the existing driving line. */
import * as THREE from "three";
import { stadiumBrand } from "./stadium-brands.js";
import { surfaceAt, trackAt, project } from "./track.js";
import { proceduralKart } from "./models.js";
export function buildArchitecture(
  world,
  { mesh, box, standard, basic, signTexture, canvasTexture },
) {
  const dark = standard("#182439", { metalness: 0.5, roughness: 0.4 }),
    steel = standard("#7c94a4", { metalness: 0.72, roughness: 0.3 }),
    white = standard("#d5deda"),
    glass = standard("#17334b", { metalness: 0.7, roughness: 0.19 });
  const luminous = new THREE.MeshBasicMaterial({
    color: new THREE.Color("#a9eaff").multiplyScalar(2.4),
  });
  const gold = standard("#d2a457", { metalness: 0.65, roughness: 0.32 });
  const rod = (parent, a, b, r, mat) => {
    const av = new THREE.Vector3(...a),
      bv = new THREE.Vector3(...b),
      d = bv.clone().sub(av);
    const m = mesh(
      new THREE.CylinderGeometry(r, r, d.length(), 8),
      mat,
      parent,
      av.clone().add(bv).multiplyScalar(0.5).toArray(),
    );
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
    return m;
  };
  const panel = (parent, w, h, pos, text, bg, sub, angle = 0) => {
    const m = mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({
        map: signTexture(text, bg, "#fff", sub),
        side: THREE.DoubleSide,
      }),
      parent,
      pos,
    );
    m.rotation.y = angle;
    return m;
  };
  // Stadium hero tower outside the climbing road, with a rounded layered base,
  // wraparound title band, lit windows, metal cornices and the Mario sculpture.
  const tp = surfaceAt(715, 45),
    tower = new THREE.Group();
  tower.position.set(tp.x, 0, tp.z);
  world.add(tower);
  mesh(new THREE.CylinderGeometry(17, 22, 6, 64), dark, tower, [0, 3, 0]);
  for (let y = 6; y < 53; y += 5) {
    mesh(new THREE.CylinderGeometry(17, 17, 4.9, 64), white, tower, [
      0,
      y + 2.4,
      0,
    ]);
    mesh(new THREE.CylinderGeometry(17.25, 17.25, 0.5, 64), steel, tower, [
      0,
      y + 4.8,
      0,
    ]);
    for (let i = 0; i < 24; i++) {
      const a = (i * Math.PI * 2) / 24,
        g = new THREE.Group();
      g.position.set(Math.sin(a) * 17.1, y + 2.2, Math.cos(a) * 17.1);
      g.rotation.y = a;
      tower.add(g);
      box(g, [2.5, 2.4, 0.08], [0, 0, 0], glass);
      box(g, [2.35, 0.07, 0.12], [0, 1.27, 0], luminous);
    }
  }
  const band = canvasTexture(2048, 256, (c, w, h) => {
    c.fillStyle = "#5d1946";
    c.fillRect(0, 0, w, h);
    c.fillStyle = "#fff3c5";
    c.font = "900 130px Arial";
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.fillText("ESTÁDIO MARIO KART", w / 2, h / 2 + 7);
    c.fillStyle = "#edc070";
    c.fillRect(0, 0, w, 6);
    c.fillRect(0, h - 6, w, 6);
  });
  band.wrapS = THREE.RepeatWrapping;
  band.repeat.x = 2;
  const ring = mesh(
    new THREE.CylinderGeometry(18, 18, 7, 96, 1, true),
    new THREE.MeshStandardMaterial({
      map: band,
      color: "#ffffff",
      emissive: "#df829a",
      emissiveMap: band,
      emissiveIntensity: 0.5,
      roughness: 0.45,
    }),
    tower,
    [0, 56, 0],
  );
  ring.rotation.y = 1;
  mesh(
    new THREE.CylinderGeometry(19.2, 19.2, 1.1, 64),
    gold,
    tower,
    [0, 60, 0],
  );
  mesh(new THREE.CylinderGeometry(16, 18.8, 3, 64), dark, tower, [0, 62, 0]);
  const statue = new THREE.Group();
  statue.add(proceduralKart("mario"));
  statue.userData.dynamicScenery = true;
  statue.scale.setScalar(7.6);
  statue.position.y = 63;
  statue.rotation.y = 1.75;
  tower.add(statue);
  for (let i = 0; i < 12; i++) {
    const a = (i * Math.PI) / 6;
    mesh(new THREE.SphereGeometry(0.35, 8, 6), luminous, tower, [
      Math.sin(a) * 18.1,
      60.8,
      Math.cos(a) * 18.1,
    ]);
  }
  // Infield service paddock: team transporters, small awnings and flags add
  // recognisable racing scale to the aerial return without filling the route.
  const teamPaint = [
    standard("#bc283e"),
    standard("#287ab0"),
    standard("#418653"),
  ];
  const tire = standard("#172027");
  for (let i = 0; i < 9; i++) {
    const x = -65 + (i % 3) * 24,
      z = -15 + Math.floor(i / 3) * 29;
    if (Math.abs(project(x, z).lateral) < 40) continue;
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.rotation.y = 0.2;
    world.add(g);
    box(g, [7, 4, 12], [0, 2.3, 0], white);
    box(g, [6.8, 3.5, 4], [0, 2.05, -8], teamPaint[i % 3]);
    box(g, [6.5, 1.5, 0.1], [0, 3.1, -10.06], glass);
    for (const side of [-1, 1]) {
      for (const z of [-7.5, 3.5]) {
        const w = mesh(new THREE.CylinderGeometry(1, 1, 0.7, 12), tire, g, [
          side * 3.6,
          1,
          z,
        ]);
        w.rotation.z = Math.PI / 2;
      }
      panel(
        g,
        10,
        2,
        [side * 3.55, 2.8, 0],
        ["MOTORES MARIO", "MKTV", "COPA COGUMELO"][i % 3],
        ["#aa2235", "#183f63", "#347541"][i % 3],
        "EQUIPE DE CORRIDA",
        (side * Math.PI) / 2,
      );
    }
    const roof = mesh(
      new THREE.ConeGeometry(5, 2.5, 4),
      teamPaint[i % 3],
      g,
      [11, 5, 1],
    );
    roof.rotation.y = Math.PI / 4;
    for (const x of [8, 14])
      for (const z of [-2, 4]) rod(g, [x, 0, z], [x, 4, z], 0.07, white);
    rod(g, [17, 0, 4], [17, 12, 4], 0.08, steel);
    const flag = mesh(
      new THREE.PlaneGeometry(4, 2.6),
      new THREE.MeshBasicMaterial({
        map: signTexture(
          "M",
          ["#b42136", "#174b88", "#397b48"][i % 3],
          "#fff",
          "",
        ),
        side: THREE.DoubleSide,
      }),
      g,
      [19, 10.5, 4],
    );
    flag.rotation.y = 0.25;
  }
  // Substantial red/purple housings and a 4:3 display match the reference boards.
  const screenTex = canvasTexture(1024, 768, (c, w, h) => {
    c.fillStyle = "#f1eedb";
    c.fillRect(0, 0, w, h);
    c.drawImage(stadiumBrand("MKTV", canvasTexture).image, 0, 240, w, 256);
    c.strokeStyle = "#252c31";
    c.lineWidth = 15;
    c.lineJoin = "round";
    c.beginPath();
    c.roundRect(145, 110, 158, 108, 28);
    c.stroke();
    for (const x of [184, 263]) {
      c.beginPath();
      c.arc(x, 154, 22, 0, Math.PI * 2);
      c.stroke();
    }
    c.beginPath();
    c.moveTo(160, 218);
    c.lineTo(160, 249);
    c.lineTo(188, 249);
    c.stroke();
  });
  const capArt = canvasTexture(1024, 128, (c, w, h) => {
    c.clearRect(0, 0, w, h);
    c.fillStyle = "#fff3d8";
    c.font = "italic 900 94px Arial Black, Arial";
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.fillText("MARIOKART", w / 2, h / 2, 940);
  });
  const columnArt = canvasTexture(128, 1024, (c, w, h) => {
    c.fillStyle = "#30256a";
    c.fillRect(0, 0, w, h);
    c.translate(w / 2, h / 2);
    c.rotate(Math.PI / 2);
    c.fillStyle = "#d2bb73";
    c.font = "700 78px Arial";
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.fillText("COPA COGUMELO", 0, 0, 935);
  });
  const purple = standard("#30256a", { metalness: 0.25, roughness: 0.48 }),
    capRed = standard("#a42b3b", { metalness: 0.35, roughness: 0.42 }),
    capLabel = new THREE.MeshBasicMaterial({
      map: capArt,
      transparent: true,
      depthWrite: false,
    }),
    columnLabel = new THREE.MeshBasicMaterial({ map: columnArt });
  const screenMaterials = [];
  for (const [s, side, live] of [
    [343, -1, false],
    [390, -1, true],
    [1030, 1, true],
  ]) {
    const p = surfaceAt(s, side * 55),
      g = new THREE.Group();
    g.name = "stadium-broadcast-board";
    g.position.set(p.x, 0, p.z);
    g.rotation.y = -p.heading + (side > 0 ? -Math.PI / 2 : Math.PI / 2);
    world.add(g);
    for (const x of [-10, 10]) {
      box(g, [2, 17, 2.8], [x, 8.5, 0], dark);
      box(g, [6, 1.1, 5], [x, 0.55, 0], steel);
    }
    box(g, [34.2, 26.2, 2], [0, 30, 0], dark);
    box(g, [38.8, 3.2, 3.5], [0, 44.5, 0], capRed);
    box(g, [38.4, 1.1, 3.1], [0, 16.8, 0], gold);
    for (const x of [-18, 18]) box(g, [3.4, 28, 3], [x, 30, 0], purple);
    for (const faceSide of [-1, 1]) {
      const screen = mesh(
        new THREE.PlaneGeometry(32, 24),
        new THREE.MeshBasicMaterial({ map: screenTex }),
        g,
        [0, 30, faceSide * 1.05],
      );
      screen.name = live ? "stadium-live-screen" : "stadium-standby-screen";
      screen.rotation.y = faceSide < 0 ? Math.PI : 0;
      if (live) screenMaterials.push(screen.material);
      const title = mesh(new THREE.PlaneGeometry(29, 2.45), capLabel, g, [
        0,
        44.5,
        faceSide * 1.78,
      ]);
      title.rotation.y = screen.rotation.y;
      for (const x of [-18, 18]) {
        const edge = mesh(new THREE.PlaneGeometry(2.9, 26), columnLabel, g, [
          x,
          30,
          faceSide * 1.54,
        ]);
        edge.rotation.y = screen.rotation.y;
      }
    }
  }
  // Large trackside chevrons provide near-field scale and clarify turn direction.
  const arrow = canvasTexture(256, 128, (c, w, h) => {
    c.fillStyle = "#0b2238";
    c.fillRect(0, 0, w, h);
    c.fillStyle = "#e8e4a1";
    for (let x = -20; x < w; x += 85) {
      c.beginPath();
      c.moveTo(x, 8);
      c.lineTo(x + 45, 8);
      c.lineTo(x + 95, 64);
      c.lineTo(x + 45, 120);
      c.lineTo(x, 120);
      c.lineTo(x + 50, 64);
      c.fill();
    }
  });
  for (const s of [200, 225, 250, 320, 345, 365, 800, 825, 870, 1220, 1245]) {
    const p = surfaceAt(s, -15.2),
      m = mesh(
        new THREE.PlaneGeometry(8, 1.3),
        new THREE.MeshBasicMaterial({ map: arrow, side: THREE.DoubleSide }),
        world,
        [p.x, p.y + 1.25, p.z],
      );
    m.rotation.y = -p.heading + Math.PI / 2;
  }
  return { tower, statue, screenMaterials };
}
