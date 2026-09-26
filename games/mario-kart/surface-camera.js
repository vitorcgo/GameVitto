/** Spatial triangle grid for camera clearance against imported course geometry. */
import * as THREE from 'three';
export function surfaceCameraCollision(root) {
  root.updateMatrixWorld(true);
  const size=16,cells=new Map(),triangles=[],a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3();
  root.traverse(o=>{
    if(!o.isMesh||!o.visible||o.material.transparent||o.material.alphaTest>0)return;
    const p=o.geometry.attributes.position,index=o.geometry.index,count=index?.count||p.count;
    for(let i=0;i<count;i+=3){
      a.fromBufferAttribute(p,index?index.getX(i):i).applyMatrix4(o.matrixWorld);
      b.fromBufferAttribute(p,index?index.getX(i+1):i+1).applyMatrix4(o.matrixWorld);
      c.fromBufferAttribute(p,index?index.getX(i+2):i+2).applyMatrix4(o.matrixWorld);
      const id=triangles.length/9;triangles.push(...a.toArray(),...b.toArray(),...c.toArray());
      const min=[Math.min(a.x,b.x,c.x),Math.min(a.y,b.y,c.y),Math.min(a.z,b.z,c.z)].map(v=>Math.floor(v/size));
      const max=[Math.max(a.x,b.x,c.x),Math.max(a.y,b.y,c.y),Math.max(a.z,b.z,c.z)].map(v=>Math.floor(v/size));
      for(let x=min[0];x<=max[0];x++)for(let y=min[1];y<=max[1];y++)for(let z=min[2];z<=max[2];z++){
        const key=`${x},${y},${z}`;if(!cells.has(key))cells.set(key,[]);cells.get(key).push(id);
      }
    }
  });
  const positions=new Float32Array(triangles),ray=new THREE.Ray(),hit=new THREE.Vector3();
  return (focus,eye)=>{
    const direction=eye.clone().sub(focus),length=direction.length();if(length<.01)return eye.clone();
    direction.divideScalar(length);ray.set(focus,direction);let nearest=length;
    const ids=new Set();
    const min=[Math.min(focus.x,eye.x),Math.min(focus.y,eye.y),Math.min(focus.z,eye.z)].map(v=>Math.floor(v/size));
    const max=[Math.max(focus.x,eye.x),Math.max(focus.y,eye.y),Math.max(focus.z,eye.z)].map(v=>Math.floor(v/size));
    for(let x=min[0];x<=max[0];x++)for(let y=min[1];y<=max[1];y++)for(let z=min[2];z<=max[2];z++)for(const id of cells.get(`${x},${y},${z}`)||[])ids.add(id);
    for(const id of ids){a.fromArray(positions,id*9);b.fromArray(positions,id*9+3);c.fromArray(positions,id*9+6);if(ray.intersectTriangle(a,b,c,false,hit)){const distance=focus.distanceTo(hit);if(distance>.05)nearest=Math.min(nearest,distance);}}
    return nearest<length?focus.clone().addScaledVector(direction,Math.max(.15,nearest-.45)):eye.clone();
  };
}
