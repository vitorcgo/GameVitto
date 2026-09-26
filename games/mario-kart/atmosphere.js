import * as THREE from "three";
/** Soft high clouds and arena searchlights give the night a lit atmosphere. */
export function addAtmosphere(scene) {
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(850, 32, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {},
      vertexShader: `varying vec3 direction;void main(){direction=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
      fragmentShader: `
 varying vec3 direction;
 float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
 float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
 void main(){vec3 d=normalize(direction);float h=max(d.y,0.);vec2 uv=vec2(atan(d.z,d.x),d.y)*vec2(3.,4.);float n=noise(uv)*.55+noise(uv*2.7)*.27+noise(uv*7.)*.13;
 vec3 color=mix(vec3(.008,.018,.030),vec3(.002,.004,.012),smoothstep(0.,.6,h));
 float cloud=smoothstep(.36,.72,n)*smoothstep(-.01,.12,d.y)*(1.-smoothstep(.45,.8,d.y));
 color+=vec3(.030,.036,.045)*cloud;
 gl_FragColor=vec4(color,1.);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
 }`,
    }),
  );
  sky.renderOrder = -100;
  scene.add(sky);
  const beamMaterial = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    vertexShader: `varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    // UV interpolation can exceed the cylinder edge by a tiny epsilon. Clamp
    // both power bases: one NaN pixel contaminates the entire bloom pyramid.
    fragmentShader: `varying vec2 vUv;void main(){float fade=pow(max(0.,sin(vUv.x*3.14159)),4.)*pow(max(0.,1.-vUv.y),1.7)*.065;gl_FragColor=vec4(.55,.8,1.,fade);}`,
  });
  const beams = [];
  for (let i = 0; i < 10; i++) {
    const a = (i * Math.PI) / 5,
      g = new THREE.Group();
    g.position.set(Math.cos(a) * 242, 0, Math.sin(a) * 232);
    scene.add(g);
    const m = new THREE.Mesh(
      new THREE.CylinderGeometry(5.0, 0.18, 240, 32, 1, true),
      beamMaterial,
    );
    m.position.y = 120;
    g.add(m);
    g.rotation.z = Math.cos(a) * 0.18;
    g.rotation.x = Math.sin(a) * 0.18;
    beams.push(g);
  }
  return { sky, beams };
}
