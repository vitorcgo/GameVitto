/** Convert a local course archive and measured route; does not select the course. */
import {chromium} from 'playwright';
import {readFile,writeFile,readdir,mkdir} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const origin=process.env.KART_BUILD_ORIGIN||'http://localhost:8080';
const directory=resolve(process.env.KART_STADIUM_DIR||'games/mario-kart/evidence/asset-study/stadium');
const base=process.env.KART_STADIUM_URL||'/games/mario-kart/evidence/asset-study/stadium/';
const routeFile=process.env.KART_STADIUM_ROUTE||'assets/mario-kart/stadium-route.json';
if(!process.env.KART_STADIUM_ROUTE)execFileSync('python3',[fileURLToPath(new URL('source-road.py',import.meta.url)),join(directory,'Mario Kart Stadium.obj'),routeFile],{stdio:'inherit'});
execFileSync('python3',[fileURLToPath(new URL('source-surface.py',import.meta.url)),join(directory,'Mario Kart Stadium.obj'),routeFile,routeFile],{stdio:'inherit'});
const route=JSON.parse(await readFile(routeFile,'utf8'));
if(!Number.isFinite(route.scale)||route.scale<=0||route.origin?.length!==3||!route.origin.every(Number.isFinite))throw new Error('Invalid course transform');
if(!Array.isArray(route.points)||route.points.length<100||!Number.isFinite(route.length))throw new Error('A measured course route is required');
const files=await readdir(directory);const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const sourceFiles={};for(const file of files)sourceFiles[file]=hash(await readFile(join(directory,file)));
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`)});
 await page.goto(origin+'/games/mario-kart/pipeline/stadium-build.html');await page.waitForFunction(()=>window.buildSourceStadium);
 const base64=await page.evaluate(args=>buildSourceStadium(args),{base,files,transform:route});
 if(errors.length)throw new Error(errors.join('\n'));
 const bytes=Buffer.from(base64,'base64');if(bytes.readUInt32LE(0)!==0x46546c67)throw new Error('Course conversion did not produce a GLB');
 await mkdir('assets/mario-kart',{recursive:true});
 await writeFile('assets/mario-kart/stadium-source.glb',bytes);
 await writeFile('assets/mario-kart/stadium-route.json',JSON.stringify(route));
 const converters={};for(const file of ['source-stadium.js','stadium-build.html','build-source-stadium.mjs','source-road.py','source-surface.py','../source-visible.js','../source-materials.js'])converters[file]=hash(await readFile(new URL(file,import.meta.url)));
 await writeFile('assets/mario-kart/stadium-source.provenance.json',JSON.stringify({source:'Nintendo Mario Kart 8 assets, The Models Resource; not original GameVitto artwork or covered by its software license',page:'https://models.spriters-resource.com/wii_u/mariokart8/asset/293504/',credits:['Nintendo','RayK (course submission)'],convertedAt:new Date().toISOString(),sha256:hash(bytes),routeSha256:hash(await readFile('assets/mario-kart/stadium-route.json')),sourceFiles,converters,selectedForGameplay:false},null,2));
 console.log(`Converted stadium-source.glb: ${bytes.length} bytes. Gameplay course unchanged.`);
}finally{await browser.close()}
