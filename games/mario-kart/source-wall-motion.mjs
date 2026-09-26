/** Stage before the observed outer-rail failure, then drive with keyboard input. */
import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const out=process.env.EVIDENCE_DIR;assert.ok(out);await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const context=await browser.newContext({viewport:{width:1440,height:900},recordVideo:{dir:out,size:{width:1440,height:900}}});
const page=await context.newPage(),video=page.video();
const report={method:'Stage s200 near the outside rail. Real keyboard gas/steering targets beyond the outside road edge for five seconds, then the lane centre for five seconds. No position edits after staging. Controlled diagnostic, not an unmodified race.',errors:[]};
try{
 page.on('pageerror',e=>report.errors.push(e.message));
 await page.goto('http://localhost:8080/games/mario-kart/?evidence=1');await page.waitForFunction(()=>window.__kart?.assets?.loaded===8);
 await page.keyboard.press('KeyC');await page.keyboard.press('Enter');await page.waitForFunction(()=>__kart.race.state==='racing');
 await page.evaluate(async()=>{
  window.__wallTrack=await import('./track.js');const bounds=__wallTrack.activeSurfaceTrack.bounds(200,0);
  __kart.place(200,{lateral:bounds.min+3,speed:30});__kart.race.player.item=null;__kart.race.player.roulette=0;
  window.__wallFrames=[];window.__wallPhase='contact';let previous=-1;
  const sample=()=>{const d=__kart,r=d.race.player;if(d.renderCount!==previous){previous=d.renderCount;
   __wallFrames.push({frame:previous,time:d.race.time,phase:__wallPhase,s:r.s,lateral:r.lateral,speed:r.speed,wallCooldown:r.wallCooldown,position:[r.x,r.y,r.z],camera:d.cameraState.eye});}
   if(__wallFrames.length<1000)requestAnimationFrame(sample);
  };requestAnimationFrame(sample);
 });
 await page.keyboard.down('KeyZ');let direction=0,recover=false;const start=Date.now();
 while(Date.now()-start<10000){
  if(!recover&&Date.now()-start>5000){recover=true;await page.evaluate(()=>__wallPhase='recover');}
  const error=await page.evaluate(recover=>{const r=__kart.race.player,t=__wallTrack,track=t.activeSurfaceTrack,s=r.s+Math.max(12,r.speed*.48),bounds=track.bounds(s,r.lateral);return track.steeringError(r,t.surfaceAt(s,recover?0:bounds.min-4));},recover);
  const next=error>.045?1:error<-.045?-1:0;
  if(next!==direction){if(direction)await page.keyboard.up(direction>0?'ArrowRight':'ArrowLeft');if(next)await page.keyboard.down(next>0?'ArrowRight':'ArrowLeft');direction=next;}
  await page.waitForTimeout(24);
 }
 await page.keyboard.up('KeyZ');if(direction)await page.keyboard.up(direction>0?'ArrowRight':'ArrowLeft');
 report.frames=await page.evaluate(()=>__wallFrames);
 const frames=report.frames,contact=frames.filter(f=>f.phase==='contact'),recovery=frames.filter(f=>f.phase==='recover');
 report.wallFrames=contact.filter(f=>f.wallCooldown>0).length;
 report.contactAdvance=contact.at(-1).s-contact[0].s;
 report.recoveryAdvance=recovery.at(-1).s-recovery[0].s;
 report.finalLateral=frames.at(-1).lateral;
 report.maxStep=Math.max(...frames.slice(1).map((f,i)=>Math.hypot(...f.position.map((v,j)=>v-frames[i].position[j]))));
 assert.ok(report.wallFrames>30,'must actually contact the wall');
 assert.ok(report.contactAdvance>35&&report.recoveryAdvance>60,'must slide forward and drive away');
 assert.ok(Math.abs(report.finalLateral)<4,'must return to the lane');
 assert.ok(report.maxStep<2,'no large single-render displacement');assert.deepEqual(report.errors,[]);
 console.log({...report,frames:frames.length});
}catch(error){report.failure=error.stack;throw error;}
finally{await context.close();await video.saveAs(out+'/keyboard-demo.webm');await writeFile(out+'/wall-motion.json',JSON.stringify(report,null,2));await browser.close();}
