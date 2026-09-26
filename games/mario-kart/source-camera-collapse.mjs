/** Reconstruct an observed camera failure from the real race's recorded pose. */
import {chromium} from 'playwright';import {mkdir,readFile,writeFile} from 'node:fs/promises';
const out=process.env.EVIDENCE_DIR||'games/mario-kart/evidence/overnight/58a-camera-collapse';await mkdir(out,{recursive:true});
const frames=JSON.parse(await readFile(`${out}/closest-frames.json`,'utf8'));
const browser=await chromium.launch({channel:'chrome',headless:true});
const report={method:'Replay exact player position,normal,forward and heading from57h recorded failure; no mushroom in inventory. Compare actual course triangle casts for alternate focus heights and camera elevations.',frame:frames[0],errors:[]};
try {
 const page=await browser.newPage({viewport:{width:1440,height:900}});page.on('pageerror',e=>report.errors.push(e.message));
 await page.goto('http://localhost:8080/games/mario-kart/?evidence=1');await page.waitForFunction(()=>window.__kart?.assets?.loaded===8);
 await page.keyboard.press('KeyC');await page.keyboard.press('Enter');await page.waitForFunction(()=>__kart.race.state==='racing');
 await page.evaluate(f=>{
  __kart.freeze=true;__kart.place(f.s,{lateral:f.lateral,speed:30,lap:2});
  Object.assign(__kart.race.player,{x:f.player[0],y:f.player[1],z:f.player[2],heading:f.heading,surfaceNormal:f.normal,surfaceForward:f.forward,item:null,roulette:0,star:0,spin:0});
 },frames[0]);
 await page.waitForTimeout(500);await page.screenshot({path:`${out}/reproduced.png`});
 report.study=await page.evaluate(async()=>{
  const T=await import('three'),{surfaceCameraCollision}=await import('./surface-camera.js'),{chasePose}=await import('./visual-frame.js');
  const r=__kart.race.player,k=__kart.karts[0],scene=k.root.parent,root=scene.children.find(o=>o.userData.dynamicScenery);
  const cast=surfaceCameraCollision(root),player=new T.Vector3(r.x,r.y,r.z),up=new T.Vector3(r.surfaceNormal.x,r.surfaceNormal.y,r.surfaceNormal.z);
  const p=chasePose(r),desired=new T.Vector3(p.eye.x,p.eye.y,p.eye.z);
  const cases=[];
  for(const height of [1.3,1.8,2.1,2.4])for(const raise of [0,1,2,3]){
   const focus=player.clone().addScaledVector(up,height),eye=desired.clone().addScaledVector(up,raise),safe=cast(focus,eye);
   const ray=new T.Raycaster(focus,eye.clone().sub(focus).normalize(),.05,eye.distanceTo(focus));
   const hits=ray.intersectObject(root,true).filter(h=>h.object.visible&&!h.object.material.transparent&&!h.object.material.alphaTest);
   cases.push({height,raise,desired:eye.toArray(),result:safe.toArray(),pull:eye.distanceTo(safe),distanceFromPlayer:safe.distanceTo(player),hits:hits.slice(0,3).map(h=>({name:h.object.name,material:h.object.material.name,point:h.point.toArray(),distance:h.distance}))});
  }
  k.model.updateWorldMatrix(true,true);
  return {camera:__kart.cameraState,eyeInModel:k.model.worldToLocal(new T.Vector3(...__kart.cameraState.eye)).toArray(),item:__kart.race.player.item,cases};
 });
 console.log(JSON.stringify(report.study));
}catch(error){report.failure=error.stack;throw error;}
finally{await writeFile(`${out}/collapse-study.json`,JSON.stringify(report,null,2));await browser.close();}
