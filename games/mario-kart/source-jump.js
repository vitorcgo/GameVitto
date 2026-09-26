/** Lip coordinates measured from the local Stadium course's JumpBoard mesh.
 * The finish ramp runs diagonally across the outside boost lane. Crossing its
 * front axle must release road/edge constraints before the lane narrows. */
export const SOURCE_JUMP_LIPS = [
 {a:{x:11.5158525,y:1.339335,z:64.57169},b:{x:18.777025,y:2.76523,z:60.6635575},forward:{x:-.474,z:-.881}},
 {a:{x:-74.1168225,y:10.697835,z:114.015435},b:{x:-74.100295,y:10.760135,z:123.982535},forward:{x:1,z:0}},
];
export function sourceJumpLaunch(r,dt){
 if(r.gliding||r.jump||r.anti||r.speed<10||r.jumpCooldown>0)return null;
 const vx=Math.sin(r.heading)*r.speed,vz=-Math.cos(r.heading)*r.speed;
 for(const lip of SOURCE_JUMP_LIPS){
  const dx=lip.b.x-lip.a.x,dz=lip.b.z-lip.a.z,t=((r.x-lip.a.x)*dx+(r.z-lip.a.z)*dz)/(dx*dx+dz*dz);
  if(t<-.03||t>1.03)continue;
  const h=lip.a.y+(lip.b.y-lip.a.y)*t;
  if(Math.abs(r.y-h)>1.15)continue;
  const along=(r.x-lip.a.x)*lip.forward.x+(r.z-lip.a.z)*lip.forward.z,travel=(vx*lip.forward.x+vz*lip.forward.z)*dt;
  if(travel>0 && along < -.9 && along+travel>=-1.6){
   return {age:0,speed:r.speed,velocity:Math.max(5.2,(r.surfaceForward?.y||0)*r.speed+3.5),launchY:r.y};
  }
 }
 return null;
}
