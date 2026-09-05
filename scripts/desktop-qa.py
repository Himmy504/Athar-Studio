"""Production WebView2 integration. Start this task's app with CDP on port 9223.

This checks real packaged media commands and rendering. During fixture editing,
save/recovery IPC is intercepted so synthetic captions do not become the creator's
recovery project; storage itself is covered by the native smoke harness.
"""
from pathlib import Path
import json
import re
from PIL import Image
from playwright.sync_api import sync_playwright, expect
from qa_media import wait_for_caption_pixels

root = Path(__file__).resolve().parents[1]
out = root / "test-results"
with sync_playwright() as pw:
    browser = pw.chromium.connect_over_cdp("http://127.0.0.1:9223", timeout=30000)
    page = next(p for c in browser.contexts for p in c.pages if "tauri.localhost" in p.url)
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
    page.wait_for_selector(".app-shell")
    expected_script=re.search(r'src="([^"]+\.js)"',(root/'dist/index.html').read_text(encoding='utf-8')).group(1)
    assert page.locator('script[type="module"]').get_attribute('src') == expected_script, "The desktop app contains an older frontend build"
    assert page.locator(".browser-banner").count() == 0, "Not the desktop workspace"
    page.evaluate("""() => {
      const invoke = window.__TAURI_INTERNALS__.invoke;
      window.__TAURI_INTERNALS__.invoke = (command,args,options) => {
        if (command === 'save_project') return Promise.resolve(args.raw);
        if (command === 'recover_project') return Promise.resolve(null);
        return invoke(command,args,options);
      };
    }""")
    runtime = page.evaluate("window.__TAURI_INTERNALS__.invoke('runtime_status')")
    assert runtime["ffmpeg"] and runtime["cpu"] and runtime["vulkan"], runtime
    media = page.evaluate("""path => window.__TAURI_INTERNALS__.invoke('import_media',
        {path,jobId:'packaged-media-test'})""", str(out / "source.wav"))
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
    assert any(min(pixel) > 105 for pixel in frame.getdata()), "No visible captions in production preview"
    playback = page.locator(".source-player").evaluate("el => ({duration:el.duration,currentTime:el.currentTime,error:el.error?.message,src:el.currentSrc})")
    assert playback["error"] is None and abs(playback["currentTime"] - 2.7) < .1, playback
    assert playback["src"].startswith("http://asset.localhost/"), playback
    destination = str(out / "packaged-export.mp4")
    exported = page.evaluate("""args => window.__TAURI_INTERNALS__.invoke('export_project',args)""", {
        "raw": json.dumps(project), "ass": (out / "captions.ass").read_text(encoding="utf-8"),
        "path": destination, "format": "mp4", "jobId": "packaged-export-test"
    })
    assert Path(exported).stat().st_size > 1000
    assert not errors, errors
    report = {"ok":True,"runtime":runtime,"playback":playback,"export":exported,"pageErrors":errors,"storageInterceptedForFixture":True}
    (out / "packaged-results.json").write_text(json.dumps(report,indent=2),encoding="utf-8")
    print(json.dumps(report),flush=True)
    # Close only the window owned by this QA app process.
    try:
        page.evaluate("window.__TAURI_INTERNALS__.invoke('plugin:window|destroy',{label:'main'})")
    except Exception:
        pass  # The WebView connection can close before the successful IPC reply.
