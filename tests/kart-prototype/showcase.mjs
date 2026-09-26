/** Silent, manually selected graphics demonstrations. These are presentation
 * stages, not historical checkouts. Assets load only when first requested. */
import * as THREE from 'three';
import {GLTFLoader} from '/vendor/three-examples/loaders/GLTFLoader.js';
import {clone as cloneRig} from '/vendor/three-examples/utils/SkeletonUtils.js';
import {RoomEnvironment} from '/vendor/three-examples/environments/RoomEnvironment.js';
import {EffectComposer} from '/vendor/three-examples/postprocessing/EffectComposer.js';
import {RenderPass} from '/vendor/three-examples/postprocessing/RenderPass.js';
import {GTAOPass} from '/vendor/three-examples/postprocessing/GTAOPass.js';
import {UnrealBloomPass} from '/vendor/three-examples/postprocessing/UnrealBloomPass.js';
import {OutputPass} from '/vendor/three-examples/postprocessing/OutputPass.js';
import {loadSourceWorld} from '/games/mario-kart/source-world.js';
import {addAtmosphere} from '/games/mario-kart/atmosphere.js';
import {stadiumBroadcast} from '/games/mario-kart/stadium-broadcast.js';

function roughMario(prototype) {
  const root=prototype.clone(true);
  const red=new THREE.MeshLambertMaterial({color:0xce272b});
  const blue=new THREE.MeshLambertMaterial({color:0x295794});
  const skin=new THREE.MeshLambertMaterial({color:0xeac29b});
  const white=new THREE.MeshLambertMaterial({color:0xe7e8e7});
  const brown=new THREE.MeshLambertMaterial({color:0x40281f});
  const yellow=new THREE.MeshLambertMaterial({color:0xe9bc49});
  // Keep the prototype proportions and deliberately basic geometry.
  root.traverse(o=>{
    if(!o.isMesh)return;
    const color=o.material.color.getHex();
    if(color===0xd2944a)o.material=red;
    if(color===0x759298)o.material=o.position.y<1.1?blue:red;
    if(color===0xc2c7ca){o.material=skin;o.scale.set(1.18,1.12,1.1);}
  });
  function mesh(geometry,material,x,y,z){const m=new THREE.Mesh(geometry,material);m.position.set(x,y,z);root.add(m);return m;}
  const box=(w,h,d,m,x,y,z)=>mesh(new THREE.BoxGeometry(w,h,d),m,x,y,z);
  const sphere=(r,m,x,y,z)=>mesh(new THREE.SphereGeometry(r,10,6),m,x,y,z);
  sphere(.34,red,0,2.18,.1).scale.y=.6;
  box(.56,.08,.38,red,0,2.12,-.15);
  sphere(.12,skin,0,1.97,-.23);
  box(.33,.075,.08,brown,0,1.85,-.2);
  for(const side of [-1,1]){
    sphere(.085,skin,side*.3,1.98,.1);
    box(.11,.13,.035,white,side*.125,2.02,-.185);
    box(.045,.085,.045,blue,side*.12,2.025,-.207);
    box(.13,.35,.05,blue,side*.2,1.35,-.062);
    sphere(.04,yellow,side*.2,1.25,-.1);
    sphere(.13,white,side*.4,1.15,-.38);
    box(.27,.16,.35,brown,side*.24,.94,-.58);
    box(.22,.14,1.45,blue,side*.67,.88,.1);
    const exhaust=mesh(new THREE.CylinderGeometry(.11,.13,.55,8),yellow,side*.57,.95,1.12);exhaust.rotation.x=Math.PI/2;
  }
  box(.48,.34,.08,blue,0,1.2,-.065);
  box(.36,.02,1.1,white,0,.918,-.45);
  return root;
}

function connectRearWheels(root) {
  const wheels=[2,3].map(i=>root.getObjectByName(`wheel-${i}`));
  if(wheels.some(w=>!w))throw new Error('Rear wheel mounts missing from Mario model');
  root.updateMatrixWorld(true);
  const hubs=wheels.map(w=>root.worldToLocal(w.getWorldPosition(new THREE.Vector3())));
  const gear=new THREE.Group();gear.name='showcase-rear-suspension';root.add(gear);
  const metal=new THREE.MeshStandardMaterial({color:0x818a96,metalness:.72,roughness:.3});
  const dark=new THREE.MeshStandardMaterial({color:0x303841,metalness:.45,roughness:.46});
  function strut(a,b,radius,material=metal){
    const delta=b.clone().sub(a),mesh=new THREE.Mesh(new THREE.CylinderGeometry(radius,radius,delta.length(),16),material);
    mesh.position.copy(a).add(b).multiplyScalar(.5);mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());gear.add(mesh);
  }
  // A continuous axle reaches into both hubs; paired arms tie it to the chassis.
  strut(hubs[0],hubs[1],.085,dark);
  const center=hubs[0].clone().add(hubs[1]).multiplyScalar(.5);
  const housing=new THREE.Mesh(new THREE.BoxGeometry(.38,.26,.38),dark);housing.position.copy(center).add(new THREE.Vector3(0,.09,-.07));gear.add(housing);
  for(const hub of hubs){
    const inner=hub.clone();inner.x*=.77;
    strut(inner,hub,.14);
    for(const offset of [-.2,.1]){
      const mount=new THREE.Vector3(hub.x*.15,hub.y+.08,hub.z+offset);
      strut(mount,inner,.055);
    }
    strut(new THREE.Vector3(hub.x*.15,hub.y+.08,hub.z-.08),new THREE.Vector3(hub.x*.15,hub.y+.16,hub.z-.6),.06);
  }
}

export function createShowcase(renderer,prototype,track) {
  const studio=new THREE.Scene();studio.background=new THREE.Color(0xb8bdc1);
  studio.fog=new THREE.Fog(0xb8bdc1,110,340);
  const camera=new THREE.PerspectiveCamera(35,innerWidth/innerHeight,.1,3000);
  const studioEye=new THREE.Vector3(4.3,2.8,-7.3),studioAim=new THREE.Vector3(0,1.12,0);
  // Stable course colors across lighting stages; don't mutate driving materials.
  const trackMaterials=new Map();
  track.traverse(o=>{if(o.isMesh){
    const unlit=m=>{if(!trackMaterials.has(m))trackMaterials.set(m,new THREE.MeshBasicMaterial({color:m.color,map:m.map,side:m.side,vertexColors:m.vertexColors}));return trackMaterials.get(m);};
    o.material=Array.isArray(o.material)?o.material.map(unlit):unlit(o.material);
  }});studio.add(track);
  const contactShadow=new THREE.Mesh(new THREE.PlaneGeometry(5.4,8),new THREE.ShadowMaterial({opacity:.3}));
  contactShadow.rotation.x=-Math.PI/2;contactShadow.position.y=.004;contactShadow.receiveShadow=true;contactShadow.visible=false;studio.add(contactShadow);
  const hemi=new THREE.HemisphereLight(0xf1f5ff,0x4e5360,2.1);studio.add(hemi);
  const key=new THREE.DirectionalLight(0xfff2df,2.3);key.position.set(-3,6,-4);key.castShadow=true;
  key.shadow.mapSize.set(2048,2048);Object.assign(key.shadow.camera,{left:-5,right:5,top:5,bottom:-5,near:.1,far:20});key.shadow.bias=-.00015;key.shadow.normalBias=.015;studio.add(key);
  const fill=new THREE.DirectionalLight(0xadcfff,.55);fill.position.set(4,3,1);studio.add(fill);
  const rim=new THREE.DirectionalLight(0xffffff,2);rim.position.set(-1,3,4);studio.add(rim);
  const basic=prototype.clone(true),rough=roughMario(prototype);
  // Keep every model fixed at the same road position while the camera orbits.
  const turntable=new THREE.Group();turntable.name='showcase-turntable';
  studio.add(turntable);turntable.add(basic,rough);rough.visible=false;
  const saved={toneMapping:renderer.toneMapping,exposure:renderer.toneMappingExposure,shadows:renderer.shadowMap.enabled,shadowType:renderer.shadowMap.type};
  const status=document.getElementById('showcase-status');
  let mode=0,ready=0,token=0,elapsed=0,modelPromise,worldPromise,environment,composer,renderPass,ao,course,courseScene,courseSun,broadcast;
  let polished,basicFinal;
  const models=[null,basic,rough];
  function environmentMap(){
    if(!environment){const pmrem=new THREE.PMREMGenerator(renderer),room=new RoomEnvironment();environment=pmrem.fromScene(room,.04);room.dispose();pmrem.dispose();}
    return environment.texture;
  }
  function postprocess(scene){
    if(!composer){
      const target=new THREE.WebGLRenderTarget(innerWidth,innerHeight,{type:THREE.HalfFloatType,samples:4});
      composer=new EffectComposer(renderer,target);renderPass=new RenderPass(scene,camera);composer.addPass(renderPass);
      ao=new GTAOPass(scene,camera,innerWidth,innerHeight);
      ao.updateGtaoMaterial({radius:2.2,thickness:1.1,distanceExponent:1.5,samples:8});
      ao.updatePdMaterial({radius:4,samples:8,depthPhi:3,normalPhi:3});ao.blendIntensity=.6;composer.addPass(ao);
      composer.addPass(new UnrealBloomPass(new THREE.Vector2(innerWidth,innerHeight),.18,.4,2.1));
      const output=new OutputPass();output.material.fragmentShader=output.material.fragmentShader.replace('gl_FragColor = texture2D( tDiffuse, vUv );','gl_FragColor = vec4(texture2D( tDiffuse, vUv ).rgb, 1.0);');composer.addPass(output);
    }
    renderPass.scene=scene;ao.scene=scene;
  }
  async function loadModel(){
    if(!modelPromise)modelPromise=(async()=>{
      const gltf=await new GLTFLoader().loadAsync('/assets/mario-kart/mario-source.glb');
      polished=gltf.scene;
      connectRearWheels(polished);
      polished.traverse(o=>{if(o.isMesh){o.castShadow=o.receiveShadow=true;for(const m of [].concat(o.material))if(m.map)m.map.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());}});
      // Preserve the current production source rig and authored materials.
      // Anchor the tires on the same floor as the prototype, without posing bones.
      const bounds=new THREE.Box3().setFromObject(polished),size=bounds.getSize(new THREE.Vector3());
      const scale=2.25/size.y;polished.scale.multiplyScalar(scale);
      const aligned=new THREE.Box3().setFromObject(polished),center=aligned.getCenter(new THREE.Vector3());
      polished.position.add(new THREE.Vector3(-center.x,-aligned.min.y,-center.z));
      basicFinal=cloneRig(polished);
      const materialPool=new Map();
      basicFinal.traverse(o=>{
        if(!o.isMesh)return;o.castShadow=o.receiveShadow=false;
        const flatten=m=>{if(!materialPool.has(m))materialPool.set(m,new THREE.MeshLambertMaterial({color:m.color,map:m.map,side:m.side,transparent:m.transparent,opacity:m.opacity,alphaTest:m.alphaTest,vertexColors:m.vertexColors}));return materialPool.get(m);};
        o.material=Array.isArray(o.material)?o.material.map(flatten):flatten(o.material);
      });
      polished.visible=basicFinal.visible=false;turntable.add(polished,basicFinal);models[3]=basicFinal;models[4]=polished;
    })().catch(e=>{modelPromise=null;throw e;});
    await modelPromise;
  }
  async function loadCourse(){
    if(!worldPromise)worldPromise=(async()=>{
      courseScene=new THREE.Scene();courseScene.background=new THREE.Color('#081325');courseScene.fog=new THREE.FogExp2('#111c30',.0011);
      courseScene.environment=environmentMap();courseScene.environmentIntensity=.28;
      courseScene.add(new THREE.HemisphereLight('#a5c8f4','#34384a',.29));
      courseSun=new THREE.DirectionalLight('#fff3dd',1.7);courseSun.position.set(-60,160,40);courseSun.castShadow=true;
      courseSun.shadow.mapSize.set(2048,2048);Object.assign(courseSun.shadow.camera,{left:-55,right:55,top:55,bottom:-55,near:1,far:350});courseSun.shadow.bias=-.00035;courseSun.shadow.normalBias=.025;
      courseScene.add(courseSun,courseSun.target);
      const light=new THREE.DirectionalLight('#77baff',.32);light.position.set(-80,70,20);courseScene.add(light);
      const response=await fetch('/assets/mario-kart/manifest.json');if(!response.ok)throw new Error('Local asset manifest unavailable');
      const manifest=await response.json();if(!manifest.course)throw new Error('Local stadium pack unavailable');
      course=await loadSourceWorld(courseScene,manifest.course);
      addAtmosphere(courseScene);
      broadcast=stadiumBroadcast(renderer,courseScene,course.screenMaterials,{width:768,height:432});
    })().catch(e=>{worldPromise=null;throw e;});
    await worldPromise;
  }
  async function select(next){
    const request=++token;mode=next;ready=0;elapsed=0;
    turntable.rotation.y=0;
    document.body.classList.toggle('showcase',mode!==0);
    status.hidden=mode===0;
    if(!mode){renderer.toneMapping=saved.toneMapping;renderer.toneMappingExposure=saved.exposure;renderer.shadowMap.enabled=saved.shadows;renderer.shadowMap.type=saved.shadowType;return;}
    status.textContent=next===5?'Loading stadium…':next>=3?'Loading Mario…':'';status.hidden=next<3;
    try{
      if(next>=3&&next<=4)await loadModel();
      if(next===5)await loadCourse();
      if(request!==token)return;
      for(let i=1;i<models.length;i++)if(models[i])models[i].visible=i===next;
      const finished=next>=4;
      renderer.toneMapping=THREE.NeutralToneMapping;renderer.toneMappingExposure=1.05;
      renderer.shadowMap.enabled=finished;renderer.shadowMap.type=THREE.PCFShadowMap;
      studio.environment=finished?environmentMap():null;studio.environmentIntensity=.65;
      hemi.intensity=finished?.65:2.1;key.intensity=finished?3:1.2;fill.visible=rim.visible=finished;
      contactShadow.visible=finished;
      if(finished)postprocess(next===5?courseScene:studio);
      camera.fov=next===5?52:35;camera.up.set(0,1,0);camera.position.copy(studioEye);camera.lookAt(studioAim);camera.updateProjectionMatrix();
      ready=next;status.hidden=true;
    }catch(error){
      if(request!==token)return;
      status.textContent=`Could not load this stage. ${error.message}. Press the number to retry, or 0 to drive.`;status.hidden=false;
    }
  }
  function sample(fraction){
    const points=course.route.points,t=((fraction%1+1)%1)*(points.length-1),i=Math.floor(t);
    return {p:new THREE.Vector3().fromArray(points[i].p).lerp(new THREE.Vector3().fromArray(points[i+1].p),t-i),n:new THREE.Vector3().fromArray(points[i].n).lerp(new THREE.Vector3().fromArray(points[i+1].n),t-i).normalize()};
  }
  function cinematic(time){
    const duration=9,shot=Math.floor(time/duration)%4,u=(time%duration)/duration;
    const ease=u*u*(3-2*u),eye=new THREE.Vector3(),aim=new THREE.Vector3();
    camera.up.set(0,1,0);
    if(shot===0){ // Stadium establishing crane, looking across the finish straight.
      eye.set(110-ease*15,115+ease*5,120-ease*10);aim.set(-90,75,15);camera.fov=60;
    }else if(shot===1){ // Low dolly along the finish/start straight.
      const f=.967+ease*.048,p=sample(f),ahead=sample(f+.035);
      eye.copy(p.p).addScaledVector(p.n,2.7);aim.copy(ahead.p).addScaledVector(ahead.n,2.3);camera.fov=57;
    }else if(shot===2){ // High oblique orbit over the opening curve.
      const p=sample(.17),angle=-.7+ease*.45;
      eye.copy(p.p).add(new THREE.Vector3(Math.sin(angle)*85,82,Math.cos(angle)*85));aim.copy(p.p);camera.fov=49;
    }else{ // Outside the banked antigravity climb, following its rising ribbon.
      const p=sample(.55+ease*.13);eye.copy(p.p).add(new THREE.Vector3(140,40,100));aim.copy(p.p).add(new THREE.Vector3(0,5,0));camera.fov=55;
    }
    camera.position.copy(eye);camera.lookAt(aim);camera.updateProjectionMatrix();
    courseSun.target.position.copy(aim);courseSun.position.copy(aim).add(new THREE.Vector3(-60,150,40));
    course.update(time);
    broadcast.update(performance.now(),camera);
    return shot;
  }
  let shot=0;
  return {
    select,
    get mode(){return mode;},get ready(){return ready;},get shot(){return shot;},
    render(dt){
      if(!mode)return;
      if(ready!==mode){renderer.setClearColor(0x899299);renderer.clear();return;}
      elapsed+=dt;
      if(mode===5)shot=cinematic(elapsed);
      else{
        // Brief front-view hold, then one smooth eight-second camera orbit.
        // Both the kart and track stay fixed. Selecting a stage restarts the orbit.
        const progress=THREE.MathUtils.clamp((elapsed-.35)/8,0,1);
        const angle=2*Math.PI*progress*progress*(3-2*progress);
        camera.position.copy(studioEye).sub(studioAim).applyAxisAngle(THREE.Object3D.DEFAULT_UP,angle).add(studioAim);
        camera.lookAt(studioAim);
      }
      if(mode>=4)composer.render(dt);else renderer.render(studio,camera);
    },
    resize(){camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();composer?.setSize(innerWidth,innerHeight);},
  };
}
