'use strict';
// Dedicated prototype runner. Does not import or start GameVitto's server.js.
const express = require('express');
const https = require('https');
const path = require('path');
const fs = require('fs');
const {execFile} = require('child_process');
const {Server} = require('socket.io');
const QRCode = require('qrcode');
const {ensureCert, localAddresses} = require('../../scripts/gen-cert');
const root = path.resolve(__dirname, '../..');
const port = Number(process.env.PORT) || 8444;
const title = 'Test';
const tls = ensureCert();
if (!tls) { console.error('HTTPS certificate required for phone motion. Install openssl and retry.'); process.exit(1); }
const app = express();
app.use((_req,res,next)=>{res.set('Cache-Control','no-cache');next();});
const serve = (url, file) => app.get(url, (_req,res)=>res.sendFile(path.join(root,file)));
serve('/', 'tests/kart-prototype/index.html');
for (const file of ['scene.mjs','physics.mjs','showcase.mjs','style.css']) serve('/'+file, 'tests/kart-prototype/'+file);
// Shared motion and visual helpers; the full game and audio are not served.
for (const file of ['net.js','orientation.js']) serve('/core/'+file,'core/'+file);
for (const file of ['input.js','track.js','surface-track.js','surface-mesh.js','wheel-support.js']) serve('/games/mario-kart/'+file,'games/mario-kart/'+file);
for (const file of ['source-world.js','surface-camera.js','source-screens.js','source-crowd.js','source-visible.js','source-materials.js','stadium-crowd.js','atmosphere.js','stadium-broadcast.js']) serve('/games/mario-kart/'+file,'games/mario-kart/'+file);
for (const file of ['manifest.json','mario-source.glb','stadium-source.glb','stadium-route.json','stadium-tv-brand.png']) serve('/assets/mario-kart/'+file,'assets/mario-kart/'+file);
serve('/games/alien-attack/logic.js','games/alien-attack/logic.js');
app.get('/favicon.ico',(_req,res)=>res.status(204).end());
app.use('/vendor/three',express.static(path.join(root,'node_modules/three/build')));
app.use('/vendor/three-examples',express.static(path.join(root,'node_modules/three/examples/jsm')));
app.get('/controller',(_req,res)=>res.type('html').send(
  fs.readFileSync(path.join(root,'public/controller.html'),'utf8')
    .replace('MARIO KART · Hold sideways',title.toUpperCase()+' · Hold sideways')));
app.get('/controller.js',(_req,res)=>res.type('js').send(
  fs.readFileSync(path.join(root,'public/controller.js'),'utf8')
    .replace('function phoneAudioUnlock() {','function phoneAudioUnlock() { return; // Silent prototype remote.\n')
    .replace('function pSound(kind) {','function pSound(kind) { return; // No phone speaker effects.\n')));
const controllerUrl = `https://${localAddresses()[0] || 'localhost'}:${port}/controller`;
app.get('/api/test',async(_req,res)=>{
  try { res.json({title,url:controllerUrl,qr:await QRCode.toDataURL(controllerUrl,{margin:1,width:240})}); }
  catch(error) {res.status(500).json({error:error.message});}
});
const server = https.createServer(tls,app);
const io = new Server(server,{transports:['websocket','polling'],pingInterval:5000,pingTimeout:3000});
let controller = null;
const games = new Set();
const profile = () => {if(controller&&games.size)io.to(controller).emit('feedback',{type:'controller-profile',profile:'wheel'});};
function presence(){io.emit('presence',{game:games.size,controller:controller?1:0,slots:[{slot:0,occupied:!!controller}]});profile();}
io.on('connection',socket=>{
  socket.on('register',role=>{
    if(socket.data.role) return;
    if(role==='controller') {
      if(controller){socket.emit('slot-denied',{max:1});return;}
      controller=socket.id;socket.data.role=role;socket.join(role);socket.emit('slot',{slot:0});
    } else if(role==='game'){socket.data.role=role;games.add(socket.id);socket.join(role);}
    else return;
    presence();
  });
  for(const event of ['orientation','motion','command'])socket.on(event,data=>{
    if(socket.id===controller&&data&&typeof data==='object')socket.to('game').emit(event,{...data,slot:0});
  });
  socket.on('feedback',data=>{if(games.has(socket.id)&&controller&&data?.type==='controller-profile')io.to(controller).emit('feedback',data);});
  socket.on('ping-probe',data=>{if(games.has(socket.id))socket.to('controller').emit('ping-probe',data);});
  socket.on('pong-probe',data=>{if(socket.id===controller)socket.to('game').emit('pong-probe',data);});
  socket.on('disconnect',()=>{if(controller===socket.id)controller=null;games.delete(socket.id);presence();});
});
const lease=setInterval(profile,1000);
server.on('error',error=>{console.error(error.code==='EADDRINUSE'?`Port ${port} is busy. Stop the other test or run with PORT=<free port>.`:error.message);clearInterval(lease);process.exit(1);});
server.listen(port,'0.0.0.0',()=>{
  const url=`https://localhost:${port}/`;
  console.log(`\n${title.toUpperCase()}\n  Computer: ${url}\n  Phone:    ${controllerUrl}\n\nSame Wi-Fi → scan the on-screen QR → accept the local certificate → enable motion.\nHold sideways and level. 2 gas · 1 brake · A drift / release to boost · − recenter · Home reset\nKeyboard: Z gas · arrows steer · Shift drift · R reset · P pairing\nShowcase: 1–4 character stages · 5 stadium tour · 0 driving\nSilent scene and remote. Ctrl+C stops this test.\n`);
  if(process.env.NO_OPEN!=='1'){
    const command=process.platform==='darwin'?'open':process.platform==='win32'?'cmd':'xdg-open';
    execFile(command,process.platform==='win32'?['/c','start','',url]:[url],()=>{});
  }
});
function stop(){clearInterval(lease);io.close();server.close(()=>process.exit(0));}
process.on('SIGINT',stop);process.on('SIGTERM',stop);
