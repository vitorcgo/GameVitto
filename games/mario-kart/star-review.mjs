/** Freeze the live renderer at explicit star phases; inspect real loaded materials. */
import {chromium} from 'playwright';import {mkdir,writeFile} from 'node:fs/promises';import assert from 'node:assert/strict';
const out=process.env.EVIDENCE_DIR;assert.ok(out);await mkdir(out,{recursive:true});const browser=await chromium.launch({channel:'chrome',headless:true});const report={method:'Live game, frozen source-course poses at six explicit star hue phases, plus exact post-effect material restoration.',errors:[],cases:[]};
try{
 const page=await browser.newPage({viewport:{width:1440,height:900}});page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(['error','warning'].includes(m.type())&&/THREE|WebGL|GL_INVALID|shader/i.test(m.text()))report.errors.push(m.text())});await page.goto('http://localhost:8080/games/mario-kart/?evidence=1');await page.waitForFunction(()=>window.__kart?.assets?.loaded===8);
 await page.keyboard.press('KeyC');await page.keyboard.press('Enter');await page.waitForFunction(()=>__kart.race.state==='racing');await page.evaluate(()=>{__kart.freeze=true;__kart.place(650);for(const r of __kart.race.racers.slice(1)){r.x+=1000;r.z+=1000;}});
 for(const [label,time,star] of [['normal',0,0],...Array.from({length:6},(_,i)=>['star-'+i,(i/6)/.65,1]),['restored',0,0]]){
  const frame=await page.evaluate(({time,star})=>{__kart.race.time=time+20/.65;__kart.race.player.star=star;return __kart.renderCount;},{time,star});await page.waitForFunction(f=>__kart.renderCount>f+4,frame);
  await page.screenshot({path:out+'/'+label+'.png'});
  const materials=await page.evaluate(()=>{const result=[];__kart.karts[0].model.traverse(o=>{if(o.isMesh&&!Array.isArray(o.material)){const m=o.material;result.push({mesh:o.name,material:m.name,emissive:m.emissive?.toArray(),intensity:m.emissiveIntensity,color:m.color?.toArray(),roughness:m.roughness,metalness:m.metalness,map:m.map?.uuid,normalMap:m.normalMap?.uuid,starClone:!!o.userData.starMat});}});return result;});report.cases.push({label,time,star,materials});
 }
 const before=report.cases[0].materials,after=report.cases.at(-1).materials;
 for(let i=0;i<before.length;i++)for(const key of ['color','roughness','metalness','map','normalMap'])assert.deepEqual(after[i][key],before[i][key],'Restore '+key+' on '+before[i].mesh);
 report.restored=true;assert.deepEqual(report.errors,[]);console.log('PASS staged star phases');
}finally{await writeFile(out+'/star-review.json',JSON.stringify(report,null,2));await browser.close();}
