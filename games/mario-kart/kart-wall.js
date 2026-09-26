import {kartCorners} from './surface-contact.js';

/** Fit the existing physical kart footprint inside the measured road edge.
 * Sample the edge at each corner's route station so a curved rail cannot cut
 * through a long chassis even when its centre remains inside the road.
 */
export function kartWallLimits(track,racer,time=0) {
  const road=track.bounds(racer.s,racer.lateral);
  // No detailed corner projections while comfortably inside the course.
  if(racer.lateral>road.min+3&&racer.lateral<road.max-3)return road;
  const frame=track.frame(racer.s,racer.heading,racer.lateral,racer.surfaceForward,racer.surfaceNormal);
  let min=-Infinity,max=Infinity;
  for(const corner of kartCorners(racer,frame,time)){
    const near=track.project(corner,racer.s),edge=track.bounds(near.s,near.lateral);
    const offset=near.lateral-racer.lateral;
    min=Math.max(min,edge.min+.15-offset);
    max=Math.min(max,edge.max-.15-offset);
  }
  // Extremely narrow malformed strips cannot invert the interval.
  if(min>max){const center=(min+max)/2;return {min:center,max:center};}
  return {min,max};
}
