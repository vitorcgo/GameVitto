import * as THREE from 'three';

/** Keep the driver visible when a nearby rail blocks the low chase segment.
 * Search clear lateral/elevated eyes before shortening the arm into the kart.
 * The collision query remains authoritative; no candidate bypasses scenery.
 */
export function clearChaseView(body, head, eye, up, avoid, crown=head) {
  const clear = candidate => avoid(body, candidate).distanceToSquared(candidate)<1e-8 &&
    avoid(head, candidate).distanceToSquared(candidate)<1e-8;
  if (clear(eye)) return eye.clone();
  const bodySafe = avoid(body, eye);
  // Compare ordinary arm shortening with lateral clearance, rather than first
  // zooming deep toward the driver and abruptly switching to a side view.
  const canShorten=bodySafe.distanceTo(body)>4.5 && clear(bodySafe);
  const shortening=canShorten?bodySafe.distanceToSquared(eye):Infinity;
  const back=eye.clone().sub(body),right=new THREE.Vector3().crossVectors(up,back).normalize();
  const offsets=[];
  for(const lateral of [0,-1.5,1.5,-3,3,-4.5,4.5,-6,6])
    for(const height of [0,1.5,3])if(lateral||height)offsets.push({lateral,height,cost:lateral*lateral+height*height*1.4});
  offsets.sort((a,b)=>a.cost-b.cost);
  for(const {lateral,height} of offsets){
    const offset=right.clone().multiplyScalar(lateral).addScaledVector(up,height);
    if(offset.lengthSq()>shortening)return bodySafe;
    const candidate=eye.clone().add(offset);
    if(!clear(candidate))continue;
    // Find the boundary continuously, avoiding fixed-size sideways camera jumps.
    let low=0,high=1;
    for(let i=0;i<6;i++){
      const middle=(low+high)/2;
      if(clear(eye.clone().addScaledVector(offset,middle)))high=middle;else low=middle;
    }
    const buffered=eye.clone().addScaledVector(offset,Math.min(1,high+.04));
    return clear(buffered)?buffered:candidate;
  }
  // A kart already overlapping a rail can have both lower anchors inside it.
  // Preserve a clear view of the upper head instead of pulling the eye into it.
  const upperClear=candidate=>avoid(crown,candidate).distanceToSquared(candidate)<1e-8;
  if(upperClear(eye))return eye.clone();
  for(const {lateral,height} of offsets){
    const candidate=eye.clone().addScaledVector(right,lateral).addScaledVector(up,height);
    if(upperClear(candidate))return candidate;
  }
  const headSafe=avoid(crown,eye);
  return headSafe.distanceTo(body)>bodySafe.distanceTo(body)?headSafe:bodySafe;
}

/** Retain the head's angular placement when clearance translates the eye. */
export function clearanceLookTarget(before, after, head, target) {
  const from=head.clone().sub(before),to=head.clone().sub(after);
  if(from.lengthSq()<1e-8||to.lengthSq()<1e-8)return target.clone();
  const turn=new THREE.Quaternion().setFromUnitVectors(from.normalize(),to.normalize());
  return target.clone().sub(before).applyQuaternion(turn).add(after);
}

/** Damp changes between clear views, validating the intermediate eye against
 * scenery. A one-frame opening must not swing the whole camera sideways.
 */
export function smoothChaseCorrection(eye, resolved, body, crown, avoid, offset, dt) {
  const desired=resolved.clone().sub(eye);
  if(desired.distanceToSquared(offset)<1e-8){offset.copy(desired);return resolved;}
  const proposal=offset.clone().lerp(desired,1-Math.exp(-Math.max(0,dt)*10));
  const candidate=eye.clone().add(proposal);
  if(candidate.distanceTo(body)>4.5 && avoid(crown,candidate).distanceToSquared(candidate)<1e-8){
    offset.copy(proposal);return candidate;
  }
  offset.copy(desired);return resolved;
}
