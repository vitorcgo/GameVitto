import test from 'node:test';import assert from 'node:assert/strict';
import {createSurfaceTrack} from './surface-track.js';import {surfaceContact} from './surface-contact.js';
function bankedCircle(degrees){
 const bank=degrees*Math.PI/180,c=Math.cos(bank),s=Math.sin(bank),radius=100,length=2*Math.PI*radius;
 return createSurfaceTrack({length,antiStart:0,antiEnd:length,gapStart:length-1,gapEnd:length,points:Array.from({length:2001},(_,i)=>{const t=i/2000*2*Math.PI;return{s:i/2000*length,p:[radius*Math.cos(t)*c,radius*Math.cos(t)*s,radius*Math.sin(t)],n:[-s,c,0]}})});
}
test('lateral metres retain their physical width on an 86-degree road',()=>{
 const road=bankedCircle(86),angle=86*Math.PI/180;
 // Independently place a point six metres inward from a 100m circular center.
 const p={x:94*Math.cos(angle),y:94*Math.sin(angle),z:0},near=road.project(p,0);
 assert.ok(Math.abs(near.lateral-6)<.001,JSON.stringify(near));
 const placed=road.surface(0,6);assert.ok(Math.hypot(placed.x-p.x,placed.y-p.y,placed.z-p.z)<.001);
});
test('straight input travels ten physical metres on flat and near-vertical planes',()=>{
 for(const bank of [0,60,86]){
  const road=bankedCircle(bank),p=road.surface(0),r={...p,lateral:0};
  for(let i=0;i<120;i++)Object.assign(r,road.advance(r,0,10/120));
  assert.ok(Math.abs(r.z-10)<.03,`bank ${bank}: z ${r.z}`);
  assert.ok(Math.hypot(r.x-p.x,r.y-p.y)<.03,`bank ${bank}: curved without steering`);
 }
});
test('physical steering angle is unchanged by a steep bank',()=>{
 for(const bank of [0,60,86]){
  const road=bankedCircle(bank),p=road.at(0),heading=road.turnHeading(0,p.heading,.2),f=road.frame(0,heading);
  // At the start, forward is +Z and right points radially inward.
  const angle=bank*Math.PI/180;
  assert.ok(Math.abs(f.forward.z-Math.cos(.2))<.001);
  assert.ok(Math.abs(f.forward.x+Math.sin(.2)*Math.cos(angle))<.001);
  assert.ok(Math.abs(f.forward.y+Math.sin(.2)*Math.sin(angle))<.001);
 }
});
test('surface contact separates actual chassis width along a tilted plane',()=>{
 for(const degrees of [0,60,86]){
  const t=degrees*Math.PI/180,c=Math.cos(t),s=Math.sin(t),frame={right:{x:c,y:s,z:0},up:{x:-s,y:c,z:0},forward:{x:0,y:0,z:-1}};
  const a={x:0,y:0,z:0,heading:0},b={...a,x:2.4*c,y:2.4*s};
  const contact=surfaceContact(a,b,frame,frame);assert.ok(contact);
  assert.ok(Math.abs(contact.x-.185*c)<1e-8);assert.ok(Math.abs(contact.y-.185*s)<1e-8);assert.ok(Math.abs(contact.z)<1e-8);
  assert.equal(surfaceContact(a,{...b,x:2.7*c,y:2.7*s},frame,frame),null);
 }
});
