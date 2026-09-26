import assert from 'node:assert/strict';
import test from 'node:test';
import certificateTools from '../scripts/gen-cert.js';

const { choosePreferredAddress, isPrivateLanAddress } = certificateTools;
const ip = (...parts) => parts.join('.');

test('reconhece as três faixas de rede local', () => {
  assert.equal(isPrivateLanAddress(ip(10, 4, 3, 2)), true);
  assert.equal(isPrivateLanAddress(ip(172, 20, 3, 2)), true);
  assert.equal(isPrivateLanAddress(ip(192, 168, 3, 2)), true);
  assert.equal(isPrivateLanAddress(ip(198, 51, 100, 2)), false);
});

test('prefere a rede local mesmo quando outro adaptador aparece primeiro', () => {
  const otherAdapter = ip(198, 51, 100, 20);
  const localNetwork = ip(192, 168, 50, 20);

  assert.equal(choosePreferredAddress([otherAdapter, localNetwork]), localNetwork);
});

test('mantém a ordem do sistema entre endereços com a mesma prioridade', () => {
  const first = ip(10, 20, 30, 40);
  const second = ip(192, 168, 10, 20);

  assert.equal(choosePreferredAddress([first, second]), first);
  assert.equal(choosePreferredAddress([]), null);
});
