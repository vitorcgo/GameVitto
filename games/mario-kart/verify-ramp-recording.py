"""Compare captured physical positions, not the ramp trigger implementation."""
from pathlib import Path
import json,math
base=Path(__file__).parent/'evidence/overnight'
result={"method":"Measured displacement divided by recorded speed and elapsed race time. Exclude the first 0.1s after explicit staged placement, which settles onto source geometry. Preserve the unfiltered maximum separately."}
for label,folder in [('before','63a-ramp-before'),('after','63b-ramp-after')]:
 frames=json.loads((base/folder/'ramp.json').read_text())['frames']
 all_pairs=[(a,b) for a,b in zip(frames,frames[1:]) if b['time']>a['time']]
 pairs=[(a,b) for a,b in all_pairs if a['time']>frames[0]['time']+.1]
 def ratio(a,b):return math.hypot(a['x']-b['x'],a['z']-b['z'])/(max(a['speed'],b['speed'])*(b['time']-a['time']))
 air=[f for f in frames if f['jump']]
 result[label]={'maxFrameDrop':max(a['y']-b['y'] for a,b in pairs),'maxHorizontalFrameTravel':max(math.hypot(a['x']-b['x'],a['z']-b['z']) for a,b in pairs),'maxTravelToSpeedRatio':max(ratio(a,b) for a,b in pairs),'unfilteredMaxTravelToSpeedRatio':max(ratio(a,b) for a,b in all_pairs),'airborneFrames':len(air),'airTime':air[-1]['time']-air[0]['time'] if air else 0,'lastFrameGrounded':frames[-1]['jump'] is None}
a=result['after'];result['passed']=a['maxTravelToSpeedRatio']<1.1 and a['airborneFrames']>30 and a['lastFrameGrounded'] and a['maxFrameDrop']<.25
(base/'63b-ramp-after/continuity-verification.json').write_text(json.dumps(result,indent=2));print(json.dumps(result,indent=2));assert result['passed']
