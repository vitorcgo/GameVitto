import test from 'node:test';
import assert from 'node:assert/strict';
import {Prototype,settings,roadOffset,routeAt,trackLength,RAMP} from './physics.mjs';
const run=(sim,seconds,input)=>{for(let i=0;i<seconds*120;i++)sim.update(1/120,input);};
test('oval is continuous at straights, curves and closing seam',()=>{
 {
  const c=settings(),ends=[0,2*c.straight,2*c.straight+Math.PI*c.radius,4*c.straight+Math.PI*c.radius,trackLength(c)];
  for(const s of ends){const a=routeAt(s-.001,c),b=routeAt(s+.001,c);assert.ok(Math.hypot(a.x-b.x,a.z-b.z)<.00201);assert.ok(Math.abs(roadOffset(a.x,a.z,c))<1e-8);}
 }
});
test('gas moves forward, steering changes trajectory, brake reduces speed',()=>{
 const sim=new Prototype();const start=sim.z;run(sim,1,{gas:true});assert.ok(sim.z<start-5);assert.equal(sim.x,sim.config.radius);
 run(sim,.5,{gas:true,steer:-.4});assert.ok(sim.x<sim.config.radius);assert.ok(sim.heading<0);
 const before=sim.speed;run(sim,.3,{brake:true});assert.ok(sim.speed<before);
});
test('holding drift builds charge; releasing it adds speed',()=>{
 const drift=new Prototype();run(drift,1,{gas:true});drift.z=-drift.config.straight;run(drift,1.6,{gas:true,drift:true,steer:-.22});assert.equal(drift.drift,-1);assert.ok(drift.tier>=1);
 const before=drift.speed;run(drift,.25,{gas:true,steer:-.3});assert.ok(drift.boost>0);assert.ok(drift.speed>before+2);assert.equal(drift.boostCount,1);
});
test('frame rate does not change acceleration or path and reset clears charged inputs',()=>{
 const sims=[30,60,120].map(fps=>{const s=new Prototype();for(let i=0;i<fps*2;i++)s.update(1/fps,{gas:true,steer:-.15});return s;});
 const expected={x:sims[0].x,speed:sims[0].speed};
 for(const s of sims){assert.ok(Math.abs(s.x-expected.x)<1e-8);assert.ok(Math.abs(s.speed-expected.speed)<1e-8);s.reset();assert.equal(s.speed,0);assert.equal(s.boost,0);}
});

test('driving up the ramp launches, preserves pace, glides and lands continuously',()=>{
 const sim=new Prototype();sim.x=-65;sim.z=-72;sim.heading=Math.PI;sim.speed=28;
 const samples=[];
 for(let i=0;i<120*7;i++){sim.update(1/120,{gas:true});samples.push({y:sim.y,speed:sim.speed,air:sim.airborne,age:sim.flightAge});}
 const air=samples.filter(s=>s.air);assert.ok(air.length>240,'Visible flight lasts over two seconds');assert.ok(air.length<720);
 assert.ok(Math.max(...air.map(s=>s.y))>RAMP.height+1,'Jump rises above launch lip');
 assert.ok(air.every(s=>s.speed>=27.99),'No slowdown in flight');
 assert.ok(air.some(s=>s.age>.3),'Parachute gets time to open');
 assert.equal(sim.jumpCount,1);assert.equal(sim.airborne,false);assert.equal(sim.y,0);
 assert.ok(samples.every((s,i)=>!i||Math.abs(s.y-samples[i-1].y)<.12),'No teleport on takeoff or landing');
 sim.reset();assert.equal(sim.airborne,false);assert.equal(sim.y,0);assert.equal(sim.jumpCount,0);
});
