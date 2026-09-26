import test from 'node:test';import assert from 'node:assert/strict';
import {Group,Mesh,BoxGeometry,MeshStandardMaterial,Texture} from 'three';
import {updateStarModel,makeStarAura,updateStarAura} from './star-effect.js';
import {sourceWheelMaterial,updateSourceWheel} from './source-wheel.js';
const values=m=>({color:m.color.toArray(),emissive:m.emissive.toArray(),intensity:m.emissiveIntensity,roughness:m.roughness,metalness:m.metalness,map:m.map,normalMap:m.normalMap});
test('star activation preserves other instances and restores authored material state',()=>{
 const source=new MeshStandardMaterial({color:0x735ea2,emissive:0x173229,emissiveIntensity:.7,roughness:.83,metalness:.12,map:new Texture(),normalMap:new Texture()});
 const root=new Group(),mesh=new Mesh(new BoxGeometry(),source),other=new Mesh(mesh.geometry,source);root.add(mesh);const before=values(source);
 updateStarModel(root,true,.2);assert.notEqual(mesh.material,source);assert.deepEqual(values(other.material),before);
 const active=mesh.material;updateStarModel(root,true,.7);assert.equal(mesh.material,active,'Per-frame updates must reuse the effect material');
 updateStarModel(root,false,.1);assert.deepEqual(values(mesh.material),before);
 updateStarModel(root,true,.4);updateStarModel(root,false,.8);assert.deepEqual(values(mesh.material),before);
});
test('star does not overwrite the source wheel emission controller',()=>{
 const root=new Group(),source=new MeshStandardMaterial({emissive:0x00ccff,emissiveIntensity:2.8});source.userData.sourceHover={value:1};
 const mesh=new Mesh(new BoxGeometry(),source);root.add(mesh);updateStarModel(root,true,.5);
 assert.deepEqual(mesh.material.emissive.toArray(),source.emissive.toArray());assert.equal(mesh.material.emissiveIntensity,2.8);
 updateStarModel(root,false,.1);assert.equal(mesh.material.emissiveIntensity,2.8);
});
test('twinkles stay within the kart envelope and disappear when star ends',()=>{
 const aura=makeStarAura();for(let time=0;time<4;time+=.031){updateStarAura(aura,true,time,900);const a=aura.geometry.attributes.position.array;assert.ok([...a].every(Number.isFinite));for(let i=0;i<a.length;i+=3){assert.ok(Math.hypot(a[i],a[i+2])<1.8);assert.ok(a[i+1]>=0&&a[i+1]<3);}}
 updateStarAura(aura,false,4,900);assert.equal(aura.visible,false);
});

test('hover updates preserve the composed star shader and isolate cloned tire uniforms',()=>{
 const source=new MeshStandardMaterial({roughness:.72});sourceWheelMaterial(source);source.userData.sourceHover.value=.2;
 const root=new Group(),wheel=new Group(),mesh=new Mesh(new BoxGeometry(),source);root.add(wheel);wheel.add(mesh);wheel.userData.sourceTireMeshes=[mesh];
 updateStarModel(root,true,.5);const material=mesh.material,combined=material.onBeforeCompile;
 for(const hover of [1,.3,0,1]){
  updateSourceWheel(wheel,hover);
  assert.equal(material.onBeforeCompile,combined,'Hover must not replace the composed star shader');
  assert.equal(material.userData.sourceHover.value,hover);
  assert.equal(source.userData.sourceHover.value,.2,'A powered kart must not change another kart sharing the original tire material');
 }
 updateStarModel(root,false,0);assert.equal(material.roughness,.72);
 updateSourceWheel(wheel,0);assert.equal(material.emissiveIntensity,0);
 updateSourceWheel(wheel,1);assert.equal(material.emissiveIntensity,2.8);
});
