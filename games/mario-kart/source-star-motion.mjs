/** Recorded star activation from a labeled inventory grant, then real keyboard play. */
import {chromium} from 'playwright';import {mkdir,writeFile} from 'node:fs/promises';import assert from 'node:assert/strict';
const out=process.env.EVIDENCE_DIR;assert.ok(out);await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true}),context=await browser.newContext({viewport:{width:1440,height:900},recordVideo:{dir:out,size:{width:1440,height:900}}}),page=await context.newPage(),video=page.video();
const report={method:'Stage s425 approach and grant one star to inventory. Activate with Space, drive with real gas/steering keys through effect expiry. This is a controlled diagnostic, not an unmodified full race.',errors:[],frames:[]};
try{
 page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&/THREE|shader|WebGL/i.test(m.text()))report.errors.push(m.text())});
 await page.goto('http://localhost:8080/games/mario-kart/?evidence=1');await page.waitForFunction(()=>window.__kart?.assets?.loaded===8);await page.keyboard.press('KeyC');await page.keyboard.press('Enter');await page.waitForFunction(()=>__kart.race.state==='racing');
 await page.evaluate(async()=>{__kart.place(425,{speed:36});__kart.race.player.item='star';__kart.race.player.roulette=0;window.__starTrack=await import('./track.js');window.__starFrames=[];let prior=-1;const sample=()=>{const d=__kart,r=d.race.player;if(d.renderCount!==prior){prior=d.renderCount;__starFrames.push({frame:prior,time:d.race.time,s:r.s,star:r.star,speed:r.speed,anti:r.anti,gliding:r.gliding,auraVisible:d.karts[0].starAura.visible,camera:d.cameraState});}if(__starFrames.length<1000)requestAnimationFrame(sample);};requestAnimationFrame(sample);});
 await page.keyboard.down('KeyZ');await page.keyboard.press('Space');await page.waitForFunction(()=>__kart.race.player.star>0);let direction=0,seen=true;const start=Date.now();
 while(Date.now()-start<12000){const r=await page.evaluate(()=>{const p=__kart.race.player,t=__starTrack;return {star:p.star,error:t.activeSurfaceTrack.steeringError(p,t.surfaceAt(p.s+Math.max(12,p.speed*.48),0))};});
 const next=r.error>.045?1:r.error<-.045?-1:0;if(next!==direction){if(direction)await page.keyboard.up(direction>0?'ArrowRight':'ArrowLeft');if(next)await page.keyboard.down(next>0?'ArrowRight':'ArrowLeft');direction=next;}
 if(seen&&r.star===0){await page.waitForTimeout(500);break;}await page.waitForTimeout(24);
 }
 await page.keyboard.up('KeyZ');if(direction)await page.keyboard.up(direction>0?'ArrowRight':'ArrowLeft');report.frames=await page.evaluate(()=>__starFrames);
 report.activeFrames=report.frames.filter(r=>r.star>0).length;report.restored=report.frames.at(-1).star===0&&!report.frames.at(-1).auraVisible;
 assert.ok(report.activeFrames>100&&report.restored);assert.deepEqual(report.errors,[]);console.log({activeFrames:report.activeFrames,restored:report.restored});
}finally{await context.close();await video.saveAs(out+'/keyboard-demo.webm');await writeFile(out+'/star-motion.json',JSON.stringify(report,null,2));await browser.close();}
