/** Controlled airborne blue-shell hit; diagnostic, not an unmodified full race. */
import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const out=process.env.EVIDENCE_DIR;assert.ok(out,'EVIDENCE_DIR required');await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const context=await browser.newContext({viewport:{width:1440,height:900},recordVideo:{dir:out,size:{width:1440,height:900}}});
const page=await context.newPage(),video=page.video();
const report={method:'Staged s875 approach, real keyboard gas, one explicitly injected blue-shell hit at flight1.4. Renderer and physics then run normally through landing.',errors:[]};
try{
 page.on('pageerror',e=>report.errors.push(e.message));
 await page.goto('http://localhost:8080/games/mario-kart/?evidence=1');
 await page.waitForFunction(()=>window.__kart?.assets?.loaded===8);assert.equal(await page.evaluate(()=>__kart.sourceCourse),true);
 await page.keyboard.press('KeyC');await page.keyboard.press('Enter');await page.waitForFunction(()=>__kart.race.state==='racing');
 await page.evaluate(()=>{
  __kart.place(875,{speed:36});window.__hitReview={frames:[],injected:false};let previous=-1;
  const sample=()=>{const d=__kart,r=d.race.player,review=__hitReview;
   if(r.gliding&&r.flight>=1.4&&!review.injected){r.invulnerable=0;r.star=0;review.injected=d.race.hit(r,'blue');review.hitTime=d.race.time;}
   if(previous!==d.renderCount){previous=d.renderCount;review.frames.push({frame:previous,time:d.race.time,s:r.s,flight:r.flight,gliding:r.gliding,speed:r.speed,flightV:r.flightV,spin:r.spin,heading:r.heading,player:[r.x,r.y,r.z],camera:d.cameraState,quaternion:d.karts[0].root.quaternion.toArray()});}
   if(review.frames.length<900)requestAnimationFrame(sample);
  };requestAnimationFrame(sample);
 });
 await page.keyboard.down('KeyZ');
 await page.waitForFunction(()=>__hitReview.injected&&!__kart.race.player.gliding,{},{timeout:20000});
 await page.waitForTimeout(600);await page.keyboard.up('KeyZ');
 Object.assign(report,await page.evaluate(()=>__hitReview));
 const slow=report.frames.filter(f=>f.gliding&&f.speed<10);
 report.slowFrames=slow.length;
 report.maximumElevation=Math.max(...slow.map(f=>Math.atan2(f.camera.eye[1]-f.player[1],Math.hypot(f.camera.eye[0]-f.player[0],f.camera.eye[2]-f.player[2]))*180/Math.PI));
 report.minimumBehind=Math.min(...slow.map(f=>-(f.camera.eye[0]-f.player[0])*Math.sin(f.heading)+(f.camera.eye[2]-f.player[2])*Math.cos(f.heading)));
 assert.ok(report.injected&&slow.length>10);assert.deepEqual(report.errors,[]);
 console.log({slowFrames:report.slowFrames,maximumElevation:report.maximumElevation,minimumBehind:report.minimumBehind});
}finally{await context.close();await video.saveAs(out+'/keyboard-demo.webm');await writeFile(out+'/glide-hit-review.json',JSON.stringify(report,null,2));await browser.close();}
