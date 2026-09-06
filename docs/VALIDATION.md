# Pilot validation

This record distinguishes implemented behavior and automated evidence from the human and hardware acceptance work that remains. The application is a Windows 0.2 pilot, not a completed translation-quality study.

## Automated checks

- **44 TypeScript tests:** Gemini JSON contracts, complete-response validation, reordered IDs, duplicate/missing/unknown IDs, stale revisions, creator edits before translation, locally computed Arabic differences, unreported corrections, independent uncertainty resolution, exact text/timing approvals, split/merge, escaping, subtitle timing, project serialization, safe reconciliation of asset paths after asynchronous saves, loop bounds, zoom clamping, font sizing, legacy panel defaults, panel wrapping, and emphasis offsets.
- **4 Rust tests:** native approval/timing gates, SRT timing, and atomic file replacement with Arabic filenames.
- **Browser integration:** complete manual JSON handoff using synthetic responses, invalid-response repair, individual review gates, styling without approval loss, text changes invalidating approval, final export confirmation, SRT download, and layouts at 1440 and 1100 pixels. No page JavaScript errors were recorded.
- **Native integration:** actual FFmpeg import/proxy/waveform preparation; project save/reopen; MP4 and SRT output; vertical, square, and landscape composition; original, gradient, image, and muted looping-video backgrounds; logos; rejection of unapproved text; cancellation without publishing output; one-heavy-job enforcement.
- **Recovery and downloads:** named-project recovery and repeated asset saves passed. A real model request was cancelled in 0.36 seconds, leaving no newly installed model.
- **Production WebView2:** packaged CPU/Vulkan/FFmpeg resources were found; native media import, local asset-protocol playback, Arabic caption preview, and MP4 export passed with no recorded page errors. The production CSP remained enabled. Fixture save/recovery calls were intercepted for this UI check; the separate native integration check covers real storage.
- **Caption rendering:** matching Inter and Noto Naskh Arabic TrueType files are provided to both renderers. In the synthetic bilingual comparison, the preview caption bounds and resized FFmpeg output differed by one pixel. This is a narrow regression check, not proof that every font/style/text combination is identical.
- **Local Arabic transcription:** a public 3.37-second Arabic speech example produced nonempty timestamped Arabic using both Vulkan and CPU with the verified multilingual large-v3-turbo-q5_0 model. An initial run took approximately 36 seconds on Vulkan and 76 seconds on CPU, including native preparation and verification. These are smoke-test timings on this development machine, not performance promises.

Generated test reports and screenshots live in `test-results/` and are excluded from source control. Synthetic captions are ordinary Arabic sentences about a book and a pen, not attributed scholar quotations. Gemini responses used in automated tests are fixtures; the app did not send a message to Gemini.

### 0.1.1 interface update

The editor now uses a compact toolbar, flat caption rows, a larger preview, and a streamlined inspector. Promotional copy, repeated status messages, decorative preset cards, and the footer were removed. Browser checks cover all three preview aspect ratios, unobstructed import controls, dialogs, and the minimum 1060 × 720 window without page overflow. Review gates, approval invalidation, subtitle export, and preview/export alignment passed after the layout changes.

### 0.2.0 review and caption tools

- Browser tests exercise first/last caption looping, physical source-end looping, one-shot phrase playback, pitch-preserving speed changes, keyboard navigation, typing/dialog guards, Ctrl + Enter approval, unresolved flags, invalid timing while looping, zoom/pan/fit/reset, and dragging handles against zoomed source coordinates.
- Ten Arabic and twelve English font families load offline from bundled files. Every family's bold face was rendered through SubtitlesOctopus and native FFmpeg with the same ASS. Font-selection logs confirm the intended embedded family, including families whose internal names differ from their displayed names. Caption bounds agreed within six preview pixels; text-mask coverage exceeded 90% with a one-pixel rasterization allowance in every case. This is a synthetic regression check, not proof of pixel equality for arbitrary text.
- All seven panel presets were rendered in the editor. Checks cover Arabic diacritics, bilingual text, manual line breaks, all three aspect ratios, narrow English-only panels, project reopening, and preserved approvals. Screenshots include the minimum 1060 × 720 workspace.
- Existing projects and saved personal styles receive a disabled panel by default; fonts and panel changes preserve exact text/timing approvals. Review speed never changes the saved project or export timing.
- The production app exported the Azure panel through its actual export dialog with Amiri/Lora fonts. Review playback was 0.75×; the output remained a 10-second, 1080 × 1920, 30 fps H.264/AAC video. Preview/export caption bounds agreed within four preview pixels. Native import produced 1,200 waveform peaks for the 12-second test source.

## Reproduce the checks

From the repository root after runtime preparation:

```powershell
npm run check
npm run test:native
```

Browser scripts use Python 3.12, the pinned dependencies in `scripts/requirements-qa.txt`, and Playwright Chromium (or `ATHAR_QA_BROWSER` pointing to an existing browser). They use the project fixtures generated by `npm test` and a synthetic 12-second source:

```powershell
python -m pip install -r scripts/requirements-qa.txt
python -m playwright install chromium
powershell -NoProfile -File scripts/run-browser-qa.ps1
```

The QA route supplies audio with HTTP Range support; no local lecture is uploaded.

The runner generates the tone using Python's standard library, starts a dedicated Vite process, runs the review workflow and layout checks, and stops that process. Pass `-Port 1430` if port 1420 is occupied. `npm run test:native` temporarily excludes bundle resources so Rust unit tests work without downloaded executables; it does not validate a packaged installer. The GitHub workflow runs these checks on Windows and retains screenshots and test reports for seven days.

For native integration, build with the explicit testing feature and run its isolated harness:

```powershell
cargo build --manifest-path src-tauri/Cargo.toml --features native-smoke
$env:ATHAR_SMOKE_INPUT = (Resolve-Path test-results/smoke-input.json).Path
$pilotTest = Start-Process src-tauri/target/debug/athar-studio.exe -WindowStyle Hidden -PassThru -Wait
$pilotTest.ExitCode
Remove-Item Env:ATHAR_SMOKE_INPUT
```

The harness saves `native-results.json`. Its data and model directory is `test-results/native-data`, so tests do not replace a creator's recovery project. It checks real model-download cancellation, named-project recovery, and repeated saves of copied assets. Add `"skipTranscription": true` to the input configuration to run only the media/storage checks. Transcription runs when `test-results/arabic-example.wav` is present, downloading and verifying the Balanced model if necessary. The optional speech example is documented in `THIRD_PARTY_NOTICES.md`.

After native rendering, compare captions at 0.7 seconds:

```powershell
& src-tauri/resources/runtime/ffmpeg/ffmpeg.exe -y -ss 0.7 -i test-results/native-export.mp4 -frames:v 1 test-results/native-frame.png
python scripts/preview-qa.py
```

The native smoke feature is excluded from the standard release installer.

After running the browser checks and with Vite running, `python scripts/caption-render-qa.py` compares every bundled font against the prepared native FFmpeg. It writes font-selection logs, preview/export frames, and `font-render-results.json`. This optional check requires `src-tauri/resources/runtime/ffmpeg/ffmpeg.exe`; the standard browser CI does not download native media runtimes.

`scripts/desktop-qa.py` attaches to a production app launched with `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9223`. It uses the installed Chrome-compatible Playwright CDP client, without disabling the application's content-security policy. Launch only the QA app instance with this temporary environment variable; normal creator launches do not enable debugging. Run this after installer packaging has finished so the QA process does not lock the binary during bundling. The script closes its tested app window when finished.

The desktop harness stubs the fetch transport used for storage IPC and the export file picker, proves that interception works before loading fixtures, preserves a recovery snapshot under ignored `test-results/`, and checks that recovery files remain unchanged. Storage interception must pass its preflight check before fixtures are loaded.

## Required human and hardware pilot

These acceptance items remain **unverified** and must be completed with creators and appropriate machines:

1. Twenty manually checked scholar excerpts spanning clear/noisy speech, religious terminology, quotations, names, numbers, and negation. Use `pilot-evaluation.csv` to record source, expected Arabic, ASR mistakes, and meaning-changing translation errors separately. Inspect the complete audio context; no AI-generated score replaces this review.
2. Five first-time creators completing onboarding through export. Target at least four successful exports without assistance. Record completion, assistance, elapsed time, and confusing steps.
3. An actual 8 GB CPU-only laptop with both Low memory and Balanced models. Measure peak memory and throughput on 30-second and five-minute clips. The development machine has approximately 24 GB RAM and a compatible NVIDIA GPU, so it does not establish the 8 GB result.
4. Incompatible or failing Vulkan hardware, network interruptions during an active download, prolonged disconnection, and insufficient disk space. CPU fallback and error paths are implemented; forced hardware failure and all physical-resource conditions still need direct testing.
5. A broader preview/export corpus: Arabic diacritics, mixed RTL/LTR punctuation, long wrapped captions, manual line breaks, all weights/alignment settings, and fade boundaries at every aspect ratio.
6. A clean Windows x64 installation with no developer runtimes. The installer bundles the media and transcription executables and C++ runtime files, but a clean-machine installation is a separate acceptance check. The pilot installer is unsigned.

Record actual observations and unresolved defects before calling the pilot generally released. No scholarly verification label is generated by this software.
