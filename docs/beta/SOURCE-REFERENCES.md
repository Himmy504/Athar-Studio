# Pinned source references

These are source identification records, not an assembled corresponding-source package. Git archives of a parent repository do not include submodule contents.

| Component | Repository | Revision |
| --- | --- | --- |
| FFmpeg core | https://github.com/FFmpeg/FFmpeg | `894da5ca7d742e4429ffb2af534fcda0103ef593` |
| whisper.cpp | https://github.com/ggml-org/whisper.cpp | `371b5a7561823ab2bb32142d2751e35e7534727b` |
| SubtitlesOctopus 4.1.0 | https://github.com/libass/JavascriptSubtitlesOctopus | `f5ead60c287fd6b84d4561a3b4fcc65dcd0d1f54` |
| Its lib/brotli | https://github.com/google/brotli | `e61745a6b7add50d380cfd7d3883dd6c62fc2c71` |
| Its lib/expat | https://github.com/libexpat/libexpat | `654d2de0da85662fcc7644a7acd7c2dd2cfb21f0` |
| Its lib/fontconfig | https://gitlab.freedesktop.org/fontconfig/fontconfig | `c45e09df1ef235d653d56aef05012f6a3cc57979` |
| Its lib/freetype | https://gitlab.freedesktop.org/freetype/freetype | `e8ebfe988b5f57bfb9a3ecb13c70d9791bce9ecf` |
| Its lib/fribidi | https://github.com/fribidi/fribidi | `6428d8469e536bcbb6e12c7b79ba6659371c435a` |
| Its lib/harfbuzz | https://github.com/harfbuzz/harfbuzz | `970321db7bddbe8c579b73751fc655a924ea3ce6` |
| Its lib/libass | https://github.com/libass/libass | `bef4b43ef1882b77f789f611d9cd24271ccdd65b` |

FFmpeg core revision comes from Gyan's 8.0.1 release metadata. SubtitlesOctopus main revision comes from npm 4.1.0's `gitHead`; dependency revisions come from that commit's Git tree and repository mappings from `.gitmodules`. These SubtitlesOctopus dependency revisions do **not** identify libraries in Gyan's FFmpeg build.

For source assembly, retain the main project's build scripts and patches, initialize its recursive submodules at the recorded revisions, check for nested source dependencies, and retain all original notices. Record source archive SHA-256 values after assembly. Verify the material against the distributed binaries before resolving the hold.
