"""Check real Tauri URL permissions on an owned QA app with CDP port 9223.

This deliberately opens Gemini in the default browser. It edits no projects.
Run manually when changing URL permissions; never as unattended hosted CI.
"""
import hashlib
import json
import os
from pathlib import Path
from playwright.sync_api import sync_playwright

out=Path(__file__).resolve().parents[1]/'test-results'
data=Path(os.environ['APPDATA'])/'studio.athar.editor'
def recovery_hash():
    return {name:hashlib.sha256((data/name).read_bytes()).hexdigest() if (data/name).exists() else None for name in ['recovery.athar','last-project.txt']}
before=recovery_hash()
with sync_playwright() as pw:
    browser=pw.chromium.connect_over_cdp('http://127.0.0.1:9223')
    page=next(p for c in browser.contexts for p in c.pages if 'tauri.localhost' in p.url)
    try:
        page.wait_for_selector('.app-shell')
        result=page.evaluate('''async()=>{
            const invoke=window.__TAURI_INTERNALS__.invoke;
            await invoke('plugin:opener|open_url',{url:'https://gemini.google.com/app'});
            let otherBlocked=false;
            try {await invoke('plugin:opener|open_url',{url:'https://example.com/'});}catch(e){otherBlocked=String(e).toLowerCase().includes('not allowed');}
            return {geminiOpened:true,unrelatedUrlBlocked:otherBlocked};
        }''')
        assert result['geminiOpened'] and result['unrelatedUrlBlocked'],result
        assert recovery_hash()==before,'QA modified recovery data'
        out.mkdir(exist_ok=True)
        (out/'gemini-results.json').write_text(json.dumps(result,indent=2))
        print(json.dumps(result),flush=True)
    finally:
        try:page.evaluate("window.__TAURI_INTERNALS__.invoke('plugin:window|destroy',{label:'main'})")
        except Exception:pass
