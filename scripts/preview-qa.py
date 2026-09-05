from pathlib import Path
import json
from PIL import Image, ImageChops
from playwright.sync_api import sync_playwright, expect
from qa_media import BASE_URL, launch_browser, serve_audio, wait_for_caption_pixels

root = Path(__file__).resolve().parents[1]
out = root / "test-results"
with sync_playwright() as pw:
    browser = launch_browser(pw)
    page = browser.new_page(viewport={"width":1440,"height":1000},device_scale_factor=1)
    page.route("**/qa-audio.wav", lambda route: serve_audio(route,out/"source.wav"))
    page.goto(BASE_URL,wait_until="domcontentloaded")
    page.wait_for_load_state("networkidle")
    page.locator('input[type="file"]').set_input_files(str(out/"approved.athar"))
    expect(page.get_by_label("Arabic caption 1",exact=True)).to_have_value("هذا كتاب")
    page.wait_for_function("document.querySelector('.source-player').readyState >= 2")
    page.locator(".source-player").evaluate("(el) => { el.currentTime=2.7; }")
    page.wait_for_timeout(600)
    print(page.locator(".source-player").evaluate("(el) => ({currentTime:el.currentTime,duration:el.duration,readyState:el.readyState,error:el.error?.message,src:el.currentSrc,timecode:document.querySelector('.timecode').textContent})"),flush=True)
    wait_for_caption_pixels(page)
    page.locator(".video-canvas").screenshot(path=str(out/"preview-frame.png"))
    page.screenshot(path=str(out/"workspace-preview.png"),full_page=True)
    browser.close()

preview=Image.open(out/"preview-frame.png").convert("RGB")
native=Image.open(out/"native-frame.png").convert("RGB").resize(preview.size,Image.Resampling.LANCZOS)
def bright_bounds(image):
    pixels=image.load()
    coords=[(x,y) for y in range(image.height) for x in range(image.width) if min(pixels[x,y])>105]
    assert coords, "No visible caption pixels"
    return [min(x for x,y in coords),min(y for x,y in coords),max(x for x,y in coords),max(y for x,y in coords)]
a,b=bright_bounds(preview),bright_bounds(native)
assert max(abs(x-y) for x,y in zip(a,b))<=6, (a,b)
ImageChops.difference(preview,native).save(out/"preview-export-diff.png")
report={"ok":True,"previewCaptionBounds":a,"exportCaptionBounds":b,"tolerancePixels":6,"canvasSize":preview.size}
(out/"preview-results.json").write_text(json.dumps(report,indent=2))
print(json.dumps(report))
