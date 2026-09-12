"""Translate a long transcript in sequential prompts, with project recovery between batches."""
import json
from pathlib import Path
from playwright.sync_api import sync_playwright, expect
from support import BASE_URL, launch_browser, serve_audio

out=Path(__file__).resolve().parents[2]/'test-results'
fixture=json.loads((out/'approved.athar').read_text(encoding='utf-8'))
template=fixture['segments'][0]
fixture['segments']=[{**template,'id':f'batch-{i}','start':i*.06,'end':(i+1)*.06,'arabic':'هذا كتاب مفيد','originalArabic':'هذا كتاب مفيد','english':'','approval':None,'proposedArabic':None,'uncertain':False,'correctionResolved':True} for i in range(85)]
fixture['request']=None
fixture['translationPromptLimit']=6000
fixture.pop('translationBatch',None)
source=out/'batch-project.athar';source.write_text(json.dumps(fixture,ensure_ascii=False),encoding='utf-8')
with sync_playwright() as pw:
    browser=launch_browser(pw)
    page=browser.new_page(viewport={'width':1440,'height':900},permissions=['clipboard-read','clipboard-write'])
    errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.route('**/qa-audio.wav',lambda route:serve_audio(route,out/'source.wav'))
    page.goto(BASE_URL,wait_until='networkidle',timeout=120000)
    page.locator('input[type=file]').set_input_files(str(source))
    expect(page.get_by_label('Prompt size')).to_have_value('6000')
    seen=set();batches=0
    while len(seen)<85:
        page.get_by_role('button',name='Copy prompt',exact=True).click()
        expect(page.get_by_role('button',name='Paste response',exact=True)).to_be_enabled()
        prompt=page.evaluate('navigator.clipboard.readText()').replace('\r\n','\n')
        assert len(prompt)<=6000
        contract=json.loads(prompt.split('Return ONLY JSON matching this contract, no additional fields: ')[1].split('\n\n')[0])
        rows=json.loads(prompt.split('TRANSCRIPT DATA:\n')[1])
        assert not seen.intersection(r['id'] for r in rows)
        contract['segments']=[{**r,'english':'A useful book '+r['id'],'correctionNote':'','uncertain':False} for r in reversed(rows)]
        page.get_by_role('button',name='Paste response',exact=True).click()
        if batches==0:
            invalid={**contract,'segments':contract['segments'][:-1]}
            page.get_by_label('Gemini JSON response').fill(json.dumps(invalid))
            page.get_by_role('button',name='Import for review',exact=True).click()
            expect(page.get_by_role('button',name='Copy repair prompt')).to_be_visible()
        page.get_by_label('Gemini JSON response').fill(json.dumps(contract,ensure_ascii=False))
        page.get_by_role('button',name='Import for review',exact=True).click()
        seen.update(r['id'] for r in rows);batches+=1
        expect(page.get_by_role('button',name='Paste response',exact=True)).to_be_disabled()
        with page.expect_download() as download:
            page.get_by_role('button',name='Save project',exact=True).click()
        saved=json.loads(Path(download.value.path()).read_text(encoding='utf-8'))
        assert len(saved['translationBatch']['completedIds'])==len(seen)
        for segment in saved['segments']:
            assert segment['english']==('A useful book '+segment['id'] if segment['id'] in seen else '')
            assert segment['approval'] is None
        source.write_text(json.dumps(saved,ensure_ascii=False),encoding='utf-8')
        page.locator('input[type=file]').set_input_files(str(source))
        expect(page.get_by_role('button',name='Undo',exact=True)).to_be_disabled()
    assert batches>=3
    expect(page.get_by_text('All batches imported',exact=True)).to_be_visible()
    expect(page.get_by_role('button',name='Copy prompt',exact=True)).to_be_disabled()
    page.set_viewport_size({'width':1060,'height':720})
    expect(page.get_by_label('Prompt size')).to_be_visible()
    page.screenshot(path=str(out/'translation-batches.png'))
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
    page.get_by_role('button',name='Restart batches',exact=True).click()
    expect(page.get_by_role('button',name='Copy prompt',exact=True)).to_be_enabled()
    expect(page.get_by_label('English caption 1',exact=True)).to_have_value('A useful book batch-0')
    assert not errors,errors
    browser.close()
print(f'Passed: {batches} bounded prompts translated all 85 captions with save/reopen and atomic validation.')
