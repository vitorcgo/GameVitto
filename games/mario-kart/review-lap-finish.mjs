/** Pass 73: menu controls, lap persistence, short-cue results, and front finish camera.
 * Finish positions are staged; crossing, camera, audio and UI run normally. */
import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {captureArgs,startAV,stopAV} from './review-av.mjs';
const out=process.env.EVIDENCE_DIR||'games/mario-kart/evidence/overnight/73-lap-finish';
const base=process.env.KART_URL||'http://localhost:8081';await mkdir(out,{recursive:true});
const b=await chromium.launch({channel:'chrome',headless:true,args:['--autoplay-policy=no-user-gesture-required',...captureArgs]});
const p=await b.newPage({viewport:{width:1280,height:720}});
const phone=await b.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
const report={errors:[],checks:[],runs:[],method:'Actual phone DOM touch -> Socket.IO menu commands. Synthetic IMU. Staged final-gate positions with actual keyboard crossing; rendered camera, original audio and leaderboard. Not physical iPhone testing or a full manual race.'};let recording=false;
for(const page of [p,phone])page.on('pageerror',e=>report.errors.push(e.stack));
const ready=()=>p.waitForFunction(()=>window.__kart?.karts.every(k=>k.source==='glb')&&__kart.audioState.samples.ready,null,{timeout:60000});
try{
 await p.goto(base+'/games/mario-kart/?evidence=1');await ready();
 assert.equal(await p.evaluate(()=>__kart.race.laps),3);
 await p.locator('[data-laps="1"]').click();assert.equal(await p.evaluate(()=>__kart.race.laps),1);
 await p.reload();await ready();assert.equal(await p.evaluate(()=>__kart.race.laps),1);
 await p.screenshot({path:out+'/menu.png'});report.checks.push('Default three laps; mouse selects one; selection survives reload');
 await phone.goto(base+'/controller');await phone.waitForFunction(()=>document.body.classList.contains('wheel-mode'));
 await phone.locator('#enable').tap();
 await phone.evaluate(()=>setInterval(()=>window.dispatchEvent(new DeviceOrientationEvent('deviceorientation',{alpha:0,beta:0,gamma:0,absolute:false})),16));
 await phone.locator('#btn-2').tap();await p.waitForFunction(()=>document.getElementById('start').textContent.includes('Start Race'));
 await phone.locator('.dp.r').tap();await p.waitForFunction(()=>__kart.race.laps===3);
 await phone.locator('.dp.l').tap();await p.waitForFunction(()=>__kart.race.laps===1);
 await p.screenshot({path:out+'/menu-confirmed.png'});report.checks.push('Phone 2 confirms driver; crosspad changes laps without changing driver');
 await phone.locator('#btn-2').tap();await p.waitForFunction(()=>__kart.race.state==='racing',null,{timeout:12000});
 assert.equal(await p.evaluate(()=>__kart.race.laps),1);report.checks.push('Phone 2 starts selected one-lap race through live countdown');
 await phone.close();
 await p.waitForFunction(()=>__kart.paused);await p.keyboard.press('Enter');
 await p.waitForFunction(()=>__kart.audioState.samples.context==='running');
 await p.evaluate(async()=>window.course=await import('./track.js'));
 await startAV(p,out+'/finish.webm');recording=true;
 await p.evaluate(()=>__kart.resume());
 await p.waitForFunction(()=>__kart.audioState.samples.context==='running');
 for(const laps of [1,3]){
  await p.evaluate(laps=>{
   __kart.stage('normal');const r=__kart.race,L=course.TRACK_LENGTH;r.laps=laps;
   __kart.place(L-5,{speed:30,lap:laps});Object.assign(r.player,{progress:laps*L-5,checkpoints:laps*8-1,nextCheckpoint:laps*L});r.raceTime=40*laps;
   // All opponents are unfinished and far behind: the UI must not wait for them.
   r.racers.slice(1).forEach((k,i)=>Object.assign(k,course.surfaceAt(100+i*15,0),{progress:100+i*15,checkpoints:0,nextCheckpoint:L/8,finishTime:null}));
   window.samples=[];window.observeResults=true;
   function sample(){if(!observeResults)return;const a=__kart.audioState.samples,c=__kart.cameraState,k=r.player;const eye=c.eye;
    samples.push({at:performance.now()/1000,clock:a.now,cueEnd:a.finishCueUntil,state:r.state,visible:!document.getElementById('results').hidden,ready:!document.getElementById('again').disabled,front:(eye[0]-k.x)*Math.sin(k.heading)-(eye[2]-k.z)*Math.cos(k.heading),eye,player:[k.x,k.y,k.z],text:document.getElementById('standings').innerText});requestAnimationFrame(sample);
   }sample();__kart.freeze=false;
  },laps);
  await p.keyboard.down('KeyZ');await p.waitForFunction(()=>__kart.race.player.finishTime!==null);await p.keyboard.up('KeyZ');
  await p.waitForTimeout(500);await p.screenshot({path:out+`/orbit-${laps}.png`});
  await p.waitForFunction(()=>!document.getElementById('results').hidden&&!document.getElementById('again').disabled,null,{timeout:10000});
  await p.waitForTimeout(1200);await p.screenshot({path:out+`/results-${laps}.png`});
  const run=await p.evaluate(laps=>{observeResults=false;return {laps,samples,audio:__kart.audioState.samples,checkpoints:__kart.race.player.checkpoints,finishTimes:__kart.race.standings.map(r=>r.finishTime)};},laps);
  report.runs.push(run);
  const shown=run.samples.find(s=>s.visible),settled=run.samples.find(s=>s.visible&&s.ready),last=run.samples.at(-1);
  console.log('timing',shown.clock,shown.cueEnd,run.audio.finishUntil,run.audio.events.filter(e=>e.key==='finish'));
  assert.ok(shown.clock>=shown.cueEnd && shown.clock-shown.cueEnd<.12,'Reveal on first rendered frame after short cue');
  assert.ok(shown.clock<run.audio.finishUntil,'Reveal before placement fanfare ends');
  assert.equal(run.checkpoints,laps*8);assert.equal(run.finishTimes.filter(t=>t===null).length,7);
  assert.equal((settled.text.match(/—/g)||[]).length,7,'Unfinished racers show dashes');
  assert.equal(last.text,settled.text,'Standings snapshot stays stable');
  assert.ok(last.front>3,'Camera is in front looking back at racer');
  const moved=Math.hypot(...last.player.map((v,i)=>v-settled.player[i]));assert.ok(moved>10,'Autodrive continues behind results');
  const cues=run.audio.events.filter(e=>['resultsIn','resultsCount','resultsStop'].includes(e.key));
  assert.deepEqual(cues.slice(-3).map(e=>e.key),['resultsIn','resultsCount','resultsStop']);
  run.transition={revealDelay:shown.clock-shown.cueEnd,frontDistance:last.front,autoDriveDistance:moved};console.log(laps,run.transition);
 }
 assert.deepEqual(report.errors,[]);await stopAV(p);recording=false;
} catch(e){report.failure=e.stack;throw e;} finally {if(recording)await stopAV(p).catch(()=>{});await writeFile(out+'/report.json',JSON.stringify(report,null,2));await b.close();}
