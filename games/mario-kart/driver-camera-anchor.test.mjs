import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {driverCameraAnchor} from './driver-camera-anchor.js';
const near=(a,b)=>assert.ok(a.distanceTo(new T.Vector3(...b))<1e-5,`${a.toArray()} != ${b}`);

test('rendered head center excludes the sibling body and follows cached head motion',()=>{
 const model=new T.Group(),hip=new T.Bone(),pivot=new T.Group(),head=new T.Bone();
 pivot.name='driver-head';pivot.position.y=1;head.position.y=1;hip.add(pivot);pivot.add(head);model.add(hip);
 const geometry=new T.BufferGeometry();
 geometry.setAttribute('position',new T.Float32BufferAttribute([-.5,2,-.5,.5,4,.5,.5,3,-.5,20,0,0],3));
 geometry.setAttribute('skinIndex',new T.Uint16BufferAttribute([1,0,0,0,1,0,0,0,1,0,0,0,0,0,0,0],4));
 geometry.setAttribute('skinWeight',new T.Float32BufferAttribute([1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0],4));
 const mesh=new T.SkinnedMesh(geometry,new T.MeshBasicMaterial());model.add(mesh);model.updateMatrixWorld(true);
 mesh.bind(new T.Skeleton([hip,head]));
 model.position.set(7,1,4);
 // Independent bounds of the three authored head points: x[-.5,.5],y[2,4],z[-.5,.5].
 near(driverCameraAnchor(model,new T.Vector3()),[7,4,4]);
 pivot.rotation.z=Math.PI/2;
 // Rotate that center about the neck at(0,1,0): (0,2,0)->(-2,0,0).
 near(driverCameraAnchor(model,new T.Vector3()),[5,2,4]);
 model.position.set(9,0,0);
 near(driverCameraAnchor(model,new T.Vector3()),[7,1,0]);
});

test('generated head geometry supplies its center through model scale',()=>{
 const model=new T.Group(),head=new T.Group();head.name='driver-head';head.position.y=1;
 const mesh=new T.Mesh(new T.BoxGeometry(1,1,1));mesh.position.y=.5;head.add(mesh);model.add(head);
 model.position.x=10;model.scale.setScalar(2);
 near(driverCameraAnchor(model,new T.Vector3()),[10,3,0]);
 head.rotation.z=Math.PI/2;
 near(driverCameraAnchor(model,new T.Vector3()),[9,2,0]);
});

test('models without a usable head retain their existing fallback anchor',()=>{
 const fallback=new T.Vector3(1,2,3),actual=driverCameraAnchor(new T.Group(),fallback);
 near(actual,[1,2,3]);assert.notEqual(actual,fallback);
});
