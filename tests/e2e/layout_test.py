from pathlib import Path
import json
from playwright.sync_api import sync_playwright, expect
from support import BASE_URL, launch_browser, serve_audio, wait_for_caption_pixels

root=Path(__file__).resolve().parents[2]
out=root/'test-results'
with sync_playwright() as pw:
    browser=launch_browser(pw)
    page=browser.new_page(viewport={'width':1440,'height':900},device_scale_factor=1)
    errors=[]
    page.on('pageerror',lambda error:errors.append(str(error)))
    page.route('**/qa-audio.wav',lambda route:serve_audio(route,out/'source.wav'))
    page.goto(BASE_URL,wait_until='networkidle')
    expect(page.get_by_role('heading',name='Captions',exact=True)).to_be_visible()
    expect(page.locator('.project-title > span')).to_have_text('Saved')
    page.screenshot(path=str(out/'ui-empty.png'))
    assert page.locator('.preview-empty button').evaluate('el => {const r=el.getBoundingClientRect();return el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));}'), 'Import button is obscured'
    for phrase in ['Your files stay on your device','MEANING COMES FIRST','Words worth preserving','CREATE WITH PURPOSE','MAKE IT YOURS','Always.']:
        assert phrase not in page.locator('body').inner_text(),phrase
    page.locator('input[type=file]').set_input_files(str(out/'approved.athar'))
    expect(page.get_by_label('Arabic caption 1',exact=True)).to_have_value('هذا كتاب')
    page.wait_for_function("document.querySelector('.source-player')?.readyState >= 2")
    expect(page.locator('.project-title > span')).to_have_text('Saved')
    page.locator('.source-player').evaluate('el => {el.currentTime=2.7;}')
    wait_for_caption_pixels(page)
    page.screenshot(path=str(out/'ui-editor.png'))
    page.get_by_role('button',name='Expand caption 1',exact=True).click()
    page.screenshot(path=str(out/'ui-caption-details.png'))
    page.get_by_role('button',name='Collapse caption 1',exact=True).click()
    page.get_by_role('button',name='Background',exact=True).click()
    page.screenshot(path=str(out/'ui-background.png'))
    page.get_by_role('button',name='Brand',exact=True).click()
    page.screenshot(path=str(out/'ui-source.png'))
    page.get_by_role('button',name='Captions',exact=True).click()
    page.get_by_role('button',name='Export clip',exact=True).click()
    page.screenshot(path=str(out/'ui-export.png'))
    page.get_by_role('button',name='Back to editor',exact=True).click()
    page.get_by_role('button',name='Models',exact=True).click()
    page.screenshot(path=str(out/'ui-models.png'))
    page.get_by_role('button',name='Close dialog',exact=True).click()
    ratio_results=[]
    for ratio in ['1:1','16:9','9:16']:
        page.get_by_role('button',name='Export clip',exact=True).click()
        page.get_by_label('Aspect ratio',exact=True).select_option(ratio)
        page.get_by_role('button',name='Back to editor',exact=True).click()
        page.wait_for_timeout(250)
        stage=page.locator('.video-canvas').bounding_box()
        area=page.locator('.canvas-area').bounding_box()
        a,b=map(int,ratio.split(':'))
        assert abs(stage['width']/stage['height']-a/b)<.005,(ratio,stage)
        assert stage['width']<=area['width']+1 and stage['height']<=area['height']+1,(ratio,stage,area)
        ratio_results.append({'ratio':ratio,'width':stage['width'],'height':stage['height']})
        page.screenshot(path=str(out/('ui-'+ratio.replace(':','x')+'.png')))
    page.set_viewport_size({'width':1060,'height':720})
    page.screenshot(path=str(out/'ui-minimum-size.png'))
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth && document.documentElement.scrollHeight<=innerHeight'), 'Workspace overflow'
    assert not errors,errors
    report={'ok':True,'ratios':ratio_results,'minimumWindow':{'width':1060,'height':720},'pageErrors':errors}
    (out/'ui-results.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
    print(json.dumps(report))
    browser.close()
