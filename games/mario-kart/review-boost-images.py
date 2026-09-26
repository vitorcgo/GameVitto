"""Check rendered scene visibility and expose the exact effect comparison for review."""
import json,sys
from pathlib import Path
from PIL import Image,ImageDraw
import numpy as np
root=Path(sys.argv[1]);stats={}
for name in ['off','bank','drift','straight','tail','expired']:
 a=np.asarray(Image.open(root/(name+'.png')).convert('RGB'))
 # Road/stadium region, separate from the DOM HUD that survives a broken render.
 region=a[200:500,100:1300];lit=(region.max(2)>35).mean()
 stats[name]={'sceneVisibleFraction':float(lit),'pass':bool(lit>.65)}
(root/'image-verification.json').write_text(json.dumps(stats,indent=2))
assert all(s['pass'] for s in stats.values()),stats
canvas=Image.new('RGB',(1200,440),'#10151d');d=ImageDraw.Draw(canvas)
for i,(name,label) in enumerate([('off','Before boost'),('bank','Boost active'),('expired','After expiry')]):
 im=Image.open(root/(name+'.png')).crop((580,420,980,820));canvas.paste(im,(i*400,35));d.text((i*400+12,10),label,fill='white')
canvas.save(root/'boost-comparison.jpg',quality=92)
print('PASS: all six rendered scenes remain visible')
