/** Convert locally supplied source archives; does not download or select assets. */
import {chromium} from 'playwright';
import {writeFile,readFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const origin=process.env.KART_BUILD_ORIGIN||'http://localhost:8080';
const source=process.env.KART_SOURCE_URL||'/games/mario-kart/evidence/asset-study/';
const out='assets/mario-kart/mario-source.glb';
const browser=await chromium.launch({channel:'chrome',headless:true});
try {
 const page=await browser.newPage();page.on('pageerror',e=>console.error(e.message));
 await page.goto(origin+'/games/mario-kart/pipeline/source-build.html');
 await page.waitForFunction(()=>window.buildSourceKart);
 const base64=await page.evaluate(base=>buildSourceKart(base),source);
 const bytes=Buffer.from(base64,'base64');
 if(bytes.readUInt32LE(0)!==0x46546c67)throw new Error('Conversion did not produce a GLB');
 await mkdir('assets/mario-kart',{recursive:true});await writeFile(out,bytes);
 const converters={};for(const file of ['source-models.js','source-pose.js','source-build.html'])converters[file]=createHash('sha256').update(await readFile(new URL(file,import.meta.url))).digest('hex');
 await writeFile('assets/mario-kart/mario-source.provenance.json',JSON.stringify({source:'Nintendo Mario Kart 8 assets, The Models Resource; not original GameVitto artwork or covered by its software license',pages:['https://models.spriters-resource.com/wii_u/mariokart8/asset/292062/','https://models.spriters-resource.com/wii_u/mariokart8/asset/293519/','https://models.spriters-resource.com/wii_u/mariokart8/asset/353815/'],credits:['Nintendo','Mystie (Mario extraction)','RayK (Standard Kart submission)','BillyGaming964 (tire submission)'],convertedAt:new Date().toISOString(),sha256:createHash('sha256').update(bytes).digest('hex'),converters},null,2));
 console.log(`Converted ${out}: ${bytes.length} bytes. Existing manifest unchanged.`);
} finally {await browser.close();}
