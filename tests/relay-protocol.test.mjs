import assert from 'node:assert/strict';
import test from 'node:test';
import relayProtocol from '../relay/slot-registry.js';

const { SlotRegistry, feedbackRoute } = relayProtocol;

test('registrar o mesmo controle novamente mantém a vaga original', () => {
  const registry = new SlotRegistry(4);

  assert.equal(registry.assign('controle-a'), 0);
  assert.equal(registry.assign('controle-a'), 0);
  assert.deepEqual(registry.presence(), [
    { slot: 0, occupied: true },
    { slot: 1, occupied: false },
    { slot: 2, occupied: false },
    { slot: 3, occupied: false },
  ]);
});

test('desconectar limpa qualquer vaga duplicada deixada por uma versão antiga', () => {
  const registry = new SlotRegistry(3);
  registry.slots[0] = 'controle-a';
  registry.slots[2] = 'controle-a';

  assert.equal(registry.release('controle-a'), true);
  assert.deepEqual(registry.presence().map((entry) => entry.occupied), [false, false, false]);
});

test('recusar um controle quando não há vaga não altera o registro', () => {
  const registry = new SlotRegistry(1);
  registry.assign('controle-a');

  assert.equal(registry.assign('controle-b'), -1);
  assert.equal(registry.slotOf('controle-b'), -1);
  assert.equal(registry.socketAt(0), 'controle-a');
});

test('feedback com vaga ocupada vai somente ao controle indicado', () => {
  const registry = new SlotRegistry(2);
  registry.assign('controle-a');

  assert.deepEqual(feedbackRoute(registry, { type: 'rumble', slot: 0 }), {
    type: 'socket',
    socketId: 'controle-a',
  });
});

test('feedback para vaga vazia é descartado em vez de ser transmitido a todos', () => {
  const registry = new SlotRegistry(2);
  registry.assign('controle-a');

  assert.deepEqual(feedbackRoute(registry, { type: 'rumble', slot: 1 }), {
    type: 'discard',
  });
});

test('feedback sem vaga continua sendo transmitido a todos os controles', () => {
  const registry = new SlotRegistry(2);

  assert.deepEqual(feedbackRoute(registry, { type: 'game-state' }), {
    type: 'broadcast',
  });
});
