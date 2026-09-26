import { axesFromSample } from "../../core/orientation.js";
import { clamp } from "./track.js";

const DEG = Math.PI / 180;
const clamp1 = (v) => (v < -1 ? -1 : v > 1 ? 1 : v);
const STEER_FULL = 18;
const STEER_DEADZONE = 2.5;
const BIAS_HEAL_BAND = 4.5;
const BIAS_HEAL_TAU_S = 6;
const BIAS_SETTLE_S = 2;
const BIAS_SETTLE_TAU_S = 0.6;

function captureTray(axes, prevRight = null) {
  const vx = -axes.z.x;
  const vy = -axes.z.y;
  const magnitude = Math.hypot(vx, vy);
  let right = prevRight || { x: 1, y: 0 };
  if (magnitude > 0.05) right = { x: vy / magnitude, y: -vx / magnitude };

  const sy = axes.y.x * right.x + axes.y.y * right.y >= 0 ? 1 : -1;
  const ref = { right, sy, bank0: 0 };
  ref.bank0 = trayRead(axes, ref).bank;
  return ref;
}

function trayRead(axes, ref) {
  const rightEndZ = ref.sy * axes.y.z;
  return { bank: -Math.asin(clamp1(rightEndZ)) / DEG - ref.bank0 };
}

function shapeSteer(bankDeg) {
  const amount = Math.abs(bankDeg);
  if (amount <= STEER_DEADZONE) return 0;
  const sign = bankDeg < 0 ? -1 : 1;
  // Keep the stable neutral zone, but bring useful steering in earlier. The
  // previous linear curve required a large phone tilt before tight corners
  // became practical, while preserving the same 18-degree full-lock point.
  const normalized = Math.min(1, (amount - STEER_DEADZONE) / (STEER_FULL - STEER_DEADZONE));
  return sign * Math.pow(normalized, 0.82) * STEER_FULL;
}

class SteerFilter {
  constructor() {
    this.bias = 0;
    this.ageS = 0;
  }

  update(rawBank, dt) {
    this.ageS += dt;
    const corrected = rawBank - this.bias;
    if (Math.abs(corrected) < BIAS_HEAL_BAND) {
      const tau = this.ageS < BIAS_SETTLE_S ? BIAS_SETTLE_TAU_S : BIAS_HEAL_TAU_S;
      this.bias += Math.min(1, dt / tau) * (rawBank - this.bias);
    }
    return shapeSteer(corrected);
  }
}

/** Safe, device-pinned tray steering for the GameVitto wheel remote. */
export class WheelInput {
  constructor({ invert = false } = {}) {
    this.invert = invert;
    this.ref = null;
    this.filter = new SteerFilter();
    this.lastAt = -Infinity;
    this.lastButtonsAt = -Infinity;
    this.value = 0;
    this.buttons = {};
    this.stable = [];
    this.lastAxes = null;
    this.status = "Mantenha o volante nivelado";
    this.armed = false;
  }
  reset() {
    this.ref = null;
    this.filter = new SteerFilter();
    this.stable = [];
    this.value = 0;
    this.armed = false;
    this.status = "Mantenha o volante nivelado";
  }
  release() {
    this.buttons = {};
    this.value = 0;
    this.armed = false;
  }
  sample(sample, now, { canCapture = false } = {}) {
    if (!sample || !Number.isFinite(now)) return false;
    const vals = sample.quat || [sample.alpha, sample.beta, sample.gamma];
    if (!Array.isArray(vals) || vals.some((v) => !Number.isFinite(v)))
      return false;
    if (
      sample.quat &&
      (vals.length !== 4 || Math.abs(Math.hypot(...vals) - 1) > 0.05)
    )
      return false;
    const axes = axesFromSample(sample);
    const dt = clamp((now - this.lastAt) / 1000, 1 / 240, 0.1);
    this.lastAt = now;
    this.lastAxes = axes;
    if (sample.buttons) this.setButtons(sample.buttons, now);
    if (!this.ref && canCapture) {
      // Long axis must be level; z axis must face mostly up. A turned wheel at
      // countdown is rejected, not silently learned as straight for the race.
      if (Math.abs(axes.y.z) > 0.0436 || axes.z.z < 0.7) {
        this.stable = [];
        this.status = "Nivele o volante. Use R ou − para recentralizar";
        return true;
      }
      this.stable.push({ axes, at: now });
      this.stable = this.stable.filter((s) => now - s.at <= 650);
      const zs = this.stable.map((s) => s.axes.y.z);
      if (
        this.stable.length >= 10 &&
        now - this.stable[0].at >= 450 &&
        Math.max(...zs) - Math.min(...zs) < 0.035
      ) {
        this.ref = captureTray(axes);
        this.filter = new SteerFilter();
        this.status = "Volante pronto";
        this.armed = true;
      }
    }
    if (this.ref) {
      const raw = trayRead(axes, this.ref).bank;
      // Learn small resting bias only while stationary/counting in. During a
      // held corner retain the player's deliberate input, regardless of duration.
      const shaped = canCapture
        ? this.filter.update(raw, dt)
        : this.filter.update(raw, 0);
      this.value = clamp(shaped / STEER_FULL, -1, 1) * (this.invert ? -1 : 1);
      this.armed = true;
      this.status = "Volante pronto";
    }
    return true;
  }
  setButtons(buttons, now) {
    if (!buttons || typeof buttons !== "object") return;
    this.buttons = Object.fromEntries(
      ["A", "B", "1", "2", "up", "down", "left", "right"].map((k) => [k, buttons[k] === true]),
    );
    this.lastButtonsAt = now;
  }
  command(cmd, now) {
    if (cmd.type === "buttons") this.setButtons(cmd.buttons, now);
    if (cmd.type === "button" && cmd.button) {
      this.buttons[cmd.button] = cmd.pressed !== false;
      this.lastButtonsAt = now;
    }
    if (cmd.type === "button-up") {
      this.buttons[cmd.button] = false;
      this.lastButtonsAt = now;
    }
  }
  read(now) {
    const live = now - this.lastAt < 450,
      buttonsLive = now - this.lastButtonsAt < 650;
    // Packet loss cannot leave gas/drift stuck, even if no disconnect event arrives.
    if (!live) {
      this.value = 0;
      this.armed = false;
    }
    const b = buttonsLive ? this.buttons : {};
    return {
      steer: live && this.armed ? this.value : 0,
      gas: !!b["2"],
      brake: !!b["1"],
      drift: !!b.A,
      item: !!b.right,
      live,
      status: live ? this.status : "Sinal do volante perdido. Teclado disponível",
    };
  }
}
