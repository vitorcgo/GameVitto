/** Compare authored tire normals with the converted tire before any smoothing. */
import {chromium} from 'playwright';import {mkdir,writeFile} from 'node:fs/promises';
const out=process.env.EVIDENCE_DIR||'games/mario-kart/evidence/overnight/56a-tire-normals';await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage();await page.goto('http://localhost:8080/games/mario-kart/pipeline/source-build.html');
 const report=await page.evaluate(async(assetUrl)=>{
  const T=await import('three'),{ColladaLoader}=await import('/vendor/three-examples/loaders/ColladaLoader.js'),{GLTFLoader}=await import('/vendor/three-examples/loaders/GLTFLoader.js');
  const src=await new ColladaLoader().loadAsync('../evidence/asset-study/tires/Standard%20%26%20Blue%20Standard/TireK_Std.dae');src.scene.updateMatrixWorld(true);src.scene.traverse(o=>{if(o.isSkinnedMesh)o.skeleton.update()});
  const tire=src.scene.getObjectByName('TireK_LB__m_Tire'),pos=tire.geometry.attributes.position,normal=tire.geometry.attributes.normal;
  const groups=new Map(),raw=new T.Vector3(),posed=new T.Vector3();let maxRestSkinDisplacement=0;
  for(let i=0;i<pos.count;i++){
   raw.fromBufferAttribute(pos,i);tire.getVertexPosition(i,posed);maxRestSkinDisplacement=Math.max(maxRestSkinDisplacement,raw.distanceTo(posed));
   const key=raw.toArray().map(x=>x.toFixed(5)).join(',');if(!groups.has(key))groups.set(key,[]);groups.get(key).push(i);
  }
  const seams=g=>{const ns=g.attributes.normal,p=g.attributes.position,gs=new Map();for(let i=0;i<p.count;i++){const k=[p.getX(i),p.getY(i),p.getZ(i)].map(x=>x.toFixed(5)).join(',');if(!gs.has(k))gs.set(k,[]);gs.get(k).push(new T.Vector3().fromBufferAttribute(ns,i).normalize())}const angles=[];for(const v of gs.values()){if(v.length<2)continue;let a=0;for(const x of v)for(const y of v)a=Math.max(a,Math.acos(T.MathUtils.clamp(x.dot(y),-1,1))*180/Math.PI);angles.push(a)}return{vertices:p.count,uniquePositions:gs.size,duplicatedPositions:angles.length,seamsAbove10Degrees:angles.filter(a=>a>10).length,maxNormalSeamDegrees:Math.max(...angles)}};
  const expected=tire.geometry.clone(),nmat=new T.Matrix3().getNormalMatrix(tire.matrixWorld);
  const v=new T.Vector3(),skin=new T.Matrix4(),bone=new T.Matrix4(),transform=new T.Matrix4();
  for(let i=0;i<pos.count;i++){
   skin.elements.fill(0);for(let k=0;k<4;k++){const weight=tire.geometry.attributes.skinWeight.getComponent(i,k),index=tire.geometry.attributes.skinIndex.getComponent(i,k);if(!weight)continue;bone.fromArray(tire.skeleton.boneMatrices,index*16);for(let j=0;j<16;j++)skin.elements[j]+=bone.elements[j]*weight;}
   transform.copy(tire.matrixWorld).multiply(tire.bindMatrixInverse).multiply(skin).multiply(tire.bindMatrix);nmat.getNormalMatrix(transform);
   tire.getVertexPosition(i,v).applyMatrix4(tire.matrixWorld);expected.attributes.position.setXYZ(i,v.x,v.y,v.z);v.fromBufferAttribute(normal,i).applyMatrix3(nmat).normalize();expected.attributes.normal.setXYZ(i,v.x,v.y,v.z)}
  expected.computeBoundingBox();const c=expected.boundingBox.getCenter(new T.Vector3()),s=expected.boundingBox.getSize(new T.Vector3());expected.translate(-c.x,-c.y,-c.z);expected.scale(.5/s.x,.92/s.y,.92/s.z);
  const glb=await new GLTFLoader().loadAsync(assetUrl);const actual=glb.scene.getObjectByName('source-tire').geometry;
  let positionDifference=0,maxNormalAngle=0,sumAngle=0;for(let i=0;i<pos.count;i++){v.fromBufferAttribute(expected.attributes.position,i);positionDifference=Math.max(positionDifference,v.distanceTo(raw.fromBufferAttribute(actual.attributes.position,i)));v.fromBufferAttribute(expected.attributes.normal,i).normalize();raw.fromBufferAttribute(actual.attributes.normal,i).normalize();const a=Math.acos(T.MathUtils.clamp(v.dot(raw),-1,1))*180/Math.PI;maxNormalAngle=Math.max(maxNormalAngle,a);sumAngle+=a;}
  // Independent oracle: render the original skinned Collada through Three.js,
  // then the GLB with MeshNormalMaterial. This does not use our normal baker.
  const renderer=new T.WebGLRenderer({preserveDrawingBuffer:true,antialias:false});renderer.setSize(512,512);renderer.setClearColor(0x000000,1);
  const camera=new T.PerspectiveCamera(35,1,.01,100);camera.position.set(1.3,.95,1.8);camera.lookAt(0,0,0);
  const scene=new T.Scene(),normalizeRoot=new T.Group();normalizeRoot.matrixAutoUpdate=false;normalizeRoot.matrix.makeScale(.5/s.x,.92/s.y,.92/s.z).multiply(new T.Matrix4().makeTranslation(-c.x,-c.y,-c.z));
  src.scene.traverse(o=>{if(o.isMesh)o.visible=o===tire});tire.material=new T.MeshNormalMaterial();normalizeRoot.add(src.scene);scene.add(normalizeRoot);
  const pixels=()=>{const p=new Uint8Array(512*512*4),gl=renderer.getContext();gl.readPixels(0,0,512,512,gl.RGBA,gl.UNSIGNED_BYTE,p);return p};
  renderer.render(scene,camera);const sourceImage=renderer.domElement.toDataURL(),sourcePixels=pixels();
  scene.remove(normalizeRoot);scene.add(new T.Mesh(actual,new T.MeshNormalMaterial()));renderer.render(scene,camera);const convertedImage=renderer.domElement.toDataURL(),convertedPixels=pixels();
  let total=0,count=0,max=0,changed=0;for(let i=0;i<sourcePixels.length;i+=4){if(sourcePixels[i]+sourcePixels[i+1]+sourcePixels[i+2]+convertedPixels[i]+convertedPixels[i+1]+convertedPixels[i+2]===0)continue;count++;let peak=0;for(let k=0;k<3;k++){const d=Math.abs(sourcePixels[i+k]-convertedPixels[i+k]);total+=d;peak=Math.max(peak,d)}max=Math.max(max,peak);if(peak>2)changed++;}
  const gpu={comparedPixels:count,meanChannelError:total/(count*3),maxChannelError:max,pixelsAbove2:changed,sourceImage,convertedImage};renderer.dispose();
  return{gpu,maxRestSkinDisplacement,positionDifference,authored:seams(expected),converted:seams(actual),authoredVsConverted:{maxNormalAngle,meanNormalAngle:sumAngle/pos.count},expectedNormals:Array.from(expected.attributes.normal.array),actualNormals:Array.from(actual.attributes.normal.array)};
 },process.env.TIRE_ASSET||'/assets/mario-kart/mario-source.glb');
 for(const key of ['sourceImage','convertedImage']){await writeFile(`${out}/${key}.png`,Buffer.from(report.gpu[key].split(',')[1],'base64'));delete report.gpu[key];}
 await writeFile(`${out}/normal-review.json`,JSON.stringify(report,null,2));delete report.expectedNormals;delete report.actualNormals;console.log(JSON.stringify(report));
}finally{await browser.close()}
