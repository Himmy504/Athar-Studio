"""Compare real libass render paths for mixed-script punctuation and styled RTL captions."""
import base64
import json
import subprocess
from pathlib import Path
from playwright.sync_api import sync_playwright
from PIL import Image, ImageChops, ImageFilter
from support import BASE_URL, launch_browser

root = Path(__file__).resolve().parents[2]
out = root / 'test-results'
ffmpeg = root / 'src-tauri/resources/runtime/ffmpeg/ffmpeg.exe'

def text_masks(path):
    r,g,b,a = Image.open(path).convert('RGBA').split()
    white = ImageChops.multiply(ImageChops.multiply(r.point(lambda v:255 if v>225 else 0),g.point(lambda v:255 if v>225 else 0)),b.point(lambda v:255 if v>225 else 0))
    gold = ImageChops.multiply(ImageChops.multiply(r.point(lambda v:255 if v>230 else 0),g.point(lambda v:255 if 175<v<225 else 0)),b.point(lambda v:255 if v<35 else 0))
    alpha = a.point(lambda v:255 if v>180 else 0)
    return ImageChops.multiply(ImageChops.lighter(white,gold),alpha), ImageChops.multiply(gold,alpha)

with sync_playwright() as pw:
    browser = launch_browser(pw)
    page = browser.new_page()
    page.goto(BASE_URL, wait_until='networkidle')
    page.add_script_tag(url=BASE_URL+'libass/subtitles-octopus.js')
    for font in ['Noto Naskh Arabic', 'Noto Nastaliq Urdu']:
        for panel in ['none', 'azure']:
            name = ('nastaliq' if 'Nastaliq' in font else 'naskh')+'-'+panel
            result = page.evaluate('''async ({font,panel})=>{
                const {newProject,newSegment}=await import('/src/domain.ts');
                const {createPanel}=await import('/src/panelPresets.ts');
                const {generateAss}=await import('/src/subtitles.ts');
                const {loadCaptionFonts,fontFiles}=await import('/src/fonts.ts');
                const p=newProject();p.targetLanguage='ur';p.clip={start:0,end:4};
                p.style.mode='english';p.style.fade=false;p.style.english={...p.style.english,font,size:75,outline:0,shadow:0};
                p.style.panel=createPanel(panel);
                p.segments=[{...newSegment(0,4,'العلم'),english:'"علم", "کتاب"!\\n2026، (Urdu 12:30) — علم۔',emphasis:[{text:'علم',color:'#ffcc00',bold:true}]}];
                await loadCaptionFonts(p.style);
                const ass=generateAss(p);
                if(window.qaEngine)window.qaEngine.dispose();
                document.querySelector('#rtl-canvas')?.remove();
                const canvas=document.createElement('canvas');canvas.id='rtl-canvas';canvas.width=1080;canvas.height=1920;
                canvas.style.cssText='width:1080px;height:1920px';document.body.append(canvas);
                window.qaEngine=new window.SubtitlesOctopus({canvas,subContent:ass,fonts:fontFiles(p.style).map(f=>'/fonts/'+f),
                    workerUrl:'/libass/subtitles-octopus-worker.js',fallbackFont:'/fonts/noto-naskh-arabic-arabic-400-normal.ttf',
                    onReady:()=>window.qaEngine.setCurrentTime(1)});
                return {ass};
            }''', {'font':font,'panel':panel})
            page.wait_for_function('''()=>{
                const c=document.querySelector('#rtl-canvas'),d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;
                let gold=0;for(let i=0;i<d.length;i+=4)if(d[i]>200&&d[i+1]>120&&d[i+2]<80&&d[i+3]>180)gold++;
                return gold>100;
            }''',timeout=30000)
            png = page.locator('#rtl-canvas').evaluate('c=>c.toDataURL().split(",")[1]')
            (out/f'rtl-{name}-preview.png').write_bytes(base64.b64decode(png))
            preview,gold = text_masks(out/f'rtl-{name}-preview.png')
            bounds = gold.getbbox()
            middle = (bounds[1]+bounds[3])//2
            # The first logical word belongs on the right; the last word on the left.
            assert gold.crop((0,0,1080,middle)).getbbox()[0]>540
            assert gold.crop((0,middle,1080,1920)).getbbox()[2]<400
            (out/f'rtl-{name}.ass').write_text(result['ass'],encoding='utf-8')
            if ffmpeg.exists():
                rendered=subprocess.run([str(ffmpeg),'-y','-f','lavfi','-i','color=c=black:s=1080x1920:d=1',
                    '-vf',f'ass=test-results/rtl-{name}.ass:fontsdir=src-tauri/resources/fonts','-frames:v','1',
                    str(out/f'rtl-{name}-export.png')],cwd=root,capture_output=True,text=True,encoding='utf-8',errors='replace',check=True)
                assert 'failed to find any fallback' not in rendered.stderr.lower(),rendered.stderr
                exported,_ = text_masks(out/f'rtl-{name}-export.png')
                # Allow antialiasing differences, but fail moved/missing/reordered glyphs.
                for actual,reference in [(preview,exported),(exported,preview)]:
                    missing=ImageChops.subtract(actual,reference.filter(ImageFilter.MaxFilter(5)))
                    assert sum(missing.histogram()[1:])/sum(actual.histogram()[1:])<.02,name
            print(f'RTL punctuation and emphasis rendered: {name}',flush=True)
    browser.close()
