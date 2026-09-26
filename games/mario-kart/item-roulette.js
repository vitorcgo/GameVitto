/** A continuous vertical reel, advanced by the simulation clock (pause/seek safe).
 * The result comes from gameplay, never from the visual icon sequence. */
export function itemRoulette(node,icons,items){
 let previous=-1,phase=0,settle=null,key='',wasRolling=false;
 const wrap=n=>((n%items.length)+items.length)%items.length;
 function reel(at){
  const base=Math.floor(at),fraction=at-base,html=[-1,0,1].map(offset=>`<div class="reel-cell">${icons[items[wrap(base+offset)]]}</div>`).join('');
  const next=String(base);
  if(key!==next){node.innerHTML=`<div class="item-reel">${html}</div>`;key=next;}
  node.firstElementChild.style.transform=`translateY(${-100-fraction*100}%)`;
 }
 return (time,remaining,item)=>{
  const dt=previous<0||time<previous?0:Math.min(.1,time-previous);previous=time;
  if(remaining>0){
   if(!wasRolling){phase=0;settle=null;key='';node.getAnimations().forEach(a=>a.cancel());}
   phase+=dt*(remaining>.5?18:5+26*remaining);
   reel(phase);wasRolling=true;node.classList.add('rolling');return;
  }
  if(wasRolling&&item){
   const target=items.indexOf(item),base=Math.ceil(phase);
   settle={start:time,from:phase,to:base+wrap(target-wrap(base))};
  }
  wasRolling=false;
  if(settle&&item){
   const t=Math.min(1,(time-settle.start)/.24);
   reel(settle.from+(settle.to-settle.from)*(1-Math.pow(1-t,3)));
   if(t<1)return;settle=null;
  }else settle=null;
  node.classList.remove('rolling');
  const next='item:'+item;
  if(key!==next){node.innerHTML=icons[item]||'';key=next;}
 };
}
