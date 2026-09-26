/** Continuous diagnostic replay of an observed failure; no claim of live driving. */
import {chromium} from 'playwright';import {mkdir,readFile,writeFile} from 'node:fs/promises';import assert from 'node:assert/strict';
const out=process.env.EVIDENCE_DIR;assert.ok(out);await mkdir(out,{recursive:true});
const source='games/mario-kart/evidence/overnight/57h-held-item-race/camera-frames.json';
const frames=JSON.parse(await readFile(source,'utf8')).frames.filter(f=>f.time>=43&&f.time<=48&&f.normal);
const browser=await chromium.launch({channel:'chrome',headless:true}),context=await browser.newContext({viewport:{width:1440,height:900},recordVideo:{dir:out,size:{width:1440,height:900}}}),page=await context.newPage(),video=page.video();
const report={method:'Continuous replay of57h recorded player poses at original timestamps43–48s. Physics frozen,empty inventory,no spin. This is a deterministic camera diagnostic,not a keyboard race.',source,errors:[]};
try {
 page.on('pageerror',e=>report.errors.push(e.message));await page.goto('http://localhost:8080/games/mario-kart/?evidence=1');
 await page.waitForFunction(()=>window.__kart?.assets?.loaded===8);await page.keyboard.press('KeyC');await page.keyboard.press('Enter');await page.waitForFunction(()=>__kart.race.state==='racing');
 await page.evaluate(async frames=>{
  const T=await import('three');__kart.freeze=true;window.cameraReplay={frames,samples:[],done:false};
  const assign=f=>{const r=__kart.race.player;__kart.race.time=f.time;Object.assign(r,{s:f.s,lateral:f.lateral,x:f.player[0],y:f.player[1],z:f.player[2],heading:f.heading,surfaceNormal:f.normal,surfaceForward:f.forward,item:null,roulette:0,star:0,spin:0,drift:0,steer:0,hop:0,gliding:false,speed:30});};
  assign(frames[0]);__kart.snapCamera=true;
  await new Promise(resolve=>setTimeout(resolve,400));
  const start=performance.now();let index=0;
  const step=()=>{
   const target=frames[0].time+(performance.now()-start)/1000;
   while(index<frames.length-1&&frames[index+1].time<=target)index++;
   const f=frames[index];assign(f);
   const k=__kart.karts[0],eye=new T.Vector3(...__kart.cameraState.eye);k.model.updateWorldMatrix(true,false);
   cameraReplay.samples.push({time:target,frame:f.frame,eye:eye.toArray(),eyeInModel:k.model.worldToLocal(eye.clone()).toArray(),player:f.player,camera:__kart.cameraState});
   if(target<frames.at(-1).time)requestAnimationFrame(step);else cameraReplay.done=true;
  };requestAnimationFrame(step);
 },frames);
 await page.waitForFunction(()=>cameraReplay.done);await page.waitForTimeout(300);
 report.samples=await page.evaluate(()=>cameraReplay.samples);
 report.minEyeDistance=Math.min(...report.samples.map(s=>Math.hypot(s.eyeInModel[0],s.eyeInModel[1]-1.3,s.eyeInModel[2])));
 report.maxEyeStep=Math.max(...report.samples.slice(1).map((s,i)=>Math.hypot(...s.eye.map((v,j)=>v-report.samples[i].eye[j]))));
 assert.ok(report.minEyeDistance>4.5,'Keep the eye outside the driver and retain chase distance');
 assert.ok(report.maxEyeStep<2,'No large frame-to-frame camera teleport during the recorded trajectory');assert.deepEqual(report.errors,[]);
 console.log({samples:report.samples.length,minEyeDistance:report.minEyeDistance,maxEyeStep:report.maxEyeStep});
}catch(error){report.failure=error.stack;throw error;}
finally{await context.close();await video.saveAs(out+'/keyboard-demo.webm');await writeFile(out+'/camera-replay.json',JSON.stringify(report,null,2));await browser.close();}
