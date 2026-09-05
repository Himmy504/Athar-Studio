import os

BASE_URL = os.environ.get("ATHAR_QA_URL", "http://127.0.0.1:1420/")


def launch_browser(playwright):
    options = {"headless": True}
    if os.environ.get("ATHAR_QA_BROWSER"):
        options["executable_path"] = os.environ["ATHAR_QA_BROWSER"]
    return playwright.chromium.launch(**options)


def serve_audio(route, source):
    data = source.read_bytes()
    requested = route.request.headers.get("range")
    headers = {"Accept-Ranges": "bytes", "Content-Type": "audio/wav"}
    if requested and requested.startswith("bytes="):
        first, last = requested[6:].split("-", 1)
        start = int(first or "0")
        end = min(int(last) if last else len(data)-1, len(data)-1)
        if start >= len(data):
            route.fulfill(status=416, headers={"Content-Range": "bytes */"+str(len(data))})
            return
        headers["Content-Range"] = f"bytes {start}-{end}/{len(data)}"
        route.fulfill(status=206, headers=headers, body=data[start:end+1])
    else:
        route.fulfill(status=200, headers=headers, body=data)
def wait_for_caption_pixels(page):
    for _ in range(200):
        visible = page.locator('.subtitle-canvas').evaluate('''canvas => {
            const ctx=canvas.getContext('2d');
            if(!ctx || !canvas.width || !canvas.height) return false;
            const pixels=ctx.getImageData(0,0,canvas.width,canvas.height).data;
            for(let i=3;i<pixels.length;i+=4) if(pixels[i]>0) return true;
            return false;
        }''')
        if visible:
            return
        page.wait_for_timeout(100)
    raise AssertionError('Caption renderer did not produce visible text')
