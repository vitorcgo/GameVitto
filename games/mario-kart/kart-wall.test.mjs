import test from 'node:test';import assert from 'node:assert/strict';
import {kartWallLimits} from './kart-wall.js';
function corridor(degrees=0,narrow=false){
 const a=degrees*Math.PI/180,c=Math.cos(a),s=Math.sin(a);
 return {bounds:station=>({min:narrow&&station>1?-3:-5,max:narrow&&station>1?3:5}),
  frame:()=>({right:{x:c,y:s,z:0},up:{x:-s,y:c,z:0},forward:{x:0,y:0,z:-1}}),
  project:p=>({s:-p.z,lateral:p.x*c+p.y*s}),place:lateral=>({x:lateral*c,y:lateral*s,z:0,s:0,lateral,heading:0})};
}
test('a centre still inside the road is corrected before the body crosses the wall',()=>{
 const t=corridor(),r=t.place(-4.8),limit=kartWallLimits(t,r);
 // Independent straight-corridor check using the source tire's measured extent
 // +/-1.24m (0.99 axle position plus0.25 tire half-width), not helper corners.
 assert.ok(limit.min-1.24>-5);assert.ok(limit.min>r.lateral);
 assert.ok(limit.min<-3,'Do not unnecessarily remove a whole driving lane');
});
test('wall clearance uses physical width on a near-vertical road',()=>{
 const flat=corridor(),bank=corridor(86);
 const a=kartWallLimits(flat,flat.place(-4.8)),b=kartWallLimits(bank,bank.place(-4.8));
 assert.ok(Math.abs(a.min-b.min)<1e-9);assert.ok(Math.abs(a.max-b.max)<1e-9);
});
test('the forward corners see a narrowing before the centre gets there',()=>{
 const t=corridor(0,true),limits=kartWallLimits(t,t.place(-2.8));
 assert.ok(limits.min>-2&&limits.max<2);
});
test('flat hover tires reserve more width and a central racer is untouched',()=>{
 const t=corridor(),r=t.place(-4.8);
 assert.ok(kartWallLimits(t,{...r,anti:true}).min>kartWallLimits(t,r).min);
 assert.deepEqual(kartWallLimits(t,t.place(0)),{min:-5,max:5});
});
