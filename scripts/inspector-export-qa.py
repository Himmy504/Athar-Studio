"""Inspector editing and persisted export choices in the browser workspace."""
import json
from pathlib import Path
from playwright.sync_api import sync_playwright, expect
from qa_media import BASE_URL, launch_browser, serve_audio, wait_for_caption_pixels

root=Path(__file__).resolve().parents[1]
out=root/'test-results'
with sync_playwright() as pw:
    browser=launch_browser(pw)
    page=browser.new_page(viewport={'width':1440,'height':900})
    errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.route('**/qa-audio.wav',lambda route:serve_audio(route,out/'source.wav'))
    page.goto(BASE_URL,wait_until='networkidle')
    page.locator('input[type=file]').set_input_files(str(out/'approved.athar'))
    expect(page.get_by_label('Arabic caption 1',exact=True)).to_have_value('هذا كتاب')
    page.get_by_label('english font size',exact=True).fill('200')
    page.get_by_role('button',name='Italic',exact=True).click()
    page.get_by_role('button',name='Underline',exact=True).click()
    page.get_by_text('Outline, shadow & spacing',exact=True).click()
    page.get_by_label('english outline color',exact=True).fill('#dd2222')
    page.get_by_label('english shadow color',exact=True).fill('#2233dd')
    page.get_by_role('button',name='العربية',exact=True).click()
    page.get_by_label('arabic font size',exact=True).fill('320')
    page.get_by_role('button',name='Middle',exact=True).click()
    expect(page.get_by_label('arabic font size',exact=True)).to_have_value('300')
    with page.expect_download() as download:
        page.get_by_role('button',name='Save project',exact=True).click()
    saved=json.loads(Path(download.value.path()).read_text(encoding='utf-8'))
    assert saved['style']['english']['size']==200 and saved['style']['arabic']['size']==300
    assert saved['style']['english']['italic'] and saved['style']['english']['underline']
    assert saved['style']['english']['outlineColor']=='#dd2222'
    assert all(s['approval'] for s in saved['segments'])
    assert saved['style']['name']=='Custom'
    # Reset only the current language; keep the other language's settings.
    page.get_by_role('button',name='Reset',exact=True).click()
    expect(page.get_by_label('arabic font size',exact=True)).to_have_value('65')
    page.get_by_role('button',name='English',exact=True).click()
    expect(page.get_by_label('english font size',exact=True)).to_have_value('200')
    page.get_by_label('english font size',exact=True).fill('100')
    page.locator('.source-player').evaluate('el=>{el.currentTime=2.7}')
    wait_for_caption_pixels(page)
    page.screenshot(path=str(out/'inspector-new-controls.png'))
    page.get_by_role('button',name='Export clip',exact=True).click()
    page.get_by_label('Resolution',exact=True).select_option('720')
    page.get_by_label('Frame rate',exact=True).select_option('24')
    page.get_by_label('Encoding',exact=True).select_option('quick')
    expect(page.locator('.export-summary')).to_contain_text('720p · 24 fps')
    page.screenshot(path=str(out/'export-options.png'))
    page.get_by_label('Format',exact=True).select_option('srt-english')
    expect(page.get_by_label('Resolution',exact=True)).to_have_count(0)
    page.get_by_role('button',name='Back to editor',exact=True).click()
    with page.expect_download() as download:
        page.get_by_role('button',name='Save project',exact=True).click()
    final=json.loads(Path(download.value.path()).read_text(encoding='utf-8'))
    assert final['exportSettings']=={'resolution':720,'fps':24,'speed':'quick'}
    assert all(s['approval'] for s in final['segments'])
    fixture=out/'inspector-export.athar';fixture.write_text(json.dumps(final,ensure_ascii=False),encoding='utf-8')
    page.locator('input[type=file]').set_input_files(str(fixture))
    page.get_by_role('button',name='Export clip',exact=True).click()
    page.get_by_label('Format',exact=True).select_option('mp4')
    expect(page.get_by_label('Resolution',exact=True)).to_have_value('720')
    expect(page.get_by_label('Frame rate',exact=True)).to_have_value('24')
    page.set_viewport_size({'width':1060,'height':720})
    expect(page.get_by_role('button',name='Export video',exact=True)).to_be_visible()
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
    page.screenshot(path=str(out/'export-minimum-window.png'))
    assert not errors,errors
    (out/'inspector-export-results.json').write_text(json.dumps({'ok':True,'largeFonts':True,'effects':True,'reset':True,'exportSettingsPersisted':True,'approvalsPreserved':True,'pageErrors':errors},indent=2))
    browser.close()
print('Inspector and export browser checks passed.')
