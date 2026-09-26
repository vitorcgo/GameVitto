/** Identical frozen flight views plus an isolated wing view for silhouette review. */
import {chromium} from 'playwright';import {mkdir,writeFile} from 'node:fs/promises';
const out=process.env.EVIDENCE_DIR;await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});const report=[];
try{for(const variant of ['before','after']){
 const page=await browser.newPage({viewport:{width:1440,height:900}});
 if(variant==='before')await page.route('**/games/mario-kart/models.js',route=>route.fulfill({path:'games/mario-kart/evidence/overnight/60a-glider-before/source/models.js',contentType:'text/javascript'}));
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://localhost:8080/games/mario-kart/?evidence=1');await page.waitForFunction(()=>window.__kart?.assets?.loaded===8);
 await page.keyboard.press('KeyC');await page.keyboard.press('Enter');await page.waitForFunction(()=>__kart.race.state==='racing');
 await page.evaluate(()=>{__kart.freeze=true;__kart.race.time=20;__kart.place(935,{speed:36});const r=__kart.race.player;r.y+=8;r.gliding=true;r.flight=1;r.item=null;r.steer=0;r.spin=0;});
 await page.waitForTimeout(500);await page.screenshot({path:out+'/'+variant+'-flight.png'});
 const shape=await page.evaluate(async()=>{
  const T=await import('three'),g=__kart.karts[0].glider.clone(true);g.visible=true;g.scale.setScalar(1);g.rotation.set(0,0,0);
  const scene=new T.Scene();scene.background=new T.Color('#18232b');scene.add(g);scene.add(new T.HemisphereLight(0xffffff,0x77818b,2));
  const light=new T.DirectionalLight(0xffffff,3);light.position.set(-4,8,5);scene.add(light);
  const camera=new T.PerspectiveCamera(42,1440/900,.1,100);camera.position.set(7,7,9);camera.lookAt(0,2.7,0);
  const renderer=new T.WebGLRenderer({antialias:true});renderer.setSize(1440,900);renderer.setPixelRatio(1);renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;
  renderer.domElement.style='position:fixed;inset:0;z-index:99999';document.body.appendChild(renderer.domElement);renderer.render(scene,camera);
  let triangles=0;g.traverse(o=>{if(o.isMesh)triangles+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3;});
  const bounds=new T.Box3().setFromObject(g);return {bounds:[bounds.min.toArray(),bounds.max.toArray()],triangles};
 });
 await page.screenshot({path:out+'/'+variant+'-shape.png'});report.push({variant,errors,...shape});await page.close();
}await writeFile(out+'/shape-review.json',JSON.stringify(report,null,2));if(report.some(r=>r.errors.length))throw new Error(JSON.stringify(report));}
finally{await browser.close();}
