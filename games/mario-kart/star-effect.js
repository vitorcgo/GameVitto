import {Color,Points,BufferGeometry,Float32BufferAttribute,ShaderMaterial,AdditiveBlending} from 'three';
import {sourceWheelMaterial} from './source-wheel.js';

const states=new WeakMap();
/** Tint the lit surface and add a small rim glow instead of filling every
 * fragment with the same emissive color. Original maps and emission survive.
 */
export function updateStarModel(root, active, hue) {
  root.traverse(mesh=>{
    if(!mesh.isMesh||Array.isArray(mesh.material)||!mesh.material.emissive)return;
    let state=states.get(mesh);
    if(!state&&active){
      const original=mesh.material,material=original.clone();
      mesh.material=material;mesh.userData.starMat=true;
      // Clone callbacks/uniforms do not survive Material.clone(). Configure the
      // new tire instance before composing star shading, so the per-frame hover
      // update recognizes it and does not replace the combined shader later.
      if(original.userData.sourceHover) sourceWheelMaterial(material);
      state={amount:{value:0},tint:{value:new Color()},roughness:original.roughness,metalness:original.metalness};states.set(mesh,state);
      const compile=original.userData.sourceHover?material.onBeforeCompile:original.onBeforeCompile;
      const key=(original.userData.sourceHover?material:original).customProgramCacheKey.bind(original.userData.sourceHover?material:original);
      material.onBeforeCompile=(shader,renderer)=>{
        compile.call(material,shader,renderer);
        shader.uniforms.kartStarAmount=state.amount;
        shader.uniforms.kartStarTint=state.tint;
        shader.fragmentShader='uniform float kartStarAmount;\nuniform vec3 kartStarTint;\n'+shader.fragmentShader;
        shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
          float starLuma=dot(diffuseColor.rgb,vec3(.2126,.7152,.0722));
          vec3 starSurface=kartStarTint*(.1+.9*sqrt(max(0.0,starLuma)));
          diffuseColor.rgb=mix(diffuseColor.rgb,starSurface,kartStarAmount*.8);`);
        shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',`
          float starRim=pow(1.0-abs(dot(normal,normalize(vViewPosition))),2.0);
          outgoingLight+=kartStarAmount*mix(kartStarTint,vec3(1.0),.65)*(starRim*3.5+starLuma*.025);
          #include <opaque_fragment>`);
      };
      material.customProgramCacheKey=()=>key()+'|kart-star-lit-v2';
      material.needsUpdate=true;
    }
    if(!state)return;
    state.amount.value=active?1:0;
    state.tint.value.setHSL(hue,.85,.62);
    mesh.material.roughness=active?Math.min(state.roughness,.28):state.roughness;
    mesh.material.metalness=active?Math.max(state.metalness,.3):state.metalness;
  });
}

/** Eight small white/gold twinkles, batched into one draw call per active kart. */
export function makeStarAura(){
  const geometry=new BufferGeometry();
  geometry.setAttribute('position',new Float32BufferAttribute(new Float32Array(24),3));
  geometry.setAttribute('twinkle',new Float32BufferAttribute(new Float32Array(8),1));
  const material=new ShaderMaterial({transparent:true,depthWrite:false,blending:AdditiveBlending,
    uniforms:{screenHeight:{value:900}},
    vertexShader:`attribute float twinkle; uniform float screenHeight; varying float shine;
      void main(){shine=twinkle;vec4 p=modelViewMatrix*vec4(position,1.0);gl_Position=projectionMatrix*p;
      gl_PointSize=clamp((.15+.5*shine)*screenHeight/max(1.0,-p.z),1.0,64.0);}`,
    fragmentShader:`varying float shine;void main(){vec2 q=(gl_PointCoord-.5)*2.0;
      float crossLight=max(exp(-q.x*q.x*180.0-q.y*q.y*7.0),exp(-q.x*q.x*7.0-q.y*q.y*180.0));
      float halo=exp(-dot(q,q)*18.0)*.25;
      gl_FragColor=vec4(mix(vec3(1.0,.72,.2),vec3(1.0),crossLight),min(1.0,crossLight+halo)*shine);}`});
  const aura=new Points(geometry,material);aura.name='star-twinkles';aura.frustumCulled=false;aura.visible=false;return aura;
}
export function updateStarAura(aura,active,time,screenHeight){
  aura.visible=active;if(!active)return;
  aura.material.uniforms.screenHeight.value=screenHeight;
  const p=aura.geometry.attributes.position,t=aura.geometry.attributes.twinkle;
  for(let i=0;i<8;i++){
    const phase=(time*1.4+i*.61803398875)%1,angle=i*2.39996323+time*.7;
    const radius=1.2+Math.sin(i*4.17)*.5;
    p.setXYZ(i,Math.cos(angle)*radius,.35+phase*2.6,Math.sin(angle)*radius);
    t.setX(i,Math.sin(phase*Math.PI)**4);
  }
  p.needsUpdate=true;t.needsUpdate=true;
}
