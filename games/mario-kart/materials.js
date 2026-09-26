import * as THREE from "three";
// Deterministic, local pavement maps. No remote asset request or random per frame.
export function pavementMaps() {
  const size = 512,
    height = new Float32Array(size * size);
  let seed = 28971;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const diffuse = document.createElement("canvas"),
    normal = document.createElement("canvas"),
    rough = document.createElement("canvas");
  for (const c of [diffuse, normal, rough]) c.width = c.height = size;
  const dc = diffuse.getContext("2d"),
    nc = normal.getContext("2d"),
    rc = rough.getContext("2d");
  const di = dc.createImageData(size, size),
    ni = nc.createImageData(size, size),
    ri = rc.createImageData(size, size);
  // Periodic cellular aggregate: neighbouring pixels belong to the same stone.
  // Independent white noise looked like video grain rather than physical asphalt.
  const cells = 256,
    cell = size / cells,
    stones = Array.from({ length: cells * cells }, () => ({
      x: random(),
      y: random(),
      v: random(),
    }));
  const pigment = new Float32Array(size * size),
    edgeShade = new Float32Array(size * size);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const cx = Math.floor(x / cell),
        cy = Math.floor(y / cell);
      let nearest = Infinity,
        second = Infinity,
        stone = 0;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const sx = cx + dx,
            sy = cy + dy,
            data =
              stones[((sy + cells) % cells) * cells + ((sx + cells) % cells)];
          const d = Math.hypot(
            x - (sx + 0.15 + data.x * 0.7) * cell,
            y - (sy + 0.15 + data.y * 0.7) * cell,
          );
          if (d < nearest) {
            second = nearest;
            nearest = d;
            stone = data.v;
          } else if (d < second) second = d;
        }
      const i = y * size + x,
        edge = Math.min(1, (second - nearest) / 0.65),
        noise = random();
      pigment[i] = stone;
      edgeShade[i] = edge;
      height[i] = 0.12 + edge * 0.22 + stone * 0.12 + noise * 0.2;
    }
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const i = y * size + x,
        j = i * 4,
        v = height[i],
        large =
          (Math.sin(x * 0.08) +
            Math.cos(y * 0.09) +
            Math.sin((x + y) * 0.022)) *
          0.8;
      const grain = 91 + pigment[i] * 45 + edgeShade[i] * 10 + v * 19 + large;
      di.data.set([grain * 0.96, grain * 0.98, grain, 255], j);
      const dx =
          height[y * size + ((x + 1) % size)] -
          height[y * size + ((x + size - 1) % size)],
        dy =
          height[((y + 1) % size) * size + x] -
          height[((y + size - 1) % size) * size + x];
      const len = Math.hypot(dx * 0.9, dy * 0.9, 1);
      ni.data.set(
        [128 + (dx / len) * 100, 128 + (dy / len) * 100, 128 + 127 / len, 255],
        j,
      );
      const rv = 205 + edgeShade[i] * 22 - pigment[i] * 18;
      ri.data.set([rv, rv, rv, 255], j);
    }
  dc.putImageData(di, 0, 0);
  nc.putImageData(ni, 0, 0);
  rc.putImageData(ri, 0, 0);
  const map = new THREE.CanvasTexture(diffuse),
    normalMap = new THREE.CanvasTexture(normal),
    roughnessMap = new THREE.CanvasTexture(rough);
  map.colorSpace = THREE.SRGBColorSpace;
  for (const t of [map, normalMap, roughnessMap]) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 16;
    t.repeat.set(3, 1.5);
  }
  return { map, normalMap, roughnessMap };
}
export function roadMaterial(maps, color = "#838482", paint = false) {
  const mat = new THREE.MeshStandardMaterial({
    color,
    ...maps,
    normalScale: new THREE.Vector2(paint ? 0.23 : 0.5, paint ? 0.23 : 0.5),
    roughness: paint ? 0.54 : 0.68,
    metalness: paint ? 0.08 : 0.06,
  });
  // Wear along the racing line, subtle resurfacing patches and edge dirt use
  // physical ribbon UVs. Details survive a video encode without a noisy overlay.
  mat.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <map_fragment>",
      `#include <map_fragment>
    float lane = vMapUv.x / 3.0;
    float tyre = pow(abs(sin(lane*19.0)),26.0);
    float roadWear = (1.0-smoothstep(0.32,0.5,abs(lane-.5)));
    float wearPatch = sin(vMapUv.y*.6)*sin(vMapUv.y*.13);
    diffuseColor.rgb *= 1.0 - roadWear*tyre*.1 - wearPatch*.028;
  `,
    );
  };
  return mat;
}
