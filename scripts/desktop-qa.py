"""Production WebView2 integration. Start this task's app with CDP on port 9223.

This checks real packaged media commands and rendering. During fixture editing,
save/recovery IPC is intercepted so synthetic captions do not become the creator's
recovery project; storage itself is covered by the native smoke harness.
"""
from pathlib import Path
from contextlib import ExitStack
import json
import os
import re
from PIL import Image
from playwright.sync_api import sync_playwright, expect
from qa_media import wait_for_caption_pixels

root = Path(__file__).resolve().parents[1]
out = root / "test-results"
with sync_playwright() as pw, ExitStack() as cleanup:
    browser = pw.chromium.connect_over_cdp("http://127.0.0.1:9223", timeout=30000)
    page = next(p for c in browser.contexts for p in c.pages if "tauri.localhost" in p.url)
    def close_qa_window():
        try:
            page.evaluate("window.__TAURI_INTERNALS__.invoke('plugin:window|destroy',{label:'main'})")
        except Exception:
            pass  # Closing the owned WebView can end the connection before reply.
    cleanup.callback(close_qa_window)
    data_dir=Path(os.environ['APPDATA'])/'studio.athar.editor'
    recovery_before={name:(data_dir/name).read_bytes() if (data_dir/name).exists() else None for name in ['recovery.athar','last-project.txt']}
    (out/'desktop-recovery-before.json').write_text(json.dumps({name:value.decode('utf-8') if value else None for name,value in recovery_before.items()}),encoding='utf-8')
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
    page.wait_for_selector(".app-shell")
    expected_script=re.search(r'src="([^"]+\.js)"',(root/'dist/index.html').read_text(encoding='utf-8')).group(1)
    assert page.locator('script[type="module"]').get_attribute('src') == expected_script, "The desktop app contains an older frontend build"
    assert page.locator(".browser-banner").count() == 0, "Not the desktop workspace"
    page.evaluate("""() => {
      // Tauri's invoke/ipc properties are read-only. Stub the fetch transport,
      // then prove interception before any synthetic project is loaded.
      const originalFetch=window.fetch.bind(window);
      window.__atharQaSaves=0;
      window.fetch=(input,options)=>{
        const url=new URL(typeof input==='string'?input:input.url);
        if(url.hostname==='ipc.localhost'){
          const command=decodeURIComponent(url.pathname.slice(1));
          const reply=value=>Promise.resolve(new Response(JSON.stringify(value),{
            headers:{'Content-Type':'application/json','Tauri-Response':'ok'}}));
          if(command==='save_project'){window.__atharQaSaves++;return reply(JSON.parse(options.body).raw);}
          if(command==='recover_project')return reply(null);
          if(command==='plugin:dialog|save'&&window.__atharQaExportPath)return reply(window.__atharQaExportPath);
        }
        return originalFetch(input,options);
      };
    }""")
    probe='ATHAR_QA_INTERCEPTION_PROBE'
    assert page.evaluate("raw=>window.__TAURI_INTERNALS__.invoke('save_project',{raw,path:null})",probe)==probe,'Storage interception failed; aborting before fixture import'
    runtime = page.evaluate("window.__TAURI_INTERNALS__.invoke('runtime_status')")
    assert runtime["ffmpeg"] and runtime["cpu"] and runtime["vulkan"], runtime
    media = page.evaluate("""path => window.__TAURI_INTERNALS__.invoke('import_media',
        {path,jobId:'packaged-media-test'})""", str(out / "source.wav"))
    assert 360 < len(media['waveform']) <= 16384, 'High-resolution waveform was not prepared'
    project = json.loads((out / "approved.athar").read_text(encoding="utf-8"))
    project["media"] = media
    project["segments"][0].update({"inputArabic":"هذا كتاب قديم","proposedArabic":"هذا كتاب","correctionNote":"Synthetic QA: remove the extra adjective.","correctionResolved":True})
    fixture = out / "packaged-project.athar"
    fixture.write_text(json.dumps(project, ensure_ascii=False), encoding="utf-8")
    page.locator('input[type="file"]').set_input_files(str(fixture))
    expect(page.get_by_label("Arabic caption 1", exact=True)).to_have_value("هذا كتاب")
    page.get_by_role("button",name="Expand caption 1",exact=True).click()
    expect(page.get_by_text("Gemini Arabic",exact=True)).to_be_visible()
    # Playwright wait_for_function uses eval, which the production CSP disallows.
    for _ in range(100):
        if page.locator('.source-player').evaluate('el => el.readyState >= 2'):
            break
        page.wait_for_timeout(100)
    else:
        raise AssertionError(page.locator('.source-player').evaluate('el => ({src:el.currentSrc,error:el.error?.message,readyState:el.readyState})'))
    page.locator(".source-player").evaluate("el => {el.currentTime=2.7;}")
    wait_for_caption_pixels(page)
    page.locator(".video-canvas").screenshot(path=str(out / "packaged-preview.png"))
    page.screenshot(path=str(out / "packaged-workspace.png"))
    frame = Image.open(out / "packaged-preview.png").convert("RGB")
    assert any(min(pixel) > 105 for pixel in frame.get_flattened_data()), "No visible captions in production preview"
    playback = page.locator(".source-player").evaluate("el => ({duration:el.duration,currentTime:el.currentTime,error:el.error?.message,src:el.currentSrc})")
    assert playback["error"] is None and abs(playback["currentTime"] - 2.7) < .1, playback
    assert playback["src"].startswith("http://asset.localhost/"), playback
    destination = str(out / "packaged-export.mp4")
    exported = page.evaluate("""args => window.__TAURI_INTERNALS__.invoke('export_project',args)""", {
        "raw": json.dumps(project), "ass": (out / "captions.ass").read_text(encoding="utf-8"),
        "path": destination, "format": "mp4", "jobId": "packaged-export-test"
    })
    assert Path(exported).stat().st_size > 1000
    # Exercise the new panel through the actual export dialog and generated ASS.
    panel_report=None
    if (out/'panel-azure.athar').exists():
        panel=json.loads((out/'panel-azure.athar').read_text(encoding='utf-8'))
        panel['media']=media
        panel_fixture=out/'packaged-panel.athar'
        panel_fixture.write_text(json.dumps(panel,ensure_ascii=False),encoding='utf-8')
        page.locator('input[type="file"]').set_input_files(str(panel_fixture))
        expect(page.get_by_label('Arabic caption 1',exact=True)).to_have_value(panel['segments'][0]['arabic'])
        page.locator('.source-player').evaluate('v=>{v.currentTime=2.7}')
        page.wait_for_timeout(1500)
        wait_for_caption_pixels(page)
        page.locator('.video-canvas').screenshot(path=str(out/'packaged-panel-preview.png'))
        page.get_by_label('Playback speed',exact=True).select_option('0.75')
        page.get_by_role('button',name='Play caption 1',exact=True).click()
        page.get_by_role('button',name='Loop selected caption',exact=True).click()
        page.locator('.source-player').evaluate('v=>{v.currentTime=3.95}')
        page.wait_for_timeout(450)
        transport=page.locator('.source-player').evaluate('v=>({time:v.currentTime,rate:v.playbackRate,paused:v.paused})')
        assert 2<=transport['time']<3 and transport['rate']==.75 and not transport['paused'],transport
        page.locator('.source-player').evaluate('v=>v.pause()')
        panel_destination=str(out/'packaged-panel-export.mp4')
        page.evaluate('path=>{window.__atharQaExportPath=path}',panel_destination)
        assert page.evaluate("window.__TAURI_INTERNALS__.invoke('plugin:dialog|save',{options:{}})")==panel_destination
        page.get_by_role('button',name='Export clip',exact=True).click()
        page.get_by_text('I reviewed the final Arabic, translation, and caption timings against the audio.',exact=True).click()
        page.get_by_role('button',name='Export video',exact=True).click()
        expect(page.locator('.export-success')).to_be_visible(timeout=120000)
        assert Path(panel_destination).stat().st_size>1000
        panel_report={'export':panel_destination,'transport':transport,'fontFamilies':[panel['style']['arabic']['font'],panel['style']['english']['font']]}
    assert not errors, errors
    for name,original in recovery_before.items():
        current=(data_dir/name).read_bytes() if (data_dir/name).exists() else None
        assert current==original,'Recovery changed during QA; the original was preserved in desktop-recovery-before.json'
    report = {"ok":True,"runtime":runtime,"playback":playback,"export":exported,"panel":panel_report,"waveformPeaks":len(media['waveform']),"pageErrors":errors,"storageInterceptedForFixture":True}
    (out / "packaged-results.json").write_text(json.dumps(report,indent=2),encoding="utf-8")
    print(json.dumps(report),flush=True)
