import test from 'node:test';
import assert from 'node:assert/strict';
import {stepSourceGlide} from './glide.js';

test('steady glide preserves its descent angle and integrates actual height',()=>{
  const f=stepSourceGlide(70,-21,50,2);
  assert.ok(Math.abs(f.height-28)<1e-10);
  assert.equal(f.velocity,-21);
});
test('lift arrests a steep dive without reversing vertical motion',()=>{
  let height=70,velocity=-30;
  for(let i=0;i<120;i++){
    const f=stepSourceGlide(height,velocity,36,1/120);
    assert.ok(f.velocity>=velocity && f.velocity<0);
    assert.ok(f.height<height);
    ({height,velocity}=f);
  }
  assert.ok(velocity>-16 && velocity<-15);
});
test('measured launch height gives a sustained glide instead of a short fall',()=>{
  // Baseline recording begins at 70.26 m with -25.54 m/s vertical velocity.
  // A flat landing plane is independent of the imported route interpolation.
  let height=70.26,velocity=-25.54,time=0;
  while(height>1 && time<10){({height,velocity}=stepSourceGlide(height,velocity,36,1/120));time+=1/120;}
  assert.ok(time>4 && time<5,`flight lasted ${time}s`);
  assert.ok(time*36>145 && time*36<180);
});
test('descent result does not depend on render cadence',()=>{
  const reference=stepSourceGlide(70,-30,36,1.6);
  for(const hz of [30,60,120]){
    let state={height:70,velocity:-30};
    for(let i=0;i<1.6*hz;i++)state=stepSourceGlide(state.height,state.velocity,36,1/hz);
    assert.ok(Math.abs(state.height-reference.height)<1e-9);
    assert.ok(Math.abs(state.velocity-reference.velocity)<1e-9);
  }
});
test('braking to zero still produces a finite descending flight',()=>{
  const f=stepSourceGlide(70,-25,0,1);
  assert.ok(Number.isFinite(f.height)&&f.height<70);
  assert.ok(f.velocity<=-10 && f.velocity>-11);
});
