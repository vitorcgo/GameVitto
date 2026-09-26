#!/usr/bin/env python3
"""Extract Latin letter outlines from the optional original UI sprite archive.
Input: Fonts by Random Talking Bush, The Spriters Resource asset 69863.
These are traced raster glyphs, not the commercial New Rodin font binary.
Usage: python3 games/mario-kart/pipeline/prepare-ui-font.py /path/to/69863.zip
Requires Pillow, numpy, opencv-python, fonttools[woff]. Output remains in the
ignored local asset pack alongside the original course, models and audio.
"""
from pathlib import Path
import hashlib,json,sys,zipfile,io
import cv2,numpy as np
from PIL import Image
from fontTools.fontBuilder import FontBuilder
from fontTools.pens.ttGlyphPen import TTGlyphPen
root=Path(__file__).resolve().parents[3];out=root/'assets/mario-kart/ui';out.mkdir(parents=True,exist_ok=True)
archive=Path(sys.argv[1]);z=zipfile.ZipFile(archive)
characters=''.join(chr(i) for i in range(32,127) if i not in [64,92])
files=[('message','turbo_MessageFontOutline_50_US_62x77.png',characters,62,77,16,60,25),('counter','turbo_DigitalNum_51x75.png','"\'+,-./:;0123456789',51,75,2,72,14)]
for name,file,chars,w,h,cols,baseline,scale in files:
 data=z.read('Mario Kart 8/'+file);im=np.array(Image.open(io.BytesIO(data)))[:,:,0]
 glyphs={'.notdef':TTGlyphPen(None).glyph()};metrics={'.notdef':(500,0)};cmap={}
 for i,c in enumerate(chars):
  cell=im[1+(i//cols)*(h+1):(i//cols)*(h+1)+h+1,1+(i%cols)*(w+1):(i%cols)*(w+1)+w+1]
  mask=(cell>170).astype(np.uint8)*255;ys,xs=np.where(mask);pen=TTGlyphPen(None)
  left=int(xs.min()) if len(xs) else 0;right=int(xs.max()) if len(xs) else 15
  for contour in cv2.findContours(mask,cv2.RETR_TREE,cv2.CHAIN_APPROX_SIMPLE)[0]:
   points=[(int((p[0][0]-left+2)*scale),int((baseline-p[0][1])*scale)) for p in contour]
   if len(points)<3:continue
   pen.moveTo(points[0])
   for pt in points[1:]:pen.lineTo(pt)
   pen.closePath()
  key='uni%04X'%ord(c);glyphs[key]=pen.glyph();metrics[key]=((right-left+6)*scale,2*scale);cmap[ord(c)]=key
 fb=FontBuilder(1000,isTTF=True);fb.setupGlyphOrder(list(glyphs));fb.setupCharacterMap(cmap);fb.setupGlyf(glyphs);fb.setupHorizontalMetrics(metrics)
 fb.setupHorizontalHeader(ascent=1100,descent=-250);fb.setupNameTable({'familyName':'GameVitto MK8 '+name,'styleName':'Regular','uniqueFontIdentifier':'GameVitto MK8 raster '+name,'fullName':'GameVitto MK8 '+name,'psName':'GameVittoMK8-'+name})
 fb.setupOS2(sTypoAscender=1100,sTypoDescender=-250,usWinAscent=1100,usWinDescent=250);fb.setupPost();fb.setupMaxp();fb.font.flavor='woff';fb.save(out/(name+'.woff'))
(out/'provenance.json').write_text(json.dumps({'source':'https://www.spriters-resource.com/wii_u/mariokart8/asset/69863/','uploader':'Random Talking Bush','archiveSha256':hashlib.sha256(archive.read_bytes()).hexdigest(),'method':'White glyph contours extracted at original raster resolution; ASCII subset; original commercial font file not included.'},indent=2)+'\n')
print(out)
