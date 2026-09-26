/** Real Chromium evidence. Run against the already-started local HTTP server.
 * Scenario screenshots stage simulation states; keyboard and race progression
 * are independently exercised below. Every browser is closed in finally. */
import { chromium } from "playwright";
import { writeFile, mkdir } from "node:fs/promises";
import assert from "node:assert/strict";
const base=process.env.KART_URL || "http://localhost:8080";
const output = new URL("./evidence/", import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  headless: process.env.HEADED !== "1",
  channel: "chrome",
  args: ["--autoplay-policy=no-user-gesture-required"],
});
const report = {
  at: new Date().toISOString(),
  browser: "Installed Google Chrome / Playwright",
  checks: [],
  errors: [],
  screenshots: [],
};
const mark = (name, data = true) => {
  report.checks.push({ name, data });
  console.log(name, JSON.stringify(data));
};
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
  });
  page.on("pageerror", (e) => report.errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error" && m.text().includes("THREE."))
      report.errors.push(m.text());
  });
  await page.goto(base+"/games/mario-kart/?evidence=1&sourceCourse=0");
  await page.waitForFunction(() => window.__kart?.assets);
  assert.equal(await page.evaluate(() => __kart.assets.loaded), 8);
  mark(
    "All eight generated Blender GLBs loaded",
    await page.evaluate(() => __kart.assets),
  );
  await page.screenshot({ path: new URL("intro.png", output).pathname });
  await page.click("#mute");
  await page.keyboard.press("Enter"); await page.keyboard.press("Enter");
  await page.waitForFunction(
    () => __kart.race.state === "countdown" && __kart.audioState.gain === 0,
  );
  mark(
    "Mute before audio unlock stays muted",
    await page.evaluate(() => __kart.audioState),
  );
  await page.click("#mute");
  await page.waitForFunction(() => __kart.audioState.gain > 0);
  mark("Sound toggle restores master gain");
  await page.screenshot({ path: new URL("start-grid.png", output).pathname });
  report.screenshots.push({
    file: "start-grid.png",
    kind: "normal keyboard start",
  });
  // Hold gas in the actual page through event listeners, with no state teleport.
  await page.waitForFunction(() => __kart.race.time > 1.55);
  await page.keyboard.down("KeyZ");
  await page.waitForFunction(() => __kart.race.time > 4.2);
  const gas = await page.evaluate(() => ({
    speed: __kart.race.player.speed,
    progress: __kart.race.player.progress,
    boost: __kart.race.player.boost,
  }));
  assert.ok(gas.speed > 20);
  mark("Keyboard Z accelerates; timed rocket start", gas);
  assert.ok(await page.evaluate(() => __kart.audioState.samples.ready ? __kart.audioState.samples.loops.some(n=>n.slot==="motor" && n.rate>1) : __kart.audioState.frequency > 100));
  mark(
    "Actual Web Audio engine pitch rises with speed",
    await page.evaluate(() => __kart.audioState),
  );
  // Known PCM fixture served through the same optional-file fetch/decode route.
  const samples = 2205,
    wav = Buffer.alloc(44 + samples * 2);
  wav.write("RIFF");
  wav.writeUInt32LE(36 + samples * 2, 4);
  wav.write("WAVEfmt ", 8);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(22050, 24);
  wav.writeUInt32LE(44100, 28);
  wav.writeUInt16LE(2, 32);
  wav.writeUInt16LE(16, 34);
  wav.write("data", 36);
  wav.writeUInt32LE(samples * 2, 40);
  for (let i = 0; i < samples; i++)
    wav.writeInt16LE(
      Math.round(Math.sin((i * 2 * Math.PI * 880) / 22050) * 3000),
      44 + i * 2,
    );
  if (await page.evaluate(()=>__kart.audioState.samples.ready)) {
    await page.evaluate(()=>__kart.race.onEvent({type:'coin',racer:0}));
    assert.ok(await page.evaluate(()=>__kart.audioState.samples.events.some(e=>e.key==='coin')));
    mark('Original coin sample reaches the running Web Audio mix');
  } else {
  await page.route("**/audio/mk-coin.mp3", (r) =>
    r.fulfill({ status: 200, contentType: "audio/wav", body: wav }),
  );
  await page.evaluate(() => __kart.race.onEvent({ type: "coin", racer: 0 }));
  await page.waitForFunction(() =>
    __kart.audioState.overrides.includes("mk-coin"),
  );
  mark("Optional audio override fetches and decodes through core AudioEngine");
  }
  const h = await page.evaluate(() => __kart.race.player.heading);
  await page.keyboard.down("ArrowRight");
  await page.waitForTimeout(240);
  await page.keyboard.up("ArrowRight");
  const h2 = await page.evaluate(() => __kart.race.player.heading);
  assert.ok(Math.abs(h2 - h) > 0.03);
  mark("ArrowRight changes actual world heading", { before: h, after: h2 });
  await page.keyboard.down("ShiftLeft");
  await page.keyboard.down("ArrowRight");
  await page.waitForTimeout(250);
  const drifting = await page.evaluate(() => ({
    drift: __kart.race.player.drift,
    charge: __kart.race.player.charge,
  }));
  assert.ok(drifting.drift);
  mark("Shift+steer enters drift through keyboard", drifting);
  await page.keyboard.up("ShiftLeft");
  await page.keyboard.up("ArrowRight");
  await page.keyboard.up("KeyZ");
  const beforeBrake = await page.evaluate(() => __kart.race.player.speed);
  await page.keyboard.down("KeyX");
  await page.waitForTimeout(500);
  await page.keyboard.up("KeyX");
  const afterBrake = await page.evaluate(() => __kart.race.player.speed);
  assert.ok(afterBrake < beforeBrake);
  mark("X brake slows actual race state", { beforeBrake, afterBrake });
  await page.evaluate(() => {
    __kart.race.player.item = "mushroom";
  });
  await page.keyboard.press("Space");
  await page.waitForTimeout(100);
  assert.equal(await page.evaluate(() => __kart.race.player.item), null);
  mark("Space consumes item through real keyboard handler");
  await page.keyboard.press("Escape");
  assert.ok(await page.evaluate(() => __kart.paused));
  const t = await page.evaluate(() => __kart.race.time);
  await page.waitForTimeout(200);
  assert.equal(await page.evaluate(() => __kart.race.time), t);
  await page.keyboard.press("Enter");
  mark("Pause halts simulation and Enter resumes");
  for (const name of ["drift", "antigrav", "glider", "hit", "results"]) {
    await page.evaluate((name) => __kart.stage(name), name);
    await page.waitForTimeout(600);
    const filename = {
      drift: "drift-sparks.png",
      antigrav: "anti-gravity.png",
      glider: "glider.png",
      hit: "item-hit.png",
      results: "results.png",
    }[name];
    await page.screenshot({ path: new URL(filename, output).pathname });
    report.screenshots.push({
      file: filename,
      kind:
        name === "results"
          ? "complete real simulation using CPU planner for player"
          : "explicitly staged simulation state",
    });
    if (name === "results") {
      const result = await page.evaluate(() => ({
        state: __kart.race.state,
        racers: __kart.race.standings.map((r) => ({
          name: r.character.name,
          time: r.finishTime,
          checkpoints: r.checkpoints,
        })),
      }));
      assert.equal(result.state, "results");
      assert.ok(result.racers.every((r) => r.checkpoints === 24 && r.time > 0));
      mark("Three laps and eight genuine finish times", result);
    }
  }
  // Clean-source fallback: block the optional local asset route without deleting
  // any files, then prove all eight fallback sculptures render.
  const fallback = await browser.newPage({
    viewport: { width: 1280, height: 800 },
  });
  fallback.on("pageerror", (e) => report.errors.push(e.message));
  await fallback.route("**/assets/mario-kart/**", (r) =>
    r.fulfill({ status: 404, body: "" }),
  );
  await fallback.goto(base+"/games/mario-kart/?evidence=1&sourceCourse=0");
  await fallback.waitForFunction(() => window.__kart?.assets);
  assert.equal(await fallback.evaluate(() => __kart.assets.fallback), 8);
  await fallback.screenshot({
    path: new URL("procedural-fallback.png", output).pathname,
  });
  mark("Asset-free fallback renders all eight racers");
  await fallback.close();
  const games = await page.request
    .get(base+"/api/games")
    .then((r) => r.json());
  assert.equal(games[0].slug, "mario-kart");
  assert.equal(games[1].slug, "fruit-ninja");
  mark(
    "Launcher order",
    games.map((g) => g.slug),
  );
  assert.equal(
    (
      await page.request.get(
        base+"/assets/mario-kart/mario.glb",
      )
    ).status(),
    200,
  );
  assert.equal(
    (
      await page.request.get(
        base+"/vendor/three-examples/loaders/GLTFLoader.js",
      )
    ).status(),
    200,
  );
  mark("Static GLB and Three examples routes");
  // Controller profile and real multi-touch DOM events. Sensor permission gate
  // is hidden only for this hardware-free DOM check; sensors are NOT claimed.
  const phone = await browser.newPage({
    viewport: { width: 844, height: 390 },
    isMobile: true,
    hasTouch: true,
  });
  phone.on("pageerror", (e) => report.errors.push(e.message));
  await phone.goto(base+"/controller");
  await phone.waitForSelector("body.wheel-mode");
  await phone.evaluate(() => {
    document.getElementById("gate").classList.add("hide");
    document.getElementById("remote").classList.remove("asleep");
  });
  await page.evaluate(() => {
    __kart.stage("start");
    __kart.freeze = false;
    __kart.wheel.reset();
  });
  for (let i = 0; i < 15; i++) {
    await phone.evaluate(() =>
      socket.emit("orientation", { alpha: 270, beta: 20, gamma: 10 }),
    );
    await phone.waitForTimeout(35);
  }
  assert.equal(await page.evaluate(() => __kart.wheel.ref), null);
  assert.ok(await page.locator("#wheel-ready").isVisible());
  const heldAt = await page.evaluate(() => __kart.race.time);
  for (let i = 0; i < 8; i++) {
    await phone.evaluate(() =>
      socket.emit("orientation", { alpha: 270, beta: 20, gamma: 10 }),
    );
    await phone.waitForTimeout(35);
  }
  assert.equal(await page.evaluate(() => __kart.race.time), heldAt);
  mark(
    "Wrong-time wheel capture holds countdown instead of starting a broken race",
  );
  for (let i = 0; i < 24; i++) {
    await phone.evaluate(() =>
      socket.emit("orientation", { alpha: 270, beta: 0, gamma: 10 }),
    );
    await phone.waitForTimeout(30);
  }
  assert.ok(await page.evaluate(() => __kart.wheel.ref));
  mark("Stable level sensor packets arm wheel and release countdown");
  const gasBox = await phone.locator("#btn-2").boundingBox(),
    driftBox = await phone.locator("#btn-a").boundingBox();
  assert.ok(gasBox && driftBox);
  assert.ok(gasBox.width >= 44 && driftBox.width >= 64);
  const client = await phone.context().newCDPSession(phone);
  const touch = (box, id) => ({
    x: box.x + box.width / 2,
    y: box.y + box.height / 2,
    id,
  });
  await client.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [touch(gasBox, 1), touch(driftBox, 2)],
  });
  await page.waitForFunction(
    () => __kart.wheel.buttons["2"] && __kart.wheel.buttons.A,
  );
  mark("Phone simultaneous gas and drift press reaches game");
  await client.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [touch(driftBox, 2)],
  });
  await page.waitForFunction(
    () => __kart.wheel.buttons["2"] && !__kart.wheel.buttons.A,
  );
  mark("Releasing A retains held gas");
  await client.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await page.waitForFunction(() => !__kart.wheel.buttons["2"]);
  mark("Releasing gas reaches game");
  await phone.screenshot({ path: new URL("phone-wheel.png", output).pathname });
  await page.close();
  await phone.waitForFunction(
    () => !document.body.classList.contains("wheel-mode"),
  );
  mark("Wheel profile expires after game closes");
  await phone.locator("#btn-2").tap();
  assert.ok(
    await phone
      .locator("#sheet")
      .evaluate((el) => el.classList.contains("open")),
  );
  mark("Legacy button 2 still opens diagnostic sheet");
  await phone.close();
  assert.deepEqual(report.errors, []);
  mark("No browser JavaScript errors");
} finally {
  await writeFile(
    new URL("browser-report.json", output),
    JSON.stringify(report, null, 2),
  );
  await browser.close();
}
