import * as THREE from "three";

let weave;
/** A small, tileable woven surface authored here; mipmaps suppress distant sparkle. */
export function driverFabric() {
  if (weave) return weave;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 128;
  const context = canvas.getContext("2d"), pixels = context.createImageData(128, 128);
  for (let y = 0; y < 128; y++) {
    for (let x = 0; x < 128; x++) {
      const vertical = (Math.floor(x / 8) + Math.floor(y / 8)) % 2 === 0;
      const cross = ((vertical ? x : y) % 8 + 0.5) / 8;
      const along = ((vertical ? y : x) % 8 + 0.5) / 8;
      const thread = Math.sin(cross * Math.PI) * (0.72 + 0.28 * Math.sin(along * Math.PI));
      const value = Math.round(215 + thread * 40), i = (y * 128 + x) * 4;
      pixels.data.set([value, value, value, 255], i);
    }
  }
  context.putImageData(pixels, 0, 0);
  weave = new THREE.CanvasTexture(canvas);
  weave.wrapS = weave.wrapT = THREE.RepeatWrapping;
  weave.anisotropy = 4;
  // Linear luminance serves both the subtle color variation and bump height.
  return weave;
}

/** Project in kart space after transforms; remeshed Blender cloth has no UVs. */
export function projectFabric(geometry) {
  const p = geometry.attributes.position, uv = new Float32Array(p.count * 2);
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  for (let i = 0; i < p.count; i += 3) {
    a.fromBufferAttribute(p, i); b.fromBufferAttribute(p, i + 1); c.fromBufferAttribute(p, i + 2);
    b.sub(a).cross(c.sub(a));
    const axis = Math.abs(b.x) > Math.abs(b.z) ? 0 : 2;
    const top = Math.abs(b.y) > Math.max(Math.abs(b.x), Math.abs(b.z));
    for (let j = i; j < i + 3; j++) {
      uv[j * 2] = (!top && axis === 0 ? p.getZ(j) : p.getX(j)) * 2.5;
      uv[j * 2 + 1] = (top ? p.getZ(j) : p.getY(j)) * 2.5;
    }
  }
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
}
