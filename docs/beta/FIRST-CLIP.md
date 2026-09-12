# First clip test — about 30–60 seconds of speech

Use a passage you can check against the Arabic audio. These test captions should be reviewed before any public use.

1. **Import** a local MP3, WAV, M4A, MP4, MOV, or MKV.
2. **Select** one continuous 30–60-second excerpt. Try waveform zoom, pan, fit, and the start/end handles.
3. **Save** a named project using the toolbar save button.
4. **Transcribe Arabic** with the model you downloaded. Record the processing time and any Arabic mistakes.
5. Choose **Translate Arabic to**, then **Copy prompt**, open Gemini, paste the prompt there, then bring its full JSON response back with **Paste response**.
6. **Review** each caption against the audio. Resolve corrections and uncertainty flags, edit where needed, and approve each row. Record meaning-changing translation errors separately from transcription mistakes.
7. **Try the controls:** click a caption time to play it, turn on Loop caption, use 0.75× speed, and move to the next caption. Playback speed does not change export speed.
8. **Style** the clip with one alternative Arabic font, one translation font, and a caption panel. Find panels under **Inspector → Captions → Caption panel**.
9. **Save and reopen** the project. Confirm the text, timings, approvals, fonts, and panel remain correct.
10. **Export** a vertical MP4, then a target-language SRT. Watch the entire MP4 and check Arabic shaping, text clipping, audio synchronization, and the first/last captions.

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

Changing the target language clears the current translation, glossary equivalents, and caption approvals. Use Undo to restore them. Save separate projects to keep multiple translations. Urdu and Persian use right-to-left text; Russian fonts include bundled Cyrillic glyphs. Hindi, Bengali, and Tamil have dedicated Noto Sans and Noto Serif choices. Urdu also offers Noto Nastaliq Urdu. The inspector shows fonts suited to the selected language. Quotes, commas, numbers, and mixed-script text use bidirectional rendering in preview and video exports; RTL SRT files include invisible direction marks for compatible subtitle players.

For still backgrounds, 5, 10, 12, 15, or 20 fps reduces the number of frames rendered. Use 24–30 fps for smoother footage and fades. Audio speed and caption timing remain unchanged.

## Long transcripts

Use **Prompt size** to choose a 6,000, 10,000, or 16,000 character limit. **Copy prompt** prepares up to 40 captions within that limit, including instructions and glossary. Paste it into your AI assistant, then import the response using **Paste response**. Repeat until **All batches imported** appears. Each prompt includes neighboring Arabic for context, so it can be used in a fresh chat.

Batch progress and outstanding prompts are saved with the project. Earlier translations and approvals stay intact when later batches arrive. New sequences start with untranslated captions when available; **Restart batches** starts again from every caption without clearing existing text. If a single caption or a large glossary exceeds the selected limit, choose a larger limit, shorten the glossary, or split the caption. Prompt size counts characters, not model tokens.
