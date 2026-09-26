import * as THREE from 'three';
import {ColladaLoader} from '/vendor/three-examples/loaders/ColladaLoader.js';
import {seatMario} from './source-pose.js';

export async function assembleKart(sourceBase = new URL("../evidence/asset-study/", import.meta.url).href) {
  const local = path => new URL(path, sourceBase).href;
  const loader=new ColladaLoader(),textures=new THREE.TextureLoader();
  const [mario,kart,tires]=await Promise.all([
    loader.loadAsync(local('./mario/Mario/mario.dae')),
    loader.loadAsync(local('./kart/Standard%20Kart.dae')),
    loader.loadAsync(local('./tires/Standard%20%26%20Blue%20Standard/TireK_Std.dae'))
  ]);
  const texture=async(path,color=false)=>{const t=await textures.loadAsync(local(path));t.colorSpace=color?THREE.SRGBColorSpace:THREE.NoColorSpace;t.anisotropy=8;return t;};
  const [bodyMap,eyeMap,bodyNormal,eyeNormal,kartMap,emblem,tireMap,tireNormal,tireEmission]=await Promise.all([
    texture('./mario/Mario/mario_alb.png',true),texture('./mario/Mario/marioeye_alb.0.png',true),
    texture('./mario/Mario/mario_nrm.png'),texture('./mario/Mario/marioeye_nrm.0.png'),
    texture('./kart/bodyk_std_mro_alb.png',true),texture('./kart/Emblems/Mario.png',true),
    texture('./tires/Standard%20%26%20Blue%20Standard/Tire_Std_Alb.png',true),texture('./tires/Standard%20%26%20Blue%20Standard/Tire_Std_Nrm.png'),
    texture('./tires/Standard%20%26%20Blue%20Standard/Tire_Std_Emm.png',true)
  ]);
  for (const t of [kartMap,emblem,tireMap,tireNormal,tireEmission]) {t.wrapS=t.wrapT=THREE.RepeatWrapping;t.needsUpdate=true;}
  const assembly=new THREE.Group();assembly.name='gamevitto-source-kart';
  assembly.userData.gamevittoSourcePack=1;
  assembly.userData.source='Nintendo Mario Kart 8 / The Models Resource; local study conversion';
  const bodyMaterial=new THREE.MeshStandardMaterial({map:bodyMap,normalMap:bodyNormal,normalScale:new THREE.Vector2(.35,.35),roughness:.7});
  const eyeMaterial=new THREE.MeshStandardMaterial({map:eyeMap,normalMap:eyeNormal,normalScale:new THREE.Vector2(.2,.2),roughness:.56});
  mario.scene.traverse(o=>{if(o.isMesh){if(o.name.startsWith('Pupil'))o.visible=false;else o.material=o.name.includes('Eye')?eyeMaterial:bodyMaterial;}});
  seatMario(mario.scene,THREE);
  const driver=new THREE.Group();driver.name='source-driver';driver.add(mario.scene);driver.scale.setScalar(.165);driver.rotation.y=Math.PI;driver.position.set(0,.08,.08);assembly.add(driver);
  const chassis=new THREE.Group();chassis.name='source-chassis';chassis.add(kart.scene);chassis.scale.setScalar(1.15);chassis.rotation.y=Math.PI;chassis.position.set(0,.55,0);assembly.add(chassis);
  kart.scene.traverse(o=>{if(o.isMesh)o.material=new THREE.MeshPhysicalMaterial({map:o.name.includes('Layer')?emblem:kartMap,roughness:.35,metalness:.12,clearcoat:.65,clearcoatRoughness:.22,transparent:o.name.includes('Layer'),alphaTest:o.name.includes('Layer')?.3:0});});
  // Bake a single actual tire's rest-pose vertices, then center it independently
  // of the archive's scene and bone axis conventions.
  tires.scene.updateMatrixWorld(true);tires.scene.traverse(o=>{if(o.isSkinnedMesh)o.skeleton.update();});
  const tire=tires.scene.getObjectByName('TireK_LB__m_Tire'),geometry=tire.geometry.clone(),p=geometry.attributes.position;
  const v=new THREE.Vector3(),normal=geometry.attributes.normal;
  const skin=new THREE.Matrix4(),bone=new THREE.Matrix4(),transform=new THREE.Matrix4(),normalMatrix=new THREE.Matrix3();
  for(let i=0;i<p.count;i++){
    tire.getVertexPosition(i,v).applyMatrix4(tire.matrixWorld);p.setXYZ(i,v.x,v.y,v.z);
    // Preserve the authored smooth normals through the same bone/world bake.
    // Recalculating on this non-indexed mesh gives every triangle a flat normal.
    skin.elements.fill(0);
    for(let k=0;k<4;k++){
      const weight=geometry.attributes.skinWeight.getComponent(i,k),index=geometry.attributes.skinIndex.getComponent(i,k);
      if(!weight)continue;
      bone.fromArray(tire.skeleton.boneMatrices,index*16);
      for(let j=0;j<16;j++)skin.elements[j]+=bone.elements[j]*weight;
    }
    transform.copy(tire.matrixWorld).multiply(tire.bindMatrixInverse).multiply(skin).multiply(tire.bindMatrix);
    normalMatrix.getNormalMatrix(transform);
    v.fromBufferAttribute(normal,i).applyMatrix3(normalMatrix).normalize();normal.setXYZ(i,v.x,v.y,v.z);
  }
  geometry.deleteAttribute('skinIndex');geometry.deleteAttribute('skinWeight');geometry.computeBoundingBox();
  const center=geometry.boundingBox.getCenter(new THREE.Vector3()),size=geometry.boundingBox.getSize(new THREE.Vector3());
  geometry.translate(-center.x,-center.y,-center.z);geometry.scale(.5/size.x,.92/size.y,.92/size.z);
  const tireMaterial=new THREE.MeshStandardMaterial({map:tireMap,normalMap:tireNormal,normalScale:new THREE.Vector2(.5,.5),roughness:.72,emissiveMap:tireEmission,emissive:0x15d8ff,emissiveIntensity:0});
  for(const [i,[x,z]]of[[-.99,-.87],[.99,-.87],[-.99,.9],[.99,.9]].entries()) {
    const pivot=new THREE.Group();pivot.name='wheel-'+i;pivot.position.set(x,.46,z);
    const wheel=new THREE.Mesh(geometry,tireMaterial);wheel.name='source-tire';if(x<0)wheel.rotation.y=Math.PI;pivot.add(wheel);assembly.add(pivot);
  }
  assembly.updateMatrixWorld(true);
  const head=mario.scene.getObjectByName('Head_1'),parent=head.parent,pivot=new THREE.Group();
  pivot.name='driver-head';pivot.position.copy(head.position);pivot.quaternion.copy(parent.getWorldQuaternion(new THREE.Quaternion()).invert());
  parent.add(pivot);assembly.updateMatrixWorld(true);pivot.attach(head);
  pivot.userData.lookRestQuaternion=pivot.quaternion.toArray();
  assembly.updateMatrixWorld(true);return assembly;
}
