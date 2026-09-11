mod jobs;
mod storage;
mod models;
mod media;
mod render;
#[cfg(feature="native-smoke")]
mod smoke;
use tauri::{AppHandle, State};
use serde::Serialize;
use std::path::Path;

#[tauri::command]
async fn import_media(app: AppHandle, state: State<'_,jobs::JobState>, path:String, job_id:String)->Result<media::Media,String>{
    let guard=state.start(job_id,"import")?;
    tauri::async_runtime::spawn_blocking(move||media::import(&app,&path,&guard.job)).await.map_err(|e|e.to_string())?
}
#[tauri::command]
async fn transcribe(app:AppHandle,state:State<'_,jobs::JobState>,path:String,start:f64,end:f64,model:String,device:String,job_id:String)->Result<media::Transcript,String>{
    let guard=state.start(job_id,"transcribe")?;
    tauri::async_runtime::spawn_blocking(move||media::transcribe(&app,&path,start,end,&model,&device,&guard.job)).await.map_err(|e|e.to_string())?
}
#[tauri::command]
async fn download_model(app:AppHandle,state:State<'_,jobs::JobState>,model:String,job_id:String)->Result<(),String>{
    let guard=state.start(job_id,"download")?;
    tauri::async_runtime::spawn_blocking(move||models::download(&app,&model,&guard.job)).await.map_err(|e|e.to_string())?
}
#[tauri::command]
async fn cancel_job(state:State<'_,jobs::JobState>,job_id:String)->Result<(),String>{
    state.cancel(&job_id)?;
    for _ in 0..100{
        if !state.running(&job_id){return Ok(());}
        tokio::time::sleep(std::time::Duration::from_millis(100)).await;
    }
    Err("Cancellation is still finishing. Wait a moment before closing the app.".into())
}
#[derive(Serialize)]
#[serde(rename_all="camelCase")]
struct RuntimeStatus{ffmpeg:bool,cpu:bool,vulkan:bool,memory_gb:f64,models:Vec<models::ModelInfo>}
#[tauri::command]
async fn runtime_status(app:AppHandle)->Result<RuntimeStatus,String>{
    tauri::async_runtime::spawn_blocking(move||{
        let mut sys=sysinfo::System::new(); sys.refresh_memory();
        RuntimeStatus{ffmpeg:storage::binary(&app,"ffmpeg").is_ok()&&storage::binary(&app,"ffprobe").is_ok(),cpu:storage::binary(&app,"whisper-cpu").is_ok(),
            vulkan:storage::binary(&app,"whisper-vulkan").is_ok(),memory_gb:sys.total_memory() as f64 /1_073_741_824.0,models:models::list(&app)}
    }).await.map_err(|e|e.to_string())
}
#[tauri::command]
async fn save_project(app:AppHandle,path:Option<String>,raw:String)->Result<String,String>{
    tauri::async_runtime::spawn_blocking(move||storage::save(&app,path,raw)).await.map_err(|e|e.to_string())?
}
#[tauri::command]
async fn open_project(path:String)->Result<String,String>{
    tauri::async_runtime::spawn_blocking(move||storage::open_project(&path)).await.map_err(|e|e.to_string())?
}
#[tauri::command]
async fn recover_project(app:AppHandle)->Result<Option<serde_json::Value>,String>{
    tauri::async_runtime::spawn_blocking(move||storage::recover(&app)).await.map_err(|e|e.to_string())?
}
#[tauri::command]
fn path_exists(path:String)->bool{Path::new(&path).is_file()}
#[tauri::command]
async fn export_project(app:AppHandle,state:State<'_,jobs::JobState>,raw:String,ass:String,path:String,format:String,job_id:String)->Result<String,String>{
    let guard=state.start(job_id,"export")?;
    tauri::async_runtime::spawn_blocking(move||{
        let p:serde_json::Value=serde_json::from_str(&raw).map_err(|e|e.to_string())?;
        let dest=render::destination(&path,&p)?;
        render::export(&app,&p,&ass,&dest,&format,&guard.job)?;
        Ok(path)
    }).await.map_err(|e|e.to_string())?
}
#[cfg_attr(mobile,tauri::mobile_entry_point)]
pub fn run(){
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .manage(jobs::JobState::default())
        .setup(|app|{
            #[cfg(feature="native-smoke")]
            {
                use tauri::Manager;
                if let Ok(input)=std::env::var("ATHAR_SMOKE_INPUT"){
                    if let Some(window)=app.get_webview_window("main"){let _=window.hide();}
                    let handle=app.handle().clone();
                    std::thread::spawn(move||{
                        let result=smoke::run(&handle,&input);
                        let report=match &result{Ok(v)=>v.clone(),Err(e)=>serde_json::json!({"ok":false,"error":e})};
                        let report_path=std::path::Path::new(&input).with_file_name("native-results.json");
                        let _=std::fs::write(report_path,serde_json::to_vec_pretty(&report).unwrap_or_default());
                        handle.exit(if result.is_ok(){0}else{1});
                    });
                }
            }
            #[cfg(not(feature="native-smoke"))]
            let _=app;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![import_media,transcribe,download_model,cancel_job,runtime_status,save_project,open_project,recover_project,path_exists,export_project])
        .run(tauri::generate_context!())
        .expect("Athar Studio could not start");
}
