/** Inspect actual loaded tire geometry, materials and axle orientation. */
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const out=process.env.EVIDENCE_DIR||'games/mario-kart/evidence/overnight/38-source-wheels';
await mkdir(out,{recursive:true});const browser=await chromium.launch({channel:'chrome',headless:true});
const report={method:'Actual loaded GLB tire materials and world-space axle orientation compared to the road normal, before and after antigravity.',cases:[],errors:[]};
try{
 const page=await browser.newPage({viewport:{width:1440,height:900}});page.on('pageerror',e=>report.errors.push(e.message));
 await page.goto('http://localhost:8080/games/mario-kart/?evidence=1');await page.waitForFunction(()=>window.__kart?.assets?.loaded===8,{},{timeout:120000});
 await page.keyboard.press('KeyC');await page.keyboard.press('Enter');await page.waitForFunction(()=>__kart.race.state==='racing');
 for(const [name,s,anti,star] of [['ground',60,false,0],['hover',650,true,0],['star-hover',650,true,1],['after-star',650,true,0],['returned',70,false,0]]){
   const frame=await page.evaluate(({s,star})=>{__kart.freeze=true;__kart.place(s);__kart.race.player.star=star;return __kart.renderCount;},{s,star});
   await page.waitForFunction(frame=>__kart.renderCount>frame+2,frame);
   await page.waitForFunction(anti=>Math.abs(__kart.karts[0].wheelHover-(anti?1:0))<.001,anti);
   const result=await page.evaluate(async({name,anti})=>{
     const THREE=await import('three'),{trackAt}=await import('./track.js');
     const k=__kart.karts[0],normal=trackAt(__kart.race.player.s).normal,n=new THREE.Vector3(normal.x,normal.y,normal.z);
     k.root.updateMatrixWorld(true);
     return {name,anti,wheels:k.wheels.map(w=>{
       const center=w.getWorldPosition(new THREE.Vector3()),axis=w.localToWorld(new THREE.Vector3(1,0,0)).sub(center).normalize();
       let tire;w.traverse(o=>{if(o.isMesh&&o.material.emissiveMap)tire=o;});const m=tire.material;
       return {sourceMesh:!!tire,axleDotNormal:Math.abs(axis.dot(n)),emission:m.emissiveIntensity,hasEmissionMap:!!m.emissiveMap,hasDiffuseMap:!!m.map,
         flatOverlay:!!w.userData.glow,vertices:tire.geometry.attributes.position.count,shaderKey:m.customProgramCacheKey(),starClone:!!tire.userData.starMat};
     }),otherWheels:__kart.karts.slice(1).map(other=>{let source=false;other.model.traverse(o=>{if(o.userData.gamevittoSourcePack)source=true;});return {id:other.id,source,overlays:other.wheels.map(w=>!!w.userData.glow)};})};
   },{name,anti});
   report.cases.push(result);await page.screenshot({path:`${out}/wheel-${name}.png`});
   for(const wheel of result.wheels){assert.ok(wheel.sourceMesh&&wheel.hasEmissionMap&&wheel.hasDiffuseMap);assert.equal(wheel.flatOverlay,false);assert.ok(anti?wheel.axleDotNormal>.99:wheel.axleDotNormal<.01);assert.ok(anti?wheel.emission>2.7:wheel.emission<.01);assert.equal(wheel.shaderKey,'source-tire-antigravity-v1');if(star)assert.ok(wheel.starClone);}
   for(const other of result.otherWheels)assert.ok(other.overlays.every(overlay=>overlay===!other.source));
 }
 assert.deepEqual(report.errors,[]);console.log('PASS source wheel states');
}catch(e){report.failure=e.stack;throw e;}finally{await writeFile(`${out}/wheel-review.json`,JSON.stringify(report,null,2));await browser.close();}
