/** Convert locally supplied OBJ/MTL course artwork without downloading assets. */
import * as THREE from 'three';
import {OBJLoader} from '/vendor/three-examples/loaders/OBJLoader.js';
import {mergeVertices} from '/vendor/three-examples/utils/BufferGeometryUtils.js';
import {sourceHelperMaterial} from '../source-visible.js';
import {isSourceAsphalt,finishSourceAsphalt,finishSourceLights} from '../source-materials.js';

export async function assembleSourceStadium(base, files, transform) {
  const local = name => new URL(encodeURIComponent(name), base).href;
  const inventory = new Map(files.map(name => [name.toLowerCase(), name]));
  const [root, mtl] = await Promise.all([
    new OBJLoader().loadAsync(local('Mario Kart Stadium.obj')),
    fetch(local('Mario Kart Stadium.mtl')).then(r => {
      if (!r.ok) throw new Error(`Course materials: HTTP ${r.status}`);
      return r.text();
    }),
  ]);
  const specs = {};
  let current;
  for (const line of mtl.split('\n')) {
    const [tag, ...rest] = line.trim().split(/\s+/);
    if (tag === 'newmtl') specs[current = rest.join(' ')] = {};
    else if (current && tag === 'map_Kd') specs[current].map = rest.join(' ').toLowerCase();
  }
  const loader = new THREE.TextureLoader(), cache = new Map();
  const texture = (name, color = true) => {
    if (!inventory.has(name)) return Promise.resolve(null);
    const key = `${name}:${color}`;
    if (!cache.has(key)) cache.set(key, loader.loadAsync(local(inventory.get(name))).then(t => {
      t.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.anisotropy = 8;
      return t;
    }));
    return cache.get(key);
  };
  const materials = new Map();
  await Promise.all(Object.entries(specs).map(async ([name, spec]) => {
    if (spec.map && !inventory.has(spec.map)) throw new Error(`Missing course texture: ${spec.map}`);
    const normalName = spec.map?.replace(/_alb(?:2)?\.png$/, '_nrm.png');
    const emissiveName = spec.map?.replace(/_alb(?:2)?\.png$/, '_emm.png');
    const specularName = spec.map?.replace(/_alb(?:2)?\.png$/, '_spm.png');
    const [map, normalMap, emissiveMap, specularMap] = await Promise.all([
      texture(spec.map), texture(normalName, false), texture(emissiveName),
      isSourceAsphalt(name) ? texture(specularName, false) : null,
    ]);
    let roughnessMap=null;
    if(specularMap){
      const canvas=document.createElement('canvas');canvas.width=specularMap.image.width;canvas.height=specularMap.image.height;
      const ctx=canvas.getContext('2d');ctx.drawImage(specularMap.image,0,0);const pixels=ctx.getImageData(0,0,canvas.width,canvas.height);
      // Preserve the source's spatial reflectivity pattern. This is an art-
      // directed PBR approximation, not a decoding of Nintendo's shader.
      // In these source SPM files all four channels carry the same scalar.
      // Read alpha: canvas premultiplication can quantize low RGB values, while
      // alpha retains the source scalar exactly (verified against the PNGs).
      for(let i=0;i<pixels.data.length;i+=4){const value=Math.round(255*(.56-.26*Math.sqrt(pixels.data[i+3]/255)));pixels.data[i]=pixels.data[i+1]=pixels.data[i+2]=value;pixels.data[i+3]=255;}
      ctx.putImageData(pixels,0,0);roughnessMap=new THREE.CanvasTexture(canvas);roughnessMap.wrapS=roughnessMap.wrapT=THREE.RepeatWrapping;roughnessMap.anisotropy=8;
    }
    const material=new THREE.MeshStandardMaterial({
      name, map, normalMap, normalScale: new THREE.Vector2(.5, .5),
      roughnessMap,
      emissiveMap, emissive: emissiveMap ? 0xffffff : 0,
      emissiveIntensity: .7, color: map ? 0xffffff : 0x727982,
      roughness: .8, side: THREE.DoubleSide,
      alphaTest: /(?:nuki|flower|bush|shiba|grass|TeamLogo|Enkei_Building_Plane)/i.test(name) ? .35 : 0,
    });
    finishSourceAsphalt(material);finishSourceLights(material);materials.set(name,material);
  }));
  root.traverse(o => {
    if (!o.isMesh) return;
    const material = materials.get(o.material.name);
    if (!material) throw new Error(`Unknown course material: ${o.material.name}`);
    o.material = material;
    // This untextured mesh contains shadow-only proxy surfaces. Rendering it
    // opaque covers the gantry artwork and pit details with grey rectangles.
    if (sourceHelperMaterial(material.name)) o.visible = false;
    o.geometry = mergeVertices(o.geometry, .0001);
    o.castShadow = o.receiveShadow = true;
  });
  root.name = 'gamevitto-source-stadium';
  root.userData.source = 'Nintendo Mario Kart 8 / The Models Resource; local conversion';
  root.userData.gamevittoSourceCourse = 1;
  root.scale.setScalar(transform.scale);
  root.position.fromArray(transform.origin).multiplyScalar(-transform.scale);
  root.updateMatrixWorld(true);
  return root;
}
