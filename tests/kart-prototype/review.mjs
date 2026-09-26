/** Real controller touch + synthetic IMU through the standalone HTTPS servers.
 * No simulation state writes; screenshots/video are actual browser output. */
import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const out=new URL('../../games/mario-kart/evidence/prototype-test-combined/',import.meta.url).pathname;
await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const handset=await chromium.launch({channel:'chrome',headless:true});
const report={method:'Live HTTPS standalone runners; real controller DOM multitouch and Socket.IO, synthetic DeviceOrientation. No simulation state writes; not a physical phone test.',runs:[]};
const instrumentation=()=>{window.__audioContexts=0;for(const key of ['AudioContext','webkitAudioContext'])if(window[key])window[key]=new Proxy(window[key],{construct(target,args){window.__audioContexts++;return Reflect.construct(target,args);}});};
try{
 for(const [mode,port] of [['test',Number(process.env.PORT)||8444]]){
  const errors=[],requests=[];
  const context=await browser.newContext({ignoreHTTPSErrors:true,viewport:{width:1280,height:720},recordVideo:{dir:out+'raw',size:{width:1280,height:720}}});
  const phoneContext=await handset.newContext({ignoreHTTPSErrors:true,viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  await context.addInitScript(instrumentation);await phoneContext.addInitScript(instrumentation);
  const page=await context.newPage(),phone=await phoneContext.newPage();
  page.on('pageerror',e=>errors.push(e.stack));phone.on('pageerror',e=>errors.push(e.stack));page.on('request',r=>requests.push(r.url()));
  const url=`https://localhost:${port}`;await page.goto(url+'/?evidence');await page.waitForFunction(()=>window.__prototype);
  await page.screenshot({path:out+mode+'-pairing.png'});
  assert.equal((await context.request.get(url+'/games/mario-kart/')).status(),404,'Full game is not served');
  await phone.goto(url+'/controller');await phone.waitForFunction(()=>document.body.classList.contains('wheel-mode'));
  await phone.locator('#enable').tap();
  await phone.evaluate(()=>{window.testBeta=0;window.sensorTimer=setInterval(()=>window.dispatchEvent(new DeviceOrientationEvent('deviceorientation',{alpha:0,beta:testBeta,gamma:0,absolute:false})),16);});
  await page.waitForFunction(()=>__prototype.wheel.armed);
  await phone.screenshot({path:out+mode+'-phone.png'});
  const cdp=await phoneContext.newCDPSession(phone);
  const points=await phone.evaluate(()=>Object.fromEntries(['btn-2','btn-a'].map((id,i)=>{const r=document.getElementById(id).getBoundingClientRect();return [id,{x:r.x+r.width/2,y:r.y+r.height/2,id:i+1}];})));
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[points['btn-2']]});
  await page.waitForFunction(()=>__prototype.sim.speed>12);
  const before=await page.evaluate(()=>({x:__prototype.sim.x,z:__prototype.sim.z}));
  // A short steering check, then reset through the public keyboard control.
  await phone.evaluate(()=>testBeta=6);await page.waitForFunction(()=>__prototype.sim.input.steer<-.1);await page.waitForTimeout(400);
  const left=await page.evaluate(()=>__prototype.sim.heading);assert.ok(left<-.05);
  await phone.evaluate(()=>testBeta=-6);await page.waitForTimeout(500);assert.ok(await page.evaluate(()=>__prototype.sim.heading)>left+.05);
  await phone.evaluate(()=>testBeta=0);await page.keyboard.press('KeyR');
  await page.waitForFunction(()=>__prototype.sim.speed>12);
  {
   // Follow the visible capsule centreline from independent geometric look-ahead.
   await page.evaluate(async()=>window.geometry=await import('/physics.mjs'));
   let held=false,boosted=false,jumped=false,opened=false,landed=false;const flight=[];const start=Date.now();
   while(Date.now()-start<35000){
    const state=await page.evaluate(()=>{
     const s=__prototype.sim,c=s.config;let best=null;
     for(let d=0;d<geometry.trackLength(c);d+=1){const p=geometry.routeAt(d,c),dist=Math.hypot(p.x-s.x,p.z-s.z);if(!best||dist<best.dist)best={d,dist};}
     const aim=geometry.routeAt(best.d+18,c),heading=Math.atan2(aim.x-s.x,-(aim.z-s.z));
     return {x:s.x,y:s.y,air:s.airborne,age:s.flightAge,jumps:s.jumpCount,error:Math.atan2(Math.sin(heading-s.heading),Math.cos(heading-s.heading)),speed:s.speed,z:s.z,a:c.straight,charge:s.charge,boost:s.boost,drift:s.drift};
    });
    const desiredTurn=2*state.speed*Math.sin(state.error)/18;
    const steer=Math.max(-.65,Math.min(.65,state.drift?(desiredTurn/1.35-state.drift*.12)/.85:desiredTurn/(1.35*(state.air?.55:1))));
    const beta=-(steer*15.5+Math.sign(steer)*2.5);await phone.evaluate(v=>testBeta=v,beta);
    if(!held&&!boosted&&state.x>0&&state.z<-state.a+8){await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[points['btn-a']]});held=true;}
    if(held&&state.charge>2.1){await page.screenshot({path:out+'drift.png'});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[points['btn-a']]});held=false;boosted=true;await page.waitForFunction(()=>__prototype.sim.boost>0);await page.waitForTimeout(250);await page.screenshot({path:out+'boost.png'});}
    if(state.air){flight.push(state);if(!jumped){jumped=true;await page.screenshot({path:out+'jump.png'});}if(state.age>.8&&!opened){opened=true;await page.screenshot({path:out+'parachute.png'});}}
    if(jumped&&!state.air){landed=true;await page.waitForTimeout(600);await page.screenshot({path:out+'landing.png'});break;}
    await page.waitForTimeout(50);
   }
   assert.ok(boosted,'Phone builds drift charge and releases boost');
   assert.ok(jumped&&opened&&landed,'Continuous phone-driven run climbs ramp, deploys parachute and lands');
   assert.ok(Math.max(...flight.map(s=>s.y))>5.5);
   report.flight={samples:flight.length,peakHeight:Math.max(...flight.map(s=>s.y)),lastFlightAge:flight.at(-1).age};
   assert.ok(await page.evaluate(()=>__prototype.sim.boostCount)>0);
  }
  const moving=await page.evaluate(()=>({x:__prototype.sim.x,z:__prototype.sim.z,gas:__prototype.sim.input.gas}));assert.equal(moving.gas,true);assert.ok(Math.hypot(moving.x-before.x,moving.z-before.z)>8);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[points['btn-2']]});
  await page.waitForFunction(()=>!__prototype.sim.input.gas);
  // Stop sensor delivery: a stale phone cannot keep steering or accelerating.
  await phone.evaluate(()=>clearInterval(sensorTimer));await page.waitForTimeout(600);
  assert.equal(await page.evaluate(()=>__prototype.wheel.read(performance.now()).live),false);
  assert.equal(await page.evaluate(()=>__prototype.sim.input.gas),false);
  assert.equal(await page.evaluate(()=>__audioContexts),0);assert.equal(await phone.evaluate(()=>__audioContexts),0);
  assert.equal(requests.some(url=>/\.(glb|ogg|wav|mp3)|\/assets\//.test(url)),false);
  assert.deepEqual(errors,[]);
  report.runs.push({mode,errors,moving,checks:['TLS pairing','phone calibration','gas and steering','drift release boost','ramp jump','parachute glide and landing','button release','stale sensor safety','no AudioContexts on game or phone','no production assets or full game route'],requests});
  await phoneContext.close();await page.waitForTimeout(200);const video=page.video();await context.close();await video.saveAs(out+mode+'.webm');
  console.log(mode,'passed');
 }
}catch(error){report.failure=error.stack;throw error;}finally{await writeFile(out+'report.json',JSON.stringify(report,null,2));await browser.close();await handset.close();}
