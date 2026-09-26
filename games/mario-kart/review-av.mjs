/** Capture this test tab (including HTML HUD) and the game's actual master
 * audio bus into one MediaRecorder timeline. Never captures the desktop. */
import {writeFile,appendFile,stat} from 'node:fs/promises';
export const captureArgs=['--auto-accept-this-tab-capture'];
export async function startAV(page,file){
 await writeFile(file,Buffer.alloc(0));
 await page.exposeFunction('__writeAV',async data=>appendFile(file,Buffer.from(data,'base64')));
 page.__avFile=file;
 return page.evaluate(async()=>{
  const screen=await navigator.mediaDevices.getDisplayMedia({video:true,audio:false,preferCurrentTab:true});
  const sound=__kart.audioStream();if(!sound?.getAudioTracks().length)throw new Error('No game audio bus');
  if(screen.getVideoTracks()[0].getSettings().displaySurface!=='browser')throw new Error('Review must capture only this tab');
  const stream=screen;stream.addTrack(sound.getAudioTracks()[0]);
  const recorder=new MediaRecorder(stream,{mimeType:'video/webm;codecs=vp8,opus',videoBitsPerSecond:8_000_000,audioBitsPerSecond:192_000});
  const preview=document.createElement('video');preview.muted=true;preview.srcObject=stream;await preview.play();
  window.__avFrames=0;let pumping=true;const frame=()=>{window.__avFrames++;if(pumping)preview.requestVideoFrameCallback(frame);};preview.requestVideoFrameCallback(frame);
  window.__avRecorder=recorder;window.__avErrors=[];window.__avSizes=[];recorder.onerror=e=>__avErrors.push(String(e.error));
  let writes=Promise.resolve();
  recorder.ondataavailable=e=>{__avSizes.push(e.data.size);if(e.data.size)writes=writes.then(()=>new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>__writeAV(reader.result.split(';base64,')[1]).then(resolve,reject);reader.onerror=reject;reader.readAsDataURL(e.data);}));};
  let stopped;window.__stopAV=()=>stopped??=(new Promise(resolve=>{recorder.onstop=async()=>{await writes;pumping=false;preview.pause();preview.srcObject=null;screen.getVideoTracks().forEach(t=>t.stop());resolve();};recorder.stop();}));
  recorder.start(1000);window.__avStarted=performance.now();
  return {video:screen.getVideoTracks()[0].getSettings(),audio:sound.getAudioTracks()[0].getSettings(),method:'This-tab HTML + WebGL video and game master-bus audio, one MediaRecorder timeline'};
 });
}
export async function stopAV(page){await page.evaluate(()=>window.__stopAV?.());const expected=await page.evaluate(()=>__avSizes.reduce((a,b)=>a+b,0));const actual=(await stat(page.__avFile)).size;if(actual!==expected||actual<10000)throw new Error(`Incomplete capture: saved ${actual} of ${expected} bytes`);}
