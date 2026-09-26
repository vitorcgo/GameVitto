/** Controlled visual checks. Scenarios are staged; inputs thereafter are real
 * keyboard events. The separate visual-demo.mjs proves ordinary full-race play. */
import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const out=process.env.EVIDENCE_DIR||'games/mario-kart/evidence/overnight/66-menu-items-contact';await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const context=await browser.newContext({viewport:{width:1440,height:900},recordVideo:{dir:out,size:{width:1440,height:900}}});
const page=await context.newPage(),video=page.video(),start=Date.now(),report={method:'Staged scenarios, followed by real keyboard events; 1440×900. No phone claimed.',errors:[],chapters:[],events:[]};
page.on('pageerror',e=>report.errors.push(e.stack));page.on('console',m=>{if(m.type()==='error'&&/WebGL|THREE|shader/i.test(m.text()))report.errors.push(m.text());});
const mark=async(name)=>{const time=(Date.now()-start)/1000;report.chapters.push({name,time});console.log(name,time);};
const screenshot=async name=>page.screenshot({path:`${out}/${name}.png`});
async function setup(s,options={}){
 await page.keyboard.up('KeyZ');await page.keyboard.up('Shift');await page.keyboard.up('ArrowLeft');await page.keyboard.up('ArrowRight');
 await page.evaluate(({s,options})=>{
  __kart.stage('normal');__kart.place(s,options);__kart.race.racers.slice(1).forEach((r,i)=>{const p=course.surfaceAt(s+200+i*7,0);Object.assign(r,p,{finishTime:999});});
  window.localEvents=[];const original=__kart.race.onEvent;__kart.race.onEvent=e=>{localEvents.push({...e,time:__kart.race.time});original(e);};
 },{s,options});await page.waitForTimeout(180);
}
async function drive(seconds,{drift=false,lane=0}={}){
 await page.keyboard.down('KeyZ');if(drift)await page.keyboard.down('Shift');await page.evaluate(()=>__kart.freeze=false);
 let direction=0;const until=Date.now()+seconds*1000;
 while(Date.now()<until){
  const error=await page.evaluate(lane=>{const r=__kart.race.player,p=course.surfaceAt(r.s+Math.max(8,r.speed*.36),lane);const q=new T.Vector3(p.x-r.x,p.y-r.y,p.z-r.z).applyQuaternion(__kart.karts[0].root.quaternion.clone().invert());return Math.atan2(q.x,-q.z);},lane);
  const next=error>.045?1:error<-.045?-1:0;
  if(next!==direction){if(direction)await page.keyboard.up(direction>0?'ArrowRight':'ArrowLeft');if(next)await page.keyboard.down(next>0?'ArrowRight':'ArrowLeft');direction=next;}
  await page.waitForTimeout(40);
 }
 if(direction)await page.keyboard.up(direction>0?'ArrowRight':'ArrowLeft');await page.keyboard.up('Shift');
}
try{
 await page.goto('http://localhost:8080/games/mario-kart/?evidence=1');await page.waitForFunction(()=>window.__kart?.karts.every(k=>k.source==='glb'));
 await page.evaluate(async()=>{window.course=await import('./track.js');window.T=await import('three');});
 await mark('Single-action menu');await screenshot('menu');await page.waitForTimeout(1000);
 await page.keyboard.press('Enter'); await page.keyboard.press('Enter');await page.waitForFunction(()=>__kart.race.state==='racing');await page.keyboard.press('KeyC');
 const boxS=await page.evaluate(()=>__kart.race.boxes[0].s);
 await setup(boxS-19,{lateral:0,speed:25});await mark('Real mystery-box contact and scrolling reel');
 await drive(3.2);report.events.push(...await page.evaluate(()=>localEvents));await screenshot('item-ready');
 await page.evaluate(()=>__kart.race.player.item='mushroom');await mark('Mushroom boost exhaust');await page.keyboard.press('Space');await drive(.35);await screenshot('boost');await drive(1.8);
 await setup(230,{lateral:-5,speed:35});await mark('Drift sparks, smoke, and release');await drive(2.8,{drift:true,lane:-5});await screenshot('drift-release');await drive(.6,{lane:-5});
 for(const side of [false,true]){
  await setup(40,{lateral:side?-2.8:0,speed:side?28:38});
  await page.evaluate(side=>{
   const race=__kart.race,r=race.racers[1],p=course.surfaceAt(side?40:49,0);Object.assign(r,p,{s:side?40:49,progress:side?40:49,lateral:0,heading:p.heading,speed:side?28:12,finishTime:null,surfaceForward:null,surfaceNormal:null});
   race.cpuInput=()=>({gas:false,steer:0});
  },side);
  await mark(side?'Side contact':'Rear contact');await page.keyboard.down('KeyZ');if(side)await page.keyboard.down('ArrowRight');await page.evaluate(()=>__kart.freeze=false);
  await page.waitForTimeout(side?350:650);await page.keyboard.up('ArrowRight');await screenshot(side?'side-contact':'rear-contact');await page.waitForTimeout(850);
  const data=await page.evaluate(()=>({events:localEvents,player:{speed:__kart.race.player.speed,sideVelocity:__kart.race.player.sideVelocity},rival:{speed:__kart.race.racers[1].speed,sideVelocity:__kart.race.racers[1].sideVelocity}}));report[side?'side':'rear']=data;
 }
 await setup(40,{speed:0});await mark('Flat chase framing');await screenshot('camera-flat');
 await setup(500,{speed:0});await mark('Banked chase framing and lighting');await screenshot('camera-bank');
 await page.keyboard.press('Escape');await mark('Pause menu');await screenshot('pause');await page.waitForTimeout(800);
 assert.equal(report.errors.length,0,report.errors.join('\n'));
 assert.ok(report.events.some(e=>e.type==='box'),'Real box contact occurred');assert.ok(report.events.some(e=>e.type==='itemReady'),'Roulette resolved');
 assert.ok(report.rear.events.some(e=>e.type==='contact'),'Rear contact response fired');assert.ok(report.side.events.some(e=>e.type==='contact'),'Side contact response fired');
}finally{
 await writeFile(out+'/feedback-report.json',JSON.stringify(report,null,2));await context.close();await video.saveAs(out+'/feedback.webm');await browser.close();
}
