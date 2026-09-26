import { buildLanding, landingLightMap } from "./stadium-landing.js";
import { buildPlanting } from "./stadium-planting.js";
import { buildLandingPylons } from "./stadium-pylons.js";
import { buildUnderpass } from "./stadium-underpass.js";
import { buildPitlane } from "./stadium-pitlane.js";
import { buildLandmark } from "./stadium-landmark.js";
import { buildPaddock } from "./stadium-paddock.js";
import { buildStadiumBowl } from "./stadium-bowl.js";
import * as THREE from "three";
import { mergeGeometries } from "/vendor/three-examples/utils/BufferGeometryUtils.js";
import {
  TRACK_LENGTH as L,
  trackAt,
  surfaceAt,
  ROAD_HALF,
  WALL_HALF,
  BOOST_PADS,
  SECTIONS,
  controlDistances,
} from "./track.js";
import { seeded } from "./logic.js";
import { proceduralKart } from "./models.js";
import { pavementMaps, roadMaterial } from "./materials.js";
import { roadFrame } from "./visual-frame.js";
import { buildArchitecture } from "./stadium-architecture.js";
const rng = seeded(611),
  V = THREE.Vector3;
const materialCache = new Map();
const standard = (c, extra = {}) => {
  const key = Object.keys(extra).length ? null : "std" + c;
  if (key && materialCache.has(key)) return materialCache.get(key);
  const m = new THREE.MeshStandardMaterial({
    color: c,
    roughness: 0.65,
    ...extra,
  });
  if (key) materialCache.set(key, m);
  return m;
};
const basic = (c) => {
  if (!materialCache.has(c))
    materialCache.set(c, new THREE.MeshBasicMaterial({ color: c }));
  return materialCache.get(c);
};
export function canvasTexture(w, h, draw) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  draw(c.getContext("2d"), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}
function grass() {
  return canvasTexture(256, 256, (c, w, h) => {
    c.fillStyle = "#29653c";
    c.fillRect(0, 0, w, h);
    for (let i = 0; i < 12000; i++) {
      c.fillStyle = ["#487d35", "#285132", "#396130"][i % 3];
      c.fillRect(rng() * w, rng() * h, 1, 3);
    }
  });
}
export function signTexture(
  text,
  bg = "#1252a0",
  fg = "#fff",
  sub = "COPA COGUMELO",
) {
  return canvasTexture(1024, 256, (c, w, h) => {
    c.fillStyle = bg;
    c.fillRect(0, 0, w, h);
    c.fillStyle = "#ffffff16";
    for (let i = -h; i < w; i += 50) {
      c.beginPath();
      c.moveTo(i, 0);
      c.lineTo(i + 110, 0);
      c.lineTo(i + 110 - h, h);
      c.lineTo(i - h, h);
      c.fill();
    }
    c.fillStyle = fg;
    c.textAlign = "center";
    c.font = "italic 900 105px Arial";
    c.fillText(text, w / 2, 142, w - 50);
    c.font = "700 30px Arial";
    c.fillText(sub, w / 2, 205);
    c.fillRect(0, 0, w, 5);
    c.fillRect(0, h - 5, w, 5);
  });
}
function mesh(geo, mat, parent, pos = [0, 0, 0]) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(...pos);
  parent.add(m);
  m.castShadow = geo.type !== "PlaneGeometry";
  m.receiveShadow = true;
  return m;
}
function box(parent, size, pos, mat) {
  return mesh(new THREE.BoxGeometry(...size), mat, parent, pos);
}
function ribbon(start, end, left, right, mat, height = 0.03, step = 2) {
  const pos = [],
    uv = [],
    indices = [];
  let n = 0;
  for (let s = start; s < end + step; s += step) {
    const at = Math.min(s, end);
    for (const l of [left, right]) {
      const p = surfaceAt(at, l);
      pos.push(p.x, p.y + height, p.z);
      uv.push((l - left) / (right - left), at / 8);
    }
    if (n) {
      const i = n * 2;
      indices.push(i - 2, i - 1, i, i, i - 1, i + 1);
    }
    n++;
    if (at === end) break;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(indices);
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, mat);
  m.receiveShadow = true;
  return m;
}
export function buildWorld(scene) {
  const world = new THREE.Group();
  scene.add(world);
  const pavement = pavementMaps();
  const roadTex = pavement.map;
  roadTex.wrapS = roadTex.wrapT = THREE.RepeatWrapping;
  const grassTex = grass();
  grassTex.wrapS = grassTex.wrapT = THREE.RepeatWrapping;
  grassTex.repeat.set(250, 250);
  const lawnMaterial = standard("#c6d4ad", { map: grassTex, roughness: 1 });
  const shoulderFallback = grassTex.clone();
  shoulderFallback.repeat.set(1.5, 8 / 3);
  const shoulderGrass = standard("#d1d9b9", {
    map: shoulderFallback,
    roughness: 1,
  });
  // Keep a local procedural fallback until the authored turf image is ready.
  new THREE.ImageLoader().load(
    "./art/turf-v1.png",
    (image) => {
      // WebGL texture storage keeps its original dimensions. A differently
      // sized image needs a new texture object, not an in-place image swap.
      const turf = new THREE.Texture(image);
      turf.colorSpace = THREE.SRGBColorSpace;
      turf.wrapS = turf.wrapT = THREE.RepeatWrapping;
      turf.repeat.copy(grassTex.repeat);
      turf.anisotropy = 16;
      turf.needsUpdate = true;
      lawnMaterial.map = turf;
      lawnMaterial.needsUpdate = true;
      const shoulderTurf = turf.clone();
      shoulderTurf.repeat.set(1.5, 8 / 3);
      shoulderTurf.needsUpdate = true;
      shoulderGrass.map = shoulderTurf;
      shoulderGrass.needsUpdate = true;
      shoulderFallback.dispose();
      grassTex.dispose();
    },
    undefined,
    () => {},
  );
  grassTex.anisotropy = 16;
  const lawn = mesh(
    new THREE.PlaneGeometry(760, 760),
    lawnMaterial,
    world,
    [0, -0.3, 0],
  );
  lawn.rotation.x = -Math.PI / 2;
  lawn.receiveShadow = true;
  const road = roadMaterial(pavement);
  const blue = roadMaterial(pavement, "#278cbd", true),
    yellow = roadMaterial(pavement, "#dcc555", true),
    red = roadMaterial(pavement, "#ba4250", true);
  // Continuous paved shoulders carry the barrier all the way to the road.
  for (const [a, b] of [
    [0, SECTIONS.glideStart],
    [SECTIONS.glideEnd, L],
  ]) {
    world.add(
      ribbon(
        a,
        b,
        -WALL_HALF,
        -ROAD_HALF,
        roadMaterial(pavement, "#407b70"),
        -0.02,
      ),
    );
    world.add(
      ribbon(
        a,
        b,
        ROAD_HALF,
        WALL_HALF,
        roadMaterial(pavement, "#407b70"),
        -0.02,
      ),
    );
    world.add(ribbon(a, b, -WALL_HALF, WALL_HALF, standard("#26384a"), -0.65));
  }
  // The reference climb has planted shoulders between the curb and blue rail.
  for (const [left, right] of [
    [-WALL_HALF, -ROAD_HALF],
    [ROAD_HALF, WALL_HALF],
  ]) {
    world.add(
      ribbon(
        controlDistances[8],
        SECTIONS.glideStart,
        left,
        right,
        shoulderGrass,
        0.005,
      ),
    );
  }
  buildPlanting(world);
  const sandMap = canvasTexture(256, 256, (c, w, h) => {
    c.fillStyle = "#bba775";
    c.fillRect(0, 0, w, h);
    for (let i = 0; i < 42000; i++) {
      const shade = Math.floor(145 + rng() * 75);
      c.fillStyle = `rgba(${shade},${Math.floor(shade * 0.9)},${Math.floor(shade * 0.65)},0.42)`;
      c.fillRect(rng() * w, rng() * h, 1, 1);
    }
  });
  sandMap.wrapS = sandMap.wrapT = THREE.RepeatWrapping;
  sandMap.repeat.set(2, 2);
  const landingSand = standard("#fff2ce", { map: sandMap, roughness: 1 });
  // The launch deck ends above a lower paved landing corridor. In the reference,
  // flight is framed by asphalt and sandy runoff, not a long bare green void.
  for (const [left, right, material] of [
    [-10, 10, road],
    [-WALL_HALF, -ROAD_HALF, landingSand],
    [ROAD_HALF, WALL_HALF, landingSand],
  ]) {
    const lower = ribbon(
      SECTIONS.glideStart + 6,
      SECTIONS.glideEnd,
      left,
      right,
      material,
    );
    const positions = lower.geometry.attributes.position;
    for (let i = 0; i < positions.count; i++) positions.setY(i, 0.02);
    positions.needsUpdate = true;
    lower.geometry.computeVertexNormals();
    world.add(lower);
  }
  // Sand continues beyond the numerical glider gap: most of the airborne
  // chase view looks down this grounded straight, not just the first 60 metres.
  for (const [left, right] of [
    [-WALL_HALF, -ROAD_HALF],
    [ROAD_HALF, WALL_HALF],
  ]) {
    const illuminatedSand = landingSand.clone();
    illuminatedSand.emissive.set("#ffd58b");
    illuminatedSand.emissiveIntensity = 0.65;
    illuminatedSand.emissiveMap = landingLightMap(
      canvasTexture,
      Math.sign(left + right),
    );
    world.add(
      ribbon(
        SECTIONS.glideEnd,
        controlDistances[24],
        left,
        right,
        illuminatedSand,
        0.008,
      ),
    );
  }
  buildLanding(world, { mesh, box, standard, canvasTexture });
  buildLandingPylons(world, { mesh, box, standard, canvasTexture });
  // Road is genuinely interrupted at the glider jump; the launch and landing
  // deck edges stay visible. Banked surfaces share the simulation's heights.
  world.add(ribbon(0, SECTIONS.glideStart, -ROAD_HALF, ROAD_HALF, road));
  world.add(ribbon(SECTIONS.glideEnd, L, -ROAD_HALF, ROAD_HALF, road));
  for (const [start, end] of [
    [controlDistances[4], controlDistances[8]],
    [controlDistances[24], controlDistances[26]],
  ]) {
    world.add(ribbon(start, end, -10, -3.4, red, 0.055));
    world.add(ribbon(start, end, -3.4, 3.4, yellow, 0.055));
    world.add(ribbon(start, end, 3.4, 10, blue, 0.055));
  }
  const railMat = standard("#163fac", { metalness: 0.25, roughness: 0.4 }),
    white = standard("#e9e9e1"),
    curbRed = standard("#d92c46");
  const curbGeo = [[], []],
    railGeo = [],
    supportGeo = [];
  for (let s = 0; s < L; s += 3) {
    if (s > SECTIONS.glideStart && s < SECTIONS.glideEnd) continue;
    for (const side of [-1, 1]) {
      const p = surfaceAt(s, side * 10.6),
        geo = new THREE.BoxGeometry(1.15, 0.16, 3.15);
      const cf = roadFrame(s, side * 10.6, p.heading),
        cm = new THREE.Matrix4().makeBasis(
          new V(cf.right.x, cf.right.y, cf.right.z),
          new V(cf.up.x, cf.up.y, cf.up.z),
          new V(-cf.forward.x, -cf.forward.y, -cf.forward.z),
        );
      geo.applyMatrix4(cm);
      geo.translate(p.x, p.y + 0.03, p.z);
      const planted = s >= controlDistances[8] && s < SECTIONS.glideStart;
      if (planted) geo.dispose();
      else curbGeo[Math.floor(s / 3) % 2].push(geo);
      const q = surfaceAt(s, side * WALL_HALF),
        g = new THREE.BoxGeometry(0.6, 0.85, 3.2);
      g.applyMatrix4(cm);
      g.translate(q.x, q.y + 0.55, q.z);
      railGeo.push(g);
      if (Math.floor(s / 3) % 8 === 0) {
        const post = new THREE.BoxGeometry(0.5, 2, 0.5);
        post.translate(q.x, q.y + 0.8, q.z);
        supportGeo.push(post);
      }
    }
  }
  for (const [i, geo] of curbGeo.entries())
    mesh(mergeGeometries(geo), i ? white : curbRed, world);
  for (const side of [-1, 1])
    world.add(
      ribbon(
        controlDistances[8],
        SECTIONS.glideStart,
        side * 10.6 - 0.575,
        side * 10.6 + 0.575,
        standard("#8f9691"),
        0.12,
        1,
      ),
    );
  mesh(mergeGeometries(railGeo), railMat, world);
  mesh(mergeGeometries(supportGeo), white, world);
  const neon = new THREE.MeshBasicMaterial({
    color: new THREE.Color("#27cdff").multiplyScalar(2),
  });
  for (const side of [-1, 1])
    world.add(
      ribbon(
        SECTIONS.antiStart,
        SECTIONS.antiEnd,
        side * 14.2 - 0.12,
        side * 14.2 + 0.12,
        neon,
        0.87,
      ),
    );
  const guide = new THREE.MeshStandardMaterial({
    color: "#94d8ee",
    emissive: "#148baa",
    emissiveIntensity: 0.7,
    roughness: 0.32,
    metalness: 0.25,
  });
  for (let s = SECTIONS.antiStart; s < SECTIONS.antiEnd; s += 4) {
    for (const side of [-1, 1])
      world.add(
        ribbon(s, s + 1.7, side * 8.9 - 0.16, side * 8.9 + 0.16, guide, 0.045),
      );
  }
  // Road paint: twin white edge lines, yellow dashed center on the straights.
  for (const [start, end] of [
    [0, SECTIONS.glideStart],
    [SECTIONS.glideEnd, L],
  ])
    for (const side of [-1, 1])
      world.add(
        ribbon(
          start,
          end,
          side * 9.5 - 0.08,
          side * 9.5 + 0.08,
          basic("#ecf2ed"),
          0.07,
        ),
      );
  const checkerMap = canvasTexture(64, 128, (c, w, h) => {
    c.clearRect(0, 0, w, h);
    c.fillStyle = "#ececdf";
    c.fillRect(0, 0, w / 2, h / 2);
    c.fillRect(w / 2, h / 2, w / 2, h / 2);
    for (let i = 0; i < 250; i++) {
      c.clearRect((i * 31) % 64, (i * 47) % 128, 1, 2);
    }
  });
  checkerMap.wrapS = checkerMap.wrapT = THREE.RepeatWrapping;
  checkerMap.repeat.set(1, 8);
  checkerMap.anisotropy = 16;
  // Reference playback at 00:34 shows weathered center checks on ordinary
  // tarmac too. Reserve cyan emission for anti-gravity, not the markings.
  for (const [a, b] of [
    [0, SECTIONS.antiStart],
    [SECTIONS.antiStart, SECTIONS.glideStart],
    [SECTIONS.glideEnd, L],
  ]) {
    const checkerMat = new THREE.MeshStandardMaterial({
      map: checkerMap,
      transparent: true,
      depthWrite: false,
      roughness: 0.75,
      color: a === SECTIONS.antiStart ? "#6ae3ff" : "#c0c2b8",
      opacity: a === SECTIONS.antiStart ? 1 : 0.62,
      emissive: a === SECTIONS.antiStart ? "#1373a9" : "#000000",
      emissiveIntensity: 0.4,
    });
    world.add(ribbon(a, b, -0.38, 0.38, checkerMat, 0.083));
  }
  const edgeChecks = new THREE.MeshStandardMaterial({
    map: checkerMap,
    transparent: true,
    depthWrite: false,
    color: "#c0c2b8",
    opacity: 0.6,
    roughness: 0.85,
  });
  for (const [a, b] of [
    [0, SECTIONS.antiStart],
    [SECTIONS.glideEnd, L],
  ])
    for (const side of [-1, 1]) {
      world.add(
        ribbon(a, b, side * 9.15 - 0.24, side * 9.15 + 0.24, edgeChecks, 0.084),
      );
      world.add(
        ribbon(
          a,
          b,
          side * 8.78 - 0.04,
          side * 8.78 + 0.04,
          roadMaterial(pavement, "#c5ad46", true),
          0.085,
        ),
      );
    }

  for (const pad of BOOST_PADS) {
    world.add(
      ribbon(
        pad.s - 3.5,
        pad.s + 3.5,
        pad.lateral - 2,
        pad.lateral + 2,
        basic("#ffb520"),
        0.12,
      ),
    );
    for (let j = 0; j < 3; j++)
      world.add(
        ribbon(
          pad.s - 2 + j * 1.7,
          pad.s - 1.6 + j * 1.7,
          pad.lateral - 1.8,
          pad.lateral + 1.8,
          basic("#fff1ac"),
          0.14,
        ),
      );
  }
  for (const [s, color] of [
    [SECTIONS.antiStart, "#40e3ff"],
    [SECTIONS.glideStart - 1, "#4399ff"],
  ]) {
    world.add(ribbon(s - 1.3, s + 0.05, -10, 10, basic(color), 0.14));
    for (let i = -9; i < 10; i += 1)
      world.add(ribbon(s - 1, s, -0.15 + i, 0.15 + i, basic("#f4ffff"), 0.16));
  }
  // Starting stripe and eight individual grid boxes.
  for (let i = 0; i < 20; i++)
    for (let j = 0; j < 3; j++)
      world.add(
        ribbon(
          j * 0.65,
          j * 0.65 + 0.65,
          i - 10,
          i - 9,
          basic((i + j) % 2 ? "#111e35" : "#f5f9ed"),
          0.1,
        ),
      );
  for (let r = 0; r < 4; r++)
    for (const lane of [-3, 3]) {
      const s = -8 - r * 6;
      for (const offset of [-1.4, 1.4])
        world.add(
          ribbon(
            L + s - 2,
            L + s + 2,
            lane + offset - 0.06,
            lane + offset + 0.06,
            basic("#e5dfca"),
            0.1,
          ),
        );
      world.add(
        ribbon(
          L + s - 2,
          L + s - 1.85,
          lane - 1.4,
          lane + 1.4,
          basic("#e5dfca"),
          0.1,
        ),
      );
    }
  // Elevated-road support piers; shadow depth beneath the hairpin matters.
  for (let s = SECTIONS.antiStart + 30; s < SECTIONS.antiEnd; s += 30) {
    const p = trackAt(s);
    if (p.y > 3) {
      // A world-vertical pier must end below the LOW side of the bank. A
      // centre-height pier used to poke triangular white wedges through road.
      let top = Infinity;
      for (const ds of [-3, 0, 3])
        for (const l of [-2, 0, 2])
          top = Math.min(top, surfaceAt(s + ds, l).y - 1.3);
      if (top > 0)
        box(world, [2.2, top, 2.2], [p.x, top / 2, p.z], standard("#657c88"));
    }
  }
  buildUnderpass(world, { box, standard });
  const gate = buildPitlane(world, {
    mesh,
    box,
    standard,
    basic,
    canvasTexture,
    signTexture,
  });
  // Countdown light pods beneath the bridge, separate from HUD lamps.
  const lights = [];
  for (let i = 0; i < 3; i++) {
    const housing = mesh(
      new THREE.CylinderGeometry(0.65, 0.65, 0.4, 24),
      standard("#202735"),
      gate,
      [(i - 1) * 1.65, 7.4, 0],
    );
    housing.rotation.x = Math.PI / 2;
    const light = mesh(
      new THREE.CircleGeometry(0.48, 24),
      new THREE.MeshBasicMaterial({ color: "#451f32" }),
      gate,
      [(i - 1) * 1.65, 7.4, 0.24],
    );
    lights.push(light);
  }
  buildStadiumBowl(world, { mesh, box, standard, basic, canvasTexture });
  // Floodlight pylons and their visible luminaires. Illumination is consolidated
  // into the scene's key/fill lights rather than hundreds of GPU point lights.
  for (let i = 0; i < 12; i++) {
    const a = (i * Math.PI * 2) / 12,
      x = Math.cos(a) * 255,
      z = Math.sin(a) * 242;
    box(world, [0.9, 78, 0.9], [x, 39, z], standard("#7e93af"));
    const lamp = new THREE.Group();
    lamp.position.set(x, 77, z);
    lamp.lookAt(0, 0, 0);
    world.add(lamp);
    box(lamp, [12, 3, 0.7], [0, 0, 0], standard("#263049"));
    for (let k = 0; k < 12; k++)
      box(
        lamp,
        [1.5, 0.75, 0.1],
        [((k % 6) - 2.5) * 1.85, Math.floor(k / 6) * 1.05 - 0.5, 0.4],
        new THREE.MeshBasicMaterial({
          color: new THREE.Color("#ceeeff").multiplyScalar(3),
        }),
      );
  }
  // Lit office towers rise above the bowl, as in the Stadium night skyline.
  const windowTex = canvasTexture(128, 512, (c, w, h) => {
    c.fillStyle = "#14243e";
    c.fillRect(0, 0, w, h);
    for (let y = 5; y < h; y += 9)
      for (let x = 4; x < w; x += 8) {
        const lit = rng();
        c.fillStyle =
          lit > 0.58 ? "#bfcbd0" : lit > 0.25 ? "#b5a989" : "#18273b";
        c.fillRect(x, y, 4, 4);
      }
  });
  const buildingMat = standard("#aab3cb", {
    map: windowTex,
    emissive: "#fff2cd",
    emissiveMap: windowTex,
    emissiveIntensity: 0.58,
  });
  for (let i = 0; i < 70; i++) {
    const a = (i * Math.PI * 2) / 70,
      radius = 350 + rng() * 80,
      h = 70 + rng() * 115,
      w = 17 + rng() * 20;
    const b = box(
      world,
      [w, h, w],
      [Math.cos(a) * radius, h / 2 - 4, Math.sin(a) * radius],
      buildingMat,
    );
    b.rotation.y = a;
    const roof = box(
      world,
      [w + 1, 1.1, w + 1],
      [b.position.x, h - 3.3, b.position.z],
      standard("#29333d"),
    );
    roof.rotation.y = a;
    const plant = box(
      world,
      [w * 0.35, 3.5, w * 0.45],
      [b.position.x, h - 1, b.position.z],
      standard("#46515a"),
    );
    plant.rotation.y = a;
    if (i % 5 === 0) {
      box(
        world,
        [0.35, 9, 0.35],
        [b.position.x, h + 2, b.position.z],
        standard("#68747f"),
      );
      mesh(new THREE.SphereGeometry(0.42, 6, 4), basic("#fd493f"), world, [
        b.position.x,
        h + 6.5,
        b.position.z,
      ]);
    }
  }
  buildLandmark(world, { box, standard });
  buildPaddock(world, { mesh, box, standard, basic, canvasTexture });
  const architecture = buildArchitecture(world, {
    mesh,
    box,
    standard,
    basic,
    signTexture,
    canvasTexture,
  });
  // Starry sky and fireworks use one points draw each.
  const stars = new Float32Array(900 * 3);
  for (let i = 0; i < 900; i++) {
    const a = rng() * Math.PI * 2,
      r = 450;
    stars.set([Math.cos(a) * r, 70 + rng() * 230, Math.sin(a) * r], i * 3);
  }
  const sg = new THREE.BufferGeometry();
  sg.setAttribute("position", new THREE.BufferAttribute(stars, 3));
  world.add(
    new THREE.Points(
      sg,
      new THREE.PointsMaterial({
        color: "#b4d8ff",
        size: 0.6,
        sizeAttenuation: true,
      }),
    ),
  );
  const fireworks = [];
  for (let k = 0; k < 4; k++) {
    const positions = new Float32Array(100 * 3),
      colors = new Float32Array(100 * 3),
      origin = new V(
        Math.cos(k * 1.5) * 310,
        95 + (k % 2) * 40,
        Math.sin(k * 1.5) * 310,
      );
    const color = new THREE.Color(
      ["#ffd27a", "#7bdcff", "#e28cff", "#ff899c"][k],
    );
    for (let i = 0; i < 100; i++) {
      const a = i * 2.399,
        el = Math.acos(1 - (2 * (i + 0.5)) / 100);
      positions.set(
        [Math.sin(el) * Math.cos(a), Math.cos(el), Math.sin(el) * Math.sin(a)],
        i * 3,
      );
      color.toArray(colors, i * 3);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    const points = new THREE.Points(
      geo,
      new THREE.PointsMaterial({
        size: 1.1,
        vertexColors: true,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    points.position.copy(origin);
    world.add(points);
    fireworks.push(points);
  }
  return {
    world,
    lights,
    fireworks,
    statue: architecture.statue,
    screenMaterials: architecture.screenMaterials,
    update(time, count) {
      lights.forEach((l, i) =>
        l.material.color.set(
          count === 0 ? "#58ff87" : i < 4 - count ? "#ff403f" : "#421c29",
        ),
      );
      fireworks.forEach((f, i) => {
        const t = ((time + i * 1.3) % 5) / 5;
        f.scale.setScalar(5 + t * 24);
        f.material.opacity = Math.max(0, 1 - t) * 0.8;
      });
    },
  };
}
