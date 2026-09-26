import * as THREE from "three";

const inverseRoad = new THREE.Quaternion(), inverseKart = new THREE.Quaternion();
const direction = new THREE.Vector3();
const yawRotation = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);

/** Visual attention only: steering, collision and race state are never modified. */
export function updateDriverLook(kart, racer, racers, dt, active) {
  if (kart.lookModel !== kart.model) {
    kart.lookModel = kart.model;
    kart.driverHead = kart.model.getObjectByName("driver-head");
    kart.lookTime = 0;
    kart.lookCooldown = 0;
    kart.lookTarget = null;
    kart.lookYaw = 0;
  }
  const head = kart.driverHead;
  if (!head || dt <= 0) return;
  const step = Math.min(dt, 0.05);
  inverseRoad.copy(kart.root.quaternion).invert();
  inverseKart.copy(kart.model.quaternion).invert();
  const local = (other) => direction.set(other.x - racer.x, other.y - racer.y, other.z - racer.z)
    .applyQuaternion(inverseRoad).applyQuaternion(inverseKart);
  let yaw = active && racer.speed > 8 ? -racer.steer * 0.28 : 0;
  kart.lookCooldown = Math.max(0, kart.lookCooldown - step);
  if (!active || racer.spin > 0 || racer.gliding) kart.lookTime = 0;
  else if (kart.lookTime <= 0 && kart.lookCooldown <= 0) {
    let closest = 8;
    for (const other of racers) {
      if (other === racer) continue;
      const p = local(other), distance = p.length();
      if (distance < closest && Math.abs(p.y) < 2.2 && Math.abs(p.z) < 4 && Math.abs(p.x) > 1.1) {
        closest = distance;
        kart.lookTarget = other;
      }
    }
    if (closest < 8) {
      kart.lookTime = 0.85;
      kart.lookCooldown = 2.6;
    }
  }
  if (kart.lookTime > 0 && kart.lookTarget) {
    kart.lookTime -= step;
    const p = local(kart.lookTarget);
    if (p.length() < 12 && Math.abs(p.y) < 3) yaw = Math.max(-0.62, Math.min(0.62, Math.atan2(-p.x, -p.z)));
    else kart.lookTime = 0;
  }
  kart.lookYaw += (yaw - kart.lookYaw) * (1 - Math.exp(-step * 7));
  if (head.userData.lookRestQuaternion) {
    head.quaternion.fromArray(head.userData.lookRestQuaternion)
      .multiply(yawRotation.setFromAxisAngle(up, kart.lookYaw));
  } else head.rotation.y = kart.lookYaw;
}
