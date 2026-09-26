#!/usr/bin/env python3
"""Build the optional local sample pack. Originals remain unchanged and untracked.
Requires numpy/scipy and ffmpeg (or imageio_ffmpeg). Run from any directory.
"""
import hashlib,json,re,shutil,subprocess
from pathlib import Path
import numpy as np
from scipy.signal import fftconvolve
ROOT=Path(__file__).resolve().parents[3]
SOURCE=ROOT/'assets/mario-kart/audio-source'; OUT=ROOT/'assets/mario-kart/audio'
OUT.mkdir(parents=True,exist_ok=True)
try:
 import imageio_ffmpeg
 FFMPEG=imageio_ffmpeg.get_ffmpeg_exe()
except ImportError: FFMPEG='ffmpeg'
inventory=json.loads((SOURCE/'audio-inventory.json').read_text())['wav']
manifest={'version':1,'cues':{},'unresolved':['isolated box shatter','shell flight and impact','banana placement and slip','blue-shell wind-up and explosion']}
def wav(key,name,gain=0.6,scope=None):
 matches=[x for x in inventory if Path(x['file']).name==name and (not scope or scope in x['file'])]
 if len(matches)!=1: raise ValueError((key,name,len(matches)))
 x=matches[0]; source=SOURCE/x['file']; dest=OUT/(key+'.wav'); shutil.copyfile(source,dest)
 entry={'file':dest.name,'source':x['file'],'sha256':hashlib.sha256(source.read_bytes()).hexdigest(),'gain':gain,'duration':x['seconds']}
 if x.get('loopMetadata'):
  nums=re.findall(r'loop (?:start|end): (\d+) samples',x['loopMetadata']); entry.update(loopStart=int(nums[0])/x['rate'],loopEnd=int(nums[1])/x['rate'])
 manifest['cues'][key]=entry
for key,name,gain in [
 ('uiCursor','SE_SYS_CMN_CURSOR.wav',.7),('uiConfirm','SE_SYS_BTN_OK.wav',.65),('uiCancel','SE_SYS_CANCEL_S.wav',.55),('uiStart','SE_SYS_RACE_OK.wav',.65),
 ('countdown','SE_RC_321.wav',.8),('go','SE_RC_GO.wav',.9),('roulette','SE_RC_ITEM_ROULETTE.wav',.48),('decide','SE_RC_ITEM_DECIDE.wav',.85),
 ('drift1','SE_KT_DRIFT_HIBANA_BLUE.wav',.38),('drift2','SE_KT_DRIFT_HIBANA_RED.wav',.42),('drift3','SE_KT_DRIFT_HIBANA_PURPLE.wav',.45),
 ('turbo','SE_KT_DASH_MINI.wav',.75),('ultra','SE_KT_DASH_MINI_ULTRA.wav',.78),('boost','SE_KT_DASH_BOARD_TND.wav',.7),('rocket','SE_KT_START_DASH.wav',.7),('burnout','SE_KT_START_FAIL.wav',.65),
 ('hop','SE_KT_MINI_JUMP.wav',.5),('trick','SE_KT_JUMP_ACTION.wav',.65),('land','SE_KT_LAND_SKID_1.wav',.7),('contact','SE_KT_COL_CAR.wav',.7),('bump','SE_KT_COL_HOVER.wav',.6),('hit','SE_KT_CRASH.wav',.7),('wall','SE_KT_HALFCRASH.wav',.55),
 ('hoverIn','SE_KT_START_HOVERZONE.wav',.6),('hoverOut','SE_KT_FINISH_HOVER.wav',.5),('hover','SE_KT_HOVER_LOOP.wav',.16),('glider','SE_KT_GLIDER_START.wav',.55),
 ('coin','SE_ITM_Coin.wav',.7),('equip','SE_ITM_KAME_EQUIP_1.wav',.5),('alarm','SE_ITM_ALARM.wav',.4),('starHit','SE_ITM_STAR_HIT.wav',.6),
 ('lap','SE_RC_LAP.wav',.8),('pause','SE_RC_PAUSE_ON.wav',.75),('resume','SE_RC_PAUSE_OFF.wav',.65),
 ('road','pSE_GND_RUN_ASPHALT.wav',.18),('slip','pSE_GND_SLIP_ASPHALT.wav',.28),('grass','pSE_GND_RUN_GRASS.wav',.18),
 ('crowd','SE_ENV_AUDIENCE.ny.32.wav',.2)]: wav(key,name,gain, 'Gu_FirstCircuit/' if key=='crowd' else None)
for key,name,gain in [('idle','idle_NoiseReduction.b.32.wav',.28),('engine','AccelNormal.ry.32.wav',.3),('rev','AccelBeforeStart.q.32.wav',.3),('dashEngine','DashEngine.ry.32.wav',.35),('miniEngine','DashEngineMiniTurbo.ry.32.wav',.35)]: wav(key,name,gain,'Karts/K_Std/')
for driver in ['mario','luigi','peach','yoshi','toad','bowser','donkey-kong','koopa']:
 for role,pattern in [('throw',r'Item_Put|RI-PUT|ITM_PUT(?!_END)'),('jump',r'Action_Jump|RA-JUMS|VO_NK_JMP'),('damage',r'Damage_[MSL]|DMG_SPN(?!_END)'),('rocket',r'Action_RocketStart|RA-STRM|VO_NK_STRM(?!_END)')]:
  found=[x for x in inventory if x['file'].startswith('sfx/'+driver+'/') and re.search(pattern,x['file'])]
  for i,x in enumerate(found[:2]):wav(f'voice-{driver}-{role}-{i}',Path(x['file']).name,.65,'sfx/'+driver+'/')
def music(key,file,loop=False,gain=.46):
 source=SOURCE/'music'/file; entry={'file':key+'.ogg','source':str(source.relative_to(SOURCE)),'sha256':hashlib.sha256(source.read_bytes()).hexdigest(),'gain':gain}
 x=np.frombuffer(subprocess.check_output([FFMPEG,'-v','error','-i',str(source),'-ac','1','-ar','4000','-f','f32le','-']),np.float32)
 entry['duration']=len(x)/4000
 if loop:
  # Compare the same rendered waveform one complete musical period later.
  off=20000; n=12000; w=x[off:off+n]; c=fftconvolve(x,w[::-1],mode='valid');cs=np.r_[0,np.cumsum(x.astype(float)**2)];energy=cs[n:]-cs[:-n]
  score=c/np.sqrt(np.maximum(energy*np.sum(w*w),1e-12));score[:off+40000]=0;i=int(np.argmax(score))
  if score[i]<.6: raise ValueError(('No credible musical recurrence',file,float(score[i])))
  entry.update(loopStart=5,loopEnd=i/4000,loopCorrelation=round(float(score[i]),5))
 args=[FFMPEG,'-v','error','-y','-i',str(source)]
 if loop:args+=['-t',str(entry['loopEnd']+.1)]
 subprocess.run(args+['-c:a','libvorbis','-q:a','5',str(OUT/entry['file'])],check=True)
 manifest['cues'][key]=entry
for key,file in [('race','mario-kart-stadium.flac'),('raceLead','mario-kart-stadium-frontrunning.flac'),('final','mario-kart-stadium-final-lap.flac'),('finalLead','mario-kart-stadium-final-lap-frontrunning.flac'),('menu','selection-screen-course-select.flac'),('win','race-results-you-won.flac'),('lose','race-results-you-lost.flac')]:music(key,file,True)
for key,file in [('grid','starting-grid-grand-prix-vs-race.flac'),('finalLap','final-lap.flac'),('finish','finish.flac'),('finishWin','finish-1st-place.flac'),('finishMid','finish-2nd-6th-place.flac'),('finishLose','finish-7th-12th-place.flac'),('star','super-star.flac')]:music(key,file,False,.7 if key!='star' else .46)
# Original results entrance and tally UI sounds.
for key,name,gain in [('resultsIn','SE_RSLT_IN.wav',.7),('resultsCount','SE_RSLT_TIME_COUNT.wav',.32),('resultsStop','SE_RSLT_TIME_COUNT_STOP.wav',.65)]:wav(key,name,gain)
# Optional manually supplied isolated effects replace the labelled placeholders.
# Preserve original uploads in this folder; the runtime manifest records hashes.
manual=SOURCE/'manual'
for key in ['box','use-green','use-red','use-banana','use-blue','hit-green','hit-red','hit-banana','hit-blue','shellConfirm']:
 source=manual/(key+'.wav')
 if source.is_file():
  import wave
  with wave.open(str(source),'rb') as w: duration=w.getnframes()/w.getframerate()
  dest=OUT/(key+'.wav');shutil.copyfile(source,dest)
  manifest['cues'][key]={'file':dest.name,'source':str(source.relative_to(SOURCE)),'sha256':hashlib.sha256(source.read_bytes()).hexdigest(),'gain':.7,'duration':duration,'provenance':'manual upload; audition and verify role before use'}
(OUT/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
print(f"Prepared {len(manifest['cues'])} cues, {sum(p.stat().st_size for p in OUT.iterdir())/1e6:.1f} MB at {OUT}")
