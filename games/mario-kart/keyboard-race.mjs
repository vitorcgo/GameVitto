/** Full real-time race using only Z and arrow key events. A separate geometric
 * path follower drives the keyboard; it never writes simulation state. */
import { chromium } from "playwright";
import { writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
const browser = await chromium.launch({
  headless: true,
  channel: "chrome",
  args: ["--autoplay-policy=no-user-gesture-required"],
});
const report = {
  started: new Date().toISOString(),
  method:
    "Real-time Playwright keyboard events; independent look-ahead controller reads track geometry and race pose. No player state writes.",
  samples: [],
  errors: [],
};
try {
  const page = await browser.newPage({
    viewport: { width: 1280, height: 800 },
  });
  page.on("pageerror", (e) => report.errors.push(e.message));
  await page.goto("http://localhost:8080/games/mario-kart/?evidence=1");
  await page.waitForFunction(() => window.__kart?.assets);
  await page.evaluate(async () => {
    window.trackGeometry = await import("./track.js");
  });
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => __kart.race.state === "racing");
  await page.keyboard.down("KeyZ");
  let direction = 0,
    lastSample = 0,
    lastLap = 1,
    seenAnti = false,
    seenGlider = false;
  const start = Date.now();
  let frames0 = await page.evaluate(() => __kart.renderCount);
  while (Date.now() - start < 240000) {
    const state = await page.evaluate(() => {
      const r = __kart.race.player,
        p = trackGeometry.surfaceAt(r.s + Math.max(12, r.speed * 0.48), 0);
      return {
        state: __kart.race.state,
        x: r.x,
        z: r.z,
        y: r.y,
        heading: r.heading,
        s: r.s,
        speed: r.speed,
        lap: r.lap,
        progress: r.progress,
        lateral: r.lateral,
        anti: r.anti,
        gliding: r.gliding,
        finish: r.finishTime,
        target: p,
        frames: __kart.renderCount,
        stats: __kart.stats,
      };
    });
    if (state.state === "results") {
      report.result = await page.evaluate(() =>
        __kart.race.standings.map((r) => ({
          name: r.character.name,
          time: r.finishTime,
          checkpoints: r.checkpoints,
        })),
      );
      await page.screenshot({
        path: "games/mario-kart/evidence/keyboard-results.png",
      });
      break;
    }
    const targetHeading = Math.atan2(
      state.target.x - state.x,
      -(state.target.z - state.z),
    );
    const error = Math.atan2(
      Math.sin(targetHeading - state.heading),
      Math.cos(targetHeading - state.heading),
    );
    const desired = error > 0.045 ? 1 : error < -0.045 ? -1 : 0;
    if (desired !== direction) {
      if (direction)
        await page.keyboard.up(direction > 0 ? "ArrowRight" : "ArrowLeft");
      if (desired)
        await page.keyboard.down(desired > 0 ? "ArrowRight" : "ArrowLeft");
      direction = desired;
    }
    if (!seenAnti && state.anti) {
      seenAnti = true;
      await page.screenshot({
        path: "games/mario-kart/evidence/keyboard-antigravity.png",
      });
    }
    if (!seenGlider && state.gliding) {
      seenGlider = true;
      await page.screenshot({
        path: "games/mario-kart/evidence/keyboard-glider.png",
      });
    }
    if (Date.now() - lastSample > 10000) {
      lastSample = Date.now();
      report.samples.push({
        elapsed: (Date.now() - start) / 1000,
        ...state,
        target: undefined,
      });
      console.log("keyboard race", JSON.stringify(report.samples.at(-1)));
    }
    lastLap = state.lap;
    await page.waitForTimeout(45);
  }
  await page.keyboard.up("KeyZ");
  if (direction)
    await page.keyboard.up(direction > 0 ? "ArrowRight" : "ArrowLeft");
  report.elapsed = (Date.now() - start) / 1000;
  report.frames = (await page.evaluate(() => __kart.renderCount)) - frames0;
  report.averageRenderedFPS = report.frames / report.elapsed;
  report.seenAnti = seenAnti;
  report.seenGlider = seenGlider;
  assert.ok(
    report.result,
    "Keyboard driver completes a full race within four minutes",
  );
  assert.equal(report.result.length, 8);
  assert.ok(seenAnti && seenGlider);
  assert.deepEqual(report.errors, []);
  console.log(
    "PASS",
    JSON.stringify({
      elapsed: report.elapsed,
      fps: report.averageRenderedFPS,
      result: report.result,
    }),
  );
} finally {
  await writeFile(
    "games/mario-kart/evidence/keyboard-race.json",
    JSON.stringify(report, null, 2),
  );
  await browser.close();
}
