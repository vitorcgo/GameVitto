import assert from 'node:assert/strict';
import test from 'node:test';
import { playerOneConnected } from './presence.js';

test('detecta o controle do jogador 1 pela vaga zero', () => {
  assert.equal(playerOneConnected({
    controller: 1,
    slots: [{ slot: 0, occupied: true }, { slot: 1, occupied: false }],
  }), true);
});

test('não confunde outro controle conectado com o jogador 1', () => {
  assert.equal(playerOneConnected({
    controller: 1,
    slots: [{ slot: 0, occupied: false }, { slot: 1, occupied: true }],
  }), false);
});

test('presença incompleta é tratada como jogador 1 desconectado', () => {
  assert.equal(playerOneConnected({ controller: 1 }), false);
  assert.equal(playerOneConnected(null), false);
});
