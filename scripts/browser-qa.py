import json
from pathlib import Path
from playwright.sync_api import sync_playwright, expect
from qa_media import BASE_URL, launch_browser, serve_audio

root = Path(__file__).resolve().parents[1]
out = root / "test-results"
out.mkdir(exist_ok=True)
errors = []
with sync_playwright() as pw:
    browser = launch_browser(pw)
    context = browser.new_context(viewport={"width": 1440, "height": 1000}, device_scale_factor=1, permissions=["clipboard-read", "clipboard-write"])
    page = context.new_page()
    if (out / "source.wav").exists():
        page.route("**/qa-audio.wav", lambda route: serve_audio(route,out/"source.wav"))
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.goto(BASE_URL, wait_until="domcontentloaded", timeout=120000)
    page.wait_for_load_state("networkidle")
    page.evaluate("document.fonts.ready")
    expect(page.get_by_role("heading", name="Captions", exact=True)).to_be_visible()
    page.screenshot(path=str(out / "workspace-empty.png"), full_page=True)
    print(json.dumps({"buttons": page.get_by_role("button").all_text_contents(), "errors": errors}))
    page.locator('input[type="file"]').set_input_files(str(out / "project.athar"))
    expect(page.get_by_label("Arabic caption 1", exact=True)).to_have_value("هذا كتاب")
    page.get_by_role("button", name="Copy prompt", exact=True).click()
    page.wait_for_timeout(250)
    prompt = page.evaluate("navigator.clipboard.readText()").replace("\r\n", "\n")
    request = json.loads(prompt.split("Return ONLY JSON matching this contract, no additional fields: ")[1].split("\n\n")[0])
    source = json.loads(prompt.split("TRANSCRIPT DATA:\n")[1])
    response = {
        "schemaVersion": 1,
        "requestId": request["requestId"],
        "segments": [
            {"id": source[1]["id"], "arabic": source[1]["arabic"], "english": "This is a pen.", "correctionNote": "", "uncertain": False},
            {"id": source[0]["id"], "arabic": "هذا كتاب جديد", "english": "This is a new book.", "correctionNote": "", "uncertain": True},
        ],
    }
    page.get_by_role("button", name="Paste response", exact=True).click()
    page.get_by_label("Gemini JSON response").fill('{"bad":true}')
    page.get_by_role("button", name="Import for review", exact=True).click()
    expect(page.get_by_text("Copy repair prompt", exact=True)).to_be_visible()
    page.get_by_label("Gemini JSON response").fill(json.dumps(response, ensure_ascii=False))
    page.get_by_role("button", name="Import for review", exact=True).click()
    expect(page.get_by_text("AI-corrected Arabic", exact=True)).to_be_visible()
    expect(page.get_by_text("Gemini Arabic", exact=True)).to_be_visible()
    expect(page.locator('.arabic-comparison ins')).to_have_text(' جديد')
    page.screenshot(path=str(out / "workspace-corrections.png"), full_page=True)
    expect(page.get_by_role("button", name="Approve caption", exact=True).first).to_be_disabled()
    page.get_by_role("button", name="Accept correction", exact=True).click()
    expect(page.get_by_role("button", name="Approve caption", exact=True).first).to_be_disabled()
    page.get_by_role("button", name="I checked this passage against the audio", exact=True).click()
    page.get_by_role("button", name="Approve caption", exact=True).first.click()
    page.get_by_role("button", name="Approve caption", exact=True).click()
    expect(page.locator(".approve-button.is-approved")).to_have_count(2)
    page.get_by_role("button", name="Background", exact=True).click()
    page.get_by_label("Background type", exact=True).select_option("solid")
    expect(page.locator(".approve-button.is-approved")).to_have_count(2)
    page.get_by_role("button", name="Captions", exact=True).click()
    page.get_by_label("English caption 1", exact=True).fill("This is a new book.\nA second line.")
    expect(page.get_by_role("button", name="Approve caption", exact=True)).to_have_count(1)
    page.get_by_role("button", name="Approve caption", exact=True).click()
    page.get_by_role("button", name="Export clip", exact=False).click()
    export_button = page.get_by_role("button", name="Export video", exact=True)
    expect(export_button).to_be_disabled()
    page.get_by_text("I reviewed the final Arabic, translation, and caption timings against the audio.", exact=True).click()
    expect(export_button).to_be_enabled()
    page.get_by_label("Format", exact=True).select_option("srt-english")
    with page.expect_download() as downloaded:
        page.get_by_role("button", name="Export subtitles", exact=True).click()
    downloaded.value.save_as(str(out / "browser-export.srt"))
    page.get_by_role("button", name="Back to editor", exact=True).click()
    if page.get_by_role("button", name="Dismiss notification").count():
        page.get_by_role("button", name="Dismiss notification").click()
    page.locator(".caption-list").evaluate("(el) => el.scrollTop = 0")
    page.locator(".source-player").evaluate("(el) => { el.currentTime = 2.7; }")
    page.wait_for_timeout(400)
    page.screenshot(path=str(out / "workspace-reviewed.png"), full_page=True)
    page.set_viewport_size({"width": 1100, "height": 820})
    page.screenshot(path=str(out / "workspace-small.png"), full_page=True)
    assert page.evaluate("document.documentElement.scrollWidth <= window.innerWidth"), "Horizontal overflow"
    assert not errors, errors
    print("PASS: copy/paste translation, malformed response recovery, correction and uncertainty gates, per-caption approval, style preservation, edit invalidation, SRT export, and compact layout.")
    browser.close()
