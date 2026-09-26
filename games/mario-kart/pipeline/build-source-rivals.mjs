/** Convert supplied local racer archives. Does not change the asset manifest. */
import {chromium} from 'playwright';
import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const hash=data=>createHash('sha256').update(data).digest('hex');
const origin=process.env.KART_BUILD_ORIGIN||'http://localhost:8080',source=process.env.KART_SOURCE_URL||'/games/mario-kart/evidence/asset-study/';
const ids=process.argv.slice(2);if(!ids.length)ids.push('luigi','peach','yoshi','toad','bowser','donkey-kong','koopa');
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 await mkdir('assets/mario-kart',{recursive:true});
 for(const id of ids){
  const page=await browser.newPage();page.on('pageerror',e=>console.error(e.message));
  await page.goto(origin+'/games/mario-kart/pipeline/source-build.html');await page.waitForFunction(()=>window.buildSourceKart);
  const bytes=Buffer.from(await page.evaluate(({source,id})=>buildSourceKart(source,id),{source,id}),'base64');
  if(bytes.readUInt32LE(0)!==0x46546c67)throw new Error('Invalid GLB');
  const converters={};for(const file of ['source-rivals.js','source-models.js','source-pose.js','source-build.html','build-source-rivals.mjs'])converters[file]=hash(await readFile(new URL(file,import.meta.url)));
  const inputs={};for(const dir of [id,'mario','kart','tires'])for(const file of await readdir(`games/mario-kart/evidence/asset-study/${dir}`,{recursive:true}))if(/\.(dae|png)$/i.test(file))inputs[dir+'/'+file]=hash(await readFile(`games/mario-kart/evidence/asset-study/${dir}/${file}`));
  const sourceRecord=JSON.parse(await readFile(`games/mario-kart/evidence/asset-study/${id}-source.json`));
  await writeFile(`assets/mario-kart/${id}-source.glb`,bytes);
  await writeFile(`assets/mario-kart/${id}-source.provenance.json`,JSON.stringify({source:sourceRecord,sharedSources:['https://models.spriters-resource.com/wii_u/mariokart8/asset/293519/','https://models.spriters-resource.com/wii_u/mariokart8/asset/353815/'],sharedCredits:['Nintendo','RayK (Standard Kart submission)','BillyGaming964 (tire submission)'],convertedAt:new Date().toISOString(),sha256:hash(bytes),converters,inputs},null,2));
  console.log(`${id}: ${bytes.length} bytes; manifest unchanged.`);await page.close();
 }
}finally{await browser.close();}
