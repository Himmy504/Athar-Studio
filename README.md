# Athar Studio

A Windows video editor for Salafi content creators translating Arabic lectures into captioned English clips.

Select a passage, transcribe the Arabic, review a translation, and style the finished video in one workspace.

![Athar Studio caption editor](docs/images/editor.png)

[Getting started](docs/beta/INSTALLATION.md) · [Build from source](docs/BUILDING.md) · [Contributing](CONTRIBUTING.md) · [Changelog](CHANGELOG.md)

## Features

- Local Arabic transcription with whisper.cpp, GPU acceleration, and CPU fallback.
- Manual Gemini translation through copy and paste, with a terminology glossary.
- Side-by-side Arabic and English review, correction history, and individual caption approvals.
- Caption looping, adjustable playback speed, keyboard shortcuts, and waveform zoom.
- English-only or bilingual captions, 22 font families, sizes up to 300, text effects, decorative panels, and reusable styles.
- Footage, image, video, solid-color, and gradient backgrounds with source labels and channel branding.
- Vertical, square, and landscape MP4 exports at 720p or 1080p, with 24/25/30 fps and encoding speed choices, plus Arabic and English SRT files.
- Local projects with autosave, recovery, undo/redo, and source relinking.

## Getting started

Athar Studio is currently a **Windows x64 beta (0.3.0)**. Speech models download separately inside the app.

1. Import an audio or video file and select an excerpt.
2. Download a speech model and transcribe the Arabic.
3. Copy the translation prompt into Gemini and paste its response back into Athar Studio.
4. Check the Arabic and English against the audio, resolve flagged passages, and approve the captions.
5. Choose fonts, a caption panel, and a background, then export.

See the [installation guide](docs/beta/INSTALLATION.md) and [first-clip walkthrough](docs/beta/FIRST-CLIP.md).

Transcription, editing, and export work offline after setup. The Gemini step requires internet access. Arabic corrections proposed from text still need to be checked against the recording. Text and timing edits clear caption approval; styling changes preserve it.

## Development

Built with Tauri 2, React, TypeScript, and Rust. A browser preview needs Node 20.19 or newer:

```sh
npm ci
npm run dev
```

Open http://127.0.0.1:1420. Local transcription and MP4 rendering require the desktop app. See [Building Athar Studio](docs/BUILDING.md) for Windows prerequisites, runtime setup, and installer builds.

```sh
npm run check
npm run test:native
```

[Architecture](docs/ARCHITECTURE.md) · [Testing](docs/VALIDATION.md) · [Security](SECURITY.md)

## Scope

Each project contains one source and one continuous excerpt. The beta focuses on short Arabic-to-English clips. Full lecture editing, multiple excerpts, additional translation languages, and automatic publishing are outside the current scope. Clean-machine, broader hardware, and human translation-quality testing remain in progress.

## License

Athar Studio's original code is licensed under [MIT](LICENSE). Fonts, libraries, and bundled executables retain their own licenses. See [third-party notices](THIRD_PARTY_NOTICES.md) and the [binary distribution notes](docs/beta/LICENSING.md) for outstanding source-package requirements.
