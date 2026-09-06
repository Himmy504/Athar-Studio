# Athar Studio 0.2.0 — Beta 1 preparation

This folder contains the materials for a small Windows beta with 3–5 invited creators.

**Distribution status: HOLD.** The installer works in local testing, but the corresponding-source package for its statically linked FFmpeg dependencies has not yet been established. Do not describe this preparation kit as cleared for redistribution. See [LICENSING.md](LICENSING.md) for the precise gap and [SOURCE-REQUEST.md](SOURCE-REQUEST.md) for the prepared request.

## Materials

- [INSTALLATION.md](INSTALLATION.md): installation, first model setup, and troubleshooting.
- [FIRST-CLIP.md](FIRST-CLIP.md): the first complete test task.
- [RELEASE-NOTES.md](RELEASE-NOTES.md): draft release description and known limits.
- [INVITATION.md](INVITATION.md): an invitation you can send after release preparation is complete.
- [FEEDBACK.md](FEEDBACK.md): how to collect and prioritize reports.
- `test-sessions.csv`: one row per tester/session.
- `issues.csv`: reproducible problems and fixes.
- `translation-review.csv`: Arabic transcription mistakes and English meaning changes, recorded separately.
- [LICENSING.md](LICENSING.md): original code license, third-party inventory, and source obligations.
- [SOURCE-REQUEST.md](SOURCE-REQUEST.md): unsent request for the exact FFmpeg build sources.
- [RELEASE-CHECKLIST.md](RELEASE-CHECKLIST.md): concrete release steps and evidence to retain.

## Build the local preparation kit

From the repository root, run `npm run beta:prepare`. This gathers the existing 0.2.0 installer, its checksum, the guides, license files, dependency inventories, pinned source references, and an Athar source snapshot into `.beta-artifacts/`. Third-party source archives remain to be assembled; references are not a substitute for those archives. It does not publish anything or change the installed application.

`npm run beta:check` verifies the prepared kit and reports unresolved distribution items. A successful file-integrity check alone does not resolve the source-completeness hold. The source snapshot and kit are generated artifacts and must not be committed to Git.

## Rollout

1. Resolve the source-package hold and keep all required notices/source materials alongside the installer.
2. Run one clean-machine installation with one tester. Record any Windows download warnings, WebView2 setup, model download, and first export.
3. Invite the remaining testers only after that installation succeeds.
4. Run the same 30–60-second task with each tester. Observe without guiding every click; record where help was needed.
5. Aim for four of five independent successful exports, reliable save/reopen, and no unresolved data-loss defects.
6. Fix critical bugs first. Give any replacement installer a new version and checksum; keep earlier reports tied to their original version.

A beta label is a readiness label. It does not restrict recipients' rights under MIT or the licenses of bundled components.
