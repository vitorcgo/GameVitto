/** The source TV surfaces use framebuffer V-down coordinates, unlike the signs. */
export function orientSourceScreen(mesh) {
  if(!mesh.isMesh||!['fc_TV_MKTV','fc_TV_capture'].includes(mesh.material.name)||mesh.userData.gamevittoScreenUpright)return false;
  mesh.geometry=mesh.geometry.clone();
  const uv=mesh.geometry.attributes.uv;
  for(let i=0;i<uv.count;i++)uv.setY(i,1-uv.getY(i));
  uv.needsUpdate=true;mesh.userData.gamevittoScreenUpright=true;
  return true;
}

/** Optional atlas from the local source pack. Playback timing is art-directed. */
export async function loadSourceTvBrand(root,descriptor,local) {
  if(!descriptor)return null;
  const {TextureLoader,SRGBColorSpace,LinearFilter,MeshBasicMaterial,DoubleSide}=await import('three');
  const {image,frames,columns,frameWidth,frameHeight,padding}=descriptor;
  if(typeof image!=='string'||![frames,columns,frameWidth,frameHeight,padding].every(Number.isInteger)||frames<21||frames>256||columns<1||columns>32||frameWidth<1||frameHeight<1||frameWidth>2048||frameHeight>2048||padding<1||padding>16)return null;
  try {
    const texture=await new TextureLoader().loadAsync(local(image));
    const cellWidth=frameWidth+2*padding,cellHeight=frameHeight+2*padding,width=columns*cellWidth,height=Math.ceil(frames/columns)*cellHeight;
    if(texture.image.width!==width||texture.image.height!==height){texture.dispose();return null;}
    texture.colorSpace=SRGBColorSpace;texture.generateMipmaps=false;texture.minFilter=texture.magFilter=LinearFilter;
    texture.repeat.set(frameWidth/width,frameHeight/height);
    root.traverse(o=>{if(o.isMesh&&o.material.name==='fc_TV_MKTV')o.material=new MeshBasicMaterial({name:'fc_TV_MKTV',map:texture,side:DoubleSide});});
    let start=null,frame=-1;
    return {get frame(){return frame;},update(time){
      start??=time;const tick=Math.floor(Math.max(0,time-start)*20),next=tick<frames?tick:20+(tick-frames)%(frames-20);
      if(next===frame)return;frame=next;
      texture.offset.set(((frame%columns)*cellWidth+padding)/width,1-(Math.floor(frame/columns)*cellHeight+padding+frameHeight)/height);
    }};
  } catch {return null;}
}
