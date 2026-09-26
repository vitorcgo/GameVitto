export const PRESENTATION_ORBIT_MS = 18000;

export function presentationCameraPose(player, now) {
  const progress = ((now % PRESENTATION_ORBIT_MS) + PRESENTATION_ORBIT_MS) % PRESENTATION_ORBIT_MS;
  const orbit = (progress / PRESENTATION_ORBIT_MS) * Math.PI * 2 - player.heading - Math.PI * 0.31;
  const radius = 7.6;

  return {
    eye: {
      x: player.x + Math.cos(orbit) * radius,
      y: player.y + 3.65 + Math.sin(now * 0.0014) * 0.12,
      z: player.z + Math.sin(orbit) * radius,
    },
    aim: {
      x: player.x,
      y: player.y + 1.35,
      z: player.z,
    },
  };
}
