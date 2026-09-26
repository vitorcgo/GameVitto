import test from 'node:test';
import assert from 'node:assert/strict';
import {SampledKartAudio} from './sample-audio.js';
function scene(){
 const audio=new SampledKartAudio({ctx:{currentTime:10}}),played=[];
 audio.ready=true;audio.buffers.set('hit-green',{});audio.buffers.set('hit-red',{});audio.buffers.set('shellConfirm',{});
 audio.play=(key,options)=>played.push({key,...options});
 const racers=[0,1].map(id=>({id,x:id*10,y:0,z:0,heading:0,character:{id:'mario'}}));
 const race={racers,player:racers[0]};audio.race=race;
 return {audio,played,race};
}
test('shell hit separates incoming impact, outgoing confirmation and self-hit',()=>{
 for(const [victim,attacker,expected] of [[0,1,['hit-green']],[1,0,['hit-green','shellConfirm']],[0,0,['hit-green']]]){
  const {audio,played,race}=scene();audio.event({type:'hit',racer:victim,attacker,cause:'green'},race);
  assert.deepEqual(played.map(p=>p.key),expected);
 }
});
test('distant owned shell confirms the hit without a nearby crash; other distant hits are silent',()=>{
 const {audio,played,race}=scene();race.racers[1].x=100;
 audio.event({type:'hit',racer:1,attacker:0,cause:'red'},race);
 assert.deepEqual(played.map(p=>p.key),['shellConfirm']);played.length=0;
 audio.event({type:'hit',racer:1,attacker:1,cause:'red'},race);
 assert.deepEqual(played,[]);
});

test('missing shell-specific samples retain the old audible crash for incoming shells',()=>{
 for(const cause of ['green','red','blue']){
  const {audio,played,race}=scene();audio.buffers.clear();
  audio.buffers.set('itemImpact',{});audio.buffers.set('hitConfirm',{});audio.buffers.set('hit',{});
  audio.event({type:'hit',racer:0,attacker:1,cause},race);
  assert.deepEqual(played.map(p=>p.key),['hit']);assert.equal(played[0].gain,1);
 }
});

test('inaudible suspended audio cannot hold the results screen indefinitely',()=>{
 const {audio}=scene();audio.finishCueUntil=20;audio.engine.ctx.state='running';assert.equal(audio.resultsReady,false);
 audio.engine.ctx.state='suspended';assert.equal(audio.resultsReady,true);
 audio.engine.ctx.state='running';audio.engine.ctx.currentTime=20;assert.equal(audio.resultsReady,true);
});


test('results follow the short finish sample, independently of the longer placement fanfare',()=>{
 const {audio,played,race}=scene();
 race.standings=race.racers;
 audio.buffers.set('finish',{duration:1.75});
 audio.buffers.set('finishWin',{duration:7});
 audio.engine.ctx.state='running';
 audio.event({type:'finish',racer:0},race);
 audio.engine.ctx.currentTime=11.749;assert.equal(audio.resultsReady,false);
 audio.engine.ctx.currentTime=11.75;assert.equal(audio.resultsReady,true);
 assert.ok(audio.finishUntil>audio.engine.ctx.currentTime,'Longer fanfare still plays');
 assert.deepEqual(played.map(p=>p.key),['finish','finishWin']);
});
