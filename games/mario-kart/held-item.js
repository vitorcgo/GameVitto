import * as THREE from 'three';
import {makeItemModel} from './item-models.js';

/** A lit, round mushroom; analytic spots keep the cap smooth at race distance. */
export function createHeldMushroom() {
  const group = new THREE.Group();
  group.name = 'held-mushroom';
  const capMaterial = new THREE.MeshStandardMaterial({color:0xe51627,roughness:.38});
  capMaterial.onBeforeCompile = shader => {
    shader.vertexShader = 'varying vec3 mushroomDirection;\n' + shader.vertexShader.replace('#include <begin_vertex>',
      '#include <begin_vertex>\nmushroomDirection = normalize(position);');
    shader.fragmentShader = 'varying vec3 mushroomDirection;\n' + shader.fragmentShader.replace('#include <color_fragment>', `
      #include <color_fragment>
      vec3 d = normalize(mushroomDirection);
      float spot = dot(d,vec3(0.,1.,0.));
      for(int i=0;i<5;i++) {
        float a = float(i)*6.28318530718/5.;
        spot = max(spot,dot(d,vec3(sin(a)*.91,.414608,cos(a)*.91)));
      }
      float edge = max(fwidth(spot),.001);
      diffuseColor.rgb = mix(diffuseColor.rgb,vec3(.96),smoothstep(.922-edge,.922+edge,spot));
    `);
  };
  capMaterial.customProgramCacheKey = ()=>'held-mushroom-spots-v1';
  const cap = new THREE.Mesh(new THREE.SphereGeometry(.35,64,32,0,Math.PI*2,0,Math.PI*.56),capMaterial);
  cap.position.y=.24;cap.scale.y=.86;group.add(cap);
  const cream = new THREE.MeshStandardMaterial({color:0xffedcc,roughness:.65});
  const stem = new THREE.Mesh(new THREE.SphereGeometry(.17,32,20),cream);
  stem.scale.set(1,1.05,.92);stem.position.y=.14;group.add(stem);
  const underside = new THREE.Mesh(new THREE.CircleGeometry(.344,64),cream);
  underside.rotation.x=Math.PI/2;underside.position.y=.184;group.add(underside);
  const black = new THREE.MeshStandardMaterial({color:0x161219,roughness:.42});
  for(const x of [-.053,.053]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(1,16,12),black);
    eye.scale.set(.018,.047,.012);eye.position.set(x,.137,.153);group.add(eye);
  }
  group.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});
  return group;
}

const v = () => new THREE.Vector3();
const states = new WeakMap();

function prepare(model) {
  const find = prefix => {let found;model.traverse(o=>{if(o.isBone&&o.name.startsWith(prefix+'_'))found=o;});return found;};
  const upper=find('ArmL'),lower=find('ElbowL'),hand=find('HandL'),finger=find('Finger1L');
  if(!upper||!lower||!hand||!finger)return null;
  const mushroom=new THREE.Group();mushroom.name="held-inventory";mushroom.visible=false;model.add(mushroom);
  return {upper,lower,hand,finger,mushroom,amount:0,
    rest:[upper,lower,hand].map(o=>o.quaternion.clone())};
}

function point(model, object) {return model.worldToLocal(object.getWorldPosition(v()));}
function aim(model,joint,child,target) {
  model.updateWorldMatrix(true,true);
  const origin=joint.getWorldPosition(v());
  const from=child.getWorldPosition(v()).sub(origin).normalize();
  const toward=model.localToWorld(target.clone()).sub(origin).normalize();
  const rotation=joint.getWorldQuaternion(new THREE.Quaternion())
    .premultiply(new THREE.Quaternion().setFromUnitVectors(from,toward));
  joint.quaternion.copy(joint.parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(rotation));
  model.updateWorldMatrix(true,true);
}

/** Visual inventory pose. Bone lengths and all race/phone state remain unchanged. */
export function updateHeldItem(model,racer,dt) {
  const show=!!racer.item&&!(racer.roulette>0)&&!(racer.spin>0)&&racer.finishTime==null;
  const throwing=racer.itemUse?.age<.48 && !(racer.spin>0);
  if(!states.has(model)&&!show&&!throwing)return;
  if(!states.has(model))states.set(model,prepare(model));
  const state=states.get(model);if(!state||dt<=0)return;
  const {upper,lower,hand,finger,mushroom,rest}=state;
  if(!show&&!throwing&&state.amount===0){mushroom.visible=false;return;}
  state.amount+=(Number(show||throwing)-state.amount)*(1-Math.exp(-Math.min(dt,.05)*14));
  if(state.amount<.0001)state.amount=0;
  const type=show?racer.item:racer.itemUse?.type;
  if(type && state.type!==type){
    mushroom.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});mushroom.clear();
    const prop=type==='mushroom'?createHeldMushroom():makeItemModel(type);
    if(type!=='mushroom')prop.scale.setScalar(.48);
    mushroom.add(prop);state.type=type;
  }
  [upper,lower,hand].forEach((o,i)=>o.quaternion.copy(rest[i]));
  model.updateWorldMatrix(true,true);
  if(state.amount>0) {
    const a=point(model,upper),b=point(model,lower),c=point(model,hand);
    const l1=a.distanceTo(b),l2=b.distanceTo(c),length=l1+l2;
    const goal=a.clone().add(new THREE.Vector3(-length*.75,length*.32,-length*.13));
    if(throwing){
      const t=racer.itemUse.age, swing=Math.sin(Math.min(1,t/.38)*Math.PI);
      goal.add(new THREE.Vector3(length*.36*swing,length*.25*swing,(type==='banana'?1:-1)*length*.9*swing));
    }
    const target=c.clone().lerp(goal,state.amount),toward=target.clone().sub(a);
    const distance=THREE.MathUtils.clamp(toward.length(),Math.abs(l1-l2)+1e-5,length-1e-5),dir=toward.normalize();
    const along=(l1*l1-l2*l2+distance*distance)/(2*distance);
    const pole=new THREE.Vector3(-1,-1,.3);pole.addScaledVector(dir,-pole.dot(dir)).normalize();
    const elbow=a.clone().addScaledVector(dir,along).addScaledVector(pole,Math.sqrt(Math.max(0,l1*l1-along*along)));
    aim(model,upper,lower,elbow);aim(model,lower,hand,a.clone().addScaledVector(dir,distance));
    // Rotate the cupped glove upward while retaining its authored finger curl.
    const wrist=point(model,hand),fingerRest=point(model,finger).sub(wrist);
    const fingerGoal=new THREE.Vector3(-.3,.88,-.36).normalize().multiplyScalar(fingerRest.length());
    aim(model,hand,finger,wrist.clone().add(fingerRest.lerp(fingerGoal,state.amount)));
  }
  model.updateWorldMatrix(true,true);
  const palm=point(model,hand).lerp(point(model,finger),.68);
  mushroom.position.copy(palm).add(new THREE.Vector3(0,.045,0));
  mushroom.visible=show;
  mushroom.userData.poseAmount=state.amount;
}

export function heldItemOrigin(model){
 const state=states.get(model);if(!state)return null;
 model.updateWorldMatrix(true,true);return state.mushroom.getWorldPosition(v());
}
