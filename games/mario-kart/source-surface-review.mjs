/** Compare runtime support points with independent Three.js rays on exported GLB. */
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const out=process.env.EVIDENCE_DIR||'games/mario-kart/evidence/overnight/39-mesh-contact';await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage();await page.goto('http://localhost:8080/games/mario-kart/pipeline/stadium-review.html');await page.waitForFunction(()=>window.sourceStadiumReview,{},{timeout:120000});
 const report=await page.evaluate(async()=>{
   const {THREE,course,route}=sourceStadiumReview,{createSurfaceTrack}=await import('../surface-track.js'),track=createSurfaceTrack(route);
   const meshes=[];course.updateMatrixWorld(true);course.traverse(o=>{if(o.isMesh&&/road|suna|shiba|grass_Outside|PitYuka|dashboard|glideboard|gravityboard/i.test(o.material.name))meshes.push(o);});
   const ray=new THREE.Raycaster(),errors=[],unsupported=[],deviations=[];
   for(let j=0;j<route.points.length-1;j+=5){const s=route.points[j].s;if(s>=route.gapStart&&s<=route.gapEnd)continue;
     for(const lateral of [-8,-6,-3,0,3,6,8]){
       const p=track.surface(s,lateral);if(p.triangle===undefined){unsupported.push({s,lateral});continue;}
       const point=new THREE.Vector3(p.x,p.y,p.z),normal=new THREE.Vector3(p.normal.x,p.normal.y,p.normal.z);
       ray.set(point.clone().addScaledVector(normal,.25),normal.clone().negate());ray.far=.5;
       const hit=ray.intersectObjects(meshes,false)[0];
       if(!hit){errors.push({s,lateral,reason:'No exported mesh support'});continue;}
       const deviation=hit.point.distanceTo(point);deviations.push(deviation);if(deviation>.002)errors.push({s,lateral,deviation});
     }
   }
   // Coordinates captured in the failed straight-gas landing recording.
   // The expected height comes from a fresh ray on the exported visible turf.
   const turf=[];
   for(const point of [{x:22.53043737023802,y:2.826670836171174,z:114.59903257776838},{x:22.68075803359607,y:2.843153604923347,z:114.69954063803145}]){
     const support=track.support(point,{x:0,y:1,z:0});
     ray.set(new THREE.Vector3(point.x,point.y+8,point.z),new THREE.Vector3(0,-1,0));ray.far=16;
     const hit=ray.intersectObjects(meshes,false)[0];
     const deviation=hit&&support?Math.abs(hit.point.y-support.y):Infinity;
     turf.push({point,supportY:support?.y,visibleY:hit?.point.y,material:hit?.object.material.name,deviation});
     if(deviation>.002||hit?.object.material.name!=='fc_shiba')errors.push({reason:'Recorded turf contact does not match visible grass',point,deviation});
   }
   deviations.sort((a,b)=>a-b);return {method:'Runtime source-mesh support versus independent Three.js intersections on the exported GLB, seven lateral positions every fifth route sample.',checked:deviations.length,unsupported,errors,turf,maxDeviation:deviations.at(-1),p95Deviation:deviations[Math.floor(deviations.length*.95)]};
 });
 await writeFile(`${out}/surface-review.json`,JSON.stringify(report,null,2));
 assert.deepEqual(report.errors,[]);assert.ok(report.checked>1500);assert.equal(report.unsupported.filter(p=>p.lateral===0).length,0);console.log('PASS',JSON.stringify({checked:report.checked,maxDeviation:report.maxDeviation,unsupported:report.unsupported.length}));
}finally{await browser.close();}
