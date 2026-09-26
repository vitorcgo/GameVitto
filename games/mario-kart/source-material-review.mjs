/** Isolate source asphalt material response at the same rendered course poses. */
import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const out=process.env.EVIDENCE_DIR||'games/mario-kart/evidence/overnight/54a-asphalt-study';
await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const report={kind:'Staged asphalt material ablation; authored alternatives, not recovered native shader values',errors:[],poses:[]};
try{
 const page=await browser.newPage({viewport:{width:1440,height:900}});
 page.on('pageerror',e=>report.errors.push(e.message));
 await page.goto('http://localhost:8080/games/mario-kart/?evidence=1');
 await page.waitForFunction(()=>window.__kart?.assets?.loaded===8,{},{timeout:120000});
 await page.keyboard.press('KeyC');await page.keyboard.press('Enter');
 await page.waitForFunction(()=>__kart.race.state==='racing'&&__kart.race.time>4);
 await page.evaluate(async()=>{
  __kart.freeze=true;
  const {isSourceAsphalt}=await import('./source-materials.js');
  const root=__kart.karts[0].root.parent.getObjectByName('gamevitto-source-stadium');
  const mats=new Set();root.traverse(o=>{if(o.material&&isSourceAsphalt(o.material.name))mats.add(o.material)});
  window.__reviewMats=[...mats].map(m=>({m,normal:m.normalScale.clone(),roughness:m.roughness,env:m.envMapIntensity,color:m.color.clone()}));
 });
 report.materials=await page.evaluate(()=>__reviewMats.map(({m})=>({name:m.name,normalScale:m.normalScale.toArray(),roughness:m.roughness,envMapIntensity:m.envMapIntensity,color:m.color.toArray(),maps:['map','normalMap','roughnessMap','emissiveMap'].filter(k=>m[k])})));
 const variants=process.env.VARIANTS?JSON.parse(process.env.VARIANTS):[
  {name:'baseline',normal:1.1,roughness:1,env:1},
  {name:'no-environment',normal:1.1,roughness:1,env:0},
  {name:'strong-normal',normal:3,roughness:1,env:1},
  {name:'narrow-specular',normal:1.1,roughness:.6,env:1},
  {name:'aggregate',normal:3,roughness:.6,env:1},
 ];
 report.variants=variants;
 for(const [name,s]of [['underpass',110],['climb',425],['bank',550],['summit',720]]){
  await page.evaluate(s=>{__kart.place(s);const p=__kart.race.player;p.gliding=false;p.spin=0;p.drift=0;},s);
  for(const v of variants){
   await page.evaluate(v=>{for(const {m}of __reviewMats){m.normalScale.set(v.normal,v.normal);m.roughness=v.roughness;m.envMapIntensity=v.env;m.color.setScalar(v.diffuse??1);m.envMap=v.env===0?__kart.karts[0].root.parent.environment:null;m.needsUpdate=true;}},v);
   const n=await page.evaluate(()=>__kart.renderCount);await page.waitForFunction(n=>__kart.renderCount>n+8,n);
   await page.screenshot({path:`${out}/${name}-${v.name}.png`});
   report.poses.push({name,s,variant:v.name,camera:await page.evaluate(()=>__kart.cameraState)});
  }
 }
 assert.deepEqual(report.errors,[]);await writeFile(`${out}/material-review.json`,JSON.stringify(report,null,2));console.log(`Captured ${report.poses.length} source material views`);
}finally{await browser.close()}
