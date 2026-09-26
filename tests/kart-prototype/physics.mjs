// Small, independent kart prototype. No assets, race rules or audio.
export const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export const settings=()=>({radius:65,straight:100,halfWidth:13});
export const RAMP={start:-70,end:-56,height:4.5};
export function rampHeight(x,z,c=settings()){
  return Math.abs(x+c.radius)<=c.halfWidth && z>=RAMP.start && z<=RAMP.end
    ? (z-RAMP.start)/(RAMP.end-RAMP.start)*RAMP.height : 0;
}
export function routeAt(distance,config){
  const {radius:r,straight:a}=config,half=2*a+Math.PI*r,length=half*2;
  let s=((distance%length)+length)%length;
  if(s<2*a)return {x:r,z:a-s,heading:0};
  s-=2*a;
  if(s<Math.PI*r){const t=s/r;return {x:r*Math.cos(t),z:-a-r*Math.sin(t),heading:-t};}
  s-=Math.PI*r;
  if(s<2*a)return {x:-r,z:-a+s,heading:-Math.PI};
  s-=2*a;const t=s/r;return {x:-r*Math.cos(t),z:a+r*Math.sin(t),heading:-Math.PI-t};
}
export const trackLength=c=>4*c.straight+2*Math.PI*c.radius;
export function roadOffset(x,z,c){return Math.hypot(x,z-clamp(z,-c.straight,c.straight))-c.radius;}
export class Prototype {
  constructor(){this.config=settings();this.reset();}
  reset(){
    Object.assign(this,{x:this.config.radius,z:-this.config.straight+45,y:0,vy:0,airborne:false,flightAge:0,launchSpeed:0,jumpCount:0,landing:0,heading:0,speed:0,steer:0,drift:0,charge:0,tier:0,boost:0,hop:0,time:0,distance:0,lastDrift:false,boostCount:0,accumulator:0,input:{}});
  }
  update(dt,input={}){
    if(!Number.isFinite(dt)||dt<=0)return;
    this.accumulator+=Math.min(dt,.1);
    while(this.accumulator+1e-10>=1/120){this.step(1/120,input);this.accumulator-=1/120;}
  }
  step(dt,raw){
    const input={gas:!!raw.gas,brake:!!raw.brake,drift:!this.airborne&&!!raw.drift,steer:Number.isFinite(raw.steer)?clamp(raw.steer,-1,1):0};
    const previousZ=this.z;
    this.input=input;this.time+=dt;this.landing=Math.max(0,this.landing-dt);this.boost=Math.max(0,this.boost-dt);this.hop=Math.max(0,this.hop-dt);
    this.steer+=(input.steer-this.steer)*(1-Math.exp(-dt*18));
    if(input.drift&&!this.lastDrift&&this.speed>8)this.hop=.3;
    if(input.drift&&!this.drift&&this.speed>10&&Math.abs(input.steer)>.12){this.drift=Math.sign(input.steer);this.charge=0;}
    if(this.drift&&(!input.drift||this.speed<7)){
      if(!input.drift&&this.tier){this.boost=[0,.8,1.4,2.1][this.tier];this.boostCount++;}
      this.drift=0;this.charge=0;this.tier=0;
    }
    if(this.drift){this.charge+=dt*(.7+.7*Math.abs(this.steer));this.tier=this.charge>=3.4?3:this.charge>=2?2:this.charge>=.8?1:0;}
    const max=this.boost>0?42:this.airborne?Math.max(28,this.launchSpeed):28;
    if(this.airborne)this.speed=Math.max(this.speed,this.launchSpeed);
    else if(input.brake)this.speed=Math.max(-6,this.speed-24*dt);
    else if(input.gas||this.boost>0)this.speed=Math.min(max,this.speed+(this.boost>0?38:13)*dt);
    else this.speed=Math.sign(this.speed)*Math.max(0,Math.abs(this.speed)-6*dt);
    if(this.speed>max)this.speed=Math.max(max,this.speed-20*dt);
    const turn=this.drift?this.drift*.12+this.steer*.85:this.steer;
    this.heading+=turn*1.35*clamp(this.speed/20,-.4,1)*dt*(this.airborne?.55:1);
    this.x+=Math.sin(this.heading)*this.speed*dt;this.z-=Math.cos(this.heading)*this.speed*dt;this.distance+=Math.abs(this.speed)*dt;
    // The visible wedge is the launch surface. Preserve forward momentum in air.
    if(!this.airborne && previousZ<RAMP.end && this.z>=RAMP.end && Math.abs(this.x+this.config.radius)<this.config.halfWidth && this.speed>.1){
      this.airborne=true;this.flightAge=0;this.y=RAMP.height;
      this.vy=Math.min(9,4+this.speed*.14);this.launchSpeed=this.speed;this.jumpCount++;
      this.drift=0;this.charge=0;this.tier=0;this.hop=0;
    }
    if(this.airborne){
      const before=this.flightAge;this.flightAge+=dt;
      if(before<.3&&this.flightAge>=.3)this.vy*=.5;
      this.vy=Math.max(this.flightAge<.3?-30:-3,this.vy-(this.flightAge<.3?13:3.5)*dt);
      this.y+=this.vy*dt;
      if(this.y<=0){this.y=0;this.vy=0;this.airborne=false;this.landing=.25;}
    }else this.y=rampHeight(this.x,this.z,this.config);
    // Keep repeated filming attempts on the road with a forgiving curb slide.
    const c=this.config,cz=clamp(this.z,-c.straight,c.straight),dx=this.x,dz=this.z-cz,d=Math.hypot(dx,dz),edge=c.halfWidth-1.5;
    if(!this.airborne&&Math.abs(d-c.radius)>edge){const legal=clamp(d,c.radius-edge,c.radius+edge);this.x=dx/(d||1)*legal;this.z=cz+dz/(d||1)*legal;this.speed*=Math.exp(-dt*1.5);}
    this.lastDrift=input.drift;
  }
}
