import * as THREE from "three";
import { GLTFLoader } from "/vendor/three-examples/loaders/GLTFLoader.js";
import { RoundedBoxGeometry } from "/vendor/three-examples/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "/vendor/three-examples/utils/BufferGeometryUtils.js";
import { modelSpec } from "./model-spec.js";
import { driverFabric, projectFabric } from "./driver-fabric.js";
import { sourceWheelMaterial } from "./source-wheel.js";
const materials = new Map();
function mat(color) {
  if (!materials.has(color))
    materials.set(
      color,
      new THREE.MeshStandardMaterial({
        color,
        roughness: 0.43,
        metalness: 0.08,
      }),
    );
  return materials.get(color);
}
export function proceduralKart(id) {
  const group = new THREE.Group();
  for (const p of modelSpec(id).parts) {
    let obj;
    if (p.shape === "wheel") {
      obj = new THREE.Group();
      const profile = [
        [-0.5, 0.63],
        [-0.54, 0.78],
        [-0.46, 0.94],
        [-0.28, 1],
        [0.28, 1],
        [0.46, 0.94],
        [0.54, 0.78],
        [0.5, 0.63],
      ];
      const tire = new THREE.Mesh(
        new THREE.LatheGeometry(
          profile.map(([x, r]) => new THREE.Vector2(r * p.s[0], x * p.s[1])),
          48,
        ),
        mat("#111820"),
      );
      tire.rotation.z = Math.PI / 2;
      tire.name = p.name + "-tire";
      obj.add(tire);
      for (const side of [-1, 1]) {
        const rim = new THREE.Mesh(
          new THREE.TorusGeometry(p.s[0] * 0.62, 0.034, 8, 40),
          mat("#e5b52c"),
        );
        rim.rotation.y = Math.PI / 2;
        rim.position.x = side * p.s[1] * 0.49;
        rim.name = p.name + "-rim";
        obj.add(rim);
        const center = new THREE.Mesh(
          new THREE.CylinderGeometry(p.s[0] * 0.5, p.s[0] * 0.5, 0.025, 32),
          mat("#242c34"),
        );
        center.rotation.z = Math.PI / 2;
        center.position.x = side * p.s[1] * 0.47;
        center.name = p.name + "-hub";
        obj.add(center);
        for (let j = 0; j < 5; j++) {
          const angle = (j * Math.PI * 2) / 5,
            spoke = new THREE.Mesh(
              new RoundedBoxGeometry(0.03, 0.23, 0.07, 2, 0.02),
              mat("#ddb030"),
            );
          spoke.position.set(
            side * p.s[1] * 0.51,
            Math.cos(angle) * 0.13,
            Math.sin(angle) * 0.13,
          );
          spoke.rotation.x = angle;
          spoke.name = p.name + "-rim-spoke";
          obj.add(spoke);
        }
        const hub = new THREE.Mesh(
          new THREE.CylinderGeometry(0.076, 0.076, 0.04, 24),
          mat("#a7b1b9"),
        );
        hub.rotation.z = Math.PI / 2;
        hub.position.x = side * p.s[1] * 0.53;
        hub.name = p.name + "-hub";
        obj.add(hub);
        for (const r of [0.79, 0.91]) {
          const bead = new THREE.Mesh(
            new THREE.TorusGeometry(p.s[0] * r, 0.0055, 5, 48),
            mat("#37414a"),
          );
          bead.rotation.y = Math.PI / 2;
          bead.position.x = side * p.s[1] * (r > 0.8 ? 0.42 : 0.535);
          bead.name = p.name + "-tire-bead";
          obj.add(bead);
        }
      }
    } else if (p.shape === "text") {
      const c = document.createElement("canvas");
      c.width = c.height = 128;
      const ctx = c.getContext("2d");
      ctx.font = "900 96px Arial";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = p.color;
      ctx.fillText(p.text, 64, 70);
      const tex = new THREE.CanvasTexture(c);
      tex.colorSpace = THREE.SRGBColorSpace;
      obj = new THREE.Mesh(
        new THREE.PlaneGeometry(1.5, 1.5),
        new THREE.MeshBasicMaterial({
          map: tex,
          transparent: true,
          side: THREE.DoubleSide,
        }),
      );
      obj.scale.set(...p.s);
    } else {
      const geo =
        p.shape === "sphere"
          ? new THREE.SphereGeometry(1, 20, 14)
          : p.shape === "box"
            ? new RoundedBoxGeometry(1, 1, 1, 3, 0.15)
            : p.shape === "torus"
              ? new THREE.TorusGeometry(1, 0.105, 8, 28)
              : p.shape === "cone"
                ? new THREE.ConeGeometry(1, 1, 24)
                : new THREE.CylinderGeometry(1, 1, 1, 24);
      obj = new THREE.Mesh(geo, mat(p.color));
      obj.scale.set(...p.s);
    }
    obj.name = p.name;
    obj.position.set(...p.p);
    obj.rotation.set(...p.rotation);
    group.add(obj);
  }
  group.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  finishKart(group, id);
  return group;
}
export function disposeModel(root) {
  const geometries = new Set(),
    ownedMaterials = new Set();
  const shared = new Set(materials.values());
  root.traverse((o) => {
    if (o.geometry) geometries.add(o.geometry);
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
      if (m && !shared.has(m)) ownedMaterials.add(m);
    }
  });
  geometries.forEach((g) => g.dispose());
  ownedMaterials.forEach((m) => {
    m.map?.dispose();
    m.dispose();
  });
}
export function rigWheels(model) {
  const source = model.getObjectByName('gamevitto-source-kart')?.userData.gamevittoSourcePack===1;
  return [0, 1, 2, 3].map((i) => {
    const wheel = model.getObjectByName("wheel-" + i);
    if (!wheel || wheel.userData.rolling) return wheel;
    if(!source)finishKart(wheel);
    const rolling = new THREE.Group();
    for (const child of [...wheel.children]) rolling.add(child);
    wheel.add(rolling);
    wheel.userData.rolling = rolling;
    // Derive the hub envelope from the actual loaded/procedural geometry.
    // The outer faces change when tire proportions change; a fixed x offset
    // previously left the little glow ring buried behind the gold rim.
    wheel.updateWorldMatrix(true, true);
    const inverse = wheel.matrixWorld.clone().invert();
    const bounds = new THREE.Box3(),
      part = new THREE.Box3();
    rolling.traverse((o) => {
      if (!o.geometry) return;
      o.geometry.computeBoundingBox();
      part
        .copy(o.geometry.boundingBox)
        .applyMatrix4(
          new THREE.Matrix4().multiplyMatrices(inverse, o.matrixWorld),
        );
      bounds.union(part);
    });
    const center = bounds.getCenter(new THREE.Vector3()),
      extent = bounds.getSize(new THREE.Vector3()),
      radius = Math.max(extent.y, extent.z) * 0.5;
    wheel.userData.hubCenter = center.toArray();
    wheel.userData.hubRadius = radius;
    if(source){
      const tireMeshes=[];
      rolling.traverse(o=>{if(o.isMesh&&!Array.isArray(o.material)&&o.material.emissiveMap){sourceWheelMaterial(o.material);tireMeshes.push(o);}});
      wheel.userData.sourceTireMeshes=tireMeshes;
      return wheel;
    }
    const glow = new THREE.Group();
    const light = new THREE.MeshBasicMaterial({
      color: new THREE.Color("#35e3ff").multiplyScalar(3.1),
    });
    const blue = new THREE.MeshStandardMaterial({
      color: "#08171d",
      emissive: "#12badb",
      emissiveIntensity: 0.055,
      metalness: 0.55,
      roughness: 0.32,
    });
    for (const face of [bounds.min.x - 0.012, bounds.max.x + 0.012]) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(radius * 0.82, radius * 0.045, 8, 40),
        light,
      );
      ring.rotation.y = Math.PI / 2;
      ring.position.set(face, center.y, center.z);
      glow.add(ring);
      const hub = new THREE.Mesh(
        new THREE.CircleGeometry(radius * 0.74, 40),
        blue,
      );
      hub.rotation.y = face < center.x ? -Math.PI / 2 : Math.PI / 2;
      hub.position.set(face, center.y, center.z);
      glow.add(hub);
    }
    glow.visible = false;
    wheel.add(glow);
    wheel.userData.glow = glow;
    const stripe = new THREE.Mesh(
      new THREE.BoxGeometry(0.012, 0.08, 0.08),
      mat("#e6eaf6"),
    );
    stripe.position.set(i % 2 ? 0.225 : -0.225, 0.26, 0);
    rolling.add(stripe);
    return wheel;
  });
}
export async function loadKartPack(karts, onProgress = () => {}) {
  try {
    const res = await fetch("/assets/mario-kart/manifest.json");
    if (!res.ok) return { loaded: 0, fallback: 8 };
    const manifest = await res.json(),
      loader = new GLTFLoader();
    let loaded = 0;
    await Promise.all(
      karts.map(async (k) => {
        const entry = manifest.characters?.find((c) => c.id === k.id);
        if (!entry) return;
        try {
          const gltf = await loader.loadAsync(
            "/assets/mario-kart/" + entry.file,
          );
          if (k.disposed) {
            disposeModel(gltf.scene);
            return;
          }
          gltf.scene.traverse((o) => {
            if (o.isMesh) {
              o.castShadow = true;
              o.receiveShadow = true;
            }
          });
          finishKart(gltf.scene, k.id);
          k.root.remove(k.model);
          disposeModel(k.model);
          k.model = gltf.scene;
          k.root.add(k.model);
          k.wheels = rigWheels(k.model);
          k.source = "glb";
          k.cast = undefined;
          loaded++;
          onProgress(loaded);
        } catch {
          /* a missing individual character retains its procedural sculpture */
        }
      }),
    );
    return { loaded, fallback: karts.length - loaded };
  } catch {
    return { loaded: 0, fallback: karts.length };
  }
}
export function makeGlider(color,characterId) {
  const group = new THREE.Group();
  // Super Glider reference: a delta wing on a rear mast, not a parafoil.
  // Dimensions are reconstructed from native gameplay, not extracted geometry.
  const point = (u, v) => new THREE.Vector3(
    u * 3.2 * v,
    3.55 - .28 * (Math.abs(u) * v) ** 1.5 + .14 * Math.sin(Math.PI * v) * (1-u*u),
    -2.1 + 3.6 * v,
  );
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 512;
  const c = canvas.getContext("2d");
  c.fillStyle = color;
  c.fillRect(0, 0, 1024, 512);
  c.fillStyle = "#f7f3e5";
  c.fillRect(464, 0, 96, 512);
  if(characterId==='mario'||characterId==='luigi'){
    c.save();c.translate(512,185);c.scale(.75,-1);
    c.fillStyle='#fffdf6';c.beginPath();c.arc(0,0,125,0,Math.PI*2);c.fill();
    c.fillStyle=color;c.font='900 190px Arial';c.textAlign='center';c.textBaseline='middle';
    c.fillText(characterId==='mario'?'M':'L',0,10);c.restore();
  }
  // Very fine fabric weave and stitched ribs remain subtle at driving distance.
  for (let y = 0; y < 512; y += 3) {
    c.fillStyle = "#ffffff0b";
    c.fillRect(0, y, 1024, 1);
  }
  for (let x = 0; x <= 1024; x += 128) {
    c.strokeStyle = "#6c293555";
    c.lineWidth = 2;
    c.setLineDash([5, 4]);
    c.beginPath();
    c.moveTo(x, 0);
    c.lineTo(x, 512);
    c.stroke();
  }
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 8;
  const pos = [], uv = [], idx = [], rows = 32;
  const rowStart = j => j * (j + 1) / 2;
  for(let j=0;j<=rows;j++)for(let i=0;i<=j;i++){
    const v=j/rows,u=j?2*i/j-1:0,p=point(u,v);
    pos.push(...p.toArray());uv.push(.5+p.x/6.4,v);
  }
  for(let j=0;j<rows;j++)for(let i=0;i<=j;i++){
    const a=rowStart(j)+i,b=rowStart(j+1)+i;
    idx.push(a,b,b+1);
    if(i<j)idx.push(a,b+1,a+1);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const sail = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({
      map,
      side: THREE.DoubleSide,
      roughness: 0.72,
    }),
  );
  sail.castShadow = true;
  sail.receiveShadow = true;
  group.add(sail);
  sail.name = 'glider-sail';
  const pale = new THREE.MeshStandardMaterial({color:'#e0e3df',metalness:.35,roughness:.36});
  const dark = new THREE.MeshStandardMaterial({color:'#434c50',metalness:.7,roughness:.32});
  const yellow = new THREE.MeshStandardMaterial({color:'#ffcc20',metalness:.15,roughness:.38});
  const tube=(name,points,radius,material)=>{
    const mesh=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),Math.max(2,points.length*2),radius,8,false),material);
    mesh.name=name;mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);return mesh;
  };
  // Three rigid perimeter spars and the spine remain readable from behind.
  for(const side of [-1,1])tube('glider-leading-frame',Array.from({length:25},(_,i)=>point(side,i/24)),.055,pale);
  tube('glider-trailing-frame',Array.from({length:33},(_,i)=>point(i/16-1,1)),.045,pale);
  tube('glider-spine',Array.from({length:25},(_,i)=>point(0,i/24).add(new THREE.Vector3(0,-.06,0))),.055,dark);
  tube('glider-mast-lower',[new THREE.Vector3(0,1.3,.65),new THREE.Vector3(0,2.35,1.25)],.085,dark);
  tube('glider-mast-upper',[new THREE.Vector3(0,2.25,1.2),point(0,1)],.07,pale);
  for(const side of [-1,1])tube('glider-cross-brace',[new THREE.Vector3(0,3.08,1.1),point(side,1).add(new THREE.Vector3(0,-.03,0))],.033,dark);
  for(const p of [point(-1,1),point(1,1),point(0,0),point(0,1)]){
    const cap=new THREE.Mesh(new THREE.SphereGeometry(.105,12,8),yellow);
    cap.name='glider-yellow-cap';cap.position.copy(p);cap.scale.set(1.35,.7,1.1);cap.castShadow=true;group.add(cap);
  }
  for(const child of group.children) child.position.sub(new THREE.Vector3(0,1.3,.15));
  group.position.set(0,1.3,.15);
  group.visible = false;
  return group;
}

/** Art pass shared by optional GLBs and the geometry fallback. Wheel groups stay riggable. */
function finishKart(root, character) {
  // Optional local source packs already contain their authored texture materials,
  // seated skeleton and wheel pivots. Flattening them would discard skinning.
  if (root.getObjectByName("gamevitto-source-kart")?.userData.gamevittoSourcePack === 1) return;
  const pool = new Map(),
    groups = new Map(),
    remove = [];
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const head = ["mario", "luigi"].includes(character) ? new THREE.Group() : null;
  if (head) {
    head.name = "driver-head";
    head.position.set(0, 1.82, 0.08);
  }
  root.traverse((o) => {
    if (!o.isMesh || Array.isArray(o.material)) return;
    const name = o.name.toLowerCase(),
      old = o.material;
    const rubber = /tire|cockpit|seat|grille|inlet|exhaust-hole/.test(name);
    const metal =
      /engine|exhaust|frame|bumper|axle|hub|(?:^|-)rim|spring|carrier/.test(name);
    const paint = /chassis|nose$|fairing|fender|sidepod|shell/.test(name);
    const fabric = ["mario", "luigi"].includes(character) &&
      /^(organic-shirt|organic-overalls|torso|arm|overalls|back-strap|strap|cap$|cap-band|cap-button|brim$|back-pocket|overall-seam)/.test(name);
    const key =
      old.color.getHexString() +
      ":" +
      (fabric ? "fabric" : rubber ? "rubber" : metal ? "metal" : paint ? "paint" : "skin");
    // Text atlas materials retain their alpha and map.
    if (!old.map) {
      if (!pool.has(key))
        pool.set(
          key,
          new THREE.MeshPhysicalMaterial({
            vertexColors: !!o.geometry.attributes.color,
            color: old.color,
            roughness: fabric ? 0.88 : rubber ? 0.82 : metal ? 0.28 : paint ? 0.29 : 0.62,
            metalness: !fabric && metal ? 0.78 : 0,
            clearcoat: paint ? 1 : 0,
            clearcoatRoughness: 0.21,
            ...(fabric ? { map: driverFabric(), bumpMap: driverFabric(), bumpScale: 0.007, sheen: 0.22, sheenRoughness: 0.9 } : {}),
          }),
        );
      o.material = pool.get(key);
    }
    o.castShadow = true;
    o.receiveShadow = true;
    let wheel = false;
    for (let p = o; p && p !== root; p = p.parent)
      if (/^wheel-[0-3]$/.test(p.name)) wheel = true;
    if (wheel) return;
    const isHead = head && /^(organic-(skin|hair|mustache)$|head$|neck$|ear|nose-face|hair|sideburn|brow|mustache|cap|brim$|eye|pupil)/.test(name);
    const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld));
    if (fabric) projectFabric(g);
    if (isHead) g.translate(-head.position.x, -head.position.y, -head.position.z);
    if (!g.attributes.uv)
      g.setAttribute(
        "uv",
        new THREE.Float32BufferAttribute(
          new Float32Array(g.attributes.position.count * 2),
          2,
        ),
      );
    const id = o.material.uuid + (isHead ? ":head" : ":body");
    if (!groups.has(id)) groups.set(id, { mat: o.material, geos: [], parent: isHead ? head : root });
    groups.get(id).geos.push(g);
    remove.push(o);
  });
  for (const o of remove) {
    o.removeFromParent();
    o.geometry.dispose();
  }
  for (const { mat, geos, parent } of groups.values()) {
    const g = mergeGeometries(geos);
    geos.forEach((x) => x.dispose());
    if (g) {
      const m = new THREE.Mesh(g, mat);
      m.castShadow = true;
      m.receiveShadow = true;
      parent.add(m);
    }
  }
  if (head) root.add(head);
}
