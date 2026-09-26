#!/usr/bin/env python3
"""Decode, measure and make a seekable MP4 from the real browser AV recording.
Audio timestamps include pause gaps: preserve them instead of concatenating PCM.
"""
import json,subprocess,sys
from pathlib import Path
import numpy as np
import imageio_ffmpeg
p=Path(sys.argv[1]);ff=imageio_ffmpeg.get_ffmpeg_exe();out=p.with_suffix('.mp4')
subprocess.run([ff,'-v','error','-y','-i',str(p),'-vf','fps=30','-af','aresample=async=1:first_pts=0','-c:v','libx264','-threads','2','-preset','fast','-crf','20','-c:a','aac','-b:a','192k','-movflags','+faststart',str(out)],check=True)
x=np.frombuffer(subprocess.check_output([ff,'-v','error','-i',str(out),'-vn','-ac','1','-ar','24000','-f','f32le','-']),np.float32)
db=lambda v:float(20*np.log10(max(1e-12,float(v))))
report={'file':out.name,'audioDuration':len(x)/24000,'peakDBFS':db(np.max(np.abs(x))),'rmsDBFS':db(np.sqrt(np.mean(x*x))),'clippedSamples':int(np.count_nonzero(np.abs(x)>=.999)),'method':'Decode final MP4 audio; resample against timestamps to retain pause gaps; mono 24kHz measurement.'}
chapters=p.parent/'sound-report.json'
if chapters.is_file():
 r=json.loads(chapters.read_text());t=next(c['time'] for c in r['chapters'] if c['name']=='Mute the complete mix');y=x[int((t+.25)*24000):int((t+.8)*24000)];report['mutedRmsDBFS']=db(np.sqrt(np.mean(y*y)))
(p.parent/(p.stem+'-media.json')).write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report))
