import assert from 'node:assert/strict';
import test from 'node:test';
import { PRESENTATION_ORBIT_MS, presentationCameraPose } from './presentation-camera.js';

const player = { x: 10, y: 2, z: -5, heading: 0 };

test('a apresentação percorre lados opostos do kart em meia volta', () => {
  const start = presentationCameraPose(player, 0);
  const opposite = presentationCameraPose(player, PRESENTATION_ORBIT_MS / 2);

  assert.ok(Math.abs((start.eye.x - player.x) + (opposite.eye.x - player.x)) < 1e-9);
  assert.ok(Math.abs((start.eye.z - player.z) + (opposite.eye.z - player.z)) < 1e-9);
});

test('a câmera de apresentação sempre mira o centro do kart', () => {
  const pose = presentationCameraPose(player, PRESENTATION_ORBIT_MS / 3);

  assert.deepEqual(pose.aim, { x: 10, y: 3.35, z: -5 });
});
