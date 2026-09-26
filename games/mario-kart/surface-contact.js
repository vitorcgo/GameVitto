/** Kart contact measured in the local surface plane, including near-vertical banks. */
import {dot,cross,unit} from './surface-track.js';
export function kartCorners(r,frame,time=0){
  const yaw=r.spin>0?time*15:r.drift?-r.drift*.25:0,c=Math.cos(yaw),s=Math.sin(yaw),half=r.anti?1.65:1.29;
  const right={},back={};for(const k of ['x','y','z']){right[k]=frame.right[k]*c+frame.forward[k]*s;back[k]=frame.right[k]*s-frame.forward[k]*c;}
  return [[-half,-1.76],[half,-1.76],[half,1.64],[-half,1.64]].map(([x,z])=>({x:r.x+right.x*x+back.x*z,y:r.y+right.y*x+back.y*z,z:r.z+right.z*x+back.z*z}));
}
export function surfaceContact(a,b,frameA,frameB,time=0) {
  const delta={x:b.x-a.x,y:b.y-a.y,z:b.z-a.z};
  if(Math.hypot(delta.x,delta.y,delta.z)>5)return null;
  const normal=unit({x:frameA.up.x+frameB.up.x,y:frameA.up.y+frameB.up.y,z:frameA.up.z+frameB.up.z});
  if(Math.abs(dot(delta,normal))>1.8)return null;
  const A=kartCorners(a,frameA,time),B=kartCorners(b,frameB,time);let depth=Infinity,axis;
  for(const polygon of [A,B])for(let i=0;i<2;i++){
    const edge={x:polygon[i+1].x-polygon[i].x,y:polygon[i+1].y-polygon[i].y,z:polygon[i+1].z-polygon[i].z};
    const n=unit(cross(edge,normal)),pa=A.map(p=>dot(p,n)),pb=B.map(p=>dot(p,n));
    const amin=Math.min(...pa),amax=Math.max(...pa),bmin=Math.min(...pb),bmax=Math.max(...pb);
    if(amax<=bmin||bmax<=amin)return null;
    const overlap=Math.min(amax-bmin,bmax-amin);
    if(overlap<depth){depth=overlap;const sign=dot(delta,n)<0?-1:1;axis={x:n.x*sign,y:n.y*sign,z:n.z*sign};}
  }
  return {x:axis.x*(depth+.005),y:axis.y*(depth+.005),z:axis.z*(depth+.005),depth};
}
