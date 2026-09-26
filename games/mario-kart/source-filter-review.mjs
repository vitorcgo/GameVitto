/** Staged, identical-pose A/B review of filtering on actual loaded GLB textures. */
import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const out=process.env.EVIDENCE_DIR||'games/mario-kart/evidence/overnight/53a-filter-study';
await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const report={method:'Frozen race and camera, same source geometry/maps, only texture anisotropy changes',errors:[],poses:[]};
try{
 const page=await browser.newPage({viewport:{width:1440,height:900}});
 page.on('pageerror',e=>report.errors.push(e.message));
 await page.goto('http://localhost:8080/games/mario-kart/?evidence=1');
 await page.waitForFunction(()=>window.__kart?.assets?.loaded===8,{},{timeout:120000});
 await page.keyboard.press('KeyC');await page.keyboard.press('Enter');
 await page.waitForFunction(()=>__kart.race.state==='racing'&&__kart.race.time>4);
 await page.evaluate(()=>{__kart.freeze=true});
 report.loaded=await page.evaluate(()=>{
  const root=__kart.karts[0].root.parent.getObjectByName('gamevitto-source-stadium');
  if(!root)throw Error('source root missing');
  const rows=[],seen=new Set();root.traverse(o=>{for(const mat of [o.material].flat()){if(!mat)continue;for(const [slot,t] of Object.entries(mat))if(t?.isTexture&&!seen.has(t.uuid)){seen.add(t.uuid);rows.push({material:mat.name,slot,width:t.image?.width,height:t.image?.height,anisotropy:t.anisotropy,minFilter:t.minFilter});}}});return rows;
 });
 if(process.env.EXPECT_FIXED==='1'){const roads=report.loaded.filter(t=>/^fc_road/.test(t.material));assert.ok(roads.length>0);assert.ok(roads.every(t=>t.anisotropy===8),'Actual loaded road maps must retain restored filtering');}
 for(const [name,s] of [['underpass',75],['climb',425],['bank',550],['summit',720]]){
  await page.evaluate(s=>{__kart.place(s);const r=__kart.race.player;r.gliding=false;r.spin=0;r.drift=0;},s);
  const cameras=[];
  for(const anisotropy of [1,8]){
   await page.evaluate(a=>{const root=__kart.karts[0].root.parent.getObjectByName('gamevitto-source-stadium');root.traverse(o=>{for(const m of [o.material].flat()){if(!m)continue;for(const t of Object.values(m))if(t?.isTexture&&!t.isRenderTargetTexture){t.anisotropy=a;t.needsUpdate=true;}}});},anisotropy);
   const n=await page.evaluate(()=>__kart.renderCount);await page.waitForFunction(n=>__kart.renderCount>n+8,n);
   cameras.push(await page.evaluate(()=>__kart.cameraState));
   await page.screenshot({path:`${out}/${name}-${anisotropy}.png`});
  }
  report.poses.push({name,s,cameras});
 }
 assert.deepEqual(report.errors,[]);
 await writeFile(`${out}/filter-review.json`,JSON.stringify(report,null,2));
 console.log(JSON.stringify({textures:report.loaded.length,loadedAnisotropy:[...new Set(report.loaded.map(t=>t.anisotropy))],poses:report.poses.length,errors:report.errors}));
}finally{await browser.close()}
