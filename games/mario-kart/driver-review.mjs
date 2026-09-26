import { chromium } from 'playwright';
import { mkdir, writeFile, rename } from 'node:fs/promises';
import assert from 'node:assert/strict';
const out = process.env.EVIDENCE_DIR || 'games/mario-kart/evidence/overnight/34-driver-glance';
await mkdir(out, {recursive:true});
const browser = await chromium.launch({channel:'chrome',headless:true});
const report = {method:'Staged adjacent-racer gaze; recorded real-time head movement, GLB and fallback.', cases:[], errors:[]};
try {
  for (const fallback of [false,true]) {
    const context = await browser.newContext({viewport:{width:1440,height:900}, recordVideo:{dir:out,size:{width:1440,height:900}}});
    const page = await context.newPage();
    if (fallback) await page.route('**/assets/mario-kart/**', route=>route.abort());
    page.on('pageerror',error=>report.errors.push(error.message));
    await page.goto('http://localhost:8080/games/mario-kart/?evidence=1&sourceCourse=0');
    await page.waitForFunction(fallback=>window.__kart?.karts.every(k=>fallback ? k.source!=='glb' : k.source==='glb'),fallback);
    await page.evaluate(()=>{__kart.stage('antigrav');__kart.place(60,{speed:30});});
    if (!fallback) await page.waitForFunction(()=>__kart.karts.every(k=>k.source==='glb'));
    await page.waitForTimeout(300);
    for (const side of [1,-1]) {
      await page.evaluate(async side=>{
        const THREE=await import('three'),k=__kart.karts[0],r=__kart.race.player;
        __kart.race.state='racing';r.steer=0;r.spin=0;r.gliding=false;
        for (const [i,other] of __kart.race.racers.entries()) if(i) Object.assign(other,{x:r.x+1000+i*10,y:r.y,z:r.z,s:r.s});
        k.root.updateMatrixWorld(true);
        const offset=new THREE.Vector3(side*3.2,0,0).applyQuaternion(k.root.quaternion);
        const other=__kart.race.racers[1];Object.assign(other,{x:r.x+offset.x,y:r.y+offset.y,z:r.z+offset.z,s:r.s,lateral:side*3.2});
        if(k.driverHead.userData.lookRestQuaternion)k.driverHead.quaternion.fromArray(k.driverHead.userData.lookRestQuaternion);else k.driverHead.rotation.y=0;
        k.lookYaw=0;k.lookTime=0;k.lookCooldown=0;k.lookTarget=null;
        const probes=[];k.root.updateMatrixWorld(true);k.model.traverse(o=>{
          if(!o.isMesh)return;for(let a=o;a&&a!==k.model;a=a.parent)if(/^wheel-[0-3]$/.test(a.name)||a.name==='driver-head')return;
          if(o.isSkinnedMesh)o.skeleton.update();
          for(let i=0;i<o.geometry.attributes.position.count;i+=3){const v=o.getVertexPosition(i,new THREE.Vector3()).applyMatrix4(o.matrixWorld);if(v.y<r.y+1.3)probes.push({object:o,index:i,position:v});}
        });
        window.gazeEvidence={probes,target:new THREE.Vector3(other.x,other.y,other.z),modelPosition:k.model.position.clone(),rootPosition:k.root.position.clone(),body:k.model.children.filter(o=>o.isMesh).map(o=>o.matrixWorld.elements.slice())};
      },side);
      await page.waitForTimeout(500);
      const result=await page.evaluate(async ()=>{
        const THREE=await import('three'),k=__kart.karts[0],head=k.driverHead;
        k.root.updateMatrixWorld(true);
        const center=head.getWorldPosition(new THREE.Vector3());
        const facing=head.localToWorld(new THREE.Vector3(0,0,-1)).sub(center).normalize();
        const target=gazeEvidence.target.clone().sub(center).normalize();
        return {angle:k.lookYaw,facingTargetDot:facing.dot(target),rootMoved:k.root.position.distanceTo(gazeEvidence.rootPosition),bodyMoved:gazeEvidence.probes.some(p=>p.object.getVertexPosition(p.index,new THREE.Vector3()).applyMatrix4(p.object.matrixWorld).distanceTo(p.position)>1e-5),bodyProbes:gazeEvidence.probes.length,headMeshes:head.children.length};
      });
      assert.ok(result.headMeshes>0);assert.ok(result.facingTargetDot>0.3,'The rendered face must turn toward the adjacent racer');
      assert.ok(result.bodyProbes>0);assert.equal(result.rootMoved,0);assert.equal(result.bodyMoved,false);
      await page.screenshot({path:`${out}/${fallback?'fallback':'glb'}-look-${side>0?'right':'left'}.png`});
      report.cases.push({fallback,side,...result});
      await page.keyboard.press('Escape');
      const before=await page.evaluate(()=>__kart.karts[0].lookYaw);
      await page.waitForTimeout(250);
      assert.equal(await page.evaluate(()=>__kart.karts[0].lookYaw),before,'Pause must freeze the pose');
      await page.keyboard.press('Escape');
      await page.evaluate(()=>{for(const r of __kart.race.racers.slice(1))r.x+=1000;});
      await page.waitForTimeout(750);
      assert.ok(Math.abs(await page.evaluate(()=>__kart.karts[0].lookYaw))<0.03,'Head must return to the road when the opponent leaves');
    }
    const path=await page.video().path();await context.close();
    await rename(path,`${out}/${fallback?'fallback':'glb'}-driver-motion.webm`);
  }
  assert.deepEqual(report.errors,[]);
  console.log('PASS',JSON.stringify(report.cases));
} catch(error) {report.failure=error.stack;throw error;}
finally {await writeFile(`${out}/driver-report.json`,JSON.stringify(report,null,2));await browser.close();}
