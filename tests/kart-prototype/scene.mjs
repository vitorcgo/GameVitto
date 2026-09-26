import * as THREE from 'three';
import {GameLink} from '/core/net.js';
import {WheelInput} from '/games/mario-kart/input.js';
import {Prototype,routeAt,trackLength,clamp,RAMP} from './physics.mjs';
const $=id=>document.getElementById(id),config=await fetch('/api/test').then(r=>r.json());
const sim=new Prototype(),keys=new Set();
document.title='Test';
$('controls').textContent='2 GAS · TILT STEER · A DRIFT · RELEASE A TO BOOST';
$('qr').src=config.qr;$('phone-url').href=config.url;$('phone-url').textContent=config.url;
const renderer=new THREE.WebGLRenderer({canvas:$('scene'),antialias:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setSize(innerWidth,innerHeight);
renderer.setClearColor(0xb8bdc1);renderer.outputColorSpace=THREE.SRGBColorSpace;
const scene=new THREE.Scene();scene.fog=new THREE.Fog(0xb8bdc1,110,340);
scene.add(new THREE.HemisphereLight(0xffffff,0x6c7277,2.5));
const sun=new THREE.DirectionalLight(0xffffff,2);sun.position.set(-30,70,25);scene.add(sun);
const camera=new THREE.PerspectiveCamera(55,innerWidth/innerHeight,.1,700);
const mat=color=>new THREE.MeshLambertMaterial({color});
const materials={road:mat(0x656b70),ground:mat(0xa0a7ac),paint:mat(0xd2944a),body:mat(0x759298),rubber:mat(0x292c2f),metal:mat(0x989fa4),head:mat(0xc2c7ca)};
const ground=new THREE.Mesh(new THREE.PlaneGeometry(1800,1800),materials.ground);ground.rotation.x=-Math.PI/2;ground.position.y=-.04;scene.add(ground);
const grid=new THREE.GridHelper(1200,120,0x8d959a,0x969ea3);grid.position.y=-.02;scene.add(grid);
function ribbon(inner,outer,color,y){
 const vertices=[],length=trackLength(sim.config),n=Math.ceil(length/2);
 for(let i=0;i<n;i++){
  const points=[routeAt(i/n*length,sim.config),routeAt((i+1)/n*length,sim.config)];
  const v=points.flatMap(p=>[inner,outer].map(offset=>[p.x+Math.cos(p.heading)*offset,y,p.z+Math.sin(p.heading)*offset]));
  for(const j of [0,2,1,1,2,3])vertices.push(...v[j]);
 }
 const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geo.computeVertexNormals();
 const mesh=new THREE.Mesh(geo,new THREE.MeshLambertMaterial({color,side:THREE.DoubleSide}));scene.add(mesh);
}
const half=sim.config.halfWidth;
ribbon(-half,half,0x656b70,.02);ribbon(-half-.45,-half,0xd09b58,.04);ribbon(half,half+.45,0x7db8c3,.04);
for(let s=0;s<trackLength(sim.config);s+=10){
 const p=routeAt(s,sim.config),dash=new THREE.Mesh(new THREE.PlaneGeometry(.22,3),mat(0xa6adb1));
 dash.rotation.set(-Math.PI/2,0,p.heading);dash.position.set(p.x,.035,p.z);scene.add(dash);
}
// A few plain survey posts make motion readable. No scenery or branded assets.
for(let s=0;s<trackLength(sim.config);s+=32){
 const p=routeAt(s,sim.config),post=new THREE.Mesh(new THREE.BoxGeometry(.25,1.25,.25),materials.metal);
 post.position.set(p.x+Math.cos(p.heading)*(half+2),.625,p.z+Math.sin(p.heading)*(half+2));scene.add(post);
}
// Untextured launch wedge across the return straight.
const rampVertices=[],rx=-sim.config.radius;
const corners=[[rx-half,.025,RAMP.start],[rx+half,.025,RAMP.start],[rx-half,RAMP.height,RAMP.end],[rx+half,RAMP.height,RAMP.end]];
for(const i of [0,1,2,1,3,2])rampVertices.push(...corners[i]);
const rampGeo=new THREE.BufferGeometry();rampGeo.setAttribute('position',new THREE.Float32BufferAttribute(rampVertices,3));rampGeo.computeVertexNormals();
scene.add(new THREE.Mesh(rampGeo,new THREE.MeshLambertMaterial({color:0x929da5,side:THREE.DoubleSide})));
const lip=new THREE.Mesh(new THREE.BoxGeometry(half*2,.12,.55),mat(0x83cbd5));lip.position.set(rx,RAMP.height+.03,RAMP.end);scene.add(lip);
for(const x of [rx-half,rx+half]){
 const sideGeo=new THREE.BufferGeometry();sideGeo.setAttribute('position',new THREE.Float32BufferAttribute([x,0,RAMP.start,x,RAMP.height,RAMP.end,x,0,RAMP.end],3));sideGeo.computeVertexNormals();scene.add(new THREE.Mesh(sideGeo,new THREE.MeshLambertMaterial({color:0x77848d,side:THREE.DoubleSide})));
}
// Keep an exact copy of the static test course for the graphics showcase.
const showcaseTrack=new THREE.Group();showcaseTrack.name='prototype-track-backdrop';
for(const object of scene.children)if(!object.isLight)showcaseTrack.add(object.clone(true));
// Place the display kart near the outside curb before the broad return bend.
showcaseTrack.position.set(-(sim.config.radius+half-2.8),-.02,-(sim.config.straight-20));
const kart=new THREE.Group();kart.rotation.order='YXZ';scene.add(kart);
function box(w,h,d,material,x,y,z){const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);mesh.position.set(x,y,z);kart.add(mesh);return mesh;}
box(1.45,.4,2.25,materials.paint,0,.65,0);box(1.35,.12,.75,materials.paint,0,.84,-.68);
box(.8,.55,.55,materials.rubber,0,1,.35);box(.63,.65,.4,materials.body,0,1.33,.16);
const head=new THREE.Mesh(new THREE.SphereGeometry(.27,10,8),materials.head);head.position.set(0,1.99,.1);kart.add(head);
for(const side of [-1,1]){
 const arm=box(.18,.48,.19,materials.body,side*.39,1.32,-.16);arm.rotation.x=-.8;
 box(.22,.23,.65,materials.body,side*.24,.98,-.25);
}
const steeringWheel=new THREE.Mesh(new THREE.TorusGeometry(.28,.04,5,12),materials.rubber);steeringWheel.position.set(0,1.3,-.55);steeringWheel.rotation.x=-.6;kart.add(steeringWheel);
const wheelPivots=[],tires=[];
for(const x of [-.94,.94])for(const z of [-.76,.8]){
 const pivot=new THREE.Group();pivot.position.set(x,.43,z);kart.add(pivot);
 const tire=new THREE.Mesh(new THREE.CylinderGeometry(.43,.43,.32,10),materials.rubber);tire.rotation.z=Math.PI/2;pivot.add(tire);
 const hub=new THREE.Mesh(new THREE.CylinderGeometry(.2,.2,.34,8),materials.metal);hub.rotation.z=Math.PI/2;tire.add(hub);hub.rotation.z=0;
 wheelPivots.push({pivot,front:z<0});tires.push(tire);
}
// Freeze the exact prototype before its wheels, flight pose or effects animate.
const showcasePrototype=kart.clone(true);
// Low-poly canopy and four suspension lines, all built from basic geometry.
const parachute=new THREE.Group();kart.add(parachute);
const canopy=new THREE.Mesh(new THREE.SphereGeometry(2.7,12,4,0,Math.PI*2,0,Math.PI/2),new THREE.MeshLambertMaterial({color:0x80bbc4,side:THREE.DoubleSide,flatShading:true}));
canopy.scale.y=.42;canopy.position.y=3.8;parachute.add(canopy);
for(const x of [-1.9,1.9])for(const z of [-1.9,1.9]){
 const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(x,3.8,z),new THREE.Vector3(Math.sign(x)*.55,1,Math.sign(z)*.6)]),new THREE.LineBasicMaterial({color:0x353e45}));parachute.add(line);
}
let canopyOpen=0;parachute.visible=false;
const shadow=new THREE.Mesh(new THREE.CircleGeometry(1.75,16),new THREE.MeshBasicMaterial({color:0x24292c,transparent:true,opacity:.22,depthWrite:false}));shadow.rotation.x=-Math.PI/2;scene.add(shadow);
const flames=new THREE.Group();kart.add(flames);
for(const x of [-.45,.45]){
 const flame=new THREE.Mesh(new THREE.ConeGeometry(.23,1.1,5),new THREE.MeshBasicMaterial({color:0xf7a94e}));flame.rotation.x=Math.PI/2;flame.position.set(x,.65,1.6);flames.add(flame);
}
flames.visible=false;
const sparkGeo=new THREE.BoxGeometry(.07,.07,.19),sparks=new THREE.InstancedMesh(sparkGeo,new THREE.MeshBasicMaterial({color:0xffffff}),96);
sparks.instanceMatrix.setUsage(THREE.DynamicDrawUsage);sparks.frustumCulled=false;scene.add(sparks);
const particleState=Array.from({length:96},()=>({life:0})),dummy=new THREE.Object3D();let particleIndex=0,particleClock=0;
const skids=new THREE.InstancedMesh(new THREE.PlaneGeometry(.23,.65),new THREE.MeshBasicMaterial({color:0x373d42,transparent:true,opacity:.7,depthWrite:false}),320);
skids.instanceMatrix.setUsage(THREE.DynamicDrawUsage);skids.frustumCulled=false;scene.add(skids);let skidIndex=0,skidClock=0;
for(let i=0;i<320;i++){dummy.position.set(0,-10,0);dummy.scale.setScalar(1);dummy.updateMatrix();skids.setMatrixAt(i,dummy.matrix);}
const sparkColor=new THREE.Color(),colors=[0x9bbcc9,0x5bc7ff,0xffae48,0xcd87ff];
function rear(side){return new THREE.Vector3(side*.9,.25,.8).applyAxisAngle(new THREE.Vector3(0,1,0),kart.rotation.y).add(kart.position);}
function effects(dt){
 particleClock+=dt;skidClock+=dt;
 if(sim.drift&&particleClock>.025){particleClock=0;for(const side of [-1,1]){const p=rear(side);Object.assign(particleState[particleIndex++%96],{life:.3,x:p.x,y:p.y,z:p.z,vx:side*2-Math.sin(sim.heading)*4,vz:Math.cos(sim.heading)*4,vy:2+Math.random()*2,color:colors[sim.tier]});}}
 if(sim.drift&&skidClock>.025){skidClock=0;for(const side of [-1,1]){const p=rear(side);dummy.position.set(p.x,.048,p.z);dummy.rotation.set(-Math.PI/2,0,-kart.rotation.y);dummy.scale.setScalar(1);dummy.updateMatrix();skids.setMatrixAt(skidIndex++%320,dummy.matrix);}skids.instanceMatrix.needsUpdate=true;}
 particleState.forEach((p,i)=>{
  p.life-=dt;if(p.life>0){p.x+=p.vx*dt;p.y+=p.vy*dt;p.z+=p.vz*dt;p.vy-=12*dt;dummy.position.set(p.x,p.y,p.z);dummy.scale.setScalar(p.life/.3);}
  else{dummy.position.set(0,-10,0);dummy.scale.setScalar(0);}
  dummy.rotation.set(0,sim.time*8,0);dummy.updateMatrix();sparks.setMatrixAt(i,dummy.matrix);sparks.setColorAt(i,sparkColor.setHex(p.color||colors[0]));
 });sparks.instanceMatrix.needsUpdate=true;sparks.instanceColor.needsUpdate=true;
 flames.visible=sim.boost>0;flames.scale.z=1+Math.sin(sim.time*65)*.18;
}
const wheel=new WheelInput({invert:localStorage.getItem('gamevitto.chargeInvert2')==='1'});let connected=false,everConnected=false,paused=false;
const link=new GameLink({
 onOrientation:(sample,slot)=>{if(slot===0)wheel.sample(sample,performance.now(),{canCapture:Math.abs(sim.speed)<.5});},
 onCommand:(cmd,slot)=>{
  if(slot!==0)return;wheel.command(cmd,performance.now());
  if(['calibrate','recentre'].includes(cmd.type))recenter();
  if(cmd.type==='home')reset();
 },
 onPresence:p=>{connected=!!p.controller;if(connected){everConnected=true;$('pairing').hidden=true;}else{wheel.release();if(everConnected){sim.speed=0;sim.input={};}}}
});
function recenter(){wheel.reset();if(!sim.airborne)sim.speed=0;}
function reset(){sim.reset();canopyOpen=0;keys.clear();wheel.release();particleState.forEach(p=>p.life=0);for(let i=0;i<320;i++){dummy.position.set(0,-10,0);dummy.updateMatrix();skids.setMatrixAt(i,dummy.matrix);}skids.instanceMatrix.needsUpdate=true;cameraReady=false;}
function togglePairing(){$('pairing').hidden=!$('pairing').hidden;}
function fullscreen(){if(document.fullscreenElement)document.exitFullscreen();else document.documentElement.requestFullscreen().catch(()=>{});}
let showcase,showcasePromise,showcaseMode=0;
async function selectShowcase(mode){
 showcaseMode=mode;keys.clear();wheel.release();sim.input={gas:false,steer:0,drift:false};
 if(!mode){showcase?.select(0);document.body.classList.remove('showcase');$('showcase-status').hidden=true;renderer.setClearColor(0xb8bdc1);cameraReady=false;return;}
 document.body.classList.add('showcase');$('showcase-status').textContent='Loading showcase…';$('showcase-status').hidden=false;
 try{
  showcasePromise??=import('./showcase.mjs').then(({createShowcase})=>showcase=createShowcase(renderer,showcasePrototype,showcaseTrack)).catch(error=>{showcasePromise=null;throw error;});
  await showcasePromise;
  if(showcaseMode===mode)await showcase.select(mode);
 }catch(error){if(showcaseMode===mode){$('showcase-status').textContent=`Showcase unavailable: ${error.message}. Press 0 to drive.`;$('showcase-status').hidden=false;}}
}
$('reset').onclick=reset;$('recenter').onclick=recenter;$('pair').onclick=togglePairing;$('hide-pairing').onclick=togglePairing;$('full').onclick=fullscreen;
window.addEventListener('keydown',e=>{
 if(['ArrowLeft','ArrowRight','Space','ShiftLeft','ShiftRight'].includes(e.code))e.preventDefault();
 keys.add(e.code);if(e.repeat)return;
 if(/^(Digit|Numpad)[0-5]$/.test(e.code)){e.preventDefault();selectShowcase(Number(e.code.at(-1)));return;}
 if(e.code==='KeyR')reset();if(e.code==='KeyP')togglePairing();if(e.code==='KeyF')fullscreen();
 if(e.code==='KeyI'){wheel.invert=!wheel.invert;localStorage.setItem('gamevitto.chargeInvert2',wheel.invert?'1':'0');}
});
window.addEventListener('keyup',e=>keys.delete(e.code));
window.addEventListener('blur',()=>keys.clear());
document.addEventListener('visibilitychange',()=>{paused=document.hidden;if(paused){keys.clear();wheel.release();}});
let previous=performance.now(),frames=0,frameMark=previous,cameraReady=false;
const eye=new THREE.Vector3(),aim=new THREE.Vector3(),targetEye=new THREE.Vector3(),targetAim=new THREE.Vector3();
function frame(now){
 requestAnimationFrame(frame);const elapsed=Math.max(0,(now-previous)/1000),dt=Math.min(.05,elapsed);previous=now;
 if(showcaseMode){if(showcase)showcase.render(paused?0:Math.min(.25,elapsed));return;}
 const remote=wheel.read(now),keyboard=['KeyZ','KeyX','ArrowLeft','ArrowRight'].some(k=>keys.has(k));
 const phoneReady=connected&&remote.live&&wheel.armed;
 const input={gas:keys.has('KeyZ')||(phoneReady&&remote.gas),brake:keys.has('KeyX')||(phoneReady&&remote.brake),drift:keys.has('ShiftLeft')||keys.has('ShiftRight')||(phoneReady&&remote.drift),steer:keyboard?Number(keys.has('ArrowRight'))-Number(keys.has('ArrowLeft')):phoneReady?remote.steer:0};
 const blocked=paused||(connected&&!phoneReady&&!keyboard);
 if(!blocked)sim.update(dt,input);else sim.input={gas:false,steer:0,drift:false};
 kart.position.set(sim.x,sim.y+(sim.hop>0?Math.sin((.3-sim.hop)/.3*Math.PI)*.3:0)-Math.sin(sim.landing/.25*Math.PI)*.12,sim.z);
 kart.rotation.y=-sim.heading-sim.drift*.32;
 const pitch=sim.airborne?Math.atan2(sim.vy,Math.max(12,sim.speed)):(sim.y>0?Math.atan2(RAMP.height,RAMP.end-RAMP.start):0);
 kart.rotation.x+=(pitch-kart.rotation.x)*(1-Math.exp(-dt*9));
 canopyOpen+=((sim.airborne&&sim.flightAge>.18?1:0)-canopyOpen)*(1-Math.exp(-dt*10));
 parachute.visible=canopyOpen>.02;parachute.scale.set(canopyOpen,.3+.7*canopyOpen,canopyOpen);

 for(const {pivot,front} of wheelPivots)if(front)pivot.rotation.y=-sim.steer*.4+sim.drift*.4;
 for(const tire of tires)tire.rotation.x-=sim.speed*dt/.43;
 shadow.position.set(sim.x,.055,sim.z);shadow.scale.setScalar(1+sim.y*.035);shadow.material.opacity=.22/(1+sim.y*.1);effects(blocked?0:dt);
 const back=10.5+canopyOpen*3;
 targetEye.set(sim.x-Math.sin(sim.heading)*back,sim.y+6.1+canopyOpen,sim.z+Math.cos(sim.heading)*back);
 targetAim.set(sim.x+Math.sin(sim.heading)*6,sim.y+1.05+canopyOpen,sim.z-Math.cos(sim.heading)*6);
 if(!cameraReady){eye.copy(targetEye);aim.copy(targetAim);cameraReady=true;}
 else{eye.lerp(targetEye,1-Math.exp(-dt*8));aim.lerp(targetAim,1-Math.exp(-dt*10));}
 camera.position.copy(eye);camera.lookAt(aim);camera.fov+=(55+(sim.boost>0?5:0)-camera.fov)*(1-Math.exp(-dt*7));camera.updateProjectionMatrix();
 $('speed').textContent=Math.abs(sim.speed).toFixed(1);$('gas').textContent=input.gas?'ON':'OFF';
 $('steer').textContent=(input.steer>=0?'+':'')+input.steer.toFixed(2);$('steering-dot').style.left=(50+input.steer*50)+'%';
 $('drift').textContent=sim.drift?(sim.drift<0?'LEFT':'RIGHT'):'OFF';$('charge').textContent=sim.charge.toFixed(2);
 $('charge-fill').style.width=clamp(sim.charge/3.4*100,0,100)+'%';$('charge-fill').style.background='#'+colors[sim.tier].toString(16);
 $('boost').textContent=sim.boost.toFixed(2)+' s';$('boost-label').hidden=sim.boost<=0;
 $('altitude').textContent=sim.y.toFixed(1)+' m';$('parachute').textContent=sim.airborne?(sim.flightAge>.18?'OPEN':'DEPLOYING'):'STOWED';
 $('connection').textContent=connected?'PHONE CONNECTED':everConnected?'PHONE DISCONNECTED':'PHONE OFFLINE';
 $('packets').textContent=Math.round(connected?link.rate:0)+' Hz';
 $('status').textContent=blocked?(paused?'TEST PAUSED':remote.status):connected?(sim.airborne?(sim.flightAge>.18?'PARACHUTE OPEN · Tilt to steer':'JUMP · Deploying parachute'):sim.y>0?'RAMP · Keep holding 2':'Steer · Drift through the curve · Jump on the next straight'):everConnected?'Phone disconnected · reconnect or use keyboard':'Connect phone or use Z + arrow keys';
 if(++frames&&now-frameMark>500){$('fps').textContent=Math.round(frames*1000/(now-frameMark))+' fps';frames=0;frameMark=now;}
 renderer.render(scene,camera);
}
window.addEventListener('resize',()=>{renderer.setSize(innerWidth,innerHeight);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();showcase?.resize();});
if(new URLSearchParams(location.search).has('evidence'))window.__prototype={sim,wheel,link,renderer,get connected(){return connected;},get showcase(){return showcase;},get showcaseMode(){return showcaseMode;}};
requestAnimationFrame(frame);
