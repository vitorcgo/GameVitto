"""Pack locally supplied MK8 TV frames; does not change the gameplay manifest."""
from pathlib import Path
from PIL import Image
import json,hashlib,datetime,sys
source=Path(sys.argv[1]) if len(sys.argv)>1 else Path('games/mario-kart/evidence/asset-study/stadium')
out=Path('assets/mario-kart');out.mkdir(exist_ok=True,parents=True)
width,height,padding,columns,count=160,90,2,7,49
cell_w,cell_h=width+2*padding,height+2*padding
atlas=Image.new('RGBA',(columns*cell_w,7*cell_h));inputs={}
for i in range(count):
 p=source/f'mktv.{i}.png';image=Image.open(p).convert('RGBA');assert image.size==(width,height)
 inputs[p.name]=hashlib.sha256(p.read_bytes()).hexdigest();x=(i%columns)*cell_w+padding;y=(i//columns)*cell_h+padding
 atlas.paste(image,(x,y))
 for box,dest,size in [((0,0,1,height),(x-padding,y),(padding,height)),((width-1,0,width,height),(x+width,y),(padding,height)),((0,0,width,1),(x,y-padding),(width,padding)),((0,height-1,width,height),(x,y+height),(width,padding))]:atlas.paste(image.crop(box).resize(size,Image.Resampling.NEAREST),dest)
 for ix,iy in [(0,0),(width-1,0),(0,height-1),(width-1,height-1)]:atlas.paste(Image.new('RGBA',(padding,padding),image.getpixel((ix,iy))),(x-padding if ix==0 else x+width,y-padding if iy==0 else y+height))
p=out/'stadium-tv-brand.png';atlas.save(p,optimize=True)
descriptor={'image':p.name,'frames':count,'columns':columns,'frameWidth':width,'frameHeight':height,'padding':padding}
(out/'stadium-tv-brand.provenance.json').write_text(json.dumps({'source':'Nintendo Mario Kart 8 source TV animation frames; local ignored pack, not original GameVitto artwork or MIT software assets','sourceCourseProvenance':'stadium-source.provenance.json','convertedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'inputs':inputs,'converterSha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'descriptor':descriptor},indent=2))
print(json.dumps(descriptor));print(f'{p}: {p.stat().st_size} bytes')
