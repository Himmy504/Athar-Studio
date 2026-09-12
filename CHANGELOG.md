# Changelog

## 0.4.0 Beta 1 — 2026-09-12

- Added sequential translation batches with adjustable prompt limits, saved progress, and validation of each batch before import.

- Added 5, 10, 12, 15, and 20 fps exports for faster rendering of still backgrounds.
- Added French, Spanish, Portuguese, German, Turkish, Indonesian, Malay, Russian, Urdu, and Persian translation targets.
- Added language-aware prompts, response validation, review, glossary, subtitle labels and filenames. Changing language clears old translations and approvals and can be undone.
- Bundled Cyrillic font subsets and added right-to-left translation editing for Urdu and Persian.
- Applied the blue Athar Studio icon to the packaged executable and running Windows taskbar window.


## 0.3.0 Beta 1 — 2026-09-11

- Increased caption font sizes to 300, with italic, underline, outline/shadow colors, and wider effect ranges.
- Added per-language typography reset and top/middle/bottom caption positioning shortcuts.
- Fixed the desktop Gemini button's URL permission.
- Added 720p/1080p export, 24/25/30 fps, and Quality, Balanced, and Quick draft encoding presets. Export choices are saved with the project.
- Cached static background effects, reduced frames before expensive filters, and reused local font files during export. Balanced encoding is now the default.


## 0.2.0 — 2026-09-05

- Added selected-caption looping and replay, including captions ending at the source file's end.
- Added pitch-preserving review speed from 0.5× to 2× without changing export timing.
- Added review navigation and keyboard shortcuts, with approval flags and text-field editing respected.
- Added waveform zoom, pan, fit-to-excerpt, and higher-resolution waveform preparation.
- Expanded the offline font library to 10 Arabic and 12 English families with regular and bold weights. Normalized family sizing and mapped embedded font names for consistent native rendering.
- Added seven customizable vector caption panels, including blue/gold and emerald plaques, parchment, and simpler boxes. Panels support wrapping, manual breaks, bilingual/English captions, fades, all three aspect ratios, and saved personal styles.
- Preserved the compact editor layout and compatibility with existing project approvals.
- Added automated playback, keyboard, zoom, font, and panel checks, plus comparisons between preview and FFmpeg rendering for every bundled font.

## 0.1.1 — 2026-09-05

- Replaced the decorative interface with a compact charcoal workspace and a single application toolbar.
- Removed slogans, repeated reassurance text, workflow banners, decorative preset cards, and the footer.
- Enlarged the preview and fitted vertical, square, and landscape compositions within the available space.
- Simplified caption rows, with correction history and timing controls available on expansion.
- Reorganized the inspector around preset, typography, layout, background, and branding controls.
- Shortened dialog copy and made routine success notices dismiss automatically.
- Checked the minimum 1060 × 720 layout, review workflow, preview/export alignment, and production Windows playback and MP4 export.

## 0.1.0 — 2026-09-05

Initial Windows pilot with local Arabic transcription, manual Gemini handoff, caption review, styling, local projects, and MP4/SRT export.
