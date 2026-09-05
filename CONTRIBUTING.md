# Contributing

Athar Studio is a focused Windows editor for translated Arabic clips. Keep changes small enough to review and explain the creator problem they address.

## Development

Use Node 22 (see `.node-version`), npm, and Rust 1.88 or newer. Native development also needs the Windows prerequisites in [README.md](README.md).

```powershell
npm ci
npm run dev
```

The browser editor supports project editing and SRT export. For local transcription and MP4 export, prepare the native runtimes and run `npm run desktop` as described in the README.

Before opening a pull request:

```powershell
npm run check
npm run test:native
```

The native unit-test command excludes packaging resources for that process only. It does not need FFmpeg, a speech model, or a GPU. Installer and media integration checks are separate; see [validation](docs/VALIDATION.md).

For UI changes, install the Python requirements and run the browser workflow:

```powershell
python -m pip install -r scripts/requirements-qa.txt
python -m playwright install chromium
powershell -NoProfile -File scripts/run-browser-qa.ps1
```

Run `npm run check` first to generate the test project fixtures and frontend assets. Use `-Port 1430` if the normal development server is already running. The runner starts and stops its own Vite process. To use an existing browser, set `ATHAR_QA_BROWSER` to its executable path; `ATHAR_QA_URL` can override the URL when running individual Python scripts.

## Product constraints

- Keep the UI compact: straightforward labels, predictable controls, and detail shown when needed. Avoid slogans, reassurance banners, decorative cards, and duplicate status messages.
- Preserve original Arabic and compute correction differences locally. Gemini responses must pass complete validation before import.
- Text, timing, and source changes must invalidate the appropriate approvals. Styling must preserve them.
- No audio uploads, automatic Gemini messages, publishing, or paid API requirements.
- Test RTL text, manual line breaks, and caption preview/export agreement when changing subtitle rendering.

Use synthetic, unattributed text and generated media in automated tests. Do not commit personal projects, lecture recordings, model files, credentials, or installers. `npm run check:repo` catches common accidental additions; it is a basic hygiene check, not a complete security audit.

## Pull requests

Describe the final behavior, include relevant validation, and attach a screenshot for UI changes. Update the documentation for setup or workflow changes. Changes to runtime versions must include their hashes and third-party notices.

Contributions to Athar Studio's original code are under the [MIT license](LICENSE). Third-party components retain their own licenses.
