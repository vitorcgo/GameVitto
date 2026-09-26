/** Staged approach, then actual keyboard steering over the finish ramp. */
import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {captureArgs,startAV,stopAV} from './review-av.mjs';
const out=process.env.EVIDENCE_DIR||'games/mario-kart/evidence/overnight/70-race-followup';
await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--autoplay-policy=no-user-gesture-required',...captureArgs]});
const page=await browser.newPage({viewport:{width:1280,height:720}});
const report={method:'Staged outer-lane approach, then real keyboard input. Measure world-space horizontal displacement, speed and boost expiry throughout the actual mesh-lip jump.',errors:[]};
let recording=false,dir=0;
page.on('pageerror',e=>report.errors.push(e.stack));
try {
 await page.goto((process.env.KART_URL||'http://localhost:8081')+'/games/mario-kart/?evidence=1');
 await page.waitForFunction(()=>window.__kart?.karts.every(k=>k.source==='glb')&&__kart.audioState.samples.ready,null,{timeout:60000});
 await page.evaluate(async()=>{
  window.course=await import('./track.js');window.T=await import('three');
  __kart.stage('normal');__kart.place(1050,{speed:34,lateral:10});
  __kart.race.racers.slice(1).forEach(r=>r.finishTime=999);
  window.frames=[];window.sampling=true;
  function sample(){const r=__kart.race.player;frames.push({time:__kart.race.time,s:r.s,x:r.x,y:r.y,z:r.z,speed:r.speed,boost:r.boost,jump:r.jump?{...r.jump}:null,eye:__kart.cameraState.eye});if(sampling)requestAnimationFrame(sample);}sample();
 });
 report.capture=await startAV(page,out+'/ramp.webm');recording=true;
 await page.keyboard.down('KeyZ');await page.evaluate(()=>__kart.freeze=false);
 const start=Date.now();
 while(Date.now()-start<12000){
  const r=await page.evaluate(()=>{
   const r=__kart.race.player,s=r.s+Math.max(6,r.speed*.16),smooth=(a,b)=>{const t=Math.max(0,Math.min(1,(s-a)/(b-a)));return t*t*(3-2*t);};
   let lateral=16.5*smooth(1040,1090)*(1-smooth(1130,1190));
   const limits=course.activeSurfaceTrack.bounds(s,lateral);lateral=Math.max(limits.min+.75,Math.min(limits.max-.75,lateral));
   const t=course.surfaceAt(s,lateral),vec=new T.Vector3(t.x-r.x,t.y-r.y,t.z-r.z).applyQuaternion(__kart.karts[0].root.quaternion.clone().invert());
   return {s:r.s,error:Math.atan2(vec.x,-vec.z)};
  });
  if(r.s>1230||r.s<1000)break;
  const next=r.error>.04?1:r.error<-.04?-1:0;
  if(dir!==next){if(dir)await page.keyboard.up(dir>0?'ArrowRight':'ArrowLeft');if(next)await page.keyboard.down(next>0?'ArrowRight':'ArrowLeft');dir=next;}
  await page.waitForTimeout(40);
 }
 await page.keyboard.up('KeyZ');if(dir)await page.keyboard.up(dir>0?'ArrowRight':'ArrowLeft');
 report.frames=await page.evaluate(()=>{sampling=false;return frames;});
 const air=report.frames.filter(f=>f.jump),displacement=[];
 for(let i=1;i<report.frames.length;i++){
  const a=report.frames[i-1],b=report.frames[i];
  if(a.jump&&b.jump&&b.time>a.time)displacement.push(Math.hypot(b.x-a.x,b.z-a.z)/(b.time-a.time));
 }
 report.air={frames:air.length,duration:air.at(-1)?.time-air[0]?.time,launchSpeed:air[0]?.jump.speed,minSpeed:Math.min(...air.map(f=>f.speed)),minMeasuredForwardSpeed:Math.min(...displacement),boostExpiredInAir:air.some(f=>f.boost===0)};
 assert.ok(air.length>10,'Actual lip launch and visible airtime');
 assert.ok(report.air.minMeasuredForwardSpeed>report.air.launchSpeed*.95,'No measurable forward speed cut while airborne');
 assert.ok(report.air.boostExpiredInAir,'Exercise the old boost-expiry slowdown');
 assert.deepEqual(report.errors,[]);console.log(report.air);
 await page.screenshot({path:out+'/ramp-landing.png'});
 await stopAV(page);recording=false;
}catch(error){report.failure=error.stack;throw error;}finally{
 if(recording)await stopAV(page).catch(()=>{});
 await writeFile(out+'/ramp-report.json',JSON.stringify(report,null,2));await browser.close();
}
