/** Seat-aligned, original spectator drawings on the optional course's benches. */
import * as THREE from 'three';
import {spectatorAtlas} from './stadium-crowd.js';

export function sourceCrowd(root) {
  const texture = spectatorAtlas((w,h,draw) => {
    const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;
    draw(canvas.getContext('2d'),w,h);
    const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;
    map.anisotropy=4;return map;
  });
  const positions=[],texcoords=[],colors=[],waves=[],feet=[],occupied=new Map();
  const p=[new THREE.Vector3(),new THREE.Vector3(),new THREE.Vector3()];
  const uv=[new THREE.Vector2(),new THREE.Vector2(),new THREE.Vector2()];
  const normal=new THREE.Vector3(),edge=new THREE.Vector3(),side=new THREE.Vector3();
  let seed=72841;
  const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
  const up=new THREE.Vector3(0,1,0);
  root.updateMatrixWorld(true);
  root.traverse(o=>{
    if(!o.isMesh||o.material.name!=='fc_bench')return;
    const g=o.geometry,a=g.attributes.position,t=g.attributes.uv,index=g.index;
    if(!t)return;
    for(let i=0;i<(index?.count||a.count);i+=3){
      for(let j=0;j<3;j++){
        const k=index?index.getX(i+j):i+j;
        p[j].fromBufferAttribute(a,k).applyMatrix4(o.matrixWorld);uv[j].fromBufferAttribute(t,k);
      }
      normal.subVectors(p[1],p[0]).cross(edge.subVectors(p[2],p[0])).normalize();
      if(normal.y<0)normal.negate();
      // The inclined blue seating panels are distinct from horizontal landings
      // and near-vertical risers. Follow their texture coordinates to align rows.
      if(normal.y<.78||normal.y>.985)continue;
      const d=(uv[1].y-uv[2].y)*(uv[0].x-uv[2].x)+(uv[2].x-uv[1].x)*(uv[0].y-uv[2].y);
      if(Math.abs(d)<1e-8)continue;
      const minU=Math.min(...uv.map(v=>v.x)),maxU=Math.max(...uv.map(v=>v.x));
      const minV=Math.min(...uv.map(v=>v.y)),maxV=Math.max(...uv.map(v=>v.y));
      side.crossVectors(up,normal).normalize();
      for(let row=Math.ceil((minV-.2)*2);row<=(maxV-.2)*2;row++)
        for(let col=Math.ceil((minU-.25)*2);col<=(maxU-.25)*2;col++){
          const u=col*.5+.25,v=row*.5+.2;
          const b0=((uv[1].y-uv[2].y)*(u-uv[2].x)+(uv[2].x-uv[1].x)*(v-uv[2].y))/d;
          const b1=((uv[2].y-uv[0].y)*(u-uv[2].x)+(uv[0].x-uv[2].x)*(v-uv[2].y))/d,b2=1-b0-b1;
          if(Math.min(b0,b1,b2)<1e-5)continue;
          const foot=p[0].clone().multiplyScalar(b0).addScaledVector(p[1],b1).addScaledVector(p[2],b2);
          const cell=foot.toArray().map(x=>Math.floor(x/.7));
          let close=false;
          for(let x=-1;x<=1;x++)for(let y=-1;y<=1;y++)for(let z=-1;z<=1;z++)
            for(const prior of occupied.get(`${cell[0]+x},${cell[1]+y},${cell[2]+z}`)||[])
              if(prior.distanceToSquared(foot)<.7**2)close=true;
          if(close||random()<.12)continue;
          const key=cell.join(',');if(!occupied.has(key))occupied.set(key,[]);occupied.get(key).push(foot);
          feet.push(foot.toArray());
          const atlasCol=Math.floor(random()*4)*21+3+Math.floor(random()*18),atlasRow=Math.floor(random()*8);
          const left=atlasCol/84,right=(atlasCol+1)/84,bottom=1-(atlasRow*64+49)/512,top=1-atlasRow/8;
          const width=1.1,height=1.45,shade=.8+random()*.2,phase=random()*Math.PI*2;
          for(const [x,y] of [[0,0],[1,0],[1,1],[0,0],[1,1],[0,1]]){
            const point=foot.clone().addScaledVector(side,(x-.5)*width);point.y+=y*height-.13;
            positions.push(...point.toArray());texcoords.push(x?right:left,y?top:bottom);
            colors.push(shade,shade,shade);waves.push(y,phase);
          }
        }
    }
  });
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute(texcoords,2));
  geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  geometry.setAttribute('spectatorWave',new THREE.Float32BufferAttribute(waves,2));
  const time={value:0},material=new THREE.MeshBasicMaterial({map:texture,vertexColors:true,side:THREE.DoubleSide,alphaTest:.4});
  material.onBeforeCompile=shader=>{
    shader.uniforms.crowdTime=time;
    shader.vertexShader='uniform float crowdTime; attribute vec2 spectatorWave;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',
      '#include <begin_vertex>\n transformed.x += .035 * spectatorWave.x * sin(crowdTime * 2.8 + spectatorWave.y);');
  };
  material.customProgramCacheKey=()=> 'seat-crowd-v1';
  const mesh=new THREE.Mesh(geometry,material);mesh.name='source-stadium-spectators';
  mesh.userData.seatFeet=feet;mesh.userData.spectatorCount=feet.length;
  mesh.applyMatrix4(root.matrixWorld.clone().invert());root.add(mesh);
  return {mesh,update(t){time.value=t;}};
}
