/** Renderer-independent queries against an optional measured road triangle mesh. */
export function createMeshSurface(data) {
  const {p,n,i,road}=data;
  if(!Array.isArray(p)||p.length%3||!Array.isArray(n)||n.length!==p.length||!Array.isArray(i)||i.length%3||!Array.isArray(road)||road.length!==i.length/3)throw new Error('Invalid road mesh arrays');
  if(!p.every(Number.isFinite)||!n.every(Number.isFinite)||!i.every(v=>Number.isInteger(v)&&v>=0&&v<p.length/3))throw new Error('Invalid road mesh values');
  const size=8,cells=new Map(),triangles=[];
  for(let j=0;j<i.length;j+=3){
    const a=i[j]*3,b=i[j+1]*3,c=i[j+2]*3;
    const tri={a:[p[a],p[a+1],p[a+2]],b:[p[b],p[b+1],p[b+2]],c:[p[c],p[c+1],p[c+2]],ids:[a,b,c],road:road[j/3],boost:data.boost?.[j/3]};
    tri.e1=tri.b.map((v,k)=>v-tri.a[k]);tri.e2=tri.c.map((v,k)=>v-tri.a[k]);triangles.push(tri);
    const min=tri.a.map((v,k)=>Math.floor(Math.min(v,tri.b[k],tri.c[k])/size));
    const max=tri.a.map((v,k)=>Math.floor(Math.max(v,tri.b[k],tri.c[k])/size));
    if((max[0]-min[0]+1)*(max[1]-min[1]+1)*(max[2]-min[2]+1)>10000)throw new Error('Road triangle exceeds spatial grid limits');
    for(let x=min[0];x<=max[0];x++)for(let y=min[1];y<=max[1];y++)for(let z=min[2];z<=max[2];z++){
      const key=`${x},${y},${z}`;if(!cells.has(key))cells.set(key,[]);cells.get(key).push(triangles.length-1);
    }
  }
  const array=v=>[v.x,v.y,v.z],dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
  const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  function candidates(min,max){
    const ids=new Set();min=min.map(v=>Math.floor(v/size));max=max.map(v=>Math.floor(v/size));
    for(let x=min[0];x<=max[0];x++)for(let y=min[1];y<=max[1];y++)for(let z=min[2];z<=max[2];z++)for(const id of cells.get(`${x},${y},${z}`)||[])ids.add(id);
    return ids;
  }
  function sample(point,normal){
    const center=array(point),up=array(normal),direction=up.map(v=>-v),origin=center.map((v,k)=>v+up[k]*6);
    const min=center.map((v,k)=>v-Math.abs(up[k])*6-.001),max=center.map((v,k)=>v+Math.abs(up[k])*6+.001);
    let nearest=null,minDistance=Infinity;
    for(const id of candidates(min,max)){
      const t=triangles[id],h=cross(direction,t.e2),det=dot(t.e1,h);if(Math.abs(det)<1e-10)continue;
      const offset=origin.map((v,k)=>v-t.a[k]),u=dot(offset,h)/det;if(u<-.000001||u>1.000001)continue;
      const q=cross(offset,t.e1),v=dot(direction,q)/det;if(v<-.000001||u+v>1.000001)continue;
      const distance=dot(t.e2,q)/det;if(distance<0||distance>12)continue;
      const height=6-distance;if(Math.abs(height)>minDistance+.02)continue;
      let normal=t.ids.map(k=>[n[k],n[k+1],n[k+2]]).reduce((out,nn,j)=>out.map((x,k)=>x+nn[k]*[1-u-v,u,v][j]),[0,0,0]);
      const magnitude=Math.hypot(...normal);if(magnitude<1e-6)continue;normal=normal.map(x=>x/magnitude);
      if(dot(normal,up)<0)normal=normal.map(v=>-v);
      if(dot(normal,up)<.45)continue; // Exclude transverse walls from ground support.
      minDistance=Math.min(minDistance,Math.abs(height));
      if(nearest&&Math.abs(nearest.height)>minDistance+.02)nearest=null;
      // Road markings can be separate meshes a few millimetres above asphalt.
      // Choose the top of this tight surface cluster, never a different deck.
      if(nearest&&height<nearest.height)continue;
      nearest={x:center[0]+up[0]*height,y:center[1]+up[1]*height,z:center[2]+up[2]*height,normal:{x:normal[0],y:normal[1],z:normal[2]},height,triangle:id,onRoad:!!t.road,onBoost:!!t.boost};
    }
    return nearest;
  }
  function limits(point,normal,right,forward){
    const center=array(point),up=array(normal),side=array(right),along=array(forward);
    const extent=side.map((v,k)=>Math.abs(v)*30+Math.abs(up[k])*3+.01);
    const intervals=[];
    for(const id of candidates(center.map((v,k)=>v-extent[k]),center.map((v,k)=>v+extent[k]))){
      const t=triangles[id];if(!t.road)continue;
      const vertices=[t.a,t.b,t.c].map(v=>v.map((x,k)=>x-center[k]));
      const w=vertices.map(v=>dot(v,along)),hits=[];
      for(let j=0;j<3;j++){
        const k=(j+1)%3;if(w[j]*w[k]>0||Math.abs(w[j]-w[k])<1e-10)continue;
        const f=w[j]/(w[j]-w[k]),v=vertices[j].map((x,l)=>x*(1-f)+vertices[k][l]*f);
        if(Math.abs(dot(v,up))<=3)hits.push(dot(v,side));
      }
      if(hits.length>=2){const a=Math.max(-30,Math.min(...hits)),b=Math.min(30,Math.max(...hits));if(b-a>.001)intervals.push([a,b]);}
    }
    intervals.sort((a,b)=>a[0]-b[0]);const merged=[];
    // Narrow divider strips join adjacent colored lanes; wider gaps remain
    // separate road branches and must not expand the driving envelope.
    for(const interval of intervals){const last=merged.at(-1);if(last&&interval[0]<=last[1]+.8)last[1]=Math.max(last[1],interval[1]);else merged.push(interval.slice());}
    return merged;
  }
  return {sample,limits,triangleCount:triangles.length};
}
