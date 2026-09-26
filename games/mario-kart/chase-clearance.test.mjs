import test from 'node:test';import assert from 'node:assert/strict';import * as T from 'three';
import {clearChaseView,clearanceLookTarget,smoothChaseCorrection} from './chase-clearance.js';
const v=(x,y,z)=>new T.Vector3(x,y,z),up=v(0,1,0);

// Independent analytic finite rail in the plane z=1: -0.15<x<0.15, 0<y<2.
function rail(focus,eye){
 const d=eye.clone().sub(focus),t=(1-focus.z)/d.z;
 if(t>0&&t<1){const p=focus.clone().addScaledVector(d,t);if(Math.abs(p.x)<.15&&p.y>0&&p.y<2)
   return focus.clone().addScaledVector(d,Math.max(0,t-.45/d.length()));}
 return eye.clone();
}
test('nearby rail moves the eye to a clear side instead of inside the driver',()=>{
 const body=v(0,1.3,0),head=v(0,2.4,0),eye=v(0,3.15,7.8);
 assert.ok(rail(body,eye).distanceTo(body)<1);
 const actual=clearChaseView(body,head,eye,up,rail);
 assert.ok(actual.distanceTo(body)>7);
 // Interpolate at the known rail plane without calling the collision implementation.
 const atRail=body.clone().lerp(actual,1/actual.z);
 assert.ok(Math.abs(atRail.x)>=.15||atRail.y>=2);
 assert.ok(actual.distanceTo(eye)<3,'Use a nearby clear view');
});
test('unobstructed chase eye remains exact',()=>{
 const eye=v(0,3,8);assert.deepEqual(clearChaseView(v(0,1,0),v(0,2,0),eye,up,(_,e)=>e.clone()).toArray(),eye.toArray());
});
test('an overlapping rail never pulls the eye into the head when its top remains visible',()=>{
 const wall=(focus,eye)=>{
  const d=eye.clone().sub(focus),t=(.2-focus.z)/d.z;
  if(t>0&&t<1&&focus.y+d.y*t<3)return focus.clone().addScaledVector(d,.01);
  return eye.clone();
 };
 const eye=v(0,3.15,7.8),actual=clearChaseView(v(0,1.3,0),v(0,2.4,0),eye,up,wall,v(0,3.2,0));
 assert.deepEqual(actual.toArray(),eye.toArray());
});
test('translation compensation preserves the driver to view-axis angle',()=>{
 const before=v(0,3,8),after=v(2,3,8),head=v(0,2,0),target=v(0,1,-12);
 const adjusted=clearanceLookTarget(before,after,head,target);
 const old=head.clone().sub(before).angleTo(target.clone().sub(before));
 const next=head.clone().sub(after).angleTo(adjusted.clone().sub(after));
 assert.ok(Math.abs(old-next)<1e-7);
});
test('a brief alternate clear view does not teleport the camera',()=>{
 const eye=v(0,3,8),offset=v(0,0,0),body=v(0,1.3,0),crown=v(0,3.2,0);
 const actual=smoothChaseCorrection(eye,v(4.5,3,8),body,crown,(_,e)=>e.clone(),offset,1/60);
 assert.ok(actual.x>0&&actual.x<1);assert.equal(actual.z,8);
 const next=smoothChaseCorrection(eye,eye,body,crown,(_,e)=>e.clone(),offset,1/60);
 assert.ok(next.x>0&&next.x<actual.x);
});
