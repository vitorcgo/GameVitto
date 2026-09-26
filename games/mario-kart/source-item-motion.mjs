/** Staged inventory grant, then real keyboard driving and item consumption. */
import {chromium} from 'playwright';import {mkdir,writeFile} from 'node:fs/promises';import assert from 'node:assert/strict';
const out=process.env.EVIDENCE_DIR;assert.ok(out);await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true}),context=await browser.newContext({viewport:{width:1440,height:900},recordVideo:{dir:out,size:{width:1440,height:900}}}),page=await context.newPage(),video=page.video();
const report={method:'Stage s425 and grant a mushroom. Drive using real keyboard steering/gas for four seconds, then consume with Space. Continuous capture of inventory, hand pose and boost state. Controlled diagnostic, not an unmodified race.',errors:[],frames:[]};
try {
 page.on('pageerror',e=>report.errors.push(e.message));
 await page.goto('http://localhost:8080/games/mario-kart/?evidence=1');await page.waitForFunction(()=>window.__kart?.assets?.loaded===8);
 await page.keyboard.press('KeyC');await page.keyboard.press('Enter');await page.waitForFunction(()=>__kart.race.state==='racing');
 await page.evaluate(async()=>{
  __kart.place(425,{speed:36});__kart.race.player.item='mushroom';__kart.race.player.roulette=0;
  window.__itemTrack=await import('./track.js');window.__itemFrames=[];let previous=-1;
  const sample=()=>{const d=__kart,r=d.race.player,m=d.karts[0].model,item=m.getObjectByName('held-mushroom');
   if(d.renderCount!==previous){previous=d.renderCount;__itemFrames.push({frame:previous,time:d.race.time,s:r.s,item:r.item,boost:r.boost,visible:item?.visible||false,amount:item?.userData.poseAmount||0,position:item?.position.toArray()});}
   if(__itemFrames.length<900)requestAnimationFrame(sample);
  };requestAnimationFrame(sample);
 });
 await page.keyboard.down('KeyZ');let direction=0,used=false;const start=Date.now();
 while(Date.now()-start<8000){
  const error=await page.evaluate(()=>{const p=__kart.race.player,t=__itemTrack;return t.activeSurfaceTrack.steeringError(p,t.surfaceAt(p.s+Math.max(12,p.speed*.48),0));});
  const next=error>.045?1:error<-.045?-1:0;
  if(next!==direction){if(direction)await page.keyboard.up(direction>0?'ArrowRight':'ArrowLeft');if(next)await page.keyboard.down(next>0?'ArrowRight':'ArrowLeft');direction=next;}
  if(!used&&Date.now()-start>4000){await page.keyboard.press('Space');used=true;}
  await page.waitForTimeout(24);
 }
 await page.keyboard.up('KeyZ');if(direction)await page.keyboard.up(direction>0?'ArrowRight':'ArrowLeft');
 report.frames=await page.evaluate(()=>__itemFrames);
 report.heldFrames=report.frames.filter(f=>f.visible).length;
 report.consumed=report.frames.some((f,i)=>i>0&&report.frames[i-1].item==='mushroom'&&f.item===null&&f.boost>0);
 report.returned=report.frames.at(-1).amount===0&&!report.frames.at(-1).visible;
 assert.ok(report.heldFrames>100&&report.consumed&&report.returned);assert.deepEqual(report.errors,[]);
 console.log({heldFrames:report.heldFrames,consumed:report.consumed,returned:report.returned});
}catch(error){report.failure=error.stack;throw error;}
finally{await context.close();await video.saveAs(out+'/keyboard-demo.webm');await writeFile(out+'/item-motion.json',JSON.stringify(report,null,2));await browser.close();}
