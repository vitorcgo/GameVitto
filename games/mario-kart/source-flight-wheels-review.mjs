/** Stage an approach, then verify actual rendered wheel axes during keyboard flight. */
import {chromium} from 'playwright';import {mkdir,writeFile} from 'node:fs/promises';import assert from 'node:assert/strict';
const out=process.env.EVIDENCE_DIR;assert.ok(out);await mkdir(out,{recursive:true});
const b=await chromium.launch({channel:'chrome',headless:true}),context=await b.newContext({viewport:{width:1440,height:900},recordVideo:{dir:out,size:{width:1440,height:900}}}),page=await context.newPage(),video=page.video();
const report={method:'Stage s875 before the native anti-gravity ramp,then real keyboard gas through launch and touchdown. Measure world-space tire axles relative to kart up,not the animation target. Controlled diagnostic.',errors:[]};
try{
 if(process.env.BASELINE==='1')await page.route('**/games/mario-kart/game.js',route=>route.fulfill({path:'games/mario-kart/evidence/overnight/60d-delta-race/source/game.js',contentType:'text/javascript'}));
 page.on('pageerror',e=>report.errors.push(e.message));await page.goto('http://localhost:8080/games/mario-kart/?evidence=1');await page.waitForFunction(()=>window.__kart?.assets?.loaded===8);
 await page.keyboard.press('KeyC');await page.keyboard.press('Enter');await page.waitForFunction(()=>__kart.race.state==='racing');
 await page.evaluate(async()=>{
  const T=await import('three');__kart.place(875,{speed:36});window.__flightWheelFrames=[];let previous=-1;window.__flightWheelSampling=true;
  const sample=()=>{const d=__kart,r=d.race.player,k=d.karts[0];
   if(d.renderCount!==previous){previous=d.renderCount;k.root.updateMatrixWorld(true);const up=new T.Vector3(0,1,0).applyQuaternion(k.root.getWorldQuaternion(new T.Quaternion()));
    __flightWheelFrames.push({frame:previous,time:d.race.time,gliding:r.gliding,flight:r.flight,anti:r.anti,s:r.s,speed:r.speed,
     axleAngles:k.wheels.map(w=>Math.acos(Math.min(1,Math.abs(new T.Vector3(1,0,0).applyQuaternion(w.getWorldQuaternion(new T.Quaternion())).dot(up))))*180/Math.PI),
     emission:k.wheels.map(w=>w.userData.sourceTireMeshes?.[0]?.material.emissiveIntensity),groundGlow:k.hover.visible});
   }if(__flightWheelSampling)requestAnimationFrame(sample);
  };requestAnimationFrame(sample);
 });
 await page.keyboard.down('KeyZ');await page.waitForFunction(()=>__kart.race.player.gliding);await page.waitForFunction(()=>!__kart.race.player.gliding);await page.waitForTimeout(650);await page.keyboard.up('KeyZ');
 report.frames=await page.evaluate(()=>{__flightWheelSampling=false;return __flightWheelFrames;});
 const air=report.frames.filter(f=>f.gliding&&f.flight>.3),early=air.filter(f=>f.flight<.7),late=air.filter(f=>f.flight>2.8);report.airborneFrames=air.length;report.maxAirAxleAngle=Math.max(...air.flatMap(f=>f.axleAngles));report.minAirEmission=Math.min(...air.flatMap(f=>f.emission));report.finalAxleAngles=report.frames.at(-1).axleAngles;
 report.groundGlowDuringFlight=air.some(f=>f.groundGlow);
 report.earlyMaxAxleAngle=Math.max(...early.flatMap(f=>f.axleAngles));report.earlyMinEmission=Math.min(...early.flatMap(f=>f.emission));report.lateMinAxleAngle=Math.min(...late.flatMap(f=>f.axleAngles));
 report.passed=air.length>100&&early.length>10&&late.length>20&&report.earlyMaxAxleAngle<5&&report.earlyMinEmission>2&&report.lateMinAxleAngle>85&&report.finalAxleAngles.every(a=>a>85)&&!report.groundGlowDuringFlight&&!report.errors.length;
 console.log({...report,frames:report.frames.length});if(process.env.CHECK==='1')assert.equal(report.passed,true);
}catch(error){report.failure=error.stack;throw error;}
finally{await context.close();await video.saveAs(out+'/keyboard-demo.webm');await writeFile(out+'/flight-wheels.json',JSON.stringify(report,null,2));await b.close();}
