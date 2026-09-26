#!/usr/bin/env python3
"""Diagnose original waveform matches in the decoded focused recording.
Match mixed audio rather than trusting event logs. A low correlation is
inconclusive: tonal/repeated waves can also match the reversed control.
"""
import json,subprocess,sys
from pathlib import Path
import numpy as np
from scipy.signal import correlate
import imageio_ffmpeg
folder=Path(sys.argv[1]);root=Path(__file__).resolve().parents[2];ff=imageio_ffmpeg.get_ffmpeg_exe();rate=12000
read=lambda p:np.frombuffer(subprocess.check_output([ff,'-v','error','-i',str(p),'-vn','-ac','1','-ar',str(rate),'-f','f32le','-']),np.float32)
x=read(folder/'focused.mp4');report=json.loads((folder/'live-report.json').read_text());chapters=report['chapters'];manifest=json.loads((root/'assets/mario-kart/audio/manifest.json').read_text())['cues'];checks=[]
scenarios=[('Menu music','uiCursor'),('Menu music','uiConfirm'),('Phone selects','uiStart'),('Right arrow','itemImpact'),('Right arrow','hitConfirm'),('Rear collision','contact'),('Star music','star'),('Player is struck','itemImpact'),('Crossing the finish','finish'),('Crossing the finish','finishWin')]
for prefix,cue in scenarios:
 chapter=next(i for i,c in enumerate(chapters) if c['name'].startswith(prefix))
 start=chapters[chapter]['time'];end=chapters[chapter+1]['time'] if chapter+1<len(chapters) else len(x)/rate
 if cue.startswith('ui'):end+=2.6
 source=read(root/'assets/mario-kart/audio'/manifest[cue]['file']);musical=cue in ['star','finish','finishWin'];window=min(len(source),int((.8 if musical else .32)*rate))
 # Select the source's most energetic 320 ms transient, independently of the
 # event timestamp. Scan within the named scenario for that waveform.
 searchStart=2*rate if cue=='finishWin' else 0;searchEnd=min(len(source),3*rate) if cue=='star' else len(source)
 energy=np.convolve(source[searchStart:searchEnd].astype(float)**2,np.ones(window),mode='valid');offset=searchStart+int(np.argmax(energy));template=source[offset:offset+window].astype(float)
 segment=x[max(0,int(start*rate)):int(end*rate)].astype(float)
 numerator=correlate(segment,template,mode='valid',method='fft');cs=np.r_[0,np.cumsum(segment**2)];denom=np.sqrt(np.maximum(1e-20,(cs[window:]-cs[:-window])*np.sum(template**2)));scores=numerator/denom;i=int(np.argmax(scores));score=float(scores[i]);control=float(np.max(np.abs(correlate(segment,template[::-1],mode='valid',method='fft')/denom)));threshold=.65 if musical else max(.12,2*control);checks.append({'scenario':chapters[chapter]['name'],'cue':cue,'correlation':score,'matchedAt':start+i/rate,'sourceOffset':offset/rate,'reversedWaveformControl':control,'requiredCorrelation':threshold,'status':'detected' if score>threshold else 'inconclusive'})
result={'method':'Decode final MP4 to mono 12 kHz; normalized correlation with the original cue waveform inside each recorded scenario. Transient effects must exceed .12 and twice a time-reversed waveform control; music must exceed .65 over 800 ms. Music has periodic waveforms, so reversal is not a valid negative control for it. Match the placement fanfare after its first two seconds, beyond the overlapping finish cue. No reliance on JavaScript event logs for presence. This is a diagnostic, not an audibility gate: overlapping tonal cues can fail the reversal test without being absent. Inconclusive cues need listening or a more discriminating reference.','checks':checks};(folder/'cue-audio-report.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result,indent=2))
