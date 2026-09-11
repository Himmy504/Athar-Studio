# First clip test — about 30–60 seconds of speech

Use a passage you can check against the Arabic audio. These test captions should be reviewed before any public use.

1. **Import** a local MP3, WAV, M4A, MP4, MOV, or MKV.
2. **Select** one continuous 30–60-second excerpt. Try waveform zoom, pan, fit, and the start/end handles.
3. **Save** a named project using the toolbar save button.
4. **Transcribe Arabic** with the model you downloaded. Record the processing time and any Arabic mistakes.
5. **Copy prompt**, open Gemini, paste the prompt there, then bring its full JSON response back with **Paste response**.
6. **Review** each caption against the audio. Resolve corrections and uncertainty flags, edit where needed, and approve each row. Record meaning-changing translation errors separately from transcription mistakes.
7. **Try the controls:** click a caption time to play it, turn on Loop caption, use 0.75× speed, and move to the next caption. Playback speed does not change export speed.
8. **Style** the clip with one alternative Arabic font, one English font, and a caption panel. Find panels under **Inspector → Captions → Caption panel**.
9. **Save and reopen** the project. Confirm the text, timings, approvals, fonts, and panel remain correct.
10. **Export** a vertical MP4, then an English SRT. Watch the entire MP4 and check Arabic shaping, text clipping, audio synchronization, and the first/last captions.

In builds with the new export controls, choose 720p for a faster test export. Balanced uses faster encoding at the same quality target as Quality, with potentially larger files. Quick draft prioritizes speed over quality and compression. Lower frame rates reduce processing; review playback speed does not change exported speech speed.

## Shortcuts

| Key | Action |
| --- | --- |
| Space | Play/pause; focused buttons retain normal activation |
| R | Replay selected caption |
| L | Toggle selected-caption loop |
| Up / Down | Previous / next caption |
| [ / ] | Slower / faster review playback |
| Ctrl + Enter | Approve and advance, provided correction/uncertainty flags are resolved |
| Esc | Leave a caption text field |

Ordinary playback shortcuts are suspended while typing or inside a dialog. Help in the application lists the shortcuts too.

## At the end

Tell the organizer whether you completed the export without help, where you got stuck, whether save/reopen preserved your work, and whether this workflow would save you time. A screenshot of the finished clip is useful; a full lecture recording is not needed for routine UI feedback.
