"""Local, deterministic synthetic recordings. No downloads or microphone access."""
import sys,json,wave,random,math,array
from pathlib import Path
root=Path(sys.argv[1]);items=json.loads((root/'utterances.json').read_text(encoding='utf-8-sig'));rate=16000;rng=random.Random(106)
audio=array.array('h',[0]*rate*5);timeline=[]
def append(samples,meta):
 start=len(audio)/rate;audio.extend(samples)
 timeline.append(dict(meta,start=start,end=len(audio)/rate));audio.extend([0]*int(rate*2.7))
for condition in ['clean','quiet','noise']:
 for item in items:
  if condition!='clean' and not item['expected']:continue
  with wave.open(str(root/item['file']),'rb') as f: samples=array.array('h',f.readframes(f.getnframes()))
  # Trim only digital silence so end-of-speech latency has a repeatable reference.
  nz=[i for i,v in enumerate(samples) if abs(v)>180]
  if nz:samples=samples[max(0,nz[0]-160):min(len(samples),nz[-1]+160)]
  gain=.18 if condition=='quiet' else .65 if condition=='noise' else 1
  samples=array.array('h',(max(-32768,min(32767,round(v*gain+(rng.uniform(-220,220) if condition=='noise' else 0)))) for v in samples))
  append(samples,dict(item,condition=condition))
# Continuous recorded speech followed by a command must not become a command fragment.
for voice in sorted(set(item['voice'] for item in items)):
 item=next(x for x in items if x['voice']==voice and x['rate']==0 and x['expected']=='ninja celebration')
 with wave.open(str(root/item['file']),'rb') as f: speech=array.array('h',f.readframes(f.getnframes()))
 nz=[i for i,v in enumerate(speech) if abs(v)>180]
 speech=speech[nz[0]:nz[-1]+1]
 prefix_item=next(x for x in items if x['voice']==voice and x['phrase']=='thanks for joining the stream')
 with wave.open(str(root/prefix_item['file']),'rb') as f: prefix=array.array('h',f.readframes(f.getnframes()))
 voiced=[i for i,v in enumerate(prefix) if abs(v)>180]
 prefix=(prefix[voiced[0]:voiced[-1]+1]*5)[:round(rate*4.2)]
 append(prefix+speech,dict(phrase='continuous recorded speech then ninja celebration',expected='',condition='long-utterance',voice=voice,rate=0))
 append(speech,dict(item,condition='recovery-after-long'))
if '--safety-only' in sys.argv:
 # Keep the long-utterance/recovery cases and add recorded command audio under managed TTS suppression.
 selected=[r for r in timeline if r['condition'] in ['long-utterance','recovery-after-long']]
 previous=audio;audio=array.array('h',[0]*rate*5);timeline=[]
 for row in selected: append(previous[round(row['start']*rate):round(row['end']*rate)],{k:v for k,v in row.items() if k not in ['start','end']})
 for item in items:
  if not item['expected'] or item['rate']!=0: continue
  with wave.open(str(root/item['file']),'rb') as f: samples=array.array('h',f.readframes(f.getnframes()))
  append(samples,dict(item,expected='',condition='managed-tts'))
  append(samples,dict(item,condition='recovery-after-tts'))
for condition in ([] if '--safety-only' in sys.argv else ['silence','noise-only','musical-tones']):
 samples=[]
 for i in range(rate*15):
  t=i/rate;v=0 if condition=='silence' else rng.uniform(-550,550) if condition=='noise-only' else 1800*math.sin(2*math.pi*(220,277.18,329.63,440)[int(t*2)%4]*t)*(0.3+0.7*math.sin(math.pi*(t*2%1)))
  samples.append(round(v))
 append(samples,dict(phrase='',expected='',condition=condition,voice='none',rate=0))
with wave.open(str(root/'corpus.wav'),'wb') as f:f.setnchannels(1);f.setsampwidth(2);f.setframerate(rate);f.writeframes(audio.tobytes())
(root/'timeline.json').write_text(json.dumps(dict(duration=len(audio)/rate,items=timeline),indent=2))
print(json.dumps(dict(directory=str(root),duration=len(audio)/rate,positive=sum(bool(x['expected']) for x in timeline),negative=sum(not x['expected'] for x in timeline))))

# The binary comparison uses the same utterances with capture-like leading/trailing silence.
chunks=[]
for i,item in enumerate(timeline):
 name='chunk-'+str(i)+'.wav'
 samples=array.array('h',[0]*int(rate*.25))
 samples.extend(audio[round(item['start']*rate):round(item['end']*rate)])
 samples.extend([0]*int(rate*.45))
 with wave.open(str(root/name),'wb') as f:
  f.setnchannels(1);f.setsampwidth(2);f.setframerate(rate);f.writeframes(samples.tobytes())
 chunks.append(dict(item,file=name))
(root/'chunks.json').write_text(json.dumps(chunks,indent=2))
