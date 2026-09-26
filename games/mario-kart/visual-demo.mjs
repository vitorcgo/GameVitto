import {captureArgs,startAV,stopAV} from './review-av.mjs';
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
/** Review recording driven only by real keyboard events. Not a real phone demo. */
import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
const out = process.env.EVIDENCE_DIR || "games/mario-kart/evidence/visual-v2";
await mkdir(out, { recursive: true });
const record = process.env.RECORD !== "0";
const recordAudio=process.env.RECORD_AUDIO==='1';let avActive=false;
const driveWide=process.env.REVIEW_BOOST_LANES==='1';
const traceCamera=process.env.REVIEW_CAMERA_TRACE==='1';
let sourceCourse = process.env.SOURCE_COURSE === "1";
const browser = await chromium.launch({
  channel: "chrome",
  headless: true,
  args: ["--autoplay-policy=no-user-gesture-required",...(recordAudio?captureArgs:[])],
});
let context, video;
const loadedFiles = [];
const report = {
  reviewRoute:driveWide?'Outer boost lanes, with real keyboard steering':'Center route, with real keyboard steering',
  method:
    "Real-time keyboard-only geometric driver. Phone handling still requires a practical acceptance test.",
  viewport: [1440, 900],
  recording: record,
  sourceCourse,
  errors: [],
  loadedFiles: {},
  samples: [],
};
try {
  context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    ...(record && !recordAudio
      ? { recordVideo: { dir: out, size: { width: 1440, height: 900 } } }
      : {}),
  });
  const videoStarted=Date.now();
  const page = await context.newPage();
  video = record && !recordAudio ? page.video() : null;
  // Chrome's default inspector buffer can evict the 50 MB course response.
  // Capture that resource through our own explicitly sized CDP session.
  const network = await context.newCDPSession(page);
  await network.send('Network.enable', {maxTotalBufferSize:256*1024*1024,maxResourceBufferSize:128*1024*1024});
  const largeResponses = new Map();
  network.on('Network.responseReceived', e => {
    const url = new URL(e.response.url);
    if (url.pathname === '/assets/mario-kart/stadium-source.glb') largeResponses.set(e.requestId,{path:url.pathname,status:e.response.status});
  });
  network.on('Network.loadingFinished', e => {
    const meta = largeResponses.get(e.requestId);
    if (!meta) return;
    loadedFiles.push((async()=>{
      const data = await network.send('Network.getResponseBody',{requestId:e.requestId});
      const bytes = Buffer.from(data.body,data.base64Encoded?'base64':'utf8');
      report.loadedFiles[meta.path]={sha256:createHash('sha256').update(bytes).digest('hex'),bytes:bytes.length,status:meta.status};
    })().catch(error=>report.errors.push('Evidence large response: '+error.message)));
  });

  // Hash the bytes actually consumed, including asynchronous GLBs. Repository
  // snapshots alone cannot prove what a browser loaded during active editing.
  page.on("response", (response) => {
    const url = new URL(response.url());
    if (url.pathname === '/assets/mario-kart/stadium-source.glb') return;
    if (
      !/^\/(games\/mario-kart\/|assets\/mario-kart\/)/.test(url.pathname) ||
      !/(\.(js|mjs|css|html|glb|png|svg|webp|json|wav|ogg)|\/)$/.test(url.pathname)
    )
      return;
    loadedFiles.push(
      (async () => {
        const body = await response.body();
        if(url.pathname==='/assets/mario-kart/manifest.json'&&response.ok())report.assetManifest=JSON.parse(body.toString('utf8'));
        report.loadedFiles[
          url.pathname.endsWith("/")
            ? url.pathname + "index.html"
            : url.pathname
        ] = {
          sha256: createHash("sha256").update(body).digest("hex"),
          bytes: body.length,
          status: response.status(),
        };
      })().catch((error) =>
        report.errors.push("Evidence response: " + error.message),
      ),
    );
  });
  page.on("pageerror", (e) => report.errors.push(e.message));
  page.on("console", (m) => {
    if (
      ["error", "warning"].includes(m.type()) &&
      /THREE\.|WebGL|GL_INVALID|feedback loop|FRAMEBUFFER/i.test(m.text())
    )
      report.errors.push(m.text());
  });
  await page.goto((process.env.KART_URL || "http://localhost:8080") + "/games/mario-kart/?evidence=1" + (sourceCourse ? "&sourceCourse=1" : process.env.SOURCE_COURSE === "0" ? "&sourceCourse=0" : ""));
  await page.waitForFunction(() =>
    window.__kart?.karts.every((k) => k.source === "glb"),
  );
  sourceCourse = await page.evaluate(() => __kart.sourceCourse);
  report.sourceCourse = sourceCourse;
  await page.evaluate(async () => {
    window.course = await import("./track.js");
    window.reviewThree = await import("three");
  });
  await page.keyboard.press("KeyC");
  if(recordAudio){await page.waitForFunction(()=>__kart.audioState.samples.ready,null,{timeout:60000});report.avCapture=await startAV(page,out+"/race-with-audio.webm");avActive=true;}
  await page.keyboard.press("Enter"); await page.keyboard.press("Enter");
  await page.waitForFunction(() => __kart.race.state === "racing");
  report.videoRaceStartSeconds=(Date.now()-videoStarted)/1000;
  await page.keyboard.down("KeyZ");
  if(traceCamera)await page.evaluate(()=>{
    window.reviewCameraFrames=[];window.reviewEvents=[];
    const originalEvent=__kart.race.onEvent;__kart.race.onEvent=e=>{reviewEvents.push({...e,time:__kart.race.time});originalEvent(e);};
    const sample=()=>{
      const p=__kart.race.player;
      if(__kart.race.state==='racing'){
        reviewCameraFrames.push({frame:__kart.renderCount,time:__kart.race.time,s:p.s,lateral:p.lateral,heading:p.heading,gliding:p.gliding,player:[p.x,p.y,p.z],normal:p.surfaceNormal,forward:p.surfaceForward,camera:__kart.cameraState});
        requestAnimationFrame(sample);
      }
    };
    requestAnimationFrame(sample);
  });
  const start = Date.now(),
    frames0 = await page.evaluate(() => __kart.renderCount);
  let direction = 0,
    lastSample = 0,
    lastItem = 0,
    seenAnti = false,
    seenGlide = false,
    lap = 1,
    maxClearanceCorrection = 0;
  while (Date.now() - start < 240000) {
    const r = await page.evaluate(driveWide => {
      const p = __kart.race.player;
      const inOuterCorner=driveWide&&((p.s>165&&p.s<365)||(p.s>1035&&p.s<1190));
      const s=(p.s+(inOuterCorner?Math.max(6,p.speed*.16):Math.max(12,p.speed*.48)))%course.TRACK_LENGTH;
      const smooth=(a,b)=>{const t=Math.max(0,Math.min(1,(s-a)/(b-a)));return t*t*(3-2*t);};
      let lateral=driveWide?-16.5*smooth(170,225)*(1-smooth(300,365))+16.5*smooth(1040,1090)*(1-smooth(1130,1190)):0;
      if(driveWide&&course.activeSurfaceTrack){const limits=course.activeSurfaceTrack.bounds(s,lateral);lateral=Math.max(limits.min+.75,Math.min(limits.max-.75,lateral));}
      const target = course.surfaceAt(s,lateral);
      const relative = new reviewThree.Vector3(target.x-p.x,target.y-p.y,target.z-p.z)
        .applyQuaternion(__kart.karts[0].root.quaternion.clone().invert());
      return {
        renderedSteeringError: Math.atan2(relative.x,-relative.z),
        state: __kart.race.state,
        x: p.x,
        y: p.y,
        z: p.z,
        s: p.s,
        heading: p.heading,
        speed: p.speed,
        lap: p.lap,
        anti: p.anti,
        gliding: p.gliding,
        lateral: p.lateral,
        item: p.item,
        target,
        camera: __kart.cameraState,
        stats: __kart.stats,
        onSourceBoost:!!course.activeSurfaceTrack?.onBoost(p.s,p.lateral,p),
      };
    },driveWide);
    if(driveWide&&r.onSourceBoost){report.boostLaneTouches??={first:false,last:false};report.boostLaneTouches[r.s<400?'first':'last']=true;}
    if (r.state === "results") {
      report.standings = await page.evaluate(() =>
        __kart.race.standings.map((r) => ({
          name: r.character.name,
          time: r.finishTime,
          gates: r.checkpoints,
        })),
      );
      await page.screenshot({ path: out + "/demo-results.png" });
      break;
    }
    const h = Math.atan2(r.target.x - r.x, -(r.target.z - r.z)),
      e = sourceCourse ? r.renderedSteeringError : Math.atan2(Math.sin(h - r.heading), Math.cos(h - r.heading)),
      next = e > 0.045 ? 1 : e < -0.045 ? -1 : 0;
    if (next !== direction) {
      if (direction)
        await page.keyboard.up(direction > 0 ? "ArrowRight" : "ArrowLeft");
      if (next) await page.keyboard.down(next > 0 ? "ArrowRight" : "ArrowLeft");
      direction = next;
    }
    if (r.item && Date.now() - lastItem > 2500) {
      await page.keyboard.press("Space");
      lastItem = Date.now();
    }
    if (r.anti && !seenAnti) {
      seenAnti = true;
      await page.screenshot({ path: out + "/demo-antigravity.png" });
    }
    if (r.gliding && !seenGlide) {
      seenGlide = true;
      await page.screenshot({ path: out + "/demo-glider.png" });
    }
    if (r.lap !== lap) {
      lap = r.lap;
      console.log("lap", lap);
    }
    if (Date.now() - lastSample > 5000) {
      lastSample = Date.now();
      const capture =
        out +
        "/play-" +
        String(Math.round((Date.now() - start) / 1000)).padStart(3, "0") +
        ".png";
      await page.screenshot({ path: capture });
      const imageContent = JSON.parse(
        execFileSync("python3", ["games/mario-kart/review-frame.py", capture], {
          encoding: "utf8",
        }),
      );
      report.samples.push({
        imageContent,
        capture,
        elapsed: (Date.now() - start) / 1000,
        ...r,
        target: undefined,
      });
      console.log(
        "sample",
        report.samples.at(-1).elapsed,
        r.lap,
        r.stats.calls,
      );
    }
    maxClearanceCorrection = Math.max(
      maxClearanceCorrection,
      r.camera.clearance,
    );
    await page.waitForTimeout(40);
  }
  await page.keyboard.up("KeyZ");
  if (direction)
    await page.keyboard.up(direction > 0 ? "ArrowRight" : "ArrowLeft");
  if(traceCamera){
    const frames=await page.evaluate(()=>reviewCameraFrames);
    await writeFile(out+'/camera-frames.json',JSON.stringify({method:'Per-render camera and player poses from the actual keyboard recording; no physics state overrides.',frames}));
    report.cameraFrameCount=frames.length;report.events=await page.evaluate(()=>reviewEvents);
  }
  report.elapsed = (Date.now() - start) / 1000;
  report.fps =
    ((await page.evaluate(() => __kart.renderCount)) - frames0) /
    report.elapsed;
  const timings = await page.evaluate(() => __kart.frameTimes);
  const sorted = timings.slice(120).sort((a, b) => a - b);
  report.frameMs = {
    median: sorted[Math.floor(sorted.length * 0.5)],
    p95: sorted[Math.floor(sorted.length * 0.95)],
    p99: sorted[Math.floor(sorted.length * 0.99)],
  };
  report.maxClearanceCorrection = maxClearanceCorrection;
  report.seenAnti = seenAnti;
  report.seenGlide = seenGlide;
  if(avActive){
    // Keep the finish fanfare and results entrance in the shareable recording.
    if(await page.evaluate(()=>__kart.audioState.samples.ready))
      await page.waitForFunction(()=>['win','lose'].includes(__kart.audioState.samples.music),null,{timeout:15000});
    await page.waitForTimeout(1200);
    report.audio=await page.evaluate(()=>__kart.audioState.samples);await stopAV(page);avActive=false;
  }
  await Promise.all(loadedFiles);
  await context.close();
  assert.ok(report.standings?.length === 8);
  assert.ok(report.standings.every((r) => r.gates === 24));
  assert.ok(seenAnti && seenGlide);
  if(driveWide)assert.ok(report.boostLaneTouches?.first&&report.boostLaneTouches?.last,'Keyboard route must reach boost panels in both widened corners');
  assert.deepEqual(report.errors, []);
  // Measure all three axes on the bank. A 0.1 mm tolerance covers floating-
  // point reprojection noise while remaining far below a visible clearance gap.
  assert.ok(maxClearanceCorrection < 1e-4, `Camera surface penetration: ${maxClearanceCorrection}m`);
  console.log(
    "PASS",
    JSON.stringify({
      fps: report.fps,
      frameMs: report.frameMs,
      elapsed: report.elapsed,
    }),
  );
} catch (error) {
  report.failure = String(error);
  throw error;
} finally {
  await Promise.all(loadedFiles);
  if (context && avActive) await stopAV(context.pages()[0]).catch(()=>{});
  if (context) await context.close().catch(() => {});
  if (video) await video.saveAs(out + "/keyboard-demo.webm");
  await writeFile(
    out + (record ? "/demo-report.json" : "/performance-report.json"),
    JSON.stringify(report, null, 2),
  );
  await browser.close();
}
