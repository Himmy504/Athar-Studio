use std::{fs, io::Write, path::{Path, PathBuf}, sync::Mutex};
use tauri::{AppHandle, Manager};
use serde_json::Value;
use sha2::{Sha256, Digest};

pub static SAVE_LOCK: Mutex<()> = Mutex::new(());
pub fn data_dir(app: &AppHandle) -> Result<PathBuf, String> {
    #[cfg(feature="native-smoke")]
    if let Ok(input)=std::env::var("ATHAR_SMOKE_INPUT"){
        let dir=Path::new(&input).parent().ok_or("Invalid smoke directory")?.join("native-data");
        fs::create_dir_all(&dir).map_err(|e|e.to_string())?;
        return Ok(dir);
    }
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}
pub fn cache_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app.path().app_cache_dir().map_err(|e| e.to_string())?;
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}
pub fn resources(app: &AppHandle) -> Result<PathBuf, String> {
    #[cfg(debug_assertions)] {
        let dev = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("resources");
        if dev.exists() { return Ok(dev); }
    }
    Ok(app.path().resource_dir().map_err(|e| e.to_string())?.join("resources"))
}
pub fn binary(app: &AppHandle, name: &str) -> Result<PathBuf, String> {
    let root = resources(app)?.join("runtime");
    let path = match name {
        "ffmpeg" => root.join("ffmpeg/ffmpeg.exe"),
        "ffprobe" => root.join("ffmpeg/ffprobe.exe"),
        "whisper-cpu" => root.join("cpu/whisper-cli.exe"),
        "whisper-vulkan" => root.join("vulkan/whisper-cli.exe"),
        _ => return Err("Unknown runtime binary".into()),
    };
    if path.is_file() { return Ok(path); }
    Err(format!("{} is not bundled. Run npm run prepare:runtime, then rebuild the desktop app.", name))
}
pub fn atomic_write(path: &Path, bytes: &[u8]) -> Result<(), String> {
    let parent = path.parent().ok_or("Invalid save location")?;
    fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    let mut temp = tempfile::NamedTempFile::new_in(parent).map_err(|e| e.to_string())?;
    temp.write_all(bytes).and_then(|_| temp.as_file().sync_all()).map_err(|e| e.to_string())?;
    temp.persist(path).map_err(|e| format!("Could not save {}: {}", path.display(), e))?;
    Ok(())
}
pub fn project_check(value: &Value) -> Result<(), String> {
    if value["schemaVersion"].as_u64() != Some(1) || value["id"].as_str().is_none() || !value["segments"].is_array() {
        return Err("Unsupported or damaged project format".into());
    }
    if value["segments"].as_array().is_some_and(|s| s.len() > 5000) { return Err("Too many captions".into()); }
    Ok(())
}
pub fn save(app: &AppHandle, path: Option<String>, raw: String) -> Result<String, String> {
    let _lock = SAVE_LOCK.lock().map_err(|_| "Save lock unavailable")?;
    let mut value: Value = serde_json::from_str(&raw).map_err(|e| e.to_string())?;
    project_check(&value)?;
    let recovery = data_dir(app)?.join("recovery.athar");
    if let Some(path) = path {
        let dest = PathBuf::from(&path);
        let assets = dest.with_extension("assets");
        fs::create_dir_all(&assets).map_err(|e| e.to_string())?;
        for pointer in ["/style/background/path", "/style/logoPath"] {
            if let Some(source) = value.pointer(pointer).and_then(Value::as_str).filter(|s| !s.is_empty()).map(PathBuf::from) {
                if source.is_file() {
                    if source.parent()==Some(assets.as_path()){continue;}
                    let file = source.file_name().ok_or("Invalid asset name")?.to_string_lossy();
                    let metadata=fs::metadata(&source).map_err(|e|e.to_string())?;
                    let identity=format!("{}:{}:{:?}",source.to_string_lossy(),metadata.len(),metadata.modified().ok());
                    let digest = format!("{:x}", Sha256::digest(identity.as_bytes()));
                    let target = assets.join(format!("{}-{}", &digest[..10], file));
                    if !target.exists() {
                        let temporary=tempfile::NamedTempFile::new_in(&assets).map_err(|e|e.to_string())?;
                        fs::copy(&source,temporary.path()).map_err(|e|e.to_string())?;
                        temporary.as_file().sync_all().map_err(|e|e.to_string())?;
                        temporary.persist(&target).map_err(|e|e.to_string())?;
                    }
                    if let Some(v) = value.pointer_mut(pointer) { *v = Value::String(target.to_string_lossy().into()); }
                }
            }
        }
        let saved = serde_json::to_string_pretty(&value).map_err(|e| e.to_string())?;
        if dest.exists() { fs::copy(&dest, dest.with_extension("athar.bak")).map_err(|e| format!("Could not preserve recovery copy: {}", e))?; }
        atomic_write(&dest, saved.as_bytes())?;
        atomic_write(&recovery, saved.as_bytes())?;
        atomic_write(&data_dir(app)?.join("last-project.txt"), path.as_bytes())?;
        Ok(saved)
    } else {
        atomic_write(&recovery, raw.as_bytes())?;
        atomic_write(&data_dir(app)?.join("last-project.txt"), b"")?;
        Ok(raw)
    }
}
pub fn recover(app:&AppHandle)->Result<Option<Value>,String>{
    let dir=data_dir(app)?;let recovery=dir.join("recovery.athar");
    if !recovery.exists(){return Ok(None);}
    let raw=open_project(&recovery.to_string_lossy())?;
    let recovered:Value=serde_json::from_str(&raw).map_err(|e|e.to_string())?;
    let saved_path=fs::read_to_string(dir.join("last-project.txt")).unwrap_or_default();
    let path=if !saved_path.is_empty()&&open_project(&saved_path).ok().and_then(|s|serde_json::from_str::<Value>(&s).ok()).is_some_and(|p|p["id"]==recovered["id"]){Some(saved_path)}else{None};
    Ok(Some(serde_json::json!({"raw":raw,"path":path})))
}
pub fn open_project(path: &str) -> Result<String, String> {
    let metadata = fs::metadata(path).map_err(|e| e.to_string())?;
    if metadata.len() > 50_000_000 { return Err("Project file is too large".into()); }
    let raw = fs::read_to_string(path).map_err(|e| e.to_string())?;
    let value: Value = serde_json::from_str(&raw).map_err(|e| format!("Project could not be read: {}. Try the .athar.bak copy.", e))?;
    project_check(&value)?;
    Ok(raw)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test] fn atomic_overwrite_and_unicode() {
        let dir = tempfile::tempdir().unwrap();
        let p = dir.path().join("العلم.athar");
        atomic_write(&p, b"first").unwrap();
        atomic_write(&p, b"second").unwrap();
        assert_eq!(fs::read_to_string(p).unwrap(), "second");
    }
}
