import { execFileSync } from "node:child_process";
/** Reproducible staged visual checks; use visual-demo.mjs for actual full-race driving. */
import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
const out = process.env.EVIDENCE_DIR || "games/mario-kart/evidence/visual-v2";
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true }),
  report = {
    method: "Staged screenshots; full real-time race is in demo-report.json",
    errors: [],
    captures: [],
  };
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
  });
  page.on("pageerror", (e) => report.errors.push(e.message));
  page.on("console", (m) => {
    if (
      ["error", "warning"].includes(m.type()) &&
      /THREE\.|WebGL|GL_INVALID|feedback loop|FRAMEBUFFER/i.test(m.text())
    )
      report.errors.push(m.text());
  });
  await page.goto("http://localhost:8080/games/mario-kart/?evidence=1&sourceCourse=0");
  await page.waitForFunction(() =>
    window.__kart?.karts.every((k) => k.source === "glb"),
  );
  await page.waitForFunction(() => __kart.statue.userData.finishedModel);
  report.statueOwnership = await page.evaluate(() => {
    const geometries = new Set(),
      materials = new Set();
    for (const k of __kart.karts)
      k.model.traverse((o) => {
        if (o.geometry) geometries.add(o.geometry);
        for (const m of Array.isArray(o.material) ? o.material : [o.material])
          if (m) materials.add(m);
      });
    let sharedGeometry = 0,
      sharedMaterial = 0,
      meshes = 0;
    __kart.statue.traverse((o) => {
      if (o.isMesh) meshes++;
      if (geometries.has(o.geometry)) sharedGeometry++;
      for (const m of Array.isArray(o.material) ? o.material : [o.material])
        if (materials.has(m)) sharedMaterial++;
    });
    window.__statueReviewIdentity = __kart.statue.children[0].uuid;
    return { meshes, sharedGeometry, sharedMaterial };
  });
  assert.ok(report.statueOwnership.meshes > 0);
  assert.equal(report.statueOwnership.sharedGeometry, 0);
  assert.equal(report.statueOwnership.sharedMaterial, 0);
  await page.getByRole("button", { name: "Luigi", exact: true }).click();
  await page.waitForFunction(
    () =>
      __kart.karts[0].id === "luigi" &&
      __kart.karts.every((k) => k.source === "glb"),
  );
  await page.getByRole("button", { name: "Mario", exact: true }).click();
  await page.waitForFunction(
    () =>
      __kart.karts[0].id === "mario" &&
      __kart.karts.every((k) => k.source === "glb"),
  );
  assert.equal(
    await page.evaluate(
      () => __kart.statue.children[0].uuid === window.__statueReviewIdentity,
    ),
    true,
    "Changing characters must retain the independently owned sculpture",
  );
  report.statueSurvivesReset = true;
  report.vertexShading = await page.evaluate(() =>
    __kart.karts.map((k) => {
      let colors = 0, textures = 0;
      k.model.traverse((o) => {
        if (o.geometry?.attributes.color) colors++;
        if (o.isMesh && o.material?.map?.image?.width > 0) textures++;
      });
      return { name: k.id, coloredMeshes: colors, texturedMeshes: textures,
        sourcePack: k.model.getObjectByName("gamevitto-source-kart")?.userData.gamevittoSourcePack === 1 };
    }),
  );
  assert.ok(report.vertexShading.every((k) => k.sourcePack ? k.texturedMeshes >= 8 : k.coloredMeshes > 0),
    "Every local model must load its actual surface colors; source packs need driver, kart and four tire textures");
  await page.screenshot({ path: out + "/intro.png" });
  await page.keyboard.press("KeyF");
  await page.waitForFunction(() => !!document.fullscreenElement);
  await page.keyboard.press("KeyF");
  await page.waitForFunction(() => !document.fullscreenElement);
  report.fullscreen = true;
  await page.keyboard.press("KeyC");
  assert.ok(
    await page.locator("body").evaluate((e) => e.classList.contains("capture")),
  );
  report.cleanView = true;
  for (const [name, s] of [
    ["grid", null],
    ["bend", 280],
    ["underpass-entry", 100],
    ["underpass-crossing", 110],
    ["underpass-exit", 130],
    ["overpass-upper", 420],
    ["climb", 590],
    ["bank", 765],
    ["hairpin", 910],
    ["landing", 1150],
    ["landing-airborne", 1120],
    ["finish-turn", 1300],
    ["glider", null],
    ["drift", null],
  ]) {
    await page.evaluate(
      ({ name, s }) => {
        __kart.stage(
          name === "grid"
            ? "start"
            : ["glider", "drift"].includes(name)
              ? name
              : "antigrav",
        );
        if (s !== null) __kart.place(s);
        if (name === "landing-airborne") {
          Object.assign(__kart.race.player, {
            gliding: true,
            y: 23,
            flightY: 23,
            flight: 1,
            anti: false,
          });
        }
      },
      { name, s },
    );
    await page.waitForFunction(() =>
      __kart.karts.every((k) => k.source === "glb"),
    );
    await page.waitForTimeout(500);
    await page.screenshot({ path: out + "/" + name + ".png" });
    const hoverVisible = await page.evaluate(
      () => __kart.karts[0].hover.visible,
    );
    if (["climb", "bank", "hairpin"].includes(name))
      assert.equal(
        hoverVisible,
        true,
        "Banked anti-gravity wheels must light the road",
      );
    if (
      ["grid", "glider", "landing", "landing-airborne", "finish-turn"].includes(
        name,
      ) ||
      name.startsWith("underpass")
    )
      assert.equal(
        hoverVisible,
        false,
        "Ordinary road and flight must not have hover pools",
      );
    if (name.startsWith("underpass") || name === "overpass-upper") {
      const visible = await page.evaluate(() => ({
        id: __kart.karts[0].id,
        body: __kart.rayAt(720, 640)[0]?.racer,
        head: __kart.rayAt(720, 530)[0]?.racer,
      }));
      assert.equal(
        visible.body,
        visible.id,
        "The actual kart body must remain visible at the crossing",
      );
      assert.equal(
        visible.head,
        visible.id,
        "Crossing geometry must not cut through the driver's head",
      );
    }
    const imageContent = JSON.parse(
      execFileSync(
        "python3",
        ["games/mario-kart/review-frame.py", out + "/" + name + ".png"],
        { encoding: "utf8" },
      ),
    );
    report.captures.push({
      name,
      hoverVisible,
      imageContent,
      kind: "staged",
      ...(await page.evaluate(() => ({
        stats: __kart.stats,
        camera: __kart.cameraState,
      }))),
    });
  }
  // Inspect the exact canvas artwork used by the course materials at readable size.
  await page.evaluate(async () => {
    const { STADIUM_BRANDS, stadiumBrand } =
      await import("./stadium-brands.js");
    const { canvasTexture } = await import("./world.js");
    const gallery = document.createElement("div");
    gallery.id = "brand-review-gallery";
    gallery.style.cssText =
      "position:fixed;inset:0;z-index:9999;background:#101822;display:grid;grid-template-columns:512px 512px;gap:24px;align-content:center;justify-content:center";
    for (const name of STADIUM_BRANDS) {
      const canvas = document.createElement("canvas");
      canvas.width = 512;
      canvas.height = 128;
      canvas
        .getContext("2d")
        .drawImage(stadiumBrand(name, canvasTexture).image, 0, 0, 512, 128);
      gallery.append(canvas);
    }
    document.body.append(gallery);
  });
  await page.screenshot({ path: out + "/brand-gallery.png" });
  await page.evaluate(() =>
    document.getElementById("brand-review-gallery").remove(),
  );
  // Exercise the real event handler: clean capture suppresses tutorial-style
  // callouts while retaining lap and finish information.
  await page.evaluate(() => __kart.race.emit("bump", __kart.race.player));
  assert.equal(
    await page.locator("#notice").evaluate((e) => getComputedStyle(e).display),
    "none",
  );
  await page.evaluate(() => __kart.race.emit("finalLap", __kart.race.player));
  // The event updates content immediately; the next rendered frame unhides it.
  await page.waitForFunction(
    () =>
      getComputedStyle(document.getElementById("notice")).display !== "none",
  );
  assert.notEqual(
    await page.locator("#notice").evaluate((e) => getComputedStyle(e).display),
    "none",
  );
  report.cleanEventLabels = true;
  // Place an actual canopy mesh at the camera from its computed geometry bound.
  // This fixture does not copy the runtime's proximity threshold or height constant.
  await page.evaluate(() => {
    __kart.stage("glider");
    const r = __kart.race.racers[1],
      p = __kart.race.player;
    for (const key of [
      "x",
      "y",
      "z",
      "s",
      "heading",
      "lateral",
      "gliding",
      "anti",
      "flight",
    ])
      r[key] = p[key];
  });
  await page.waitForTimeout(150);
  await page.evaluate(() => {
    const k = __kart.karts[1],
      r = __kart.race.racers[1],
      p = __kart.race.player;
    const sail = k.glider.children.find((o) => o.isMesh);
    sail.geometry.computeBoundingSphere();
    sail.updateWorldMatrix(true, false);
    const center = sail.localToWorld(
      sail.geometry.boundingSphere.center.clone(),
    );
    const eye = __kart.cameraState.eye;
    const forward = center
      .clone()
      .set(p.x - eye[0], p.y + 1.5 - eye[1], p.z - eye[2])
      .normalize();
    const target = center
      .clone()
      .set(...eye)
      .addScaledVector(forward, 1.8);
    r.x += target.x - center.x;
    r.y += target.y - center.y;
    r.z += target.z - center.z;
  });
  await page.waitForTimeout(150);
  assert.equal(
    await page.evaluate(() => __kart.karts[1].glider.visible),
    false,
    "A rival canopy at the camera must not obscure gameplay",
  );
  await page.screenshot({ path: out + "/nearby-glider.png" });
  await page.evaluate(() => {
    __kart.race.racers[1].x += 40;
  });
  await page.waitForTimeout(150);
  assert.equal(
    await page.evaluate(() => __kart.karts[1].glider.visible),
    true,
    "A distant rival canopy must remain visible",
  );
  report.canopyClearance = true;
  report.broadcastFrames = await page.evaluate(() => __kart.broadcastFrames);
  report.broadcastAspect = await page.evaluate(() => {
    let root = __kart.statue;
    while (root.parent) root = root.parent;
    const screens = [];
    root.traverse((object) => {
      if (!object.material?.map?.isRenderTargetTexture) return;
      // Static batching removes primitive names/parameters. Recover the actual
      // physical edge lengths from the baked positions at three UV corners.
      const uv = object.geometry.attributes.uv;
      const positions = object.geometry.attributes.position;
      const corners = {};
      for (let i = 0; i < uv.count; i++) {
        const u = uv.getX(i),
          v = uv.getY(i);
        if (
          (u === 0 && v === 0) ||
          (u === 1 && v === 0) ||
          (u === 0 && v === 1)
        )
          corners[`${u},${v}`] = [
            positions.getX(i),
            positions.getY(i),
            positions.getZ(i),
          ];
      }
      const distance = (a, b) =>
        Math.hypot(...a.map((value, i) => value - b[i]));
      screens.push({
        panel:
          distance(corners["0,0"], corners["1,0"]) /
          distance(corners["0,0"], corners["0,1"]),
        feed:
          object.material.map.image.width / object.material.map.image.height,
      });
    });
    return screens;
  });
  assert.ok(report.broadcastAspect.length > 0);
  for (const screen of report.broadcastAspect)
    assert.ok(
      Math.abs(screen.panel - screen.feed) < 0.001,
      "Live feed must retain its aspect on the physical board",
    );
  assert.ok(
    report.broadcastFrames > 5,
    "Arena screens must receive live rendered frames",
  );
  await page.route("**/assets/mario-kart/**", (route) =>
    route.fulfill({ status: 404, body: "model-free verification" }),
  );
  await page.reload();
  await page.waitForFunction(() => __kart?.assets?.fallback === 8);
  await page.screenshot({ path: out + "/fallback.png" });
  report.fallback = true;
  assert.deepEqual(report.errors, []);
  console.log(
    "PASS",
    JSON.stringify({
      screenshots: report.captures.length,
      fullscreen: report.fullscreen,
      cleanView: report.cleanView,
      vertexShading: report.vertexShading,
    }),
  );
} finally {
  await writeFile(out + "/visual-checks.json", JSON.stringify(report, null, 2));
  await browser.close();
}
