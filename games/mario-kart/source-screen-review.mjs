/** Calibrate actual exported screen surfaces using independent world-space corners. */
import {chromium} from 'playwright';import {mkdir,writeFile} from 'node:fs/promises';import assert from 'node:assert/strict';
const out=process.env.EVIDENCE_DIR||'games/mario-kart/evidence/overnight/46b-screen-orientation';await mkdir(out,{recursive:true});const browser=await chromium.launch({channel:'chrome',headless:true});const report={method:'Actual exported TV geometry, four labeled colors, Canvas texture and GPU render target; sample upper-left/top-right/lower-left/lower-right in world space.',cases:[],errors:[]};
try{const page=await browser.newPage({viewport:{width:1200,height:800}});page.on('pageerror',e=>report.errors.push(e.message));await page.goto('http://localhost:8080/games/mario-kart/pipeline/stadium-review.html');await page.waitForFunction(()=>window.sourceStadiumReview,{},{timeout:120000});
await page.evaluate(async()=>{
 const {THREE,renderer,course}=sourceStadiumReview,{orientSourceScreen}=await import('../source-screens.js');renderer.toneMapping=THREE.NoToneMapping;
 const card=document.createElement('canvas');card.width=card.height=256;const ctx=card.getContext('2d');for(const [x,y,color]of [[0,0,'#ff0000'],[128,0,'#00ff00'],[0,128,'#0000ff'],[128,128,'#ffff00']]){ctx.fillStyle=color;ctx.fillRect(x,y,128,128);}ctx.fillStyle='white';ctx.font='bold 20px sans-serif';ctx.fillText('TOP LEFT',10,20);ctx.fillText('TOP RIGHT',134,20);ctx.fillText('BOTTOM',10,240);ctx.fillText('BOTTOM',134,240);
 const canvasMap=new THREE.CanvasTexture(card);canvasMap.colorSpace=THREE.SRGBColorSpace;
 const feed=new THREE.WebGLRenderTarget(256,256),feedScene=new THREE.Scene(),feedCamera=new THREE.OrthographicCamera(-1,1,1,-1,.1,10);feedCamera.position.z=2;feedScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2,2),new THREE.MeshBasicMaterial({map:canvasMap})));renderer.setRenderTarget(feed);renderer.render(feedScene,feedCamera);renderer.setRenderTarget(null);
 window.reviewScreen=async(name,kind,corrected)=>{
  let source;course.traverse(o=>{if(o.isMesh&&o.material.name===name)source=o;});source.updateWorldMatrix(true,false);
  const geometry=source.geometry.clone().applyMatrix4(source.matrixWorld),material=new THREE.MeshBasicMaterial({name,map:kind==='canvas'?canvasMap:feed.texture,side:THREE.DoubleSide}),mesh=new THREE.Mesh(geometry,material),scene=new THREE.Scene();scene.background=new THREE.Color('#162435');scene.add(mesh);
  // Source first four vertices form one physical screen. Derive top/bottom by world Y,
  // not the V coordinates whose orientation is being tested.
  const vertices=Array.from({length:4},(_,i)=>new THREE.Vector3().fromBufferAttribute(geometry.attributes.position,i));const ordered=vertices.map((p,i)=>({p,u:geometry.attributes.uv.getX(i)})).sort((a,b)=>b.p.y-a.p.y);const top=ordered.slice(0,2).sort((a,b)=>a.u-b.u),bottom=ordered.slice(2).sort((a,b)=>a.u-b.u),center=vertices.reduce((a,b)=>a.add(b),new THREE.Vector3()).multiplyScalar(.25),right=top[1].p.clone().sub(top[0].p).normalize(),up=top[0].p.clone().add(top[1].p).sub(bottom[0].p).sub(bottom[1].p).normalize(),normal=new THREE.Vector3().crossVectors(right,up).normalize();
  const camera=new THREE.OrthographicCamera(-15,15,10,-10,.1,100);camera.position.copy(center).addScaledVector(normal,30);camera.up.copy(up);camera.lookAt(center);camera.updateMatrixWorld(true);
  if(corrected)orientSourceScreen(mesh);
  const once=Array.from(mesh.geometry.attributes.uv.array);if(corrected)orientSourceScreen(mesh);const idempotent=once.every((v,i)=>v===mesh.geometry.attributes.uv.array[i]);
  const target=new THREE.WebGLRenderTarget(1200,800);renderer.setRenderTarget(target);renderer.render(scene,camera);
  const pixels=[];for(const corner of [top[0].p,top[1].p,bottom[0].p,bottom[1].p]){const sample=center.clone().lerp(corner,.5).project(camera),bytes=new Uint8Array(4);renderer.readRenderTargetPixels(target,Math.round((sample.x+1)*600),Math.round((sample.y+1)*400),1,1,bytes);pixels.push(Array.from(bytes));}
  renderer.setRenderTarget(null);renderer.render(scene,camera);target.dispose();return {name,kind,corrected,pixels,idempotent};
 };
});
for(const name of ['fc_TV_MKTV','fc_TV_capture'])for(const kind of ['canvas','render-target'])for(const corrected of [false,true]){const result=await page.evaluate(({name,kind,corrected})=>reviewScreen(name,kind,corrected),{name,kind,corrected});report.cases.push(result);await page.screenshot({path:`${out}/${name}-${kind}-${corrected?'after':'before'}.png`});if(corrected){assert.equal(result.idempotent,true);const expected=[[255,0,0],[0,255,0],[0,0,255],[255,255,0]];expected.forEach((rgb,i)=>rgb.forEach((v,c)=>assert.ok(Math.abs(result.pixels[i][c]-v)<8,`${name}/${kind} corner ${i} channel ${c}`)));}}
assert.deepEqual(report.errors,[]);console.log('PASS 2 source screen types × 2 image paths × before/after; corrected world-space corners upright');
}catch(e){report.failure=e.stack;throw e;}finally{await writeFile(`${out}/screen-review.json`,JSON.stringify(report,null,2));await browser.close();}
