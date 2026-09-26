"""Extract timestamped review frames and an unaltered silent video excerpt.
This packages browser evidence; it does not render or enhance the game.
"""
from pathlib import Path
import sys, subprocess, json, hashlib, datetime
import imageio_ffmpeg
from PIL import Image,ImageDraw
folder=Path(sys.argv[1]);src=folder/'keyboard-demo.webm';ff=imageio_ffmpeg.get_ffmpeg_exe()
frames=folder/'frames';frames.mkdir(exist_ok=True)
# Seek explicit source timestamps; fps resampling may choose a nearby midpoint.
for old in frames.glob('*.png'): old.unlink()
for seconds in range(0,128,8):
 subprocess.run([ff,'-v','error','-y','-ss',str(seconds),'-i',str(src),'-vf','scale=400:250','-frames:v','1',str(frames/f'{seconds:03d}.png')],check=True)
files=sorted(frames.glob('*.png'));sheet=Image.new('RGB',(1600,4*278),'#111722');draw=ImageDraw.Draw(sheet)
for i,f in enumerate(files):
 x=(i%4)*400;y=(i//4)*278;sheet.paste(Image.open(f),(x,y));draw.text((x+10,y+257),f'Playback {int(f.stem):03d}s',fill='#e7e8ea')
sheet.save(folder/'contact.png')
subprocess.run([ff,'-v','error','-y','-i',str(src),'-t','48','-an','-c:v','libx264','-preset','medium','-crf','18','-pix_fmt','yuv420p','-movflags','+faststart',str(folder/'preview.mp4')],check=True)
(folder/'media-manifest.json').write_text(json.dumps({'createdAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'method':'Playwright real keyboard race; timestamped 8-second samples; unaltered 48-second H264 excerpt','sampleSeconds':[int(f.stem) for f in files],'sha256':{p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in [src,folder/'preview.mp4',folder/'contact.png']}},indent=2))
print(folder/'contact.png')
