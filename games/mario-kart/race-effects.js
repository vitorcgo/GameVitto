import * as T from 'three';
/** World-space, bounded pools. Surface frames keep tire friction attached to
 * the road on banking; shard facets and glints share the box contact origin. */
export function raceEffects(scene,random=Math.random){
 const tireState=new WeakMap();
 const count=1200,particles=Array.from({length:count},()=>({life:0}));let cursor=0;
 const positions=new Float32Array(count*3),colors=new Float32Array(count*3),sizes=new Float32Array(count),alphas=new Float32Array(count),kinds=new Float32Array(count),velocities=new Float32Array(count*3);
 const geometry=new T.BufferGeometry();
 for(const [name,array,size] of [['position',positions,3],['color',colors,3],['size',sizes,1],['alpha',alphas,1],['kind',kinds,1],['velocity',velocities,3]])geometry.setAttribute(name,new T.BufferAttribute(array,size));
 const material=new T.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{viewport:{value:900}},
  vertexShader:`attribute vec3 color;attribute vec3 velocity;attribute float size;attribute float alpha;attribute float kind;uniform float viewport;varying vec3 tint;varying float opacity;varying float type;varying vec2 direction;
   void main(){vec4 p=modelViewMatrix*vec4(position,1.);vec4 q=projectionMatrix*p;vec4 next=projectionMatrix*(p+modelViewMatrix*vec4(velocity*.02,0.));direction=normalize(next.xy/next.w-q.xy/q.w+vec2(.00001));tint=color;opacity=alpha;type=kind;gl_Position=q;gl_PointSize=clamp(size*viewport*projectionMatrix[1][1]/max(.1,-p.z),1.,120.);}`,
  fragmentShader:`varying vec3 tint;varying float opacity;varying float type;varying vec2 direction;
   void main(){vec2 p=(gl_PointCoord-.5)*2.;float density;float core=0.;
    if(type<.5){vec2 d=vec2(direction.x,-direction.y);float along=dot(p,d),across=dot(p,vec2(-d.y,d.x));float curve=across-.2*(along*along-.3);float taper=smoothstep(1.,.15,abs(along));density=(exp(-curve*curve*35.)*.55+exp(-curve*curve*220.))*taper;core=exp(-curve*curve*380.)*taper*.85;}
    else if(type<1.5){float r=length(p);density=exp(-r*r*4.)*smoothstep(1.,.65,r);}
    else if(type<2.5){float r=length(p);float rays=exp(-abs(p.x)*32.)*exp(-abs(p.y)*3.)+exp(-abs(p.y)*32.)*exp(-abs(p.x)*3.);density=(rays+exp(-r*r*18.)) *smoothstep(1.,.7,r);core=exp(-r*r*55.);}
    else {float r=length(p);density=(exp(-r*r*6.)*.65+exp(-r*r*48.))*smoothstep(1.,.6,r);core=exp(-r*r*70.);}
    float a=opacity*density;if(a<.006)discard;gl_FragColor=vec4(mix(tint,vec3(1.),core),min(1.,a));
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
   }`});
 const points=new T.Points(geometry,material);points.frustumCulled=false;points.name='tire-arcs-glints-and-smoke';scene.add(points);
 const shards=Array.from({length:192},()=>({life:0}));let shardCursor=0;
 // A shallow faceted quadrilateral, not repeated flat triangles. Unequal
 // per-axis instance scales and tumbling expose different silhouettes.
 const corners=[[-.55,-.4,0],[.5,-.28,0],[.31,.6,0],[-.4,.29,0]],verts=[],bary=[];
 for(let i=0;i<4;i++){verts.push(0,0,.07,...corners[i],...corners[(i+1)%4]);bary.push(1,0,0,0,1,0,0,0,1);}
 const shardGeometry=new T.BufferGeometry();shardGeometry.setAttribute('position',new T.Float32BufferAttribute(verts,3));shardGeometry.setAttribute('bary',new T.Float32BufferAttribute(bary,3));shardGeometry.computeVertexNormals();
 const shardAlpha=new Float32Array(shards.length);shardGeometry.setAttribute('fade',new T.InstancedBufferAttribute(shardAlpha,1));
 const glassMaterial=new T.ShaderMaterial({transparent:true,depthWrite:false,side:T.DoubleSide,
  vertexShader:`attribute vec3 bary;attribute float fade;varying vec3 edge;varying vec3 tint;varying vec3 n;varying vec3 view;varying float alpha;void main(){vec4 p=modelViewMatrix*instanceMatrix*vec4(position,1.);gl_Position=projectionMatrix*p;edge=bary;tint=instanceColor;alpha=fade;n=normalize(normalMatrix*mat3(instanceMatrix)*normal);view=normalize(-p.xyz);}`,
  fragmentShader:`varying vec3 edge;varying vec3 tint;varying vec3 n;varying vec3 view;varying float alpha;void main(){vec3 width=fwidth(edge)*1.1;vec3 aa=smoothstep(vec3(0.),width,edge);float rim=1.-aa.x;float facing=abs(dot(normalize(n),normalize(view)));float glint=pow(facing,22.);vec3 col=mix(tint*(.7+facing*.25),vec3(1.),rim*.48+glint*.2);gl_FragColor=vec4(col,alpha*(.4+rim*.35+glint*.15));
   #include <tonemapping_fragment>
   #include <colorspace_fragment>
  }`});
 const glass=new T.InstancedMesh(shardGeometry,glassMaterial,shards.length);glass.frustumCulled=false;glass.name='item-box-prismatic-glass';scene.add(glass);
 const dummy=new T.Object3D(),tint=new T.Color(),palette=['#80efff','#f2afff','#e4ffff','#969aff','#8fffd9'];
 // Allocate instanceColor before the first shader compile.
 for(let i=0;i<shards.length;i++){glass.setColorAt(i,tint.set('#ffffff'));dummy.scale.setScalar(0);dummy.updateMatrix();glass.setMatrixAt(i,dummy.matrix);}
 function emit(position,velocity,color,size,life,kind=0,normal={x:0,y:1,z:0}){
  Object.assign(particles[cursor],{...position,velocity:{...velocity},normal:{...normal},life,total:life,size,kind,color});cursor=(cursor+1)%count;
 }
 function box(box){
  const n=box.normal||{x:0,y:1,z:0},origin={x:box.x+n.x*1.8,y:box.y+n.y*1.8,z:box.z+n.z*1.8};
  for(let i=0;i<28;i++){
   const v=new T.Vector3(random()-.5,random()-.25,random()-.5).normalize().multiplyScalar(3+random()*5);
   const p={x:origin.x+v.x*.025,y:origin.y+v.y*.025,z:origin.z+v.z*.025},life=.4+random()*.27;
   Object.assign(shards[shardCursor],{...p,v,normal:n,life,total:life,rotation:new T.Vector3(random()*6,random()*6,random()*6),spin:new T.Vector3(random()*15-7.5,random()*15-7.5,random()*15-7.5),size:i<8?.42+random()*.32:.18+random()*.26,aspect:.6+random()*.9});
   glass.setColorAt(shardCursor,tint.set(palette[i%palette.length]));shardCursor=(shardCursor+1)%shards.length;
   if(i<14)emit(p,v.clone().multiplyScalar(.85),palette[i%palette.length],.35+random()*.4,.24+random()*.2,2,n);
  }
  emit(origin,{x:0,y:0,z:0},'#edffff',3.1,.12,3,n);
  for(let i=0;i<5;i++)emit(origin,{x:(random()-.5)*3,y:(random()-.5)*3,z:(random()-.5)*3},palette[i],1.3,.25,3,n);
  glass.instanceColor.needsUpdate=true;
 }
 function tire(r,frame,dt){
  let state=tireState.get(r);if(!state){state={debt:0,tier:0};tireState.set(r,state);}
  if(!r.drift||r.speed<10||r.gliding||r.jump){state.debt=0;state.tier=0;return;}
  if(dt<=0)return;
  const {forward:f,right,up:n}=frame,tier=Math.max(0,Math.min(3,r.tier)),color=['#fff0c0','#22caff','#ff941f','#e451ff'][tier];
  state.debt+=dt*(tier?130:60);const amount=Math.min(7,Math.floor(state.debt));state.debt=Math.min(1,state.debt-amount);
  const flare=tier>state.tier;state.tier=tier;
  for(const side of [-1,1]){
   const position={x:r.x-f.x*1.15+right.x*side*1.08+n.x*.13,y:r.y-f.y*1.15+right.y*side*1.08+n.y*.13,z:r.z-f.z*1.15+right.z*side*1.08+n.z*.13};
   if(tier)emit(position,{x:f.x*r.speed*.72,y:f.y*r.speed*.72,z:f.z*r.speed*.72},color,flare?1.45:.48+random()*.18,flare?.15:.045,3,n);
   for(let i=0;i<amount+(flare?12:0);i++){
    const lateral=side*(1.5+random()*5),lift=.5+random()*3,back=2+random()*6;
    const velocity={x:-f.x*back+right.x*lateral+n.x*lift,y:-f.y*back+right.y*lateral+n.y*lift,z:-f.z*back+right.z*lateral+n.z*lift};
    emit(position,velocity,color,(flare?.48:.2)+random()*.2,.12+random()*.13,0,n);
    if(i===0){emit(position,{x:-f.x+n.x*.7,y:-f.y+n.y*.7,z:-f.z+n.z*.7},'#a3a9b3',.48,.4,1,n);if(tier)emit(position,velocity,color,.28,.16,2,n);}
   }
  }
 }
 function update(dt,height){
  dt=Number.isFinite(dt)?Math.max(0,dt):0;material.uniforms.viewport.value=height;
  particles.forEach((p,i)=>{
   p.life=Math.max(0,p.life-dt);if(p.life<=0){alphas[i]=0;sizes[i]=0;return;}
   const age=1-p.life/p.total;
   for(const axis of ['x','y','z']){p[axis]+=p.velocity[axis]*dt;if(p.kind===0)p.velocity[axis]-=p.normal[axis]*12*dt;}
   positions.set([p.x,p.y,p.z],i*3);velocities.set([p.velocity.x,p.velocity.y,p.velocity.z],i*3);tint.set(p.color);colors.set([tint.r,tint.g,tint.b],i*3);
   kinds[i]=p.kind;sizes[i]=p.size*(p.kind===1?1+age*1.8:1);alphas[i]=(1-age)*(p.kind===1?.22:1);
  });
  for(const attribute of Object.values(geometry.attributes))attribute.needsUpdate=true;
  shards.forEach((s,i)=>{
   s.life-=dt;shardAlpha[i]=s.life>0?Math.min(1,s.life/.18):0;
   if(s.life>0){for(const axis of ['x','y','z']){s[axis]+=s.v[axis]*dt;s.v[axis]-=s.normal[axis]*7*dt;s.rotation[axis]+=s.spin[axis]*dt;}
    dummy.position.set(s.x,s.y,s.z);dummy.rotation.set(s.rotation.x,s.rotation.y,s.rotation.z);dummy.scale.set(s.size*s.aspect,s.size,s.size);
   }else dummy.scale.setScalar(0);
   dummy.updateMatrix();glass.setMatrixAt(i,dummy.matrix);
  });glass.instanceMatrix.needsUpdate=true;shardGeometry.attributes.fade.needsUpdate=true;
 }
 return {box,tire,update};
}
