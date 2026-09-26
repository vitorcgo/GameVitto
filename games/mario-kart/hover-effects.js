import * as THREE from "three";
/** Surface glow follows actual wheel centers, independently of wheel tilt. */
export function makeHoverGlow() {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext("2d");
  const gradient = ctx.createRadialGradient(32, 32, 1, 32, 32, 31);
  gradient.addColorStop(0, "#74efffb0");
  gradient.addColorStop(0.3, "#21cef979");
  gradient.addColorStop(0.65, "#087fbe24");
  gradient.addColorStop(1, "#00346900");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 64, 64);
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.MeshBasicMaterial({
    map,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    opacity: 0.55,
    polygonOffset: true,
    polygonOffsetFactor: -2,
  });
  const group = new THREE.Group();
  for (let i = 0; i < 4; i++) {
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), material);
    glow.rotation.x = -Math.PI / 2;
    group.add(glow);
  }
  group.visible = false;
  return group;
}
export function updateHoverGlow(kart, racer, hop) {
  const group = kart.hover;
  if (group.userData.model !== kart.model.uuid) {
    kart.model.updateWorldMatrix(true, true);
    const inverse = kart.model.matrixWorld.clone().invert();
    for (const [i, wheel] of kart.wheels.entries()) {
      if (!wheel) continue;
      const center = new THREE.Vector3(...wheel.userData.hubCenter)
        .applyMatrix4(wheel.matrixWorld)
        .applyMatrix4(inverse);
      group.children[i].position.set(center.x, 0, center.z);
      group.children[i].scale.setScalar(wheel.userData.hubRadius * 3.8);
    }
    group.userData.model = kart.model.uuid;
  }
  group.visible = racer.anti && !racer.gliding;
  group.rotation.y = kart.model.rotation.y;
  group.position.y = -0.07 - hop;
}
