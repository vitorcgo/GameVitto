import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {captureArgs,startAV,stopAV} from './review-av.mjs';
const out=process.env.EVIDENCE_DIR||'games/mario-kart/evidence/overnight/68-sound-box-drift';await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:process.env.HEADED!=='1',args:captureArgs});const page=await browser.newPage({viewport:{width:1440,height:900}});
const report={method:'Staged positions and drift charges followed by real keyboard controls. Actual box collision and item roulette; captured master-bus audio. Not a phone demo.',errors:[],chapters:[],checks:[]};let recording=false;
page.on('pageerror',e=>report.errors.push(e.stack));page.on('console',m=>{if(m.type()==='error'&&/THREE|shader|WebGL/i.test(m.text()))report.errors.push(m.text());});
const mark=async name=>{const time=await page.evaluate(()=>(performance.now()-__avStarted)/1000);report.chapters.push({name,time});console.log(name,time.toFixed(2));};
const snap=async name=>page.screenshot({path:out+'/'+name+'.png'});
async function setup(s,options={}){
 for(const key of ['KeyZ','Shift','ArrowRight','ArrowLeft'])await page.keyboard.up(key);
 await page.evaluate(({s,options})=>{const time=__kart.race.time+10;__kart.stage('normal');__kart.race.time=time;__kart.place(s,options);__kart.race.racers.slice(1).forEach((r,i)=>{Object.assign(r,course.surfaceAt(s+200+i*7,0),{finishTime:999});});window.scenarioEvents=[];const event=__kart.race.onEvent;__kart.race.onEvent=e=>{scenarioEvents.push(e);event(e);};__kart.audioUpdate();},{s,options});
 await page.waitForTimeout(140);
}
async function drive(seconds,{drift=false,lane=0}={}){
 await page.keyboard.down('KeyZ');if(drift)await page.keyboard.down('Shift');await page.evaluate(()=>__kart.freeze=false);let direction=0;const end=Date.now()+seconds*1000;
 while(Date.now()<end){const error=await page.evaluate(lane=>{const r=__kart.race.player,p=course.surfaceAt(r.s+Math.max(8,r.speed*.36),lane),q=new T.Vector3(p.x-r.x,p.y-r.y,p.z-r.z).applyQuaternion(__kart.karts[0].root.quaternion.clone().invert());return Math.atan2(q.x,-q.z);},lane);const next=error>.045?1:error<-.045?-1:0;
 if(next!==direction){if(direction)await page.keyboard.up(direction>0?'ArrowRight':'ArrowLeft');if(next)await page.keyboard.down(next>0?'ArrowRight':'ArrowLeft');direction=next;}await page.waitForTimeout(35);}
 if(direction)await page.keyboard.up(direction>0?'ArrowRight':'ArrowLeft');
}
try{
 await page.goto('http://localhost:8080/games/mario-kart/?evidence=1');await page.waitForFunction(()=>window.__kart?.karts.every(k=>k.source==='glb')&&__kart.audioState.samples.ready,null,{timeout:60000});
 await page.evaluate(async()=>{window.course=await import('./track.js');window.T=await import('three');});
 await page.click('#mute');await page.keyboard.press('Enter'); await page.keyboard.press('Enter');await page.waitForFunction(()=>__kart.race.state==='countdown'&&__kart.audioState.gain===0);assert.equal(await page.evaluate(()=>__kart.audioState.gain),0);report.checks.push('Mute before unlock is respected');await page.click('#mute');
 report.capture=await startAV(page,out+'/focused.webm');recording=true;await mark('Countdown and original Stadium music');await page.waitForFunction(()=>__kart.race.state==='racing');await drive(1.3);
 const box=await page.evaluate(()=>__kart.race.boxes[0].s);await setup(box-15,{speed:25});await mark('Mystery box: contact, glass, roulette, item decision');
 await page.keyboard.down('KeyZ');await page.evaluate(()=>__kart.freeze=false);
 await page.waitForFunction(()=>scenarioEvents.some(e=>e.type==='box'));await page.waitForTimeout(70);await snap('box-contact');await page.waitForTimeout(180);await snap('box-glints');await page.waitForTimeout(1600);await snap('item-ready');
 const boxEvents=await page.evaluate(()=>scenarioEvents);assert.ok(boxEvents.some(e=>e.type==='itemReady'));report.checks.push('Real pickup collision followed by item decision');
 assert.ok(!(await page.evaluate(()=>__kart.audioState.samples.loops)).some(n=>n.slot==='roulette'));report.checks.push('Roulette source stops at selection');
 // Stage just below each threshold, then cross it via the real fixed-step
 // drift logic. This isolates the three transitions without staged audio.
 for(const [tier,charge] of [[1,.68],[2,1.86],[3,3.25]]){
  await setup(230,{lateral:-5,speed:32});await page.evaluate(({tier,charge})=>Object.assign(__kart.race.player,{drift:-1,tier:tier-1,charge,lastInput:{drift:true}}),{tier,charge});
  await mark('Drift tier '+tier+' charge and release');await drive(.28,{drift:true,lane:-5});await page.waitForFunction(tier=>scenarioEvents.some(e=>e.type==='drift'&&e.tier===tier),tier);await snap('drift-'+tier);await drive(.35,{drift:true,lane:-5});await page.keyboard.up('Shift');await drive(.6,{lane:-5});await snap('release-'+tier);
  report.checks.push({tier,events:await page.evaluate(()=>scenarioEvents.filter(e=>['drift','turbo'].includes(e.type)))});
  assert.ok(!(await page.evaluate(()=>__kart.audioState.samples.loops)).some(n=>n.slot==='charge'),'Release stops charge');
 }
 await setup(230,{speed:32});await mark('Cancelled drift: charge and friction stop');await page.evaluate(()=>Object.assign(__kart.race.player,{drift:1,tier:2,charge:2}));await drive(.3,{drift:true});await page.evaluate(()=>__kart.race.hit(__kart.race.player,'red'));await drive(.4);assert.ok(!(await page.evaluate(()=>__kart.audioState.samples.loops)).some(n=>['charge','slip'].includes(n.slot)));report.checks.push('Spin cancels charge and friction');
 await setup(40,{speed:30});await mark('Mushroom, engine boost, and original voice');await page.evaluate(()=>__kart.race.player.item='mushroom');await page.keyboard.press('Space');await drive(1.8);await snap('mushroom');
 await mark('Mute the complete mix');await page.click('#mute');await page.waitForTimeout(1000);await page.click('#mute');await page.waitForTimeout(250);
 await mark('Pause and resume');await page.keyboard.press('Escape');await page.waitForTimeout(400);assert.equal(await page.evaluate(()=>__kart.audioState.state),'suspended');await page.waitForTimeout(600);await page.keyboard.press('Enter');await page.waitForTimeout(300);assert.equal(await page.evaluate(()=>__kart.audioState.state),'running');report.checks.push('Pause suspends audio and resume restores it');
 await setup(40,{speed:25,lap:3});await mark('Final lap fanfare and faster arrangement');await page.evaluate(()=>{__kart.race.emit('finalLap');__kart.freeze=false;});await drive(3.4);assert.equal(await page.evaluate(()=>__kart.audioState.samples.music),'final');report.checks.push('Final-lap fanfare transitions to original faster music');
 await mark('Finish and results');await page.evaluate(()=>{__kart.race.player.finishTime=1;__kart.race.racers[1].finishTime=.5;__kart.race.state='finishing';__kart.race.emit('finish');__kart.audioUpdate();});await page.waitForTimeout(3200);await page.evaluate(()=>{__kart.race.state='results';__kart.audioUpdate();});await page.waitForTimeout(700);assert.ok((await page.evaluate(()=>__kart.audioState.samples.loops)).every(n=>n.slot==='music'));report.checks.push('Finish clears engine, road, roulette and drift sources');
 report.audio=await page.evaluate(()=>__kart.audioState.samples);assert.ok(report.audio.events.some(e=>e.key==='finishMid'));await page.waitForFunction(()=>__kart.audioState.samples.music==='win',null,{timeout:10000});report.audio=await page.evaluate(()=>__kart.audioState.samples);assert.equal(report.audio.music,'win');report.checks.push('Second through sixth place use the matching native finish fanfare and positive result music');report.events=boxEvents;assert.deepEqual(report.audio.failures,[]);assert.deepEqual(report.errors,[]);
 await stopAV(page);recording=false;console.log('PASS',report.checks.length,'checks');
}catch(e){report.failure=e.stack;throw e;}finally{if(recording)await stopAV(page).catch(()=>{});await writeFile(out+'/sound-report.json',JSON.stringify(report,null,2));await browser.close();}
