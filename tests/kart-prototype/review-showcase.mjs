/** Exercise public keyboard controls and record rendered output, without
 * changing the simulation, camera or presentation clock. */
import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const out=new URL('../../games/mario-kart/evidence/prototype-showcase/',import.meta.url).pathname;
const url=`https://localhost:${Number(process.env.PORT)||8444}`;
await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const errors=[],requests=[],report={method:'Headless Chrome at 1280×720. Real keyboard events, rendered frames and read-only evidence hooks. No camera/physics/timing writes. Physical phone feel is not covered.',checks:[]};
const context=await browser.newContext({ignoreHTTPSErrors:true,viewport:{width:1280,height:720},recordVideo:{dir:out+'raw',size:{width:1280,height:720}}});
await context.addInitScript(()=>{
  window.__audioContexts=0;
  for(const key of ['AudioContext','webkitAudioContext'])if(window[key])window[key]=new Proxy(window[key],{construct(target,args){window.__audioContexts++;return Reflect.construct(target,args);}});
});
try{
  const page=await context.newPage();
  page.on('pageerror',e=>errors.push(e.stack));page.on('request',r=>requests.push(r.url()));
  await page.goto(url+'/?evidence');await page.waitForFunction(()=>window.__prototype);
  assert.equal(requests.some(s=>s.includes('/assets/')),false,'Driving starts without source assets');
  assert.equal((await context.request.get(url+'/games/mario-kart/')).status(),404);
  await page.keyboard.down('KeyZ');await page.waitForFunction(()=>__prototype.sim.speed>5);await page.keyboard.up('KeyZ');
  await page.keyboard.press('1');await page.waitForFunction(()=>__prototype.showcase?.ready===1);
  const stopped=await page.evaluate(()=>({x:__prototype.sim.x,z:__prototype.sim.z,time:__prototype.sim.time}));
  await page.waitForTimeout(200);assert.deepEqual(await page.evaluate(()=>({x:__prototype.sim.x,z:__prototype.sim.z,time:__prototype.sim.time})),stopped,'Showcase freezes driving');
  await page.keyboard.press('Space');assert.equal(await page.evaluate(()=>__prototype.showcase.mode),1,'Space does not change stages');
  for(const n of [1,2,3,4]){
    await page.keyboard.press(String(n));await page.waitForFunction(n=>__prototype.showcase.ready===n,n,{timeout:90000});
    await page.waitForTimeout(1700);await page.screenshot({path:out+`stage-${n}.png`});
    assert.equal(await page.locator('#telemetry').isVisible(),false);console.log(`Stage ${n} captured`);
  }
  await page.keyboard.press('5');await page.waitForFunction(()=>__prototype.showcase.ready===5,null,{timeout:90000});
  report.tourStart=Date.now();
  for(let shot=0;shot<4;shot++){
    await page.waitForFunction(n=>__prototype.showcase.shot===n,shot,{timeout:60000});
    await page.waitForTimeout(1200);await page.screenshot({path:out+`shot-${shot+1}.png`});
    assert.equal(await page.locator('footer').isVisible(),false);console.log(`Track shot ${shot+1} captured`);
    await page.waitForTimeout(5300);await page.screenshot({path:out+`shot-${shot+1}-end.png`});
  }
  await page.waitForFunction(()=>__prototype.showcase.shot===0,null,{timeout:60000});
  report.tourLoopMs=Date.now()-report.tourStart;
  assert.ok(report.tourLoopMs>=34000&&report.tourLoopMs<46000,'Tour loops in approximately 36 seconds');
  await page.keyboard.press('4');await page.waitForFunction(()=>__prototype.showcase.ready===4);await page.screenshot({path:out+'stage-4-after-tour.png'});
  await page.setViewportSize({width:1920,height:1080});await page.waitForTimeout(200);await page.screenshot({path:out+'stage-4-1080p.png'});
  await page.setViewportSize({width:1280,height:720});
  await page.keyboard.press('0');await page.waitForFunction(()=>__prototype.showcaseMode===0);
  assert.equal(await page.locator('#telemetry').isVisible(),true);
  assert.equal(await page.evaluate(()=>__prototype.renderer.shadowMap.enabled),false);
  await page.keyboard.press('KeyR');await page.keyboard.down('KeyZ');await page.waitForFunction(()=>__prototype.sim.speed>5);await page.keyboard.up('KeyZ');
  await page.keyboard.press('Numpad2');await page.waitForFunction(()=>__prototype.showcase.ready===2);
  assert.equal(await page.evaluate(()=>__audioContexts),0);
  assert.equal(requests.some(s=>/\.(ogg|wav|mp3)(\?|$)/.test(s)),false);
  assert.deepEqual(errors,[]);
  report.checks.push('default driving needs no source assets','full game route not served','showcase freezes driving','Space ignored','1–4 render without HUD','four cinematic shots and 36-second loop','5→4 restores studio framing','1080p resize','0 restores rendering and keyboard driving','numpad selection','zero audio contexts and audio requests','zero browser errors');
  const video=page.video();await context.close();await video.saveAs(out+'showcase.webm');

  // An in-flight asset request must never steal the screen after returning to 0.
  const recovery=await browser.newContext({ignoreHTTPSErrors:true});
  const race=await recovery.newPage();let release,requested=false;
  const gate=new Promise(resolve=>release=resolve);
  await race.route('**/mario-source.glb',async route=>{requested=true;await gate;await route.continue();});
  await race.goto(url+'/?evidence');await race.waitForFunction(()=>window.__prototype);await race.keyboard.press('3');
  for(let i=0;i<100&&!requested;i++)await race.waitForTimeout(50);
  assert.ok(requested);await race.keyboard.press('0');release();await race.waitForTimeout(1700);
  assert.equal(await race.evaluate(()=>__prototype.showcaseMode),0);assert.equal(await race.locator('#showcase-status').isVisible(),false);
  const failed=await recovery.newPage();
  await failed.route('**/mario-source.glb',route=>route.fulfill({status:404,body:'Missing test asset'}));
  await failed.goto(url+'/?evidence');await failed.waitForFunction(()=>window.__prototype);await failed.keyboard.press('4');
  await failed.waitForFunction(()=>document.getElementById('showcase-status').textContent.includes('Could not load'));
  await failed.keyboard.press('0');assert.equal(await failed.locator('#telemetry').isVisible(),true);
  await failed.unroute('**/mario-source.glb');await failed.keyboard.press('4');await failed.waitForFunction(()=>__prototype.showcase.ready===4,null,{timeout:90000});
  await recovery.close();report.checks.push('0 cancels pending selection','missing asset error and retry');
  report.errors=errors;await writeFile(out+'report.json',JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report,null,2));
}finally{await browser.close();}
