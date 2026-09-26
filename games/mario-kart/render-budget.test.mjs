import assert from 'node:assert/strict';
import test from 'node:test';
import { RenderBudget } from './render-budget.js';

function feed(budget, frameMs, frames) {
  let change = null;
  for (let frame = 0; frame < frames; frame += 1) change = budget.sample(frameMs) || change;
  return change;
}

test('ativa o modo de desempenho quando os quadros ficam acima do orçamento', () => {
  const budget = new RenderBudget({ windowSize: 10 });
  assert.equal(feed(budget, 45, 10), 'performance');
  assert.equal(budget.quality, 'performance');
});

test('não reage a pausas da aba ou medições inválidas', () => {
  const budget = new RenderBudget({ windowSize: 3 });
  for (const value of [NaN, Infinity, 0, 400]) assert.equal(budget.sample(value), null);
  assert.equal(budget.count, 0);
  assert.equal(budget.quality, 'balanced');
});

test('só restaura a qualidade após três janelas com folga real de desempenho', () => {
  const budget = new RenderBudget({ windowSize: 4 });
  feed(budget, 40, 4);
  assert.equal(feed(budget, 13, 8), null);
  assert.equal(feed(budget, 13, 4), 'balanced');
});
