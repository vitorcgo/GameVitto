'use strict';

class SlotRegistry {
  constructor(maxPlayers) {
    this.slots = new Array(maxPlayers).fill(null);
  }

  assign(socketId) {
    const current = this.slotOf(socketId);
    if (current !== -1) return current;

    const free = this.slots.indexOf(null);
    if (free !== -1) this.slots[free] = socketId;
    return free;
  }

  release(socketId) {
    let released = false;
    for (let slot = 0; slot < this.slots.length; slot += 1) {
      if (this.slots[slot] !== socketId) continue;
      this.slots[slot] = null;
      released = true;
    }
    return released;
  }

  slotOf(socketId) {
    return this.slots.indexOf(socketId);
  }

  socketAt(slot) {
    if (!Number.isInteger(slot) || slot < 0 || slot >= this.slots.length) return null;
    return this.slots[slot];
  }

  presence() {
    return this.slots.map((socketId, slot) => ({
      slot,
      occupied: socketId !== null,
    }));
  }
}

function feedbackRoute(registry, data) {
  if (!data || typeof data !== 'object') return { type: 'discard' };
  if (!Object.prototype.hasOwnProperty.call(data, 'slot')) return { type: 'broadcast' };

  const socketId = registry.socketAt(data.slot);
  return socketId ? { type: 'socket', socketId } : { type: 'discard' };
}

module.exports = { SlotRegistry, feedbackRoute };
