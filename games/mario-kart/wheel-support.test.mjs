import test from 'node:test';
import assert from 'node:assert/strict';
import {wheelSupport} from './wheel-support.js';

const up={x:0,y:1,z:0},forward={x:0,y:0,z:-1},point={x:0,y:0,z:0};
test('wheel support recovers a physical plane even when its shading normals are wrong',()=>{
  // Independently specified geometry y = .2 x + .3 z.
  const support=wheelSupport(p=>({...p,y:.2*p.x+.3*p.z,normal:{x:0,y:1,z:0}}),point,up,forward);
  const length=Math.sqrt(1+.2**2+.3**2);
  for(const [k,v] of Object.entries({x:-.2/length,y:1/length,z:-.3/length}))assert.ok(Math.abs(support.normal[k]-v)<1e-12);
});
test('a four centimetre bevel produces the axle-to-axle rise rather than its local slope',()=>{
  const sample=p=>({...p,y:p.z<-.02?.03:p.z>.02?0:.015-.75*p.z});
  const support=wheelSupport(sample,point,up,forward);
  // Front axle at -.87 is .03 higher than rear at .90: atan(.03/1.77).
  assert.ok(Math.abs(Math.atan2(support.normal.z,support.normal.y)-Math.atan(.03/1.77))<1e-12);
  assert.ok(Math.abs(support.normal.x)<1e-12);
});
test('four wheel support keeps an inverted bank orientation',()=>{
  const support=wheelSupport(p=>({...p,x:0}),point,{x:1,y:0,z:0},forward);
  assert.deepEqual(support.normal,{x:1,y:0,z:0});
});
test('missing wheel and a separate deck both retain the caller fallback',()=>{
  assert.equal(wheelSupport(p=>p.x<0?null:p,point,up,forward),null);
  assert.equal(wheelSupport(p=>({...p,y:p.x<0?4:0}),point,up,forward),null);
});
