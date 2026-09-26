/** Surface orientation shared by the renderer, chase camera and kart contacts. */
import { activeSurfaceTrack, surfaceAt, project, trackAt, WALL_HALF } from "./track.js";
const norm = (v) => {
  const l = Math.hypot(v.x, v.y, v.z) || 1;
  return { x: v.x / l, y: v.y / l, z: v.z / l };
};
const cross = (a, b) => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
});
export function roadFrame(s, lateral, heading, direction=null, normal=null) {
  if (activeSurfaceTrack) return activeSurfaceTrack.frame(s, heading, lateral, direction, normal);
  // Use the centreline for horizontal travel: a very tight inside curb can
  // fold its offset ribbon, but must never turn the camera upside down.
  const a = surfaceAt(s - 0.2, 0),
    b = surfaceAt(s + 0.2, 0);
  a.y += Math.tan(a.bank) * lateral;
  b.y += Math.tan(b.bank) * lateral;
  const c = surfaceAt(s, lateral - 0.2),
    d = surfaceAt(s, lateral + 0.2);
  const along = { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z };
  const across = { x: d.x - c.x, y: d.y - c.y, z: d.z - c.z };
  const up = norm(cross(across, along));
  // The projected forward vector must preserve the player's horizontal heading.
  const x = Math.sin(heading),
    z = -Math.cos(heading);
  const forward = norm({
    x,
    y: -(up.x * x + up.z * z) / Math.max(0.1, up.y),
    z,
  });
  return { up, forward, right: norm(cross(forward, up)) };
}
export function cameraClearance(position, referenceS = null) {
  if (activeSurfaceTrack) {
    const near = activeSurfaceTrack.project(position, referenceS), p = surfaceAt(near.s, near.lateral);
    const walls=activeSurfaceTrack.wallBounds(near.s,near.lateral);
    if (p.glide || near.lateral<walls.min-1 || near.lateral>walls.max+1) return position;
    const ground=activeSurfaceTrack.support(position,p.normal)||p;
    const n = ground.normal, height = (position.x-ground.x)*n.x+(position.y-ground.y)*n.y+(position.z-ground.z)*n.z;
    const correction = Math.max(0, 1.25-height);
    return {x:position.x+n.x*correction,y:position.y+n.y*correction,z:position.z+n.z*correction};
  }
  // At a crossing, the nearest XZ point can belong to the road above us.
  // Continue along the racer's route layer, just as the driving projection does.
  const p = project(position.x, position.z, referenceS),
    t = trackAt(p.s);
  if (t.glide || Math.abs(p.lateral) > WALL_HALF + 1) return position;
  return {
    ...position,
    y: Math.max(position.y, surfaceAt(p.s, p.lateral).y + 1.25),
  };
}
export function flightFrame(racer) {
  // An airborne hit can remove almost all forward speed while gravity keeps
  // acting. That velocity is not a useful viewing direction: it carries the
  // chase eye over the canopy and even ahead of the driver. Retain the source
  // glide's minimum launch pace as the camera reference through interruptions.
  // Ordinary flight and the steep ramp departure still follow their descent.
  const speed=Math.max(26,Math.abs(racer.speed||0));
  const forward=norm({x:Math.sin(racer.heading)*speed,y:Number.isFinite(racer.flightV)?racer.flightV:-speed*.08,z:-Math.cos(racer.heading)*speed});
  // Follow actual descent, with an up vector perpendicular to that flight.
  // A horizontal camera behind the steep launch ramp starts inside the road.
  const up=norm({x:-forward.x*forward.y,y:1-forward.y*forward.y,z:-forward.z*forward.y});
  return {forward,up};
}
export function chasePose(racer) {
  const frame = racer.gliding
    ? activeSurfaceTrack ? flightFrame(racer) : {
        up: { x: 0, y: 1, z: 0 },
        forward: {
          x: Math.sin(racer.heading),
          y: -0.08,
          z: -Math.cos(racer.heading),
        },
      }
    : roadFrame(racer.s, racer.lateral, racer.heading, racer.surfaceForward, racer.surfaceNormal);
  const { up: n, forward: f } = frame;
  // MK8-like composition: kart low in frame with room to read upcoming corners, road and landmarks ahead.
  const back = racer.gliding ? 8.8 : 9.6,
    height = racer.gliding ? 3.8 : 3.65;
  const eye = cameraClearance(
    {
      x: racer.x - f.x * back + n.x * height,
      y: racer.y - f.y * back + n.y * height,
      z: racer.z - f.z * back + n.z * height,
    },
    racer.s,
  );
  const ahead = surfaceAt(racer.s + 14, racer.lateral * 0.55);
  const follow = racer.gliding ? 0 : 0.45;
  const aimHeight=racer.gliding?1.3:3.1;
  const aim = {
    x: (racer.x + f.x * 12) * (1 - follow) + ahead.x * follow + n.x * aimHeight,
    y: (racer.y + f.y * 12) * (1 - follow) + ahead.y * follow + n.y * aimHeight,
    z: (racer.z + f.z * 12) * (1 - follow) + ahead.z * follow + n.z * aimHeight,
  };
  const viewUp = norm({ x: n.x * 0.72, y: n.y * 0.72 + 0.28, z: n.z * 0.72 });
  return { eye, aim, up: viewUp };
}
