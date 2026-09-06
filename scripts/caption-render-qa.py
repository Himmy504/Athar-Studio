"""Optional native FFmpeg vs preview check for every bundled caption font."""
import json
import re
import subprocess
from pathlib import Path
from PIL import Image, ImageFilter, ImageChops
from playwright.sync_api import sync_playwright, expect
from qa_media import BASE_URL, launch_browser, serve_audio, wait_for_caption_pixels

root=Path(__file__).resolve().parents[1]
out=root/'test-results'
ffmpeg=root/'src-tauri/resources/runtime/ffmpeg/ffmpeg.exe'
catalog=json.loads((root/'src/fontCatalog.json').read_text())
reports=[]

def text_mask(image):
    image=image.convert('RGB')
    mask=Image.new('L',image.size)
    mask.putdata([255 if min(pixel)>150 else 0 for pixel in image.get_flattened_data()])
    assert mask.getbbox(),'No caption text pixels'
    return mask

with sync_playwright() as pw:
    browser=launch_browser(pw)
    page=browser.new_page(viewport={'width':1440,'height':1000},device_scale_factor=1)
    page.route('**/qa-audio.wav',lambda route:serve_audio(route,out/'source.wav'))
    page.goto(BASE_URL,wait_until='networkidle',timeout=120000)
    p=json.loads((out/'panel-azure.athar').read_text(encoding='utf-8'))
    p['style']['background'].update({'kind':'solid','color':'#101010','dim':0,'blur':0})
    p['style'].update({'showScholar':False,'showSource':False,'logoPath':''})
    p['metadata']['channel']=''
    p['style']['arabic'].update({'size':85,'bold':True})
    p['style']['english'].update({'size':64,'bold':True})
    # Mixed punctuation, a manual break, and transliteration characters.
    p['segments'][0]['arabic']='هٰذَا كِتَابٌ جَدِيدٌ، وَهٰذِهِ صَفْحَةٌ مِنَ الْكِتَابِ.'
    p['segments'][0]['english']='This is a new book, and this is a page from the book.\nā ī ū ḥ ṣ ḍ ṭ ʿ ʾ'
    for index,font in enumerate(catalog):
        p['style'][font['language']]['font']=font['family']
        fixture=out/'font-render.athar'
        fixture.write_text(json.dumps(p,ensure_ascii=False),encoding='utf-8')
        page.locator('input[type="file"]').set_input_files(str(fixture))
        expect(page.get_by_label('Arabic caption 1',exact=True)).to_have_value(p['segments'][0]['arabic'])
        page.wait_for_function("document.querySelector('.source-player').readyState>=2")
        page.locator('.source-player').evaluate('v=>{v.pause();v.currentTime=2.7}')
        ass=page.evaluate('''async p=>{const {loadCaptionFonts}=await import('/src/fonts.ts');
          const {generateAss}=await import('/src/subtitles.ts');await loadCaptionFonts(p.style);return generateAss(p);}''',p)
        page.wait_for_timeout(1800)
        wait_for_caption_pixels(page)
        assert not page.locator('.preview-panel .inline-error').count()
        name='font-'+font['id']
        page.locator('.video-canvas').screenshot(path=str(out/(name+'-preview.png')))
        (out/(name+'.ass')).write_text(ass,encoding='utf-8')
        result=subprocess.run([str(ffmpeg),'-y','-nostdin','-v','verbose','-f','lavfi','-i','color=c=0x101010:s=1080x1920:r=30:d=1',
            '-vf','ass=filename='+name+'.ass:fontsdir=../src-tauri/resources/fonts','-ss','0.7','-frames:v','1',name+'-export.png'],cwd=out,capture_output=True,text=True,encoding='utf-8',errors='replace',timeout=45)
        (out/(name+'.log')).write_text(result.stderr,encoding='utf-8')
        assert result.returncode==0,result.stderr[-2000:]
        lines=[line for line in result.stderr.splitlines() if 'fontselect: ('+font['assFamily']+',' in line]
        normalized=lambda value:re.sub('[^a-z0-9]','',value.lower())
        assert lines and any(normalized(font['assFamily']) in normalized(line.split('->')[-1]) for line in lines),lines
        preview=Image.open(out/(name+'-preview.png')).convert('RGB')
        native=Image.open(out/(name+'-export.png')).convert('RGB').resize(preview.size,Image.Resampling.LANCZOS)
        a,b=text_mask(preview),text_mask(native)
        bounds_a,bounds_b=a.getbbox(),b.getbbox()
        assert max(abs(x-y) for x,y in zip(bounds_a,bounds_b))<=6,(font['family'],bounds_a,bounds_b)
        # Compare glyph coverage with a one-pixel antialiasing allowance.
        def coverage(left,right):
            missed=ImageChops.subtract(left,right.filter(ImageFilter.MaxFilter(3)))
            return 1-sum(missed.get_flattened_data())/max(1,sum(left.get_flattened_data()))
        overlap=min(coverage(a,b),coverage(b,a))
        assert overlap>.90,(font['family'],overlap)
        reports.append({'font':font['family'],'previewBounds':bounds_a,'exportBounds':bounds_b,'glyphCoverage':round(overlap,4)})
        print(f"PASS {index+1}/22: {font['family']} ({overlap:.1%} glyph coverage)",flush=True)
    browser.close()
(out/'font-render-results.json').write_text(json.dumps({'ok':True,'fonts':reports},indent=2),encoding='utf-8')
