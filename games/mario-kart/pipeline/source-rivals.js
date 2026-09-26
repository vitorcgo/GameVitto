/** Offline fitting of optional source drivers. Coordinates come from imported bones. */
import * as THREE from 'three';
import {ColladaLoader} from '/vendor/three-examples/loaders/ColladaLoader.js';
import {assembleKart} from './source-models.js';
export const rivals={
 luigi:{dir:'luigi/Luigi/',dae:'luigi.dae',body:'luigi',eye:'luigieye',paint:'lig',emblem:'Luigi',top:2.85},
 peach:{dir:'peach/',dae:'Peach.dae',body:'peach',eye:'peacheye',paint:'pch',emblem:'Peach',top:3},
 yoshi:{dir:'yoshi/Yoshi/',dae:'yoshi.dae',body:'yoshi',eye:'yoshieye',paint:'ysi00',emblem:'Yoshi',top:2.75,suffix:2},
 toad:{dir:'toad/Toad/',dae:'toad.dae',body:'kinopio',eye:'kinopioeye',paint:'kno',emblem:'Toad',top:2.55},
 bowser:{dir:'bowser/Bowser/',dae:'bowser.dae',body:'koopabody',eye:'koopaeye',paint:'kop',emblem:'Bowser',top:2.85},
 'donkey-kong':{dir:'donkey-kong/',dae:'Donkey Kong.dae',body:'dk',eye:'dkeye',paint:'dkg',emblem:'Donkey Kong',top:3.1},
 koopa:{dir:'koopa/',dae:'Koopa Troopa.dae',body:'nokonoko',eye:'nokonokoeye',paint:'nok',emblem:'Koopa',top:2.5}
};
function seat(root,suffix,id){
 const bone=name=>root.getObjectByName(name+'_'+suffix),world=o=>o.getWorldPosition(new THREE.Vector3());
 const update=()=>root.updateMatrixWorld(true);
 const aim=(joint,child,target)=>{
  update();const origin=world(joint),from=world(child).sub(origin).normalize(),to=target.clone().sub(origin).normalize();
  const q=joint.getWorldQuaternion(new THREE.Quaternion()).premultiply(new THREE.Quaternion().setFromUnitVectors(from,to));
  joint.quaternion.copy(joint.parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(q));update();
 };
 // Solve each chain using its measured segment lengths; never stretch source bones.
 const chain=(upper,lower,end,target,pole)=>{
  update();const a=world(upper),b=world(lower),c=world(end),l1=a.distanceTo(b),l2=b.distanceTo(c);
  const toward=target.clone().sub(a),distance=THREE.MathUtils.clamp(toward.length(),Math.abs(l1-l2)+.0001,l1+l2-.0001),dir=toward.normalize();
  const along=(l1*l1-l2*l2+distance*distance)/(2*distance),height=Math.sqrt(Math.max(0,l1*l1-along*along));
  const bend=pole.clone().addScaledVector(dir,-pole.dot(dir)).normalize();
  const elbow=a.clone().addScaledVector(dir,along).addScaledVector(bend,height);
  aim(upper,lower,elbow);aim(lower,end,a.clone().addScaledVector(dir,distance));
 };
 for(const side of ['L','R']){
  const sign=side==='L'?1:-1,foot=bone('Foot'+side),rest=foot.getWorldQuaternion(new THREE.Quaternion());
  // Dress-rig legs are full standing length; fit the hidden seated legs under the drape.
  if(id==='peach'){bone('Leg'+side).scale.setScalar(.5);update();}
  chain(bone('Leg'+side),bone('Knee'+side),foot,new THREE.Vector3(sign*.4,id==='bowser'?.66:.43,.85),new THREE.Vector3(sign*.15,.3,1));
  foot.quaternion.copy(foot.parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(rest));update();
  chain(bone('Arm'+side),bone('Elbow'+side),bone('Hand'+side),new THREE.Vector3(sign*.35,1.1,.57),new THREE.Vector3(sign,-.25,-.5));
  if(bone('Finger1'+side)){
   aim(bone('Hand'+side),bone('Finger1'+side),new THREE.Vector3(sign*.32,1.18,.78));
   if(bone('Finger2'+side))aim(bone('Finger1'+side),bone('Finger2'+side),new THREE.Vector3(sign*.32,.93,.76));
  }
 }
 if(id==='yoshi')bone('Tongue1').scale.setScalar(.02);
 if(id==='peach'){
  // The archive supplies the full standing dress; compress its drape into the footwell.
  bone('Skirt1').scale.setScalar(.43);update();
  aim(bone('Skirt1'),bone('Skirt2'),new THREE.Vector3(0,.93,.35));
  aim(bone('Skirt2'),bone('Skirt3'),new THREE.Vector3(0,.48,.74));
  aim(bone('Hair1'),bone('Hair2'),new THREE.Vector3(0,1.9,-.7));
  aim(bone('Hair2'),bone('Hair3'),new THREE.Vector3(0,1.3,-.75));
 }
 update();root.traverse(o=>{if(o.isSkinnedMesh)o.skeleton.update();});
}
export async function assembleRival(id,base){
 const spec=rivals[id];if(!spec)throw new Error('Unknown source rival '+id);
 const local=path=>new URL(path,base).href,loader=new THREE.TextureLoader();
 const texture=async(path,color)=>{const t=await loader.loadAsync(local(path));t.colorSpace=color?THREE.SRGBColorSpace:THREE.NoColorSpace;t.anisotropy=8;t.wrapS=t.wrapT=THREE.RepeatWrapping;return t;};
 const [assembly,{scene},body,eye,bodyNormal,eyeNormal,paint,emblem]=await Promise.all([
  assembleKart(base),new ColladaLoader().loadAsync(local(spec.dir+spec.dae)),
  texture(spec.dir+spec.body+'_alb.png',true),texture(spec.dir+spec.eye+'_alb.0.png',true),
  texture(spec.dir+spec.body+'_nrm.png',false),texture(spec.dir+spec.eye+'_nrm.0.png',false),
  texture('kart/bodyk_std_'+spec.paint+'_alb.png',true),texture('kart/Emblems/'+spec.emblem+'.png',true)
 ]);
 assembly.remove(assembly.getObjectByName('source-driver'));
 for(const t of [paint,emblem]){t.wrapS=t.wrapT=THREE.RepeatWrapping;t.needsUpdate=true;}
 assembly.getObjectByName('source-chassis').traverse(o=>{if(o.isMesh)o.material.map=o.name.includes('Layer')?emblem:paint;});
 const bodyMat=new THREE.MeshStandardMaterial({map:body,normalMap:bodyNormal,normalScale:new THREE.Vector2(.35,.35),roughness:.7});
 const eyeMat=new THREE.MeshStandardMaterial({map:eye,normalMap:eyeNormal,normalScale:new THREE.Vector2(.2,.2),roughness:.56});
 scene.traverse(o=>{if(o.isMesh){if(o.name.startsWith('Pupil'))o.visible=false;else o.material=o.name.includes('Eye')?eyeMat:bodyMat;}});
 scene.updateMatrixWorld(true);scene.traverse(o=>{if(o.isSkinnedMesh)o.skeleton.update();});
 const suffix=spec.suffix||1,hip=scene.getObjectByName('Hip_'+suffix).getWorldPosition(new THREE.Vector3());
 const scale=(spec.top-1.05)/(new THREE.Box3().setFromObject(scene).max.y-hip.y);
 const normalized=new THREE.Group();normalized.add(scene);normalized.scale.setScalar(scale);normalized.position.set(-hip.x*scale,1.05-hip.y*scale,-.05-hip.z*scale);
 normalized.updateMatrixWorld(true);seat(normalized,suffix,id);
 const driver=new THREE.Group();driver.name='source-driver';driver.add(normalized);driver.rotation.y=Math.PI;assembly.add(driver);assembly.updateMatrixWorld(true);
 const head=scene.getObjectByName('Head_'+suffix),parent=head.parent,pivot=new THREE.Group();pivot.name='driver-head';pivot.position.copy(head.position);pivot.quaternion.copy(parent.getWorldQuaternion(new THREE.Quaternion()).invert());parent.add(pivot);assembly.updateMatrixWorld(true);pivot.attach(head);pivot.userData.lookRestQuaternion=pivot.quaternion.toArray();
 assembly.userData.sourceCharacter=id;assembly.userData.sourceFit={scale,top:spec.top,hipY:1.05};assembly.updateMatrixWorld(true);return assembly;
}
