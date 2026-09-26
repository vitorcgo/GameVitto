const smooth = value => { const t=Math.max(0,Math.min(1,value));return t*t*(3-2*t); };

/** Presentation clock follows race time, so pausing also pauses the canopy. */
export function gliderDeployment(state,gliding,flight,time){
  if(gliding){
    state.amount=smooth((flight||0)/.32);
    state.closingAt=null;
  }else if(state.wasGliding){
    state.closingAt=time;
    state.closeFrom=state.amount||0;
  }
  if(!gliding){
    state.amount=state.closingAt==null?0:state.closeFrom*(1-smooth((time-state.closingAt)/.22));
  }
  state.wasGliding=gliding;
  return state.amount;
}

export function updateGlider(glider,racer,time){
  const state=glider.userData.deployment||(glider.userData.deployment={amount:0,wasGliding:false,closingAt:null});
  const amount=gliderDeployment(state,racer.gliding,racer.flight,time);
  glider.visible=amount>.001;
  // Collapse around the rear mounting point rather than the world/road origin.
  glider.scale.set(.025+.975*amount,.08+.92*amount,.2+.8*amount);
  glider.position.set(0,1.3-.18*(1-amount),.15+.4*(1-amount));
  glider.rotation.x=(1-amount)*.25;
  glider.rotation.z=-racer.steer*.13*amount;
}
