import * as THREE from "three";
/** Low-resolution GPU-only race feed for the arena screens. */
export function stadiumBroadcast(renderer, scene, materials, {width=512,height=384} = {}) {
  const target = new THREE.WebGLRenderTarget(width, height, {
    type: THREE.HalfFloatType,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    depthBuffer: true,
  });
  const camera = new THREE.PerspectiveCamera(58, width / height, 0.3, 900);
  const originals = materials.map((m) => m.map);
  let nextFrame = 0,
    frames = 0;
  for (const m of materials) m.map = target.texture;
  return {
    get frames() {
      return frames;
    },
    update(now, chaseCamera) {
      if (now < nextFrame) return;
      nextFrame = now + 100; // Ten broadcast frames per second; no CPU readback.
      camera.position.copy(chaseCamera.position);
      camera.quaternion.copy(chaseCamera.quaternion);
      camera.fov = chaseCamera.fov;
      camera.updateProjectionMatrix();
      const previous = renderer.getRenderTarget();
      // Sampling the render target while writing it is an invalid framebuffer
      // feedback loop. The broadcast sees the original standby screen artwork.
      for (let i = 0; i < materials.length; i++)
        materials[i].map = originals[i];
      try {
        renderer.setRenderTarget(target);
        renderer.clear();
        renderer.render(scene, camera);
        frames++;
      } finally {
        renderer.setRenderTarget(previous);
        for (const m of materials) m.map = target.texture;
      }
    },
  };
}
