/** Staged close-overtake sweep, with actual keyboard-independent camera/render state. */
import {chromium} from 'playwright';import {mkdir,writeFile} from 'node:fs/promises';
const out=process.env.EVIDENCE_DIR;await mkdir(out,{recursive:true});const b=await chromium.launch({channel:'chrome',headless:true});const report=[];
try{const p=await b.newPage({viewport:{width:1440,height:900}});await p.goto('http://localhost:8080/games/mario-kart/?evidence=1');await p.waitForFunction(()=>window.__kart?.assets?.loaded===8);await p.keyboard.press('KeyC');await p.keyboard.press('Enter');await p.waitForFunction(()=>__kart.race.state==='racing');
await p.evaluate(()=>{__kart.freeze=true;__kart.race.time=20;__kart.place(425,{speed:30});});
for(const delta of [-12,-9,-6,-3,0,3,6,9]){
 await p.evaluate(async delta=>{const {surfaceAt}=await import('./track.js');const r=__kart.race.racers[1],a=surfaceAt(425+delta,3);Object.assign(r,{s:425+delta,lateral:3,x:a.x,y:a.y,z:a.z,heading:a.heading,surfaceNormal:a.normal,surfaceForward:a.forward,gliding:false,spin:0,drift:0,item:null});},delta);
 await p.waitForTimeout(120);
 report.push(await p.evaluate(async delta=>{const T=await import('three'),k=__kart.karts[1],eye=new T.Vector3(...__kart.cameraState.eye);k.root.updateMatrixWorld(true);const bounds=new T.Box3().setFromObject(k.model,true);return {delta,visible:k.root.visible,cachedRadius:k.cameraBodyRadius,cachedCenter:k.cameraBodyCenter?.toArray(),currentBounds:[bounds.min.toArray(),bounds.max.toArray()],eye:eye.toArray(),distanceToActualBox:bounds.distanceToPoint(eye)};},delta));
 await p.screenshot({path:out+'/rival-'+(delta+12)+'.png'});
}await writeFile(out+'/visibility.json',JSON.stringify(report,null,2));console.log(report.map(r=>({delta:r.delta,visible:r.visible,radius:r.cachedRadius,distanceToBox:r.distanceToActualBox})));}finally{await b.close();}
