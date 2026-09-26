"""Reject an empty 3D view independently of gameplay telemetry or shader logs."""
from PIL import Image
from collections import Counter
import json,sys
im=Image.open(sys.argv[1]).convert('RGB');w,h=im.size
# Central road/kart region excludes the HTML HUD. Coarse bins tolerate encoding noise.
sample=im.crop((int(w*.18),int(h*.20),int(w*.80),int(h*.77))).resize((160,100))
bins=Counter(tuple(v//16 for v in p) for p in sample.get_flattened_data());dominant=bins.most_common(1)[0][1]/16000
result={'dominantColorFraction':round(dominant,4),'occupiedColorBins':len(bins),'nonemptyScene':dominant<.72 and len(bins)>24}
print(json.dumps(result))
if not result['nonemptyScene']:sys.exit(1)
