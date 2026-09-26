/** Review the exported GLBs, including skinning after serialization. */
import {chromium} from 'playwright';import {mkdir,writeFile} from 'node:fs/promises';
const out=process.env.EVIDENCE_DIR||'games/mario-kart/evidence/overnight/45a-rival-fit';await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true}),report={errors:[],models:[]};
try{const page=await browser.newPage({viewport:{width:960,height:720}});page.on('pageerror',e=>report.errors.push(e.message));
await page.goto('http://localhost:8080/games/mario-kart/pipeline/source-build.html');
await page.evaluate(async()=>{
 const THREE=await import('three'),{GLTFLoader}=await import('/vendor/three-examples/loaders/GLTFLoader.js');
 const scene=new THREE.Scene();scene.background=new THREE.Color(0x4b6178);
 const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setSize(960,720);renderer.setPixelRatio(1);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.35;document.body.style.margin='0';document.body.append(renderer.domElement);
 const camera=new THREE.PerspectiveCamera(38,960/720,.1,100);scene.add(new THREE.HemisphereLight(0xc9eaff,0x615b4a,2));const sun=new THREE.DirectionalLight(0xfff2db,3);sun.position.set(-4,7,-5);scene.add(sun);const fill=new THREE.DirectionalLight(0xd4e6ff,2);fill.position.set(4,4,5);scene.add(fill);
 const floor=new THREE.Mesh(new THREE.PlaneGeometry(100,100),new THREE.MeshStandardMaterial({color:0x374653,roughness:1}));floor.rotation.x=-Math.PI/2;floor.position.y=-.02;scene.add(floor);
 let model;window.showRival=async(id,angle)=>{if(model)scene.remove(model);model=(await new GLTFLoader().loadAsync('/assets/mario-kart/'+id+'-source.glb')).scene;scene.add(model);model.updateMatrixWorld(true);model.traverse(o=>{if(o.isSkinnedMesh)o.skeleton.update();});camera.position.set(...{front:[4,3.1,-6],rear:[-4,3.1,6],side:[6,2.7,0]}[angle]);camera.lookAt(0,1.3,0);renderer.render(scene,camera);const box=new THREE.Box3().setFromObject(model);return {id,angle,bounds:{min:box.min.toArray(),max:box.max.toArray()},head:!!model.getObjectByName('driver-head'),wheels:[0,1,2,3].every(i=>!!model.getObjectByName('wheel-'+i))};};
});
for(const id of ['mario','luigi','peach','yoshi','toad','bowser','donkey-kong','koopa'])for(const angle of ['front','rear','side']){report.models.push(await page.evaluate(({id,angle})=>showRival(id,angle),{id,angle}));await page.screenshot({path:`${out}/${id}-${angle}.png`});}
await writeFile(`${out}/rival-review.json`,JSON.stringify(report,null,2));if(report.errors.length)throw new Error(report.errors.join('\n'));console.log('Reviewed 8 exported karts × 3 angles');
}finally{await browser.close();}
