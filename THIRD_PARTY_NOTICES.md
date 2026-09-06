# Third-party components

Athar Studio uses the components below. Original license/copyright notices are retained in `public/notices`, `public/libass/COPYRIGHT`, and bundled `resources/runtime/notices` where applicable.

The MIT license in this repository covers Athar Studio's original source. It does not relicense third-party libraries, fonts, models, or executables. Generated notices and runtime manifests are prepared locally and included with their corresponding build artifacts.

| Component | Source |
| --- | --- |
| Tauri and plugins | https://github.com/tauri-apps/tauri |
| React | https://github.com/facebook/react |
| Lucide | https://github.com/lucide-icons/lucide |
| Zod | https://github.com/colinhacks/zod |
| SubtitlesOctopus / libass-wasm | https://github.com/libass/JavascriptSubtitlesOctopus |
| libass | https://github.com/libass/libass |
| whisper.cpp CPU and Vulkan runtime | https://github.com/ggml-org/whisper.cpp/tree/371b5a7561823ab2bb32142d2751e35e7534727b |
| Whisper models | https://huggingface.co/ggerganov/whisper.cpp |
| FFmpeg 8.0.1 Windows build | https://www.gyan.dev/ffmpeg/builds/ |
| FFmpeg source | https://ffmpeg.org/releases/ffmpeg-8.0.1.tar.xz |
| Inter | https://github.com/rsms/inter |
| Noto Naskh Arabic | https://github.com/notofonts/arabic |
| fontsource packages | https://github.com/fontsource/fontsource |
| WOFF2 decompression build tool | https://github.com/fontello/wawoff2 |
| Vulkan SDK build tools | https://vulkan.lunarg.com/sdk/home |

The bundled FFmpeg build reports GPL/version3 features and includes libass and libx264. Its original LICENSE is included with the runtime. Run the packaged FFmpeg with `-version` to inspect its complete build configuration.

The offline font catalog includes Noto Naskh Arabic, Amiri, Cairo, Tajawal, Noto Kufi Arabic, Noto Sans Arabic, Scheherazade New, Reem Kufi, Markazi Text, IBM Plex Sans Arabic, Inter, Roboto, Open Sans, Lato, Montserrat, Poppins, Source Sans 3, Merriweather, Playfair Display, Lora, Oswald, and Nunito Sans. The exact fontsource versions are pinned in `package-lock.json`. Asset preparation copies each package's original font license to `public/notices/<package>-LICENSE.txt`, included in the frontend build. Caption plaque artwork is original vector geometry implemented in this repository.

The Vulkan SDK is a build dependency in `.runtime-cache`, not a creator installation dependency. Microsoft C++ runtime DLLs are copied from the Visual Studio redistributable directory for local application deployment.

Beta distribution preparation, pinned source references, and outstanding source-package requirements are recorded in [docs/beta/LICENSING.md](docs/beta/LICENSING.md). The current preparation kit remains on distribution hold; generic source links do not establish complete corresponding sources for the static FFmpeg build.

The optional native QA speech sample comes from SpeechBrain's public `asr-whisper-large-v2-commonvoice-ar` example (`example-ar.wav`). It is used only as a transcription smoke test. It is not a scholarly quotation, a translation benchmark, or app starter content.
