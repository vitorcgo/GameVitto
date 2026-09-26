import { surfaceContact } from './surface-contact.js';
/** Contact footprints fitted to the finished kart meshes, in metres.
 * Evidence: overnight/21-underpass-hall/model-bounds.json. The chassis is
 * 2.498m wide and 3.324m long; horizontal hover wheels widen it to 3.244m.
 * Allow a little room for steering/lean animation.
 */
import { roadFrame } from "./visual-frame.js";
import { activeSurfaceTrack, TRACK_LENGTH, wrap } from "./track.js";

export function kartFootprint(r, time = 0) {
  const frame = r.gliding
    ? {
        right: { x: Math.cos(r.heading), z: Math.sin(r.heading) },
        forward: { x: Math.sin(r.heading), z: -Math.cos(r.heading) },
      }
    : roadFrame(r.s, r.lateral, r.heading, r.surfaceForward, r.surfaceNormal);
  const yaw = r.spin > 0 ? time * 15 : r.drift ? -r.drift * 0.25 : 0,
    c = Math.cos(yaw),
    s = Math.sin(yaw),
    right = {
      x: frame.right.x * c + frame.forward.x * s,
      z: frame.right.z * c + frame.forward.z * s,
    },
    back = {
      x: frame.right.x * s - frame.forward.x * c,
      z: frame.right.z * s - frame.forward.z * c,
    },
    halfWidth = r.anti ? 1.65 : 1.29;
  return [
    [-halfWidth, -1.76],
    [halfWidth, -1.76],
    [halfWidth, 1.64],
    [-halfWidth, 1.64],
  ].map(([x, z]) => ({
    x: r.x + right.x * x + back.x * z,
    z: r.z + right.z * x + back.z * z,
  }));
}

/** Separating axes of the projected body rectangles. Return the least world-XZ
 * displacement from A to B; distinct course layers never collide at a crossing.
 */
export function kartContact(a, b, time = 0) {
  if(a.jump||b.jump)return null;
  if (Math.hypot(b.x - a.x, b.z - a.z) > 5) return null;
  const routeGap = Math.abs(
    wrap(b.s - a.s + TRACK_LENGTH / 2, TRACK_LENGTH) - TRACK_LENGTH / 2,
  );
  if (routeGap > 18 || ((a.gliding || b.gliding) && Math.abs(a.y - b.y) > 1.8))
    return null;
  if (activeSurfaceTrack) {
    const frame = r => r.gliding ? {
      up:{x:0,y:1,z:0},right:{x:Math.cos(r.heading),y:0,z:Math.sin(r.heading)},
      forward:{x:Math.sin(r.heading),y:0,z:-Math.cos(r.heading)},
    } : roadFrame(r.s,r.lateral,r.heading,r.surfaceForward,r.surfaceNormal);
    return surfaceContact(a,b,frame(a),frame(b),time);
  }
  const A = kartFootprint(a, time),
    B = kartFootprint(b, time);
  let depth = Infinity,
    normal;
  for (const polygon of [A, B])
    for (let i = 0; i < 2; i++) {
      const dx = polygon[i + 1].x - polygon[i].x,
        dz = polygon[i + 1].z - polygon[i].z,
        len = Math.hypot(dx, dz),
        nx = -dz / len,
        nz = dx / len,
        pa = A.map((p) => p.x * nx + p.z * nz),
        pb = B.map((p) => p.x * nx + p.z * nz),
        amin = Math.min(...pa),
        amax = Math.max(...pa),
        bmin = Math.min(...pb),
        bmax = Math.max(...pb);
      if (amax <= bmin || bmax <= amin) return null;
      const overlap = Math.min(amax - bmin, bmax - amin);
      if (overlap < depth) {
        depth = overlap;
        const sign = (b.x - a.x) * nx + (b.z - a.z) * nz < 0 ? -1 : 1;
        normal = { x: nx * sign, z: nz * sign };
      }
    }
  return {
    x: normal.x * (depth + 0.005),
    z: normal.z * (depth + 0.005),
    depth,
  };
}
