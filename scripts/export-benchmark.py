"""Compare repeated still-background filtering with frame caching at equal quality.

Run after npm test. Uses the prepared FFmpeg runtime and generated caption fixtures.
Results measure this synthetic clip on the current machine, not general export speed.
"""
from pathlib import Path
import hashlib
import json
import shutil
import statistics
import subprocess
import time
from PIL import Image

root=Path(__file__).resolve().parents[1]
work=root/'test-results/export-benchmark'
work.mkdir(exist_ok=True)
ffmpeg=root/'src-tauri/resources/runtime/ffmpeg/ffmpeg.exe'
shutil.copyfile(root/'test-results/captions.ass',work/'captions.ass')
fonts=work/'fonts';fonts.mkdir(exist_ok=True)
for f in (root/'src-tauri/resources/fonts').glob('*.ttf'):
    target=fonts/f.name
    if not target.exists():shutil.copyfile(f,target)
image=Image.new('RGB',(1080,1920))
for y in range(1920):
    color=tuple(round(a+(b-a)*y/1919) for a,b in zip((23,43,37),(7,19,15)))
    image.paste(color,(0,y,1080,y+1))
image.save(work/'background.png')
results={'repeated':[],'cached':[]}
flags=getattr(subprocess,'CREATE_NO_WINDOW',0)
for run in range(3):
    for mode in (['repeated','cached'] if run%2==0 else ['cached','repeated']):
        graph='scale=1080:1920,setsar=1,fps=30,gblur=sigma=12,drawbox=color=black@0.2:t=fill'
        if mode=='cached':graph+=',loop=loop=-1:size=1:start=0,setpts=N/(30*TB)'
        graph+=',ass=filename=captions.ass:fontsdir=fonts,format=yuv420p'
        args=[str(ffmpeg),'-nostdin','-v','error','-y','-loop','1','-framerate','30','-i','background.png',
              '-ss','2','-i',str(root/'test-results/source.wav'),'-vf',graph,'-map','0:v:0','-map','1:a:0',
              '-t','6','-c:v','libx264','-preset','fast','-crf','20','-threads','4','-c:a','aac','-b:a','192k',mode+'.mp4']
        start=time.perf_counter()
        subprocess.run(args,cwd=work,check=True,capture_output=True,creationflags=flags)
        results[mode].append(time.perf_counter()-start)
        print(mode,round(results[mode][-1],2),'seconds',flush=True)
digests={}
for mode in results:
    data=subprocess.check_output([str(ffmpeg),'-v','error','-i',mode+'.mp4','-map','0:v:0','-f','framemd5','-'],cwd=work,creationflags=flags)
    digests[mode]=hashlib.sha256(data).hexdigest()
assert digests['repeated']==digests['cached'],'Still-frame caching changed decoded video frames'
report={'seconds':results,'medianSeconds':{k:statistics.median(v) for k,v in results.items()},'identicalDecodedVideo':True}
report['speedup']=report['medianSeconds']['repeated']/report['medianSeconds']['cached']
(work/'results.json').write_text(json.dumps(report,indent=2))
print(json.dumps(report),flush=True)
