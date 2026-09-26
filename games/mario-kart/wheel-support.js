/** Chassis support from the source Standard Kart's four tire contact positions.
 * Use spatial support, not artist vertex normals or temporal pose smoothing.
 * Coordinates are measured from the source rig: X +/- .99, Z -.87 / .90.
 */
export function wheelSupport(sample, point, up, forward) {
  const right={x:forward.y*up.z-forward.z*up.y,y:forward.z*up.x-forward.x*up.z,z:forward.x*up.y-forward.y*up.x};
  const hits=[];
  for(const along of [.87,-.90])for(const side of [-.99,.99]) {
    const origin={x:point.x+right.x*side+forward.x*along,y:point.y+right.y*side+forward.y*along,z:point.z+right.z*side+forward.z*along};
    const hit=sample(origin,up);
    // A missing wheel or another deck is not a four-wheel support plane.
    // One tire diameter bounds the local support reach; retain point support
    // at ramp edges instead of bridging empty space to a distant surface.
    if(!hit||Math.abs((hit.x-origin.x)*up.x+(hit.y-origin.y)*up.y+(hit.z-origin.z)*up.z)>.92)return null;
    hits.push(hit);
  }
  const [fl,fr,rl,rr]=hits;
  const side={},along={};
  for(const k of ['x','y','z']){
    side[k]=(fr[k]+rr[k]-fl[k]-rl[k])/2;
    along[k]=(fl[k]+fr[k]-rl[k]-rr[k])/2;
  }
  const n={x:side.y*along.z-side.z*along.y,y:side.z*along.x-side.x*along.z,z:side.x*along.y-side.y*along.x};
  const length=Math.hypot(n.x,n.y,n.z);if(length<1e-6)return null;
  const sign=n.x*up.x+n.y*up.y+n.z*up.z<0?-1:1;
  return {normal:{x:n.x/length*sign,y:n.y/length*sign,z:n.z/length*sign},hits};
}
