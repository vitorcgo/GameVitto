export function playerOneConnected(presence) {
  if (!Array.isArray(presence?.slots)) return false;
  return presence.slots.some((entry) => entry?.slot === 0 && entry.occupied === true);
}
