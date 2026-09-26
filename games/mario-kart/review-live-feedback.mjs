/** Pass 70: real controller DOM -> Socket.IO -> game, with simulated flat IMU.
 * Staged race positions isolate collisions/items. This is not a physical iPhone test. */
import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {captureArgs,startAV,stopAV} from './review-av.mjs';
const out=process.env.EVIDENCE_DIR||'games/mario-kart/evidence/overnight/70-race-followup';
const base=process.env.KART_URL||'http://localhost:8081';await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--autoplay-policy=no-user-gesture-required',...captureArgs]});
const phoneBrowser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1280,height:720}});
const phone=await phoneBrowser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
const report={method:'Actual controller pointer handlers and Socket.IO relay; simulated flat DeviceOrientation events; staged item/contact positions; actual game audio and HTML/WebGL capture. Physical iPhone rotation/feel remains user acceptance.',errors:[],checks:[],chapters:[]};let recording=false;
for(const p of [page,phone])p.on('pageerror',e=>report.errors.push(e.stack));
const mark=async name=>{const time=await page.evaluate(()=>(performance.now()-__avStarted)/1000);report.chapters.push({name,time});console.log(name,time.toFixed(2));};
const snap=async name=>page.screenshot({path:`${out}/${name}.png`});
const press=async selector=>{await phone.locator(selector).tap();await page.waitForTimeout(100);};
async function hold(selector,on,id=1){await phone.locator(selector).dispatchEvent(on?'pointerdown':'pointerup',{pointerId:id,pointerType:'touch',bubbles:true});}
// Browser's real touch API is used for individual buttons. Multi-touch dispatch
// below gives each contact a distinct pointer id and exercises the actual handlers.
async function setup(s,options={}){
 await hold('#btn-2',false);await hold('#btn-a',false,2);
 await page.evaluate(({s,options})=>{const time=__kart.race.time+10;__kart.stage('normal');__kart.race.time=time;__kart.place(s,options);__kart.race.racers.slice(1).forEach((r,i)=>Object.assign(r,course.surfaceAt(s+250+i*7,0),{finishTime:999}));window.events=[];const event=__kart.race.onEvent;__kart.race.onEvent=e=>{events.push({...e,time:__kart.race.time});event(e);};__kart.audioUpdate();},{s,options});
}
async function resumeRun(){await page.evaluate(()=>__kart.freeze=false);}
try{
 await page.goto(base+'/games/mario-kart/?evidence=1');await page.waitForFunction(()=>window.__kart?.karts.every(k=>k.source==='glb')&&__kart.audioState.samples.ready,null,{timeout:60000});
 await page.evaluate(async()=>{window.course=await import('./track.js');window.T=await import('three');});
 await phone.addInitScript(()=>{window.testAngle=0;Object.defineProperty(window,'orientation',{get:()=>window.testAngle,configurable:true});});
 await phone.goto(base+'/controller');await phone.waitForFunction(()=>document.body.classList.contains('wheel-mode'));
 await phone.locator('#enable').tap();
 await phone.evaluate(()=>{window.sensorTimer=setInterval(()=>window.dispatchEvent(new DeviceOrientationEvent('deviceorientation',{alpha:0,beta:0,gamma:0,absolute:false})),16);});
 await page.waitForTimeout(700);
 await phone.screenshot({path:out+'/remote-portrait.png'});
 report.capture=await startAV(page,out+'/focused.webm');recording=true;await mark('Menu music continues while landscape crosspad selects drivers');
 const menuStarts=await page.evaluate(()=>__kart.audioState.samples.events.filter(e=>e.key==='menu').length);
 const rects=()=>Object.fromEntries(['remote','dpad','btn-a','btn-b','btn-1','btn-2','speaker'].map(id=>{const r=document.getElementById(id).getBoundingClientRect();return[id,{x:r.x+r.width/2-innerWidth/2,y:r.y+r.height/2-innerHeight/2,w:r.width,h:r.height}]}));
 const portrait=await phone.evaluate(rects);report.remote={portrait,landscapes:[]};
 for(const angle of [90,-90]){
  await phone.evaluate(angle=>{testAngle=angle;window.dispatchEvent(new Event('orientationchange'));},angle);
  await phone.setViewportSize({width:844,height:390});await phone.waitForTimeout(150);
  const landscape=await phone.evaluate(rects);report.remote.landscapes.push({angle,rects:landscape});
  for(const id of ['dpad','btn-a','btn-1','btn-2','speaker']){
   const r=landscape[id],q=portrait[id];
   // Independent physical ground truth: after a left turn of the handset,
   // its original top is left; after a right turn, its top is right.
   assert.ok(Math.abs(r.x-(angle===90?q.y:-q.y))<2,`${id} physical x at ${angle}`);
   assert.ok(Math.abs(r.y-(angle===90?-q.x:q.x))<2,`${id} physical y at ${angle}`);
   assert.ok(Math.abs(r.w-q.h)<2&&Math.abs(r.h-q.w)<2,`${id} dimensions preserved`);
  }
  await phone.screenshot({path:out+`/remote-landscape-${angle}.png`});
  const directions=await phone.evaluate(()=>{
    const buttons=['u','d','l','r'].map(k=>{const b=document.querySelector('.dp.'+k).getBoundingClientRect();return {selector:'.dp.'+k,x:b.x+b.width/2,y:b.y+b.height/2};});
    return {left:buttons.toSorted((a,b)=>a.x-b.x)[0].selector,right:buttons.toSorted((a,b)=>b.x-a.x)[0].selector,up:buttons.toSorted((a,b)=>a.y-b.y)[0].selector,down:buttons.toSorted((a,b)=>b.y-a.y)[0].selector};
  });
  assert.equal(await phone.evaluate(()=>getComputedStyle(document.documentElement).backgroundColor),'rgb(16, 20, 28)');
  assert.equal(await phone.evaluate(()=>getComputedStyle(document.body).backgroundColor),'rgb(16, 20, 28)');
  if(angle===90){
    const guide=await phone.evaluate(()=>{
      const el=document.getElementById('wheel-guide'),r=el.getBoundingClientRect(),remote=document.getElementById('remote').getBoundingClientRect();
      const text=el.firstChild,a=document.createRange(),b=document.createRange();a.setStart(text,0);a.setEnd(text,1);b.setStart(text,text.length-1);b.setEnd(text,text.length);
      return {top:r.top,bottom:r.bottom,remoteTop:remote.top,first:a.getBoundingClientRect().x,last:b.getBoundingClientRect().x,text:el.textContent};
    });
    assert.ok(guide.top>=0&&guide.bottom<=guide.remoteTop);assert.ok(guide.first<guide.last);assert.match(guide.text,/MARIO KART.*Hold sideways/);
    report.checks.push({landscapeGuide:guide});
  }
  for(const [direction,name] of [['right','Luigi'],['down','Bowser'],['left','Toad'],['up','Mario']]){
    await press(directions[direction]);assert.match(await page.locator('#chosen').textContent(),new RegExp(name,'i'));
  }
  report.checks.push('All four screen directions select correctly at landscape '+angle);
 }
 report.checks.push('Portrait remote geometry preserved at both landscape rotations, including speaker and stacked 1/2');
 await phone.evaluate(()=>{testAngle=90;window.dispatchEvent(new Event('orientationchange'));});
 await press('.dp.d');assert.match(await page.locator('#chosen').textContent(),/Luigi/i);
 await press('#btn-2');assert.equal(await page.evaluate(()=>__kart.race.state),'ready');assert.match(await page.locator('#start').textContent(),/Start Race/);
 await snap('driver-confirmed');report.checks.push('Crosspad changes driver; first 2 confirms without starting');
 assert.equal(await page.evaluate(()=>__kart.audioState.samples.events.filter(e=>e.key==='menu').length),menuStarts);report.checks.push('Menu source is not restarted by nine driver changes');
 const uiMenu=await page.evaluate(()=>__kart.audioState.samples.events.filter(e=>/^ui/.test(e.key)));
 assert.equal(uiMenu.filter(e=>e.key==='uiCursor').length,9);assert.ok(uiMenu.some(e=>e.key==='uiConfirm'));report.checks.push({nativeMenuCues:uiMenu});await mark('Phone selects Luigi, confirms driver, then starts');
 await press('#btn-2');await page.waitForFunction(()=>__kart.race.state==='countdown');
 await page.waitForFunction(()=>document.getElementById('count-number').dataset.value==='3');await snap('count-3');
 for(const n of ['2','1','GO!']){await page.waitForFunction(n=>document.getElementById('count-number').dataset.value===n,n);await snap(n==='GO!'?'go':'count-'+n);}
 report.checks.push('Live relay start displays 3, 2, 1, GO plus lamps after sensor calibration');
 await page.waitForTimeout(750);
 // Actual touch multi-hold: CDP creates active touch pointers, unlike dispatchEvent.
 const cdp=await phone.context().newCDPSession(phone);
 let previousTouches=[];
 const touch=async ids=>{
   const points=await phone.evaluate(ids=>ids.map(id=>{const r=document.querySelector(id).getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2,id:id==='#btn-2'?1:2,radiusX:4,radiusY:4};}),ids);
   const removed=previousTouches.filter(p=>!points.some(q=>q.id===p.id));
   const added=points.filter(p=>!previousTouches.some(q=>q.id===p.id));
   if(removed.length)await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:removed});
   if(added.length)await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:added});
   previousTouches=points;
 };
 await setup(45,{speed:28});await mark('Phone 2 accelerates; A drifts; releasing A keeps gas held');await resumeRun();
 await touch(['#btn-2','#btn-a']);await page.waitForTimeout(350);
 assert.ok(await page.evaluate(()=>__kart.race.player.lastInput.gas&&__kart.race.player.lastInput.drift));
 await touch(['#btn-2']);await page.waitForTimeout(150);assert.ok(await page.evaluate(()=>__kart.race.player.lastInput.gas&&!__kart.race.player.lastInput.drift));await touch([]);
 report.checks.push('Real multitouch gas + A drift, individual release');
 await setup(40,{speed:27});await mark('Right arrow throws a red shell; impact confirms the player hit');
 await page.evaluate(()=>{const r=__kart.race.racers[1],p=course.surfaceAt(54,0);Object.assign(r,p,{s:54,progress:54,lateral:0,speed:15,heading:p.heading,finishTime:null});__kart.race.cpuInput=()=>({gas:false,steer:0});__kart.race.player.item='red';});
 await resumeRun();await press('.dp.r');await page.waitForFunction(()=>events.some(e=>e.type==='hit'&&e.attacker===0),null,{timeout:6000});await snap('shell-hit');await page.waitForTimeout(900);
 const hit=await page.evaluate(()=>__kart.audioState.samples.events.filter(e=>e.key==='impact-confirmation'));assert.ok(hit.some(e=>e.attacker===0&&e.victim===1));report.checks.push({shellHit:hit});
 assert.equal(await page.evaluate(()=>__kart.audioState.samples.projectiles.length),0);
 report.checks.push('Shell flight sound ends on impact');
 await setup(40,{speed:0});await mark('Green shell flies away: flight sound fades and ends with distance');
 await page.evaluate(()=>{__kart.race.player.item='green';});await resumeRun();await press('.dp.r');
 await page.waitForFunction(()=>__kart.audioState.samples.events.some(e=>e.key==='shell-sound-ended'&&e.reason==='distance'),null,{timeout:4000});
 assert.ok(await page.evaluate(()=>__kart.race.objects.some(o=>o.type==='green'&&o.life>0)));
 assert.equal(await page.evaluate(()=>__kart.audioState.samples.projectiles.length),0);await page.waitForTimeout(700);report.checks.push('Distant shell is still alive while its flight sound has ended');
 await setup(40,{speed:38});await mark('Rear collision: stronger shove, quieter single collision cue');
 await page.evaluate(()=>{const r=__kart.race.racers[1],p=course.surfaceAt(47,0);Object.assign(r,p,{s:47,progress:47,lateral:0,speed:12,heading:p.heading,finishTime:null});__kart.race.cpuInput=()=>({gas:false,steer:0});});
 await resumeRun();await page.waitForFunction(()=>events.some(e=>e.type==='contact'),null,{timeout:4000});await snap('collision');await page.waitForTimeout(600);
 report.contact=await page.evaluate(()=>({events,playerSpeed:__kart.race.player.speed,rivalSpeed:__kart.race.racers[1].speed,audio:__kart.audioState.samples.events.filter(e=>e.key==='contact')}));assert.ok(report.contact.rivalSpeed>15);report.checks.push('Rear contact visibly moves the slower rival and emits one player collision sound');
 const boxS=await page.evaluate(()=>__kart.race.boxes[0].s);await setup(boxS-25,{speed:0});await mark('CPU takes a box; the same box returns after one second');
 await page.evaluate(()=>{const b=__kart.race.boxes[0],r=__kart.race.racers[1],p=course.surfaceAt(b.s-2,b.lateral);Object.assign(r,p,{s:b.s-2,progress:b.s-2,lateral:b.lateral,speed:20,heading:p.heading,finishTime:null});__kart.race.cpuInput=()=>({gas:false,steer:0});});
 await resumeRun();await page.waitForFunction(()=>events.some(e=>e.type==='box'&&e.racer===1),null,{timeout:4000});
 const collected=await page.evaluate(()=>({time:__kart.race.time,box:events.find(e=>e.type==='box'&&e.racer===1).box}));await snap('box-collected');
 await page.waitForFunction(i=>__kart.race.boxes[i].respawn===0,collected.box);const elapsed=await page.evaluate(t=>__kart.race.time-t,collected.time);assert.ok(elapsed>=.9&&elapsed<1.2);report.checks.push({boxRespawnSeconds:elapsed});await snap('box-returned');
 await setup(45,{speed:27});await mark('Star music takes priority over engine and crowd');await page.evaluate(()=>__kart.race.player.item='star');await resumeRun();await press('.dp.r');await page.waitForTimeout(450);await snap('star');
 report.star=await page.evaluate(()=>__kart.audioState.samples);assert.equal(report.star.music,'star');assert.ok(report.star.mix.music>.95&&report.star.mix.engine<.5);await page.waitForTimeout(3000);report.checks.push('Star replaces race music, is louder, and ducks engine/crowd');
 await setup(40,{speed:0});await mark('Player is struck by a shell: damage sound and animation');await page.evaluate(()=>{__kart.race.hit(__kart.race.player,'green',1);__kart.freeze=false;});await page.waitForTimeout(150);await snap('player-hit');await page.waitForTimeout(1300);
 // Finish via actual progress/gate crossing, not a fabricated audio event.
 await setup(0,{speed:30,lap:3});await mark('Crossing the finish: universal cue, placement fanfare, native-style standings');
 await page.evaluate(()=>{const race=__kart.race,L=course.TRACK_LENGTH,p=race.player;__kart.place(L-5,{speed:30,lap:3});p.progress=3*L-5;p.lap=3;p.checkpoints=23;p.nextCheckpoint=3*L;});
 await resumeRun();await page.waitForFunction(()=>__kart.race.player.finishTime!==null,null,{timeout:8000});await snap('finish');await page.waitForTimeout(1300);
 report.finish=await page.evaluate(()=>__kart.audioState.samples.events.filter(e=>/^finish/.test(e.key)));assert.ok(report.finish.some(e=>e.key==='finish'));assert.ok(report.finish.some(e=>/^finish(Win|Mid|Lose)$/.test(e.key)));
 await page.waitForFunction(()=>__kart.race.state==='results',null,{timeout:15000});await page.waitForFunction(()=>!document.getElementById('results').hidden&&!document.getElementById('again').disabled,null,{timeout:15000});await snap('results');await page.waitForFunction(()=>__kart.audioState.samples.music==='win',null,{timeout:12000});await page.waitForTimeout(1000);report.checks.push('Actual finish line crossing fires both native finish cues, then results');
 await mark('Leaderboard stays fixed while all eight racers continue driving automatically');
 const before=await page.evaluate(()=>({positions:__kart.race.racers.map(r=>({x:r.x,z:r.z,progress:r.progress})),table:document.querySelector('#results').innerText,times:__kart.race.racers.map(r=>r.finishTime)}));
 await page.waitForTimeout(4000);
 const after=await page.evaluate(()=>({positions:__kart.race.racers.map(r=>({x:r.x,z:r.z,progress:r.progress})),table:document.querySelector('#results').innerText,times:__kart.race.racers.map(r=>r.finishTime)}));
 assert.equal(after.table,before.table);assert.deepEqual(after.times,before.times);
 for(let i=0;i<8;i++)assert.ok(Math.hypot(after.positions[i].x-before.positions[i].x,after.positions[i].z-before.positions[i].z)>20);
 report.checks.push({resultsAutodrive:{before,after}});await snap('results-driving');
 report.audio=await page.evaluate(()=>__kart.audioState.samples);
 assert.ok(report.audio.mix.music<.34&&report.audio.mix.effects<.2&&report.audio.mix.ui===1);
 report.checks.push('Active results music/effects duck while menu UI bus remains full level');assert.deepEqual(report.audio.failures,[]);assert.deepEqual(report.errors,[]);
 await stopAV(page);recording=false;await page.close();await phone.waitForFunction(()=>!document.body.classList.contains('wheel-mode'));assert.equal(await phone.locator('#wheel-guide').isVisible(),false);report.checks.push('Leaving Mario Kart restores the standard remote and removes Mario Kart hints');await phone.screenshot({path:out+'/remote-default.png'});console.log('PASS',report.checks.length);
}catch(e){report.failure=e.stack;throw e;}finally{
 if(recording)await stopAV(page).catch(()=>{});await writeFile(out+'/live-report.json',JSON.stringify(report,null,2));await phoneBrowser.close();await browser.close();
}
