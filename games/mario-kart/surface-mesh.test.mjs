import test from 'node:test';
import assert from 'node:assert/strict';
import {createMeshSurface} from './surface-mesh.js';
import {createSurfaceTrack} from './surface-track.js';

test('physical travel continues through an outside corner with a fixed nearest route vertex',()=>{
  const data={length:40,antiStart:50,antiEnd:60,gapStart:50,gapEnd:60,
    points:[[0,0],[0,-10],[10,-10],[10,0],[0,0]].map(([x,z],i)=>({s:i*10,p:[x,0,z],n:[0,1,0]})),
    roadMesh:{p:[-20,0,-30,30,0,-30,30,0,20,-20,0,20],n:[0,1,0,0,1,0,0,1,0,0,1,0],i:[0,1,2,0,2,3],road:[1,1]}};
  const track=createSurfaceTrack(data),r={x:-4,y:0,z:-14,s:10,lateral:-Math.sqrt(32),heading:Math.PI/2};
  // The nearest centerline point is the same corner vertex throughout these
  // two metres. It measures progress, but must not constrain physical travel.
  for(let i=0;i<120;i++)Object.assign(r,track.advance(r,0,2/120));
  assert.ok(Math.abs(r.x-(-2))<1e-10);
  assert.ok(Math.abs(r.z-(-14))<1e-10);
  assert.ok(Math.abs(r.s-10)<1e-10);
  const before={...r},right=track.at(r.s).right;
  const corrected=track.constrainLateral(r,r.lateral+1);
  // A wall may remove the lateral component only; the traveled coordinate
  // along the corner's bisector remains intact.
  assert.ok(Math.abs(corrected.x-(before.x+right.x))<1e-10);
  assert.ok(Math.abs(corrected.z-(before.z+right.z))<1e-10);
});

test('triangle support matches an independently specified sloped plane',()=>{
  // y = x / 5, with no dependency on the track's frame/project calculation.
  const n=[-1/Math.sqrt(26),5/Math.sqrt(26),0];
  const mesh=createMeshSurface({p:[-5,-1,-5,5,1,-5,5,1,5,-5,-1,5],n:[...n,...n,...n,...n],i:[0,1,2,0,2,3],road:[1,1]});
  for(const x of [-4,-1,0,2,4]){const p=mesh.sample({x,y:0,z:1},{x:0,y:1,z:0});assert.ok(Math.abs(p.y-x/5)<1e-10);assert.ok(Math.abs(p.normal.y-5/Math.sqrt(26))<1e-10);}
  assert.equal(mesh.sample({x:6,y:0,z:1},{x:0,y:1,z:0}),null);
});

test('raised paint wins over its asphalt, while a separate deck stays separate',()=>{
  const data={p:[],n:[],i:[],road:[],boost:[]};
  for(const [y,boost] of [[0,0],[.006,1],[4,0]]){
    const first=data.p.length/3;data.p.push(-5,y,-5,5,y,-5,5,y,5,-5,y,5);data.n.push(0,1,0,0,1,0,0,1,0,0,1,0);data.i.push(first,first+1,first+2,first,first+2,first+3);data.road.push(1,1);data.boost.push(boost,boost);
  }
  const hit=createMeshSurface(data).sample({x:0,y:0,z:0},{x:0,y:1,z:0});assert.ok(Math.abs(hit.y-.006)<1e-10);assert.equal(hit.onBoost,true);
});

test('road bounds join a narrow divider but preserve a separate road branch',()=>{
  const data={p:[],n:[],i:[],road:[]};
  for(const [left,right] of [[-10,-.2],[.2,10],[20,26]]){
    const first=data.p.length/3;data.p.push(left,0,-5,right,0,-5,right,0,5,left,0,5);data.n.push(0,1,0,0,1,0,0,1,0,0,1,0);data.i.push(first,first+1,first+2,first,first+2,first+3);data.road.push(1,1);
  }
  assert.deepEqual(createMeshSurface(data).limits({x:0,y:0,z:0},{x:0,y:1,z:0},{x:1,y:0,z:0},{x:0,y:0,z:-1}),[[-10,10],[20,26]]);
});

test('driving bounds stay on the centerline branch when a kart approaches an isolated strip',()=>{
  const roadMesh={p:[],n:[],i:[],road:[]};
  for(const [left,right] of [[-10,10],[20,26]]){
    const v=roadMesh.p.length/3;roadMesh.p.push(left,0,-25,right,0,-25,right,0,5,left,0,5);roadMesh.n.push(0,1,0,0,1,0,0,1,0,0,1,0);roadMesh.i.push(v,v+1,v+2,v,v+2,v+3);roadMesh.road.push(1,1);
  }
  const track=createSurfaceTrack({length:40,points:[[0,0],[0,-10],[0,-20],[0,-10],[0,0]].map(([x,z],i)=>({s:i*10,p:[x,0,z],n:[0,1,0]})),antiStart:50,antiEnd:60,gapStart:50,gapEnd:60,roadMesh});
  assert.deepEqual(track.bounds(10,24),{min:-10,max:10});
  // Runtime road contact uses physical position even when route coordinates
  // would reconstruct a supported centerline point.
  assert.equal(track.onRoad(10,0,{x:15,y:0,z:-10}),false);
});

test('3D steering direction survives camber that passes vertical',()=>{
  const nx=Math.sqrt(1-.03**2),ny=-.03,normal=[nx,ny,0];
  // A plane extending along Z, with a surface normal just past vertical.
  const p=[.3,10*nx,5,-.3,-10*nx,5,-.3,-10*nx,-25,.3,10*nx,-25];
  const center=[Math.sqrt(1-.05**2),.05,0];
  const data={length:40,points:[{s:0,p:[0,0,0],n:center},{s:10,p:[0,0,-10],n:center},{s:20,p:[0,0,-20],n:center},{s:30,p:[0,0,-10],n:center},{s:40,p:[0,0,0],n:center}],antiStart:0,antiEnd:40,gapStart:50,gapEnd:60,roadMesh:{p,n:[...normal,...normal,...normal,...normal],i:[0,1,2,0,2,3],road:[1,1]}};
  const track=createSurfaceTrack(data),r={...track.surface(5,0),heading:0,lateral:0};
  const turned=track.advance(r,.2,.1);
  // Rotation of a -Z direction by -.2 radians about (nx,ny,0).
  const expected={x:ny*Math.sin(.2),y:-nx*Math.sin(.2),z:-Math.cos(.2)};
  for(const k of ['x','y','z'])assert.ok(Math.abs(turned.surfaceForward[k]-expected[k])<1e-8);
  const straight=track.advance({...r,...turned},0,.1);
  for(const k of ['x','y','z'])assert.ok(Math.abs(straight.surfaceForward[k]-expected[k])<1e-8,'Zero steering must not reverse the direction after crossing vertical');
});
