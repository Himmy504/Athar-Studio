# Windows beta

Athar Studio 0.2.0 supports short Arabic-to-English captioned clips on Windows x64.

- [Installation](INSTALLATION.md): setup, model download, and troubleshooting.
- [First clip](FIRST-CLIP.md): import, transcription, review, styling, and export.
- [Reporting problems](FEEDBACK.md): information to include in a bug report.
- [Licensing](LICENSING.md): bundled components and outstanding distribution requirements.
- [Source references](SOURCE-REFERENCES.md): pinned upstream revisions.

## Preparing a build for testing

Run `npm run beta:prepare` after building the installer. It collects the installer, checksums, guides, notices, dependency inventory, and current source snapshot under `.beta-artifacts/`. These generated files are excluded from Git.

Run `npm run beta:check` to verify the kit's file hashes and report outstanding release checks. Source-package completeness and clean-machine installation remain unresolved; an integrity check alone does not establish release readiness.
