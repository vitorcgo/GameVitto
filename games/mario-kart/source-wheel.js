/** Preserve the source tire's actual rim and use its authored emission mask. */
const configured = new WeakSet();
export function sourceWheelMaterial(material) {
  if(configured.has(material))return;
  configured.add(material);
  const hover={value:0};material.userData.sourceHover=hover;
  material.onBeforeCompile=shader=>{
    shader.uniforms.sourceHover=hover;
    shader.fragmentShader='uniform float sourceHover;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',
      `#include <map_fragment>
       // Colored metal becomes a subdued blue hub in antigravity. Rubber and
       // neutral sidewall lettering retain their original texture values.
       float rim = smoothstep(.04, .18, max(diffuseColor.r,diffuseColor.g)-diffuseColor.b);
       diffuseColor.rgb = mix(diffuseColor.rgb, vec3(.012,.042,.055), rim*sourceHover);`);
  };
  material.customProgramCacheKey=()=> 'source-tire-antigravity-v1';
  material.needsUpdate=true;
}
export function updateSourceWheel(wheel, amount) {
  if(!wheel.userData.sourceTireMeshes)return;
  // Powerups replace material instances. Follow the mesh's current material;
  // serialized userData on a clone does not preserve shader callbacks/uniforms.
  for(const mesh of wheel.userData.sourceTireMeshes){
    const material=mesh.material;sourceWheelMaterial(material);
    material.userData.sourceHover.value=amount;
    material.emissive.setRGB(.03,.68,1);
    material.emissiveIntensity=amount*2.8;
  }
}
