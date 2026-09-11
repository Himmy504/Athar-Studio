"""Review transport, shortcuts, zoom, bundled fonts, and caption panel integration."""
import json
from pathlib import Path
from playwright.sync_api import sync_playwright, expect
from support import BASE_URL, launch_browser, serve_audio, wait_for_caption_pixels

root = Path(__file__).resolve().parents[2]
out = root / 'test-results'
errors = []

with sync_playwright() as pw:
    browser = launch_browser(pw)
    page = browser.new_page(viewport={'width':1440,'height':1000}, device_scale_factor=1)
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.route('**/qa-audio.wav', lambda route: serve_audio(route,out/'source.wav'))
    page.goto(BASE_URL, wait_until='networkidle', timeout=120000)
    base = json.loads((out/'approved.athar').read_text(encoding='utf-8'))
    base['clip'] = {'start':2,'end':12}
    base['segments'][0].update({'start':0,'end':2})
    base['segments'][1].update({'start':2,'end':10})
    # Stamp fixture approval through the same domain rules as the application.
    base = page.evaluate('''async p => {const {approve}=await import('/src/domain.ts');
        p.segments=p.segments.map(approve); return p;}''',base)

    def open_project(project):
        fixture=out/'review-tools.athar'
        fixture.write_text(json.dumps(project,ensure_ascii=False),encoding='utf-8')
        page.locator('input[type="file"]').set_input_files(str(fixture))
        expect(page.get_by_label('Arabic caption 1',exact=True)).to_have_value(project['segments'][0]['arabic'])
        page.wait_for_function("document.querySelector('.source-player').readyState>=2")
        page.wait_for_timeout(200)

    def unfocus():
        page.evaluate('document.activeElement.blur()')

    def media():
        return page.locator('.source-player').evaluate('v=>({time:v.currentTime,paused:v.paused,rate:v.playbackRate,pitch:v.preservesPitch})')

    def save_project():
        with page.expect_download() as download:
            page.get_by_role('button',name='Save project',exact=True).click()
        return json.loads(Path(download.value.path()).read_text(encoding='utf-8'))

    open_project(base)
    player=page.locator('.source-player')
    loop=page.get_by_role('button',name='Loop selected caption',exact=True)
    page.get_by_role('button',name='Play caption 1',exact=True).click()
    loop.click()
    player.evaluate('v=>{v.currentTime=3.95}')
    page.wait_for_timeout(400)
    state=media()
    assert 2<=state['time']<3 and not state['paused'],state
    loop.click()
    player.evaluate('v=>{v.currentTime=3.95}')
    page.wait_for_timeout(400)
    state=media()
    assert state['paused'] and abs(state['time']-4)<.1,state
    page.get_by_role('button',name='Play caption 2',exact=True).click()
    loop.click()
    player.evaluate('v=>{v.currentTime=11.95}')
    page.wait_for_timeout(450)
    state=media()
    assert 4<=state['time']<5 and not state['paused'],state
    page.get_by_label('Playback speed',exact=True).select_option('0.5')
    assert media()['rate']==.5 and media()['pitch']
    unfocus()
    page.keyboard.press(']')
    expect(page.get_by_label('Playback speed',exact=True)).to_have_value('0.75')
    page.keyboard.press('[')
    page.keyboard.press('Space')
    assert media()['paused']
    page.keyboard.press('ArrowUp')
    expect(page.locator('.caption-card.selected')).to_have_attribute('data-caption-id',base['segments'][0]['id'])
    assert media()['rate']==.5
    page.keyboard.press('l')
    expect(loop).to_have_attribute('aria-pressed','false')
    page.keyboard.press('Space')
    assert media()['paused']
    page.keyboard.press('r')
    assert not media()['paused'] and media()['time']<3
    page.keyboard.press('Space')
    # Review keys remain normal text editing keys inside a caption.
    english=page.get_by_label('English caption 1',exact=True)
    english.fill('Testing the review shortcuts.')
    english.press('End')
    english.press('l')
    english.press('[')
    expect(loop).to_have_attribute('aria-pressed','false')
    expect(page.get_by_label('Playback speed',exact=True)).to_have_value('0.5')
    english.press('Control+Enter')
    expect(page.locator('.caption-card.selected')).to_have_attribute('data-caption-id',base['segments'][1]['id'])
    assert page.evaluate("document.activeElement.tagName!=='TEXTAREA'")
    expect(page.locator('.approve-button.is-approved')).to_have_count(2)
    player.evaluate('v=>v.pause()')
    before=save_project()
    # Opening dialogs suppresses review keys.
    page.get_by_role('button',name='Workflow help',exact=True).click()
    unfocus()
    page.keyboard.press('l')
    page.keyboard.press(']')
    expect(loop).to_have_attribute('aria-pressed','false')
    expect(page.get_by_label('Playback speed',exact=True)).to_have_value('0.5')
    page.get_by_role('button',name='Close dialog',exact=True).click()
    # Zoom/pan never edits the excerpt or approval snapshots.
    waveform=page.locator('.waveform')
    page.get_by_role('button',name='Zoom waveform in',exact=True).click()
    assert float(waveform.get_attribute('data-view-end'))-float(waveform.get_attribute('data-view-start'))==6
    page.get_by_label('Waveform scroll position',exact=True).fill('6')
    assert float(waveform.get_attribute('data-view-end'))==12
    page.get_by_role('button',name='Fit waveform to excerpt',exact=True).click()
    assert float(waveform.get_attribute('data-view-start'))<=2
    page.get_by_role('button',name='Show entire waveform',exact=True).click()
    assert float(waveform.get_attribute('data-view-start'))==0
    assert float(waveform.get_attribute('data-view-end'))==12
    after=save_project()
    assert after['clip']==before['clip'] and after['segments']==before['segments']
    assert 'playbackRate' not in after
    page.get_by_role('button',name='Zoom waveform in',exact=True).click()
    page.get_by_label('Waveform scroll position',exact=True).fill('0')
    box=waveform.bounding_box()
    handle=page.get_by_role('button',name='Drag excerpt start',exact=True).bounding_box()
    page.mouse.move(handle['x']+handle['width']/2,handle['y']+handle['height']/2)
    page.mouse.down()
    page.mouse.move(box['x']+box['width']/2,box['y']+box['height']/2,steps=5)
    page.mouse.up()
    expect(page.get_by_role('heading',name='Change this excerpt?',exact=True)).to_be_visible()
    assert abs(float(page.get_by_label('Excerpt start seconds',exact=True).input_value())-3)<.1
    page.get_by_role('button',name='Keep current excerpt',exact=True).click()
    expect(page.get_by_label('Excerpt start seconds',exact=True)).to_have_value('2')
    expect(page.locator('.approve-button.is-approved')).to_have_count(2)
    # Ctrl+Enter must not bypass correction or uncertainty resolution.
    flagged=json.loads(json.dumps(base))
    flagged['segments'][0].update({'approval':None,'uncertain':True,'uncertaintyResolved':False})
    open_project(flagged)
    page.get_by_label('English caption 1',exact=True).focus()
    page.keyboard.press('Control+Enter')
    expect(page.locator('.approve-button.is-approved')).to_have_count(1)
    expect(page.locator('.caption-card.selected')).to_have_attribute('data-caption-id',base['segments'][0]['id'])
    if page.get_by_role('button',name='Dismiss notification').count():
        page.get_by_role('button',name='Dismiss notification').click()
    # A selected caption with edited invalid timing must stop looping.
    page.get_by_role('button',name='Play caption 1',exact=True).click()
    loop.click()
    page.get_by_label('Arabic caption 1',exact=True).focus()
    page.get_by_label('End caption 1',exact=True).fill('0')
    expect(loop).to_have_attribute('aria-pressed','false')
    assert media()['paused']
    open_project(base)
    english_fonts=page.get_by_label('english caption font',exact=True).locator('option').all_text_contents()
    assert len(english_fonts)==12,english_fonts
    page.get_by_role('button',name='العربية',exact=True).click()
    arabic_fonts=page.get_by_label('arabic caption font',exact=True).locator('option').all_text_contents()
    assert len(arabic_fonts)==10,arabic_fonts
    loaded=page.evaluate('''async p=>{const {FONT_CATALOG,loadCaptionFonts}=await import('/src/fonts.ts');
      const result=[]; for(const f of FONT_CATALOG){p.style[f.language].font=f.family;
        await loadCaptionFonts(p.style);result.push(f.family);}return result;}''',base)
    assert len(loaded)==22
    page.get_by_label('arabic caption font',exact=True).select_option('Amiri')
    page.get_by_role('button',name='English',exact=True).click()
    page.get_by_label('english caption font',exact=True).select_option('Lora')
    page.get_by_label('Caption panel preset',exact=True).select_option('azure')
    player.evaluate('v=>{v.pause();v.currentTime=2.7}')
    page.wait_for_timeout(1500)
    wait_for_caption_pixels(page)
    expect(page.locator('.approve-button.is-approved')).to_have_count(2)
    styled=save_project()
    # A longer, diacritized synthetic caption exercises automatic wrapping.
    styled['segments'][0].update({'arabic':'هٰذَا كِتَابٌ جَدِيدٌ، وَهٰذِهِ صَفْحَةٌ مِنَ الْكِتَابِ.',
        'english':'This is a new book, and this is a page from the book.'})
    styled=page.evaluate('''async p=>{const {approve}=await import('/src/domain.ts');
      p.segments=p.segments.map(approve);return p;}''',styled)
    styled['style']['fade']=False
    open_project(styled)
    player.evaluate('v=>{v.currentTime=2.7}')
    page.wait_for_timeout(1200)
    wait_for_caption_pixels(page)
    for preset in ['solid','glass','gold','paper','emerald','azure','midnight']:
        page.get_by_label('Caption panel preset',exact=True).select_option(preset)
        page.wait_for_timeout(450)
        page.locator('.video-canvas').screenshot(path=str(out/f'panel-{preset}.png'))
    page.get_by_label('Caption panel preset',exact=True).select_option('azure')
    page.wait_for_timeout(450)
    page.screenshot(path=str(out/'workspace-review-tools.png'))
    styled=save_project()
    # The native test consumes browser-measured ASS, exactly as desktop export does.
    rendered=page.evaluate('''async p=>{const {loadCaptionFonts}=await import('/src/fonts.ts');
      const {generateAss}=await import('/src/subtitles.ts');await loadCaptionFonts(p.style);return generateAss(p);}''',styled)
    (out/'panel-azure.ass').write_text(rendered,encoding='utf-8')
    (out/'panel-azure.athar').write_text(json.dumps(styled,ensure_ascii=False),encoding='utf-8')
    page.locator('.video-canvas').screenshot(path=str(out/'panel-azure-preview.png'))
    # Changing ratio and caption mode keeps approvals; panels follow the canvas.
    for ratio in ['1:1','16:9','9:16']:
        page.get_by_role('button',name='Export clip',exact=True).click()
        page.get_by_label('Aspect ratio',exact=True).select_option(ratio)
        page.get_by_role('button',name='Back to editor',exact=True).click()
        page.wait_for_timeout(1000)
        wait_for_caption_pixels(page)
        expect(page.locator('.approve-button.is-approved')).to_have_count(2)
        page.locator('.video-canvas').screenshot(path=str(out/('panel-'+ratio.replace(':','x')+'.png')))
    page.get_by_label('Display',exact=True).select_option('english')
    page.get_by_text('Panel settings',exact=True).click()
    page.get_by_label('Panel width',exact=True).fill('50')
    page.wait_for_timeout(450)
    page.locator('.video-canvas').screenshot(path=str(out/'panel-english-narrow.png'))
    customized=save_project()
    open_project(customized)
    expect(page.get_by_label('Panel width',exact=True)).to_have_value('50')
    expect(page.get_by_label('Display',exact=True)).to_have_value('english')
    expect(page.locator('.approve-button.is-approved')).to_have_count(2)
    page.set_viewport_size({'width':1060,'height':720})
    page.screenshot(path=str(out/'workspace-review-tools-small.png'))
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
    assert not errors,errors
    report={'ok':True,'fontFamiliesLoaded':loaded,'panelsRendered':7,'pageErrors':errors}
    (out/'review-tools-results.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
    print('PASS: looping (including source end), speed, safe shortcuts, approvals, zoom/pan, 22 fonts, and seven caption panels.',flush=True)
    browser.close()
