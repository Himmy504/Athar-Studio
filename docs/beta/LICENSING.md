# Licensing and source guide

This is a release engineering record for the existing 0.2.0 Windows installer. **Status: HOLD — source completeness remains unresolved.** Preparing documents does not clear the installer for distribution.

## What the MIT license covers

Athar Studio's original code is MIT licensed. Include the repository's `LICENSE` and `THIRD_PARTY_NOTICES.md` with the release. MIT does not replace licenses for bundled programs, libraries, fonts, or Microsoft runtime DLLs. An invitation-only beta still distributes those components.

## Component record

| Component | Evidence and release action |
| --- | --- |
| Athar Studio | Include MIT license and the source snapshot. The snapshot contains current working files, including uncommitted release work; it is not a claim of a tagged reproducible build. |
| FFmpeg / ffprobe | Gyan 8.0.1 full static GPLv3 build. Preserve GPL text, binary hashes, and `-version` output. Upstream identifies FFmpeg commit `894da5ca7d742e4429ffb2af534fcda0103ef593`. This identifies the core, not every statically linked dependency. |
| whisper.cpp | b4938, commit `371b5a7561823ab2bb32142d2751e35e7534727b`; preserve MIT notice. CPU is upstream binary; Vulkan is locally built with the repository preparation scripts. |
| SubtitlesOctopus / libass-wasm | npm 4.1.0, gitHead `f5ead60c287fd6b84d4561a3b4fcc65dcd0d1f54`. Preserve `public/libass/COPYRIGHT`. Main source and pinned submodule sources/build instructions need to accompany the source arrangement; an npm distribution archive alone is not a complete source tree. |
| Fonts | Preserve each original font license. Exact Fontsource versions are in the npm lockfile. Fontsource package licensing and the underlying font's license must both be considered. |
| JS and Rust dependencies | Kit contains an inventory and discovered license/notice files. Rust inventory includes build dependencies and may be broader than shipped code. Missing notices are explicitly reported for review. |
| Microsoft C++ runtime | Proprietary redistributables copied by runtime preparation from Visual Studio's redistributable directory. Confirm the applicable Visual Studio redistribution terms and permitted DLL list; MIT does not cover them. Do not distribute SDK/toolchain directories. |
| Models | Downloaded separately, not inside this installer. Retain upstream model references; do not describe them as Athar's original MIT code. |

## Resolve before sending the installer

1. Obtain the exact FFmpeg build's corresponding sources, including statically linked dependencies, modifications, and build scripts. The prepared [source request](SOURCE-REQUEST.md) identifies what is missing. Keep the response and source archive hashes with the release record.
2. Assemble SubtitlesOctopus's exact main source and pinned submodules, including relevant patches and build instructions. Verify completeness rather than assuming a GitHub main-project archive includes submodules.
3. Review inventory entries with missing notices and Microsoft redistributable provenance. Retain required original notices with the release.
4. Make the required source materials available alongside the binary using a distribution method appropriate to the actual licenses. Document the real download location and verify it as a recipient. Do not replace missing source with a generic upstream homepage or an unfulfillable written offer.
5. Complete a clean-machine installation and export before inviting the whole group.

An alternative to obtaining the existing FFmpeg build inputs is a new, narrowly configured, source-pinned FFmpeg build with retained dependency sources. That changes shipped binaries and requires rebuilding and retesting the installer.

## References

- [FFmpeg legal guidance](https://ffmpeg.org/legal.html)
- [Gyan build information](https://www.gyan.dev/ffmpeg/builds/) and [8.0.1 release metadata](https://github.com/GyanD/codexffmpeg/releases/tag/8.0.1)
- [SubtitlesOctopus exact source](https://github.com/libass/JavascriptSubtitlesOctopus/tree/f5ead60c287fd6b84d4561a3b4fcc65dcd0d1f54)

The generated kit checks integrity and records known gaps. It does not automatically determine legal compliance or prove source-to-binary reproducibility.
