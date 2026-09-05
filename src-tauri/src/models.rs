use std::{fs, io::{Read, Write}, path::PathBuf, time::{Duration, Instant}};
use serde::Serialize;
use sha2::{Sha256, Digest};
use tauri::AppHandle;
use crate::{storage, jobs::{self, Job}};

pub struct Model { pub id: &'static str, pub name: &'static str, pub bytes: u64, pub hash: &'static str, pub description: &'static str }
pub const MODELS: [Model; 3] = [
    Model { id: "large-v3-turbo-q5_0", name: "Balanced", bytes: 574041195, hash: "394221709cd5ad1f40c46e6031ca61bce88931e6e088c188294c6d5a55ffa7e2", description: "Recommended · multilingual Turbo, compressed for local use" },
    Model { id: "small", name: "Low memory", bytes: 487601967, hash: "1be3a9b2063867b937e64e2ec7483364a79917e157fa98c5d94b5c1fffea987b", description: "Smaller working memory · review transcription carefully" },
    Model { id: "large-v3-q5_0", name: "Larger model", bytes: 1081140203, hash: "d75795ecff3f83b5faa89d1900604ad8c780abd5739fae406de19f23ecd98ad1", description: "Optional full large-v3 · more processing time and memory" },
];
pub fn get(id: &str) -> Result<&'static Model, String> { MODELS.iter().find(|m| m.id == id).ok_or("Unknown model".into()) }
pub fn path(app: &AppHandle, id: &str) -> Result<PathBuf, String> {
    get(id)?;
    let dir = storage::data_dir(app)?.join("models");
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir.join(format!("ggml-{}.bin", id)))
}
#[derive(Serialize)]
pub struct ModelInfo { id: &'static str, name: &'static str, bytes: u64, installed: bool, description: &'static str }
pub fn list(app: &AppHandle) -> Vec<ModelInfo> {
    MODELS.iter().map(|m| ModelInfo { id: m.id, name: m.name, bytes: m.bytes, description: m.description,
        installed: path(app, m.id).ok().and_then(|p| fs::metadata(p).ok()).is_some_and(|v| v.len() == m.bytes) }).collect()
}
pub fn verify(app: &AppHandle, id: &str, job: &Job) -> Result<PathBuf, String> {
    let m = get(id)?; let p = path(app, id)?;
    let mut file = fs::File::open(&p).map_err(|_| "Download this transcription model in Models first.")?;
    if file.metadata().map_err(|e| e.to_string())?.len() != m.bytes { return Err("The model download is incomplete. Download it again.".into()); }
    let mut hasher = Sha256::new(); let mut buf = [0u8; 1024 * 128];
    loop {
        jobs::check(job)?;
        let n = file.read(&mut buf).map_err(|e| e.to_string())?;
        if n == 0 { break; }
        hasher.update(&buf[..n]);
    }
    if format!("{:x}", hasher.finalize()) != m.hash { return Err("Model integrity check failed. Download the model again.".into()); }
    Ok(p)
}
pub fn download(app: &AppHandle, id: &str, job: &Job) -> Result<(), String> {
    tauri::async_runtime::block_on(download_async(app,id,job))
}
async fn download_async(app: &AppHandle, id: &str, job: &Job) -> Result<(), String> {
    let m = get(id)?; let dest = path(app, id)?;
    let client = reqwest::Client::builder().connect_timeout(Duration::from_secs(20)).read_timeout(Duration::from_secs(30)).build().map_err(|e| e.to_string())?;
    let url = format!("https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-{}.bin", id);
    let request=client.get(url).send(); tokio::pin!(request);
    let mut response=loop{
        tokio::select!{
            result=&mut request=>break result.and_then(|r|r.error_for_status()).map_err(|e|format!("Model download could not start: {}",e))?,
            _=tokio::time::sleep(Duration::from_millis(100))=>{jobs::check(job)?;}
        }
    };
    let mut tmp = tempfile::NamedTempFile::new_in(dest.parent().ok_or("Invalid model directory")?).map_err(|e| e.to_string())?;
    let mut hash = Sha256::new(); let mut total: u64 = 0; let mut last = Instant::now();
    loop {
        jobs::check(job)?;
        let next=response.chunk();tokio::pin!(next);
        let chunk=loop{
            tokio::select!{
                result=&mut next=>break result.map_err(|e|format!("Download interrupted: {}. Retry in Models.",e))?,
                _=tokio::time::sleep(Duration::from_millis(100))=>{jobs::check(job)?;}
            }
        };
        let Some(chunk)=chunk else{break;};
        total += chunk.len() as u64;
        if total > m.bytes { return Err("Unexpected model size; download discarded.".into()); }
        tmp.write_all(&chunk).map_err(|e| format!("Cannot write model (check free disk space): {}", e))?;
        hash.update(&chunk);
        if last.elapsed() > Duration::from_millis(200) {
            jobs::report(app, job, total as f64 / m.bytes as f64 * 99.0, &format!("Downloading {} · {} / {} MB", m.name, total / 1_000_000, m.bytes / 1_000_000)); last = Instant::now();
        }
    }
    jobs::check(job)?;
    if total != m.bytes || format!("{:x}", hash.finalize()) != m.hash { return Err("Model integrity check failed. No model was installed; retry the download.".into()); }
    tmp.as_file().sync_all().map_err(|e| e.to_string())?;
    tmp.persist(dest).map_err(|e| e.to_string())?;
    jobs::report(app, job, 100.0, "Model verified and ready");
    Ok(())
}
