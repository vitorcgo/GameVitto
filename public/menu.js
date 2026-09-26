import { Pointer } from '/core/pointer.js';
import { saveSensitivity, loadSensitivity } from '/core/calibration.js';
import { AudioEngine } from '/core/audio.js';
import { GameLink } from '/core/net.js';
import { clamp } from '/core/orientation.js';

const $ = (id) => document.getElementById(id);
const inputs = new Map();
const audio = new AudioEngine();
let currentGame = null;
let launching = false;
let toastUntil = 0;

function inputFor(slot) {
  let input = inputs.get(slot);
  if (input) return input;

  const pointer = new Pointer({});
  pointer.sensitivity = (slot === 0 ? loadSensitivity() : null) ?? 1;
  pointer.setViewport(innerWidth, innerHeight);
  const marker = document.createElement('div');
  marker.className = 'remote-pointer';
  marker.textContent = `P${slot + 1}`;
  $('pointer-layer').appendChild(marker);
  input = { pointer, marker, lastSampleAt: 0, hovered: null };
  inputs.set(slot, input);
  return input;
}

inputFor(0);

function ensureAudio() {
  for (const cue of ['menu-hover', 'menu-select', 'menu-back']) audio.loadOverride(cue);
  audio.unlock().then((ok) => {
    if (ok && !audio.music && !launching) audio.startMusic();
  });
}

function showToast(message) {
  $('toast').textContent = message;
  $('toast').classList.add('on');
  toastUntil = performance.now() + 1500;
}

function updateConnection(presence) {
  const count = Number(presence?.controller) || 0;
  $('connection').classList.toggle('connected', count > 0);
  $('connection-text').textContent = count === 0
    ? 'Nenhum controle conectado'
    : count === 1 ? 'Controle conectado' : `${count} controles conectados`;

  for (const slot of presence?.slots || []) {
    if (slot.occupied) continue;
    const input = inputs.get(slot.slot);
    if (!input) continue;
    input.pointer.live = false;
    input.marker.classList.remove('visible');
    setHovered(input, null);
  }
}

function setHovered(input, element) {
  if (input.hovered === element) return;
  input.hovered?.classList.remove('is-hovered');
  input.hovered = element;
  input.hovered?.classList.add('is-hovered');
  if (element) audio.play('menu-hover');
}

function recenter(slot = 0) {
  ensureAudio();
  inputFor(slot).pointer.recentre();
  audio.play('menu-select');
  showToast(`Ponteiro P${slot + 1} recentralizado`);
}

function adjustSpeed(slot, factor) {
  const pointer = inputFor(slot).pointer;
  pointer.sensitivity = clamp(pointer.sensitivity * factor, 0.2, 6);
  if (slot === 0) saveSensitivity(pointer.sensitivity);
  showToast(`Velocidade do ponteiro: ${Math.round(pointer.sensitivity * 100)}%`);
}

function activate(slot = 0) {
  ensureAudio();
  const target = inputFor(slot).hovered;
  if (target?.dataset.action === 'launch') launchGame();
  else if (target?.dataset.action === 'pair') showToast('Leia o código QR com o celular');
}

function launchGame() {
  if (launching || !currentGame) return;
  launching = true;
  ensureAudio();
  audio.play('menu-select');
  audio.stopMusic();
  link.feedback({ type: 'launch', game: currentGame.slug });

  try {
    sessionStorage.setItem('gamevitto.launch', JSON.stringify({
      slug: currentGame.slug,
      title: currentGame.title,
      emoji: currentGame.emoji || '🏎️',
      c0: '#2b7ec1',
      c1: '#2b7ec1',
      t: Date.now(),
    }));
  } catch { /* A navegação funciona mesmo sem armazenamento local. */ }

  const overlay = document.createElement('div');
  overlay.id = 'launch';
  overlay.innerHTML = '<img src="/games/mario-kart/menu-logo.svg" alt="Mario Kart">';
  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('show'));
  setTimeout(() => { location.href = currentGame.url; }, 520);
}

const link = new GameLink({
  onOrientation: (sample, slot) => {
    const now = performance.now();
    const input = inputFor(slot);
    const dt = input.lastSampleAt ? clamp((now - input.lastSampleAt) / 1000, 1 / 240, 0.1) : 1 / 60;
    input.lastSampleAt = now;
    input.pointer.update(sample, dt, now);
  },
  onCommand: (command, slot) => {
    if (command.type === 'button' && command.pressed !== false && command.button === 'A') activate(slot);
    else if (command.type === 'button' && command.pressed !== false && command.button === 'B') audio.play('menu-back');
    else if (command.type === 'calibrate' || command.type === 'recentre') recenter(slot);
    else if (command.type === 'speed') adjustSpeed(slot, command.factor || 1);
  },
  onPresence: updateConnection,
});

function frame(now) {
  for (const input of inputs.values()) {
    const pointer = input.pointer;
    if (pointer.live && now - pointer.lastSeen > 500) pointer.live = false;
    if (!pointer.live || launching) {
      input.marker.classList.remove('visible');
      setHovered(input, null);
      continue;
    }

    const aim = pointer.sampleAt(now);
    const x = clamp(aim.x, 0, 1) * innerWidth;
    const y = clamp(aim.y, 0, 1) * innerHeight;
    input.marker.style.left = `${x}px`;
    input.marker.style.top = `${y}px`;
    input.marker.classList.add('visible');
    const target = document.elementFromPoint(x, y)?.closest('[data-action]') || null;
    setHovered(input, target);
  }

  if (toastUntil && now > toastUntil) {
    toastUntil = 0;
    $('toast').classList.remove('on');
  }
  requestAnimationFrame(frame);
}

fetch('/api/games')
  .then((response) => response.json())
  .then((games) => {
    currentGame = games.find((game) => game.slug === 'mario-kart') || games[0] || null;
    if (!currentGame) {
      $('game-title').textContent = 'Nenhum jogo disponível';
      $('game-tagline').textContent = 'Adicione um jogo para começar.';
      return;
    }
    $('game-title').textContent = currentGame.title;
    $('game-tagline').textContent = currentGame.tagline || 'Uma corrida completa usando o celular como volante.';
    $('game-card').disabled = false;
  })
  .catch(() => {
    $('game-title').textContent = 'Não foi possível carregar o jogo';
    $('game-tagline').textContent = 'Reinicie o servidor e tente novamente.';
  });

fetch('/api/pairing')
  .then((response) => response.json())
  .then(({ qr }) => {
    $('pair-qr').src = qr;
    $('pair-card').classList.add('pair-ready');
  })
  .catch(() => { $('pair-loading').textContent = 'QR indisponível'; });

$('game-card').addEventListener('click', launchGame);
$('game-card').addEventListener('mouseenter', () => { ensureAudio(); audio.play('menu-hover'); });
window.addEventListener('pointerdown', ensureAudio, { once: true });
window.addEventListener('resize', () => {
  for (const input of inputs.values()) input.pointer.setViewport(innerWidth, innerHeight);
});
window.addEventListener('keydown', (event) => {
  ensureAudio();
  if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); launchGame(); }
  else if (event.key.toLowerCase() === 'r' || event.key.toLowerCase() === 'c') recenter();
  else if (event.key === 'ArrowRight') adjustSpeed(0, 1.12);
  else if (event.key === 'ArrowLeft') adjustSpeed(0, 1 / 1.12);
});

setTimeout(() => { ensureAudio(); }, 300);
requestAnimationFrame(frame);

window.__gamevitto = { inputs, audio, link, launchGame };
