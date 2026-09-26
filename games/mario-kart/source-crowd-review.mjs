/** Independent world-space ray check of spectators against rendered benches. */
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const out=process.env.EVIDENCE_DIR||'games/mario-kart/evidence/overnight/37-source-crowd';
await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
  const page=await browser.newPage();
  await page.goto('http://localhost:8080/games/mario-kart/?evidence=1');
  await page.waitForFunction(()=>window.__kart?.assets?.loaded===8,{},{timeout:120000});
  const result=await page.evaluate(async()=>{
    const THREE=await import('three'),scene=__kart.karts[0].root.parent;
    const crowd=scene.getObjectByName('source-stadium-spectators'),benches=[];
    scene.updateMatrixWorld(true);
    scene.traverse(o=>{if(o.isMesh&&o.material.name==='fc_bench')benches.push(o);});
    const feet=crowd.userData.seatFeet,ray=new THREE.Raycaster(),deviations=[];
    let missing=0;
    for(let i=0;i<feet.length;i+=Math.max(1,Math.floor(feet.length/500))){
      const foot=new THREE.Vector3().fromArray(feet[i]);
      ray.set(foot.clone().add(new THREE.Vector3(0,.2,0)),new THREE.Vector3(0,-1,0));
      ray.far=.4;
      const hit=ray.intersectObjects(benches,false)[0];
      if(hit)deviations.push(hit.point.distanceTo(foot));else missing++;
    }
    return {count:feet.length,triangles:crowd.geometry.attributes.position.count/3,
      checked:deviations.length+missing,missing,maxFootDeviation:Math.max(...deviations),
      finite:feet.every(p=>p.every(Number.isFinite)),benchMeshes:benches.length};
  });
  await writeFile(`${out}/crowd-review.json`,JSON.stringify({method:'Independent vertical rays against actual rendered bench triangles; samples span the entire crowd.',...result},null,2));
  assert.ok(result.count>1000&&result.count<100000);
  assert.ok(result.finite);assert.equal(result.missing,0);
  assert.ok(result.maxFootDeviation<.001,'Feet must land within 1 mm of independently raycast bench triangles');
  console.log('PASS',result);
}finally{await browser.close();}
