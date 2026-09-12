"""Translation selection, native scripts, persistence, and low-frame-rate export controls."""
import json
import subprocess
from pathlib import Path
from playwright.sync_api import sync_playwright, expect
from support import BASE_URL, launch_browser, serve_audio, wait_for_caption_pixels

out = Path(__file__).resolve().parents[2] / 'test-results'
languages = [('fr','French','Un livre'),('es','Spanish','Un libro'),('pt','Portuguese','Um livro'),('de','German','Ein Buch'),('tr','Turkish','Bir kitap'),('id','Indonesian','Sebuah buku'),('ms','Malay','Sebuah buku'),('ru','Russian','Это книга'),('ur','Urdu','یہ کتاب ہے'),('fa','Persian','این یک کتاب است')]
with sync_playwright() as pw:
    browser = launch_browser(pw)
    page = browser.new_page(viewport={'width':1440,'height':900}, permissions=['clipboard-read','clipboard-write'])
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.route('**/qa-audio.wav',lambda route:serve_audio(route,out/'source.wav'))
    page.goto(BASE_URL,wait_until='networkidle',timeout=120000)
    page.locator('input[type=file]').set_input_files(str(out/'approved.athar'))
    expect(page.get_by_label('Translation language')).to_have_value('en')
    assert page.get_by_label('Translation language').locator('option').count() == 11
    for code,name,text in languages:
        print('Testing '+name,flush=True)
        page.get_by_label('Translation language').select_option(code)
        expect(page.get_by_label(name+' caption 1',exact=True)).to_have_value('')
        page.get_by_role('button',name='Copy prompt',exact=True).click()
        expect(page.get_by_role('button',name='Paste response',exact=True)).to_be_enabled()
        prompt=page.evaluate('navigator.clipboard.readText()').replace('\r\n','\n')
        contract=json.loads(prompt.split('Return ONLY JSON matching this contract, no additional fields: ')[1].split('\n\n')[0])
        source=json.loads(prompt.split('TRANSCRIPT DATA:\n')[1])
        assert contract['targetLanguage']==code and contract['schemaVersion']==2
        contract['segments']=[{'id':s['id'],'arabic':s['arabic'],'translation':text,'correctionNote':'','uncertain':False} for s in source]
        page.get_by_role('button',name='Paste response',exact=True).click()
        page.get_by_label('Gemini JSON response').fill(json.dumps(contract,ensure_ascii=False))
        page.get_by_role('button',name='Import for review',exact=True).click()
        expect(page.get_by_label(name+' caption 1',exact=True)).to_have_value(text)
        expect(page.get_by_label(name+' caption 1',exact=True)).to_have_attribute('dir','rtl' if code in ['ur','fa'] else 'ltr')
        page.get_by_label('Caption preset').select_option('Clean')
        if code in ['ur','fa']:
            expect(page.get_by_label(name.lower()+' caption font',exact=True)).to_have_value('Noto Naskh Arabic')
        page.locator('.source-player').evaluate('el=>{el.currentTime=2.7}')
        wait_for_caption_pixels(page)
        if code in ['ru','ur','fa']:
            page.screenshot(path=str(out/('language-'+code+'.png')))
        while page.get_by_role('button',name='Approve caption',exact=True).count():
            page.get_by_role('button',name='Approve caption',exact=True).first.click()
        with page.expect_download() as download:
            page.get_by_role('button',name='Save project',exact=True).click()
        saved=json.loads(Path(download.value.path()).read_text(encoding='utf-8'))
        assert saved['targetLanguage']==code and all(s['approval'] for s in saved['segments'])
        ass=page.evaluate("async p => (await import('/src/subtitles.ts')).generateAss(p)",saved)
        (out/('language-'+code+'.ass')).write_text(ass,encoding='utf-8')
        file=out/('language-'+code+'.athar');file.write_text(json.dumps(saved,ensure_ascii=False),encoding='utf-8')
        page.locator('input[type=file]').set_input_files(str(file))
        expect(page.get_by_role('button',name='Undo',exact=True)).to_be_disabled()
        expect(page.get_by_label('Translation language')).to_have_value(code)
    page.get_by_role('button',name='Export clip',exact=True).click()
    for fps in ['5','10','12','15','20']:
        page.get_by_label('Frame rate',exact=True).select_option(fps)
        expect(page.locator('.export-summary')).to_contain_text(fps+' fps')
    page.get_by_label('Format',exact=True).select_option('srt-english')
    expect(page.get_by_label('Format',exact=True).locator('option:checked')).to_have_text('Persian subtitles · SRT')
    page.get_by_text('I reviewed the final Arabic, translation, and caption timings against the audio.',exact=True).click()
    with page.expect_download() as download:
        page.get_by_role('button',name='Export subtitles',exact=True).click()
    assert download.value.suggested_filename.endswith('-fa.srt')
    assert languages[-1][2] in Path(download.value.path()).read_text(encoding='utf-8')
    page.get_by_role('button',name='Back to editor',exact=True).click()
    page.set_viewport_size({'width':1060,'height':720})
    expect(page.get_by_label('Translation language')).to_be_visible()
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
    page.screenshot(path=str(out/'language-minimum-window.png'))
    assert not errors,errors
    browser.close()
root=out.parent
ffmpeg=root/'src-tauri/resources/runtime/ffmpeg/ffmpeg.exe'
ffprobe=ffmpeg.with_name('ffprobe.exe')
if ffmpeg.exists() and ffprobe.exists():
    for fps,code in [(5,'ur'),(10,'fr'),(12,'fa'),(15,'tr'),(20,'ru')]:
        output=out/f'language-{code}-{fps}fps.mp4'
        result=subprocess.run([str(ffmpeg),'-y','-f','lavfi','-i',f'color=c=black:s=720x1280:r={fps}:d=1','-i',str(out/'source.wav'),'-t','1','-vf',f'subtitles=test-results/language-{code}.ass:fontsdir=src-tauri/resources/fonts','-c:v','libx264','-preset','ultrafast','-pix_fmt','yuv420p','-c:a','aac',str(output)],cwd=root,capture_output=True,text=True,encoding='utf-8',errors='replace',check=True)
        assert 'failed to find any fallback' not in result.stderr.lower(),result.stderr
        (out/f'language-{code}-font-log.txt').write_text(result.stderr,encoding='utf-8')
        probe=json.loads(subprocess.check_output([str(ffprobe),'-v','error','-show_streams','-of','json',str(output)],text=True))
        video=next(s for s in probe['streams'] if s['codec_type']=='video')
        assert video['r_frame_rate']==f'{fps}/1' and video['width']==720 and video['height']==1280
        assert any(s['codec_name']=='aac' for s in probe['streams'])
    print('Bundled FFmpeg: Urdu, Persian, Russian, French and Turkish rendered at all five lower frame rates with AAC audio.')
print('All ten translation languages, RTL editing, font presets, persistence and lower FPS passed.')
