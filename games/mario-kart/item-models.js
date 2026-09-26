import * as T from 'three';
const material=(color)=>new T.MeshStandardMaterial({color,roughness:.42});
function mesh(g,geometry,mat,x=0,y=0,z=0){const m=new T.Mesh(geometry,mat);m.position.set(x,y,z);m.castShadow=true;g.add(m);return m;}
function eyes(g,y,z,size=1){for(const x of [-.16,.16]){const e=mesh(g,new T.SphereGeometry(1,16,12),material('#161319'),x*size,y,z);e.scale.set(.055*size,.16*size,.035*size);}}

/** Lit silhouettes shared by the glove and projectile, including shell seams,
 * faces, the blue shell's spikes and the banana's curved peel. */
export function makeItemModel(type){
 const g=new T.Group();g.name='item-'+type;
 if(type==='banana'){
  const yellow=material('#ffdc21'),inside=material('#fff4a3');
  const body=mesh(g,new T.SphereGeometry(.24,24,16),yellow,0,.62,0);body.scale.set(1,2.2,1);
  const tip=mesh(g,new T.CylinderGeometry(.055,.1,.32,12),material('#75662b'),0,1.18,0);tip.rotation.z=-.22;
  for(let k=0;k<3;k++){
   const a=k*Math.PI*2/3,curve=new T.CatmullRomCurve3([new T.Vector3(0,.6,0),new T.Vector3(Math.sin(a)*.28,.38,Math.cos(a)*.28),new T.Vector3(Math.sin(a)*.62,.09,Math.cos(a)*.62),new T.Vector3(Math.sin(a)*.83,.16,Math.cos(a)*.83)]);
   const p=[],idx=[];for(let i=0;i<=20;i++){const t=i/20,c=curve.getPoint(t),w=.17*Math.sin(Math.PI*t)**.5+.015;for(const side of [-1,1])p.push(c.x+Math.cos(a)*side*w,c.y,c.z-Math.sin(a)*side*w);if(i<20){const n=i*2;idx.push(n,n+2,n+1,n+1,n+2,n+3);}}
   const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(p,3));geo.setIndex(idx);geo.computeVertexNormals();const mat=inside.clone();mat.side=T.DoubleSide;mesh(g,geo,mat);
  }eyes(g,.73,.225,.72);
 }else if(type==='star'){
  const shape=new T.Shape();for(let i=0;i<10;i++){const a=i*Math.PI/5,r=i%2?.32:.7,x=Math.sin(a)*r,y=Math.cos(a)*r+.7;i?shape.lineTo(x,y):shape.moveTo(x,y);}shape.closePath();
  const m=mesh(g,new T.ExtrudeGeometry(shape,{depth:.18,bevelEnabled:true,bevelSize:.08,bevelThickness:.08,bevelSegments:3,steps:1}),material('#ffe740'));m.material.emissive.set('#806700');eyes(g,.73,.28,.8);
 }else{
  const color=type==='green'?'#26ae36':type==='red'?'#e92936':'#178bf0';
  const mat=material(color),shell=mesh(g,new T.SphereGeometry(.67,48,28,0,Math.PI*2,0,Math.PI/2),mat,0,.27,0);shell.scale.y=.85;
  const seam=material(type==='green'?'#125b23':type==='red'?'#8b1427':'#084e94');
  for(let k=0;k<6;k++){const a=k*Math.PI/3,pts=[];for(let i=0;i<=18;i++){const t=.67+i/18*(Math.PI/2-.67);pts.push(new T.Vector3(Math.sin(a)*Math.sin(t)*.674,.27+Math.cos(t)*.575,Math.cos(a)*Math.sin(t)*.674));}mesh(g,new T.TubeGeometry(new T.CatmullRomCurve3(pts),18,.014,5,false),seam);}
  const seamRing=mesh(g,new T.TorusGeometry(Math.sin(.67)*.674,.014,5,48),seam,0,.27+Math.cos(.67)*.575,0);seamRing.rotation.x=Math.PI/2;
  const rim=mesh(g,new T.TorusGeometry(.64,.105,12,48),material('#fff7db'),0,.25,0);rim.rotation.x=Math.PI/2;
  const belly=mesh(g,new T.SphereGeometry(.52,32,18),material('#ffd987'),0,.16,0);belly.scale.y=.5;
  const face=mesh(g,new T.SphereGeometry(.26,24,16),material('#ffdfa0'),0,.13,.43);face.scale.set(1,.82,.72);eyes(g,.15,.6,.6);
  if(type==='blue'){
   mesh(g,new T.ConeGeometry(.13,.45,16),material('#fffbea'),0,1.02,0);
   for(const a of [0,Math.PI*.5,Math.PI,Math.PI*1.5]){const spike=mesh(g,new T.ConeGeometry(.12,.4,16),material('#fffbea'),Math.sin(a)*.38,.87,Math.cos(a)*.38);spike.rotation.z=-Math.sin(a)*.5;spike.rotation.x=Math.cos(a)*.5;}
  }
 }
 return g;
}
