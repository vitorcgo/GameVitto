import assert from 'node:assert/strict';
import test from 'node:test';
import { readStorage, writeStorage } from './storage.js';

test('leitura retorna o valor armazenado', () => {
  const storage = { getItem: () => '3' };
  assert.equal(readStorage('voltas', '1', storage), '3');
});

test('leitura protegida usa o padrão quando o armazenamento falha', () => {
  const storage = { getItem: () => { throw new Error('indisponível'); } };
  assert.equal(readStorage('voltas', '3', storage), '3');
});

test('gravação protegida informa sucesso e falha sem interromper o jogo', () => {
  const values = new Map();
  const storage = { setItem: (key, value) => values.set(key, value) };
  const blocked = { setItem: () => { throw new Error('bloqueado'); } };

  assert.equal(writeStorage('voltas', 1, storage), true);
  assert.equal(values.get('voltas'), '1');
  assert.equal(writeStorage('voltas', 1, blocked), false);
});
