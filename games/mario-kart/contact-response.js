/** Ground contact momentum in each kart's road frame. Equal arcade masses;
 * 40% restitution gives a firm shove without the spin-out reserved for weapons. */
const dot=(a,b)=>a.x*b.x+(a.y||0)*(b.y||0)+a.z*b.z;
const velocity=(r,f)=>({x:f.forward.x*r.speed+f.right.x*(r.sideVelocity||0),y:(f.forward.y||0)*r.speed+(f.right.y||0)*(r.sideVelocity||0),z:f.forward.z*r.speed+f.right.z*(r.sideVelocity||0)});
export function contactResponse(a,b,fa,fb,contact){
 const length=Math.hypot(contact.x,contact.y||0,contact.z);
 if(length<1e-8)return 0;
 const n={x:contact.x/length,y:(contact.y||0)/length,z:contact.z/length},va=velocity(a,fa),vb=velocity(b,fb);
 const closing=dot({x:va.x-vb.x,y:va.y-vb.y,z:va.z-vb.z},n);
 if(closing<=0)return 0;
 const impulse=closing*.7;
 for(const [r,f,sign] of [[a,fa,-1],[b,fb,1]]){
  r.speed+=sign*impulse*dot(n,f.forward);
  r.sideVelocity=(r.sideVelocity||0)+sign*impulse*dot(n,f.right);
  r.contactSide=sign*dot(n,f.right);
 }
 return closing;
}
