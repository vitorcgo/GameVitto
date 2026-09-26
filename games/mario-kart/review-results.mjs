/** Actual rendered results transition, repeated with first/last place and lagging CPU finishes. */
import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {captureArgs,startAV,stopAV} from './review-av.mjs';
const out=process.env.EVIDENCE_DIR||'games/mario-kart/evidence/overnight/73-results-timing';await mkdir(out,{recursive:true});
const b=await chromium.launch({channel:'chrome',headless:true,args:['--autoplay-policy=no-user-gesture-required',...captureArgs]});
const p=await b.newPage({viewport:{width:1280,height:720}}),report={errors:[],runs:[],method:'Staged final gate, actual keyboard input and finish crossing. Record first and last place with original fanfare, leaderboard animation and UI sounds.'};let recording=false;
p.on('pageerror',e=>report.errors.push(e.stack));
try{
 await p.goto((process.env.KART_URL||'http://localhost:8081')+'/games/mario-kart/?evidence=1');await p.waitForFunction(()=>window.__kart?.karts.every(k=>k.source==='glb')&&__kart.audioState.samples.ready,null,{timeout:60000});
 await p.evaluate(async()=>window.course=await import('./track.js'));
 await startAV(p,out+'/results.webm');recording=true;
 for(const place of [1,8]){
  await p.evaluate(place=>{
   __kart.stage('normal');const r=__kart.race,L=course.TRACK_LENGTH;__kart.place(L-5,{speed:30,lap:3});
   Object.assign(r.player,{progress:3*L-5,checkpoints:23,nextCheckpoint:3*L});r.raceTime=100;
   r.racers.slice(1).forEach((k,i)=>k.finishTime=place===1?110+i:90+i);
   window.samples=[];window.observeResults=true;
   function sample(){if(!observeResults)return;const result=document.getElementById('results');samples.push({at:performance.now()/1000,state:r.state,visible:!result.hidden,ready:!document.getElementById('again').disabled,music:__kart.audioState.samples.music,text:document.getElementById('standings').innerText});requestAnimationFrame(sample);}sample();
   __kart.freeze=false;
  },place);
  await p.keyboard.down('KeyZ');await p.waitForFunction(()=>__kart.race.player.finishTime!==null);await p.keyboard.up('KeyZ');
  await p.waitForFunction(()=>!document.getElementById('results').hidden&&!document.getElementById('again').disabled,null,{timeout:16000});
  await p.waitForTimeout(1400);await p.screenshot({path:out+`/place-${place}.png`});
  const run=await p.evaluate(place=>{observeResults=false;return {place,samples,audio:__kart.audioState.samples,finishTimes:__kart.race.standings.map(r=>r.finishTime)};},place);
  const shown=run.samples.find(s=>s.visible),settled=run.samples.find(s=>s.visible&&s.ready),finish=run.samples.find(s=>s.state==='finishing');
  const entrance=run.audio.events.filter(e=>e.key==='resultsIn').at(-1);
  assert.ok(entrance.at>=run.audio.finishCueUntil && entrance.at-run.audio.finishCueUntil<.12,'Reveal immediately after short finish cue');
  assert.ok(entrance.at<run.audio.finishUntil,'Do not wait for placement fanfare');
  assert.ok(settled.at-shown.at>=1.15&&settled.at-shown.at<1.4,'Predictable tally duration');
  assert.equal(run.samples.at(-1).text,settled.text,'Final table remains fixed while driving');
  const events=run.audio.events,finishEvent=events.filter(e=>e.key==='finish').at(-1);
  const cues=events.filter(e=>e.at>=finishEvent.at&&['resultsIn','resultsCount','resultsStop'].includes(e.key));
  assert.deepEqual(cues.map(e=>e.key),['resultsIn','resultsCount','resultsStop']);assert.equal(cues[2].delay,1.2);
  run.transition={shownAfterFinish:shown.at-finish.at,tallySeconds:settled.at-shown.at,cues};report.runs.push(run);console.log(place,run.transition);
 }
 assert.deepEqual(report.errors,[]);await stopAV(p);recording=false;
}catch(e){report.failure=e.stack;throw e;}finally{if(recording)await stopAV(p).catch(()=>{});await writeFile(out+'/results-report.json',JSON.stringify(report,null,2));await b.close();}
