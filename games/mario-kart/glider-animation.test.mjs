import test from 'node:test';import assert from 'node:assert/strict';import {gliderDeployment} from './glider-animation.js';
test('canopy stays deployed at touchdown, then closes continuously and pauses with race time',()=>{
 const s={};assert.equal(gliderDeployment(s,true,2,10),1);
 assert.equal(gliderDeployment(s,false,0,11),1);
 const middle=gliderDeployment(s,false,0,11.11);assert.ok(Math.abs(middle-.5)<1e-12);
 for(let i=0;i<20;i++)assert.equal(gliderDeployment(s,false,0,11.11),middle);
 assert.equal(gliderDeployment(s,false,0,11.23),0);
 assert.equal(gliderDeployment(s,false,0,100),0);
});
test('interrupted deployment closes from its actual width and a new launch restarts it',()=>{
 const s={};const partial=gliderDeployment(s,true,.08,4);assert.ok(partial>0&&partial<.5);
 assert.equal(gliderDeployment(s,false,0,4.01),partial);
 assert.ok(gliderDeployment(s,false,0,4.12)<partial);
 assert.equal(gliderDeployment(s,true,0,5),0);
 assert.equal(gliderDeployment(s,true,.5,5.5),1);
});
