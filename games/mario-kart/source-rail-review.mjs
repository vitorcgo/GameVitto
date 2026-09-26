/** Measure actual source rail faces and kart vertices at the recorded overlap. */
import {chromium} from 'playwright';import {mkdir,readFile,writeFile} from 'node:fs/promises';
const out=process.env.EVIDENCE_DIR||'games/mario-kart/evidence/overnight/59b-rail-geometry';await mkdir(out,{recursive:true});
const frame=JSON.parse(await readFile('games/mario-kart/evidence/overnight/58a-camera-collapse/closest-frames.json','utf8'))[0];
const browser=await chromium.launch({channel:'chrome',headless:true});
try {
 const page=await browser.newPage({viewport:{width:1440,height:900}});await page.goto('http://localhost:8080/games/mario-kart/?evidence=1');
 await page.waitForFunction(()=>window.__kart?.assets?.loaded===8);await page.keyboard.press('KeyC');await page.keyboard.press('Enter');await page.waitForFunction(()=>__kart.race.state==='racing');
 await page.evaluate(f=>{__kart.freeze=true;__kart.race.time=20;__kart.place(f.s,{lateral:f.lateral,speed:30});Object.assign(__kart.race.player,{x:f.player[0],y:f.player[1],z:f.player[2],heading:f.heading,surfaceNormal:f.normal,surfaceForward:f.forward,steer:0,drift:0,spin:0,item:null});},frame);
 if(process.env.RESOLVE==='1')await page.evaluate(()=>__kart.race.move(__kart.race.player,{gas:false,steer:0},1/120));
 await page.waitForTimeout(500);
 const report=await page.evaluate(async()=>{
  const T=await import('three'),{activeSurfaceTrack:track}=await import('./track.js'),k=__kart.karts[0],r=__kart.race.player;
  const scene=k.root.parent,root=scene.children.find(o=>o.userData.dynamicScenery);scene.updateMatrixWorld(true);
  const p=track.at(r.s),right=new T.Vector3(p.right.x,p.right.y,p.right.z),up=new T.Vector3(r.surfaceNormal.x,r.surfaceNormal.y,r.surfaceNormal.z),forward=new T.Vector3(r.surfaceForward.x,r.surfaceForward.y,r.surfaceForward.z),origin=new T.Vector3(r.x,r.y,r.z);
  const rails=[];root.traverse(o=>{if(o.isMesh&&o.material.name==='fc_saku'){
   const mesh=new T.Mesh(o.geometry,new T.MeshBasicMaterial({side:T.DoubleSide}));mesh.matrixAutoUpdate=false;mesh.matrixWorld.copy(o.matrixWorld);rails.push(mesh);
  }});
  const probes=[];
  for(const along of [-1.7,0,1.7])for(const height of [.45,.9,1.4]){
   const start=origin.clone().addScaledVector(right,5).addScaledVector(up,height).addScaledVector(forward,along);
   const hits=new T.Raycaster(start,right.clone().negate(),0,12).intersectObjects(rails,false);
   probes.push({along,height,hits:hits.slice(0,4).map(h=>({point:h.point.toArray(),lateral:r.lateral+5-h.distance,distance:h.distance}))});
  }
  const footprint={min:Infinity,max:-Infinity,vertices:0},kartTriangles=[];
  k.model.traverse(o=>{
   if(!o.isMesh)return;let physical=false;
   for(let a=o;a&&a!==k.model;a=a.parent)if(a.name==='source-chassis'||/^wheel-[0-3]$/.test(a.name))physical=true;
   if(!physical)return;if(o.isSkinnedMesh)o.skeleton.update();
   const points=[];
   for(let i=0;i<o.geometry.attributes.position.count;i++){
    const point=o.getVertexPosition(i,new T.Vector3()).applyMatrix4(o.matrixWorld);
    points.push(point);const lateral=r.lateral+point.clone().sub(origin).dot(right);footprint.min=Math.min(footprint.min,lateral);footprint.max=Math.max(footprint.max,lateral);footprint.vertices++;
   }
   const index=o.geometry.index,count=index?.count||points.length;
   for(let i=0;i<count;i+=3)kartTriangles.push([0,1,2].map(j=>points[index?index.getX(i+j):i+j]));
  });
  // Independent narrow-phase verification against the actual rendered meshes.
  // Broad-phase only selects nearby rail triangles; six edge/triangle casts test
  // both directions, without using the simulation's footprint or road limits.
  const kartBounds=new T.Box3();for(const triangle of kartTriangles)for(const p of triangle)kartBounds.expandByPoint(p);
  const nearby=[];
  for(const mesh of rails){const p=mesh.geometry.attributes.position,index=mesh.geometry.index,count=index?.count||p.count;
   for(let i=0;i<count;i+=3){const triangle=[0,1,2].map(j=>new T.Vector3().fromBufferAttribute(p,index?index.getX(i+j):i+j).applyMatrix4(mesh.matrixWorld));const box=new T.Box3().setFromPoints(triangle);if(box.intersectsBox(kartBounds))nearby.push({triangle,box});}
  }
  const ray=new T.Ray(),hit=new T.Vector3();
  const cuts=(a,b)=>{for(let i=0;i<3;i++){const delta=a[(i+1)%3].clone().sub(a[i]),length=delta.length();if(length<1e-8)continue;ray.set(a[i],delta.divideScalar(length));if(ray.intersectTriangle(...b,false,hit)){const distance=hit.distanceTo(a[i]);if(distance>1e-5&&distance<length-1e-5)return true;}}return false;};
  let intersectingKartTriangles=0;const collisionPoints=[];
  for(const a of kartTriangles){const bounds=new T.Box3().setFromPoints(a);for(const b of nearby)if(bounds.intersectsBox(b.box)&&(cuts(a,b.triangle)||cuts(b.triangle,a))){intersectingKartTriangles++;if(collisionPoints.length<20)collisionPoints.push(hit.toArray());break;}}
  return {s:r.s,lateral:r.lateral,road:track.bounds(r.s,r.lateral),walls:track.wallBounds(r.s,r.lateral),footprint,probes,railMeshes:rails.length,intersectingKartTriangles,collisionPoints,nearbyRailTriangles:nearby.length};
 });
 await page.screenshot({path:`${out}/overlap.png`});await writeFile(`${out}/rail-geometry.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{await browser.close();}
