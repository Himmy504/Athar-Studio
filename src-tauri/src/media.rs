use std::{fs, path::Path, time::UNIX_EPOCH};
use serde::Serialize;
use serde_json::Value;
use sha2::{Sha256, Digest};
use tauri::AppHandle;
use crate::{storage, models, jobs::{self, Job}};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Media {
    path: String, name: String, duration: f64, size: u64, has_video: bool,
    width: u64, height: u64, preview_path: String, waveform: Vec<f32>,
}
pub fn probe(app: &AppHandle, path: &Path, job: &Job) -> Result<Value, String> {
    let data = jobs::process(&storage::binary(app, "ffprobe")?, &["-v", "error", "-show_format", "-show_streams", "-of", "json"].map(String::from).into_iter().chain([path.to_string_lossy().into_owned()]).collect::<Vec<_>>(), None, app, job, 0.0, "Reading media")?;
    serde_json::from_slice(&data).map_err(|e| format!("Could not inspect media: {}", e))
}
pub fn import(app: &AppHandle, path: &str, job: &Job) -> Result<Media, String> {
    let source = Path::new(path);
    let ext = source.extension().and_then(|e| e.to_str()).unwrap_or("").to_ascii_lowercase();
    if !["mp3", "wav", "m4a", "mp4", "mov", "mkv"].contains(&ext.as_str()) { return Err("Choose MP3, WAV, M4A, MP4, MOV, or MKV media.".into()); }
    let info = fs::metadata(source).map_err(|e| format!("Source file is unavailable: {}", e))?;
    let data = probe(app, source, job)?;
    let streams = data["streams"].as_array().ok_or("This file has no media streams")?;
    if !streams.iter().any(|s| s["codec_type"] == "audio") { return Err("This source has no audio track.".into()); }
    let video = streams.iter().find(|s| s["codec_type"] == "video" && s["disposition"]["attached_pic"] != 1);
    let duration = data["format"]["duration"].as_str().and_then(|s| s.parse::<f64>().ok()).filter(|n| n.is_finite() && *n > 0.0).ok_or("Could not determine the media duration")?;
    let key = format!("{:x}", Sha256::digest(format!("{}:{}:{:?}", path, info.len(), info.modified().ok().and_then(|t| t.duration_since(UNIX_EPOCH).ok())).as_bytes()));
    let cache = storage::cache_dir(app)?;
    let preview = cache.join(format!("{}.{}", &key[..24], if video.is_some() { "mp4" } else { "m4a" }));
    let ffmpeg = storage::binary(app, "ffmpeg")?;
    if !preview.is_file() {
        let temporary = tempfile::Builder::new().suffix(if video.is_some() { ".mp4" } else { ".m4a" }).tempfile_in(&cache).map_err(|e| e.to_string())?;
        let mut args = vec!["-y", "-nostdin", "-v", "error", "-progress", "pipe:2", "-i", path, "-map", "0:a:0"].into_iter().map(String::from).collect::<Vec<_>>();
        if video.is_some() {
            args.extend(["-map", "0:v:0", "-vf", "scale=960:540:force_original_aspect_ratio=decrease:force_divisible_by=2,setsar=1", "-c:v", "libx264", "-preset", "ultrafast", "-crf", "27", "-pix_fmt", "yuv420p"].map(String::from));
        } else { args.push("-vn".into()); }
        args.extend(["-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart"].map(String::from));
        args.push(temporary.path().to_string_lossy().into());
        jobs::process(&ffmpeg, &args, None, app, job, duration, "Preparing smooth playback")?;
        jobs::check(job)?;
        temporary.persist(&preview).map_err(|e| e.to_string())?;
    }
    jobs::report(app, job, 0.0, "Building audio waveform");
    // Rectify before downsampling so the waveform measures the envelope, not low-frequency audio.
    let samples = jobs::process(&ffmpeg, &["-v", "error", "-nostdin", "-i", path, "-map", "0:a:0", "-vn", "-ac", "1", "-af", "aeval=abs(val(0)),aresample=100", "-ar", "100", "-f", "f32le", "pipe:1"].map(String::from), None, app, job, duration, "Building audio waveform")?;
    let values: Vec<f32> = samples.chunks_exact(4).map(|b| f32::from_le_bytes([b[0],b[1],b[2],b[3]]).abs()).collect();
    let width = 360usize; let step = (values.len() as f64 / width as f64).max(1.0);
    let mut waveform = Vec::with_capacity(width);
    for i in 0..width {
        let start = (i as f64 * step) as usize; let end = (((i+1) as f64 * step) as usize).min(values.len());
        waveform.push(if start < end { values[start..end].iter().copied().filter(|v| v.is_finite()).fold(0.0_f32, f32::max) } else { 0.0 });
    }
    let max = waveform.iter().copied().fold(0.001_f32, f32::max);
    waveform.iter_mut().for_each(|v| *v = (*v / max).sqrt().clamp(0.0,1.0));
    jobs::report(app, job, 100.0, "Media ready");
    Ok(Media { path: path.into(), name: source.file_name().unwrap_or_default().to_string_lossy().into(), duration, size: info.len(), has_video: video.is_some(), width: video.and_then(|v| v["width"].as_u64()).unwrap_or(0), height: video.and_then(|v| v["height"].as_u64()).unwrap_or(0), preview_path: preview.to_string_lossy().into(), waveform })
}
#[derive(Serialize)]
pub struct TranscriptLine { start: f64, end: f64, arabic: String }
#[derive(Serialize)]
pub struct Transcript { pub segments: Vec<TranscriptLine>, pub device: String }
pub fn transcribe(app: &AppHandle, path: &str, start: f64, end: f64, model: &str, device: &str, job: &Job) -> Result<Transcript, String> {
    if !start.is_finite() || !end.is_finite() || start < 0.0 || end <= start { return Err("Select a valid excerpt".into()); }
    if !["auto", "cpu"].contains(&device) { return Err("Unknown processing mode".into()); }
    let source = Path::new(path);
    let probe = probe(app, source, job)?;
    let duration = probe["format"]["duration"].as_str().and_then(|v| v.parse::<f64>().ok()).unwrap_or(0.0);
    if end > duration + 0.05 { return Err("The excerpt exceeds the source duration.".into()); }
    jobs::report(app, job, 0.0, "Verifying local model");
    let model_path = models::verify(app, model, job)?;
    let temp = tempfile::tempdir_in(storage::cache_dir(app)?).map_err(|e| e.to_string())?;
    let audio = temp.path().join("excerpt.wav");
    let args = vec!["-y".into(), "-v".into(), "error".into(), "-nostdin".into(), "-ss".into(), start.to_string(), "-i".into(), path.into(), "-map".into(), "0:a:0".into(), "-t".into(), (end-start).to_string(), "-vn".into(), "-ac".into(), "1".into(), "-ar".into(), "16000".into(), "-c:a".into(), "pcm_s16le".into(), audio.to_string_lossy().into()];
    jobs::process(&storage::binary(app, "ffmpeg")?, &args, None, app, job, end-start, "Preparing Arabic audio")?;
    let mut sys = sysinfo::System::new(); sys.refresh_memory();
    let available = sys.available_memory();
    let required = if model == "small" { 1_500_000_000 } else if model == "large-v3-q5_0" { 4_000_000_000 } else { 2_500_000_000 };
    if available < required + 1_000_000_000 { return Err("Not enough free memory for this model. Close other applications or choose Low memory in Models.".into()); }
    let output = temp.path().join("transcript");
    let mut args = vec!["-m".into(), model_path.to_string_lossy().into(), "-f".into(), audio.to_string_lossy().into(), "-l".into(), "ar".into(), "-oj".into(), "-of".into(), output.to_string_lossy().into(), "-pp".into(), "-t".into(), std::thread::available_parallelism().map(|n| n.get().saturating_sub(2).clamp(1,8)).unwrap_or(2).to_string()];
    let mut used = "CPU".to_string();
    let gpu_result = if device == "auto" {
        if let Ok(gpu) = storage::binary(app, "whisper-vulkan") {
            jobs::report(app, job, 0.0, "Checking Vulkan GPU compatibility and memory");
            Some(jobs::process_output(&gpu, &args, None, app, job, end-start, "Transcribing Arabic · GPU"))
        } else { None }
    } else { None };
    match gpu_result {
        Some(Ok((_,diagnostics))) => {
            used=diagnostics.lines().find_map(|line|line.strip_prefix("whisper_backend_init_gpu: using ").map(|s|s.trim_end_matches(" backend").to_string())).map(|name|format!("GPU ({})",name)).unwrap_or_else(||"CPU (GPU unavailable)".into());
        },
        result => {
            jobs::check(job)?;
            if result.is_some() { jobs::report(app, job, 0.0, "GPU initialization or processing failed; continuing on CPU"); }
            args.push("-ng".into());
            jobs::process(&storage::binary(app, "whisper-cpu")?, &args, None, app, job, end-start, "Transcribing Arabic · CPU")?;
        }
    }
    let data: Value = serde_json::from_slice(&fs::read(output.with_extension("json")).map_err(|e| e.to_string())?).map_err(|e| e.to_string())?;
    let lines = data["transcription"].as_array().ok_or("Transcription engine returned no segments")?;
    let mut segments = Vec::new();
    for line in lines {
        let text = line["text"].as_str().unwrap_or("").trim();
        let a = line["offsets"]["from"].as_f64().unwrap_or(0.0) / 1000.0;
        let b = (line["offsets"]["to"].as_f64().unwrap_or(0.0) / 1000.0).min(end-start);
        // Silence markers, timestamp tokens, and non-Arabic hallucinations are not caption content.
        if text.chars().any(|c| ('\u{0600}'..='\u{06ff}').contains(&c)) && b > a && a >= 0.0 {
            segments.push(TranscriptLine { start: a, end: b, arabic: text.into() });
        }
    }
    if segments.is_empty() { return Err("No Arabic speech was detected. Check the selected audio and try again.".into()); }
    jobs::report(app, job, 100.0, &format!("Arabic transcript ready · {}", used));
    Ok(Transcript { segments, device: used })
}
