# Building Athar Studio

Prerequisites for native development: Windows x64, Node 22 (20.19+ also supported), Rust 1.88+, Visual Studio C++ build tools with the **Desktop development with C++** workload, WebView2, FFmpeg with libass/libx264 and ffprobe, and 7-Zip for portable Vulkan SDK extraction. The Windows build was built using Visual Studio 2026. Tools are not required on a creator's machine when using the installer. See the [Tauri Windows prerequisites](https://v2.tauri.app/start/prerequisites/) for build-tool installation.

```powershell
npm ci
npm run prepare:runtime
npm run desktop
```

`prepare:runtime` downloads the pinned upstream whisper.cpp CPU release, copies an installed FFmpeg build, builds the Vulkan executable, and includes the local Microsoft C++ runtime files. When `VULKAN_SDK` is absent, it downloads and verifies a portable SDK inside `.runtime-cache`; it does not install the SDK system-wide. The SDK, models, build outputs, and large binaries are excluded from source control.

For an explicitly CPU-only developer build:

```powershell
powershell -NoProfile -File scripts/prepare-runtime.ps1 -SkipGpu
```

For a browser workspace preview, only Node and npm are required:

```powershell
npm ci
npm run dev
```

Open `http://127.0.0.1:1420`. The browser can open/edit `.athar` projects and export SRT; native media processing is intentionally available only in the Windows app.

`npm run dev` and `npm run build` prepare the local fonts and subtitle renderer automatically. Generated assets and downloaded runtimes are rebuilt locally and are not checked into Git.

Build an installer:

```powershell
npm run desktop:build
```

