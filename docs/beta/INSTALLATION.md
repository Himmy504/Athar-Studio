# Install Athar Studio — Beta 1

For Windows x64 PCs. The pilot targets Windows 10/11; the clean-machine and 8 GB hardware checks are still part of this beta. Mac, Linux, and Windows ARM are not beta targets.

## Install

1. Download `Athar Studio_0.2.0_x64-setup.exe` from the link supplied by the beta organizer. It is approximately 133 MB.
2. Run the installer and open Athar Studio. Source code, Node, Rust, FFmpeg setup, and developer tools are not needed on your computer.
3. Allow several GB of free disk space for speech models, playback caches, and exports. The installed application itself uses roughly 0.5 GB.
4. If Microsoft Edge WebView2 setup is requested, allow the installer to complete it. Keep internet access available for initial setup.

The installer is unsigned. Windows may report an unrecognized publisher or block the download/application. Record the exact message and send it to the organizer. Do not disable antivirus, SmartScreen, or Smart App Control to complete this test. A reputation warning is not the same as a malware detection; report either accurately. [Microsoft's explanation](https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/smartscreen-reputation)

Optional integrity check in PowerShell, from your download folder:

```powershell
Get-FileHash -LiteralPath '.\Athar Studio_0.2.0_x64-setup.exe' -Algorithm SHA256
```

Compare the result with the supplied `.sha256` file. Matching hashes check that the files match; they do not identify the publisher or replace a digital signature.

## First speech model

Open **Models**. Download **Balanced** (approximately 574 MB). A smaller **Low memory** model (approximately 488 MB) is available for lower-memory machines. Choose **Auto** for processing; if GPU processing fails, try **CPU only** and include that result in your report.

The model is downloaded separately from the installer. Keep the model download complete before testing offline. Local transcription may take time on a CPU-only computer. Record how long your test excerpt takes instead of assuming a fixed speed.

## First project

Follow [FIRST-CLIP.md](FIRST-CLIP.md). Use a copy of a short lecture excerpt. Save a named `.athar` project early, then save again after reviewing. Keep the source recording and the neighboring `.assets` folder when moving a saved project.

Editing, transcription, and rendering work locally after installation and model setup. The manual Gemini translation step needs internet access and whatever access Gemini requires in your browser; Athar Studio does not require a translation API key.

## If something fails

| Problem | What to send the organizer |
| --- | --- |
| Installer blocked or app does not launch | Exact Windows message, screenshot, Windows version |
| Model download fails | Model name, progress reached, exact error, whether retry works |
| Transcription fails | Excerpt duration, model, Auto/CPU setting, exact error |
| Source cannot be found | Whether the file was moved; try Relink source using the original recording |
| Caption preview differs from export | Screenshot and exported frame at the same caption/time, font and panel names |
| MP4 export fails | Exact error, available disk space, output location, app version |
| Save/reopen loses work | Stop using that project, keep the `.athar` and `.athar.bak` files, and report immediately |

The beta has no automatic update system. Install a new version only from the organizer's next versioned download, after saving your work.
