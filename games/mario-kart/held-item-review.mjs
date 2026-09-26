/** Staged inventory pose with independent joint lengths and rendered-vertex checks. */
import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const out=process.env.EVIDENCE_DIR;assert.ok(out);await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const report={method:'Isolated views of actual exported rigs with a staged mushroom inventory. Animation is called explicitly for this candidate study.',cases:[],errors:[]};
try {
 const page=await browser.newPage({viewport:{width:1000,height:800}});
 page.on('pageerror',e=>report.errors.push(e.message));
 await page.goto('http://localhost:8080/games/mario-kart/?evidence=1');
 await page.waitForFunction(()=>window.__kart?.assets?.loaded===8);
 await page.evaluate(async()=>{
  const T=await import('three'),{clone}=await import('/vendor/three-examples/utils/SkeletonUtils.js');
  const {updateHeldItem}=await import('./held-item.js');
  const scene=new T.Scene();scene.background=new T.Color('#263543');
  scene.add(new T.HemisphereLight(0xc8e1ff,0x514c48,2));
  const light=new T.DirectionalLight(0xffeddd,3);light.position.set(-3,5,4);scene.add(light);
  const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(1000,800);
  renderer.toneMapping=T.ACESFilmicToneMapping;
  const camera=new T.PerspectiveCamera(32,1.25,.05,50);
  renderer.domElement.style.cssText='position:fixed;inset:0;z-index:100000';document.body.append(renderer.domElement);
  const models=__kart.karts.map(k=>({id:k.id,model:clone(k.model)}));
  window.itemReview={T,scene,renderer,camera,models,updateHeldItem};
 });
 for(let i=0;i<8;i++) {
  const before=await page.evaluate(i=>{
   const d=itemReview,{T}=d,{model,id}=d.models[i];if(d.active)d.scene.remove(d.active);d.active=model;
   model.position.set(0,0,0);model.quaternion.identity();d.scene.add(model);model.updateMatrixWorld(true);
   const bones=[];model.traverse(o=>{if(o.isBone)bones.push(o);});
   d.before=bones.map(o=>({o,p:o.getWorldPosition(new T.Vector3()),q:o.quaternion.clone(),length:o.position.length()}));
   d.updateHeldItem(model,{item:null},1/60);
   d.camera.position.set(-4,2.9,5.2);d.camera.lookAt(0,1.45,0);d.renderer.render(d.scene,d.camera);
   return{id,bones:bones.length};
  },i);
  await page.screenshot({path:`${out}/${before.id}-before.png`});
  const result=await page.evaluate(()=>{
   const d=itemReview,{T,active:model}=d;
   for(let f=0;f<90;f++)d.updateHeldItem(model,{item:'mushroom',roulette:0,spin:0},1/60);
   model.updateMatrixWorld(true);d.renderer.render(d.scene,d.camera);
   const errors=d.before.map(b=>({name:b.o.name,lengthError:Math.abs(b.o.position.length()-b.length),moved:b.o.getWorldPosition(new T.Vector3()).distanceTo(b.p)}));
   const mesh=model.getObjectByName('held-mushroom');
   return {joints:errors,itemPosition:mesh.position.toArray(),visible:mesh.visible,amount:mesh.userData.poseAmount};
  });
  await page.screenshot({path:`${out}/${before.id}-held.png`});
  assert.ok(result.visible&&result.amount>.99);assert.ok(result.joints.every(b=>b.lengthError<1e-8));
  assert.ok(result.joints.filter(b=>/HandR|Foot|Hip/.test(b.name)).every(b=>b.moved<1e-6),'Other limbs and pelvis remain fixed');
  const restored=await page.evaluate(()=>{
   const d=itemReview;
   for(let f=0;f<90;f++)d.updateHeldItem(d.active,{item:null},1/60);
   d.active.updateMatrixWorld(true);
   return {visible:d.active.getObjectByName('held-mushroom').visible,maxRotationError:Math.max(...d.before.map(b=>b.o.quaternion.clone().normalize().angleTo(b.q.clone().normalize()))),maxComponentError:Math.max(...d.before.flatMap(b=>b.o.quaternion.toArray().map((v,i)=>Math.abs(v-b.q.toArray()[i]))))};
  });
  console.log(before.id,restored);assert.equal(restored.visible,false);assert.ok(restored.maxRotationError<1e-6);assert.ok(restored.maxComponentError<1e-8);
  const transitions=await page.evaluate(()=>{
   const d=itemReview,item=d.active.getObjectByName('held-mushroom');
   d.updateHeldItem(d.active,{item:'mushroom',finishTime:null},1/60);
   const pose=d.before.map(b=>b.o.quaternion.toArray()),position=item.position.toArray();
   d.updateHeldItem(d.active,{item:null,finishTime:null},0);
   const pauseFrozen=JSON.stringify(pose)===JSON.stringify(d.before.map(b=>b.o.quaternion.toArray()))&&JSON.stringify(position)===JSON.stringify(item.position.toArray())&&item.visible;
   const cases=[{item:'mushroom',roulette:1,finishTime:null},{item:'mushroom',spin:1,finishTime:null},{item:'red',finishTime:null},{item:'mushroom',finishTime:90}];
   return {pauseFrozen,hidden:cases.map(r=>{d.updateHeldItem(d.active,r,1/60);return !item.visible;})};
  });
  report.cases.push({...before,...result,restored,transitions});
  assert.ok(transitions.pauseFrozen&&transitions.hidden.every(Boolean),'Pause, roulette, hit, replacement and finish follow race state');
 }
 assert.deepEqual(report.errors,[]);console.log('PASS eight inventory poses and restoration');
}catch(error){report.failure=error.stack;throw error;}
finally{await writeFile(`${out}/item-review.json`,JSON.stringify(report,null,2));await browser.close();}
