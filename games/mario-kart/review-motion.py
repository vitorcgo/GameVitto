"""Inspect a short sequence from the actual recording at exact source timestamps."""
from pathlib import Path
import json, math, subprocess, sys
import imageio_ffmpeg
from PIL import Image, ImageDraw
folder = Path(sys.argv[1])
start, duration = float(sys.argv[2]), float(sys.argv[3])
step = float(sys.argv[4]) if len(sys.argv) > 4 else .5
assert start >= 0 and 0 < duration <= 30 and step > 0
out = folder / f'motion-{start:g}'
out.mkdir(exist_ok=True)
timestamps = [start + i * step for i in range(math.ceil(duration / step))]
files = []
for i, second in enumerate(timestamps):
    target = out / f'{i:03d}.png'
    subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(), '-v', 'error', '-y',
                    '-ss', str(second), '-i', str(folder / 'keyboard-demo.webm'),
                    '-frames:v', '1', '-vf', 'scale=360:225', str(target)], check=True)
    if target.exists(): files.append((second, target))
sheet = Image.new('RGB', (1440, math.ceil(len(files) / 4) * 248), '#101923')
draw = ImageDraw.Draw(sheet)
for i, (second, file) in enumerate(files):
    x, y = i % 4 * 360, i // 4 * 248
    sheet.paste(Image.open(file), (x, y))
    draw.text((x + 10, y + 230), f'Source video {second:.2f}s', fill='#eee8dc')
sheet.save(out / 'sequence.png')
(out / 'timestamps.json').write_text(json.dumps([s for s, _ in files]))
print(out / 'sequence.png')
