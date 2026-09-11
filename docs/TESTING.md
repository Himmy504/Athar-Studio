# Testing

Athar Studio uses unit, native, and browser tests. All automated fixtures contain synthetic, unattributed text and locally generated media.

## Standard checks

Install the JavaScript dependencies, then run:

```powershell
npm run check
npm run test:native
```

`npm run check` validates repository hygiene and version metadata, runs the TypeScript tests, and builds the frontend. `npm run test:native` runs the Rust unit tests without downloading speech models or media runtimes.

## End-to-end browser tests

The browser suite covers the import workspace, translation response validation, caption review gates, playback controls, typography, caption panels, export settings, and supported window sizes.

```powershell
python -m pip install -r tests/e2e/requirements.txt
python -m playwright install chromium
powershell -NoProfile -File tests/e2e/run.ps1
```

The runner creates a synthetic tone, starts a local Vite server, runs the Playwright tests, and shuts the server down. Test screenshots and reports are written to the ignored `test-results/` directory.

Use `-Port 1430` if port 1420 is occupied. Set `ATHAR_QA_BROWSER` to test with a specific Chromium executable.

## Manual release checks

Before publishing a Windows build, verify the complete desktop workflow on a clean Windows x64 system:

1. Install the app and download each supported speech model.
2. Import common audio and video formats and select an excerpt.
3. Transcribe with CPU mode and, where available, GPU acceleration.
4. Import a complete Gemini response and exercise correction, uncertainty, and approval rules.
5. Reopen the saved project and confirm media relinking and recovery.
6. Export each aspect ratio, resolution, frame rate, encoding profile, and SRT format.
7. Compare Arabic shaping, line wrapping, timing, fonts, caption panels, and branding between preview and export.

Translation quality must be reviewed by a qualified Arabic speaker against the source audio. Record transcription errors separately from meaning-changing translation errors.
