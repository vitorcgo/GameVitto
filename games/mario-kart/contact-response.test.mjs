import test from 'node:test';
import assert from 'node:assert/strict';
import {contactResponse} from './contact-response.js';
const flat={forward:{x:0,y:0,z:-1},right:{x:1,y:0,z:0}};
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,`${a} != ${b}`);
test('rear impact conserves equal-mass momentum and separates at 40% of closing speed',()=>{
 const a={speed:40},b={speed:20};
 contactResponse(a,b,flat,flat,{x:0,z:-.2});
 near(a.speed+b.speed,60);near(b.speed-a.speed,8);
 near(a.sideVelocity,0);near(b.sideVelocity,0);
});
test('separating bodies get no second kick while overlap resolves',()=>{
 const a={speed:15,sideVelocity:2},b={speed:25,sideVelocity:0},before=structuredClone([a,b]);
 assert.equal(contactResponse(a,b,flat,flat,{x:0,z:-.3}),0);assert.deepEqual([a,b],before);
});
test('side swipe redirects motion sideways without steering the player',()=>{
 const a={speed:30,sideVelocity:6,heading:0,steer:.2},b={speed:30,sideVelocity:0,heading:0,steer:0};
 contactResponse(a,b,flat,flat,{x:.2,z:0});
 near(a.speed,30);near(b.speed,30);near(a.sideVelocity+b.sideVelocity,6);near(b.sideVelocity-a.sideVelocity,2.4);
 assert.equal(a.heading,0);assert.equal(a.steer,.2);
});
test('vertical bank transfers lateral momentum in world Y, not a horizontal approximation',()=>{
 const bank={forward:{x:1,y:0,z:0},right:{x:0,y:1,z:0}};
 const a={speed:25,sideVelocity:8},b={speed:25,sideVelocity:0};
 contactResponse(a,b,bank,bank,{x:0,y:.1,z:0});
 near(a.speed,25);near(b.speed,25);near(a.sideVelocity+b.sideVelocity,8);near(b.sideVelocity-a.sideVelocity,3.2);
});
