use std::{fs,path::Path,sync::atomic::Ordering,time::Instant};
use serde_json::{json,Value};
use tauri::AppHandle;
use crate::{jobs::{self,JobState},media,models,render,storage};

pub fn run(app:&AppHandle,input:&str)->Result<Value,String>{
    let config:Value=serde_json::from_str(&fs::read_to_string(input).map_err(|e|e.to_string())?).map_err(|e|e.to_string())?;
    let get=|key:&str|config[key].as_str().ok_or(format!("Missing {}",key));
    let project_path=get("project")?;let ass_path=get("ass")?;let output=get("output")?;
    let mut project:Value=serde_json::from_str(&fs::read_to_string(project_path).map_err(|e|e.to_string())?).map_err(|e|e.to_string())?;
    let ass=fs::read_to_string(ass_path).map_err(|e|e.to_string())?;
    let state=JobState::default();let guard=state.start("smoke".into(),"smoke")?;
    if state.start("second".into(),"smoke").is_ok(){return Err("Concurrent job gate failed".into());}
    let model_path=models::path(app,"small")?;
    let had_model=model_path.exists();
    let cancellation=guard.job.clone();
    let started=Instant::now();
    let cancel_thread=std::thread::spawn(move||{std::thread::sleep(std::time::Duration::from_millis(250));cancellation.cancelled.store(true,Ordering::Relaxed);});
    let cancelled_download=models::download(app,"small",&guard.job);
    cancel_thread.join().map_err(|_|"Download cancellation thread failed")?;
    let cancellation_seconds=started.elapsed().as_secs_f64();
    if !cancelled_download.is_err_and(|e|e.contains("Cancelled"))||(!had_model&&model_path.exists())||cancellation_seconds>5.0{return Err("Model download cancellation failed".into());}
    guard.job.cancelled.store(false,Ordering::Relaxed);
    let imported=media::import(app,project["media"]["path"].as_str().ok_or("Missing source")?,&guard.job)?;
    project["media"]=serde_json::to_value(imported).map_err(|e|e.to_string())?;
    let save_path=Path::new(output).with_extension("athar");
    let saved=storage::save(app,Some(save_path.to_string_lossy().into()),serde_json::to_string(&project).map_err(|e|e.to_string())?)?;
    let opened=storage::open_project(&save_path.to_string_lossy())?;
    if saved!=opened{return Err("Project roundtrip failed".into());}
    let recovered=storage::recover(app)?.ok_or("Recovery missing")?;
    if recovered["raw"]!=saved||recovered["path"]!=save_path.to_string_lossy().as_ref(){return Err("Saved project recovery failed".into());}
    render::export(app,&project,&ass,Path::new(output),"mp4",&guard.job)?;
    let video_probe=media::probe(app,Path::new(output),&guard.job)?;
    let srt_path=Path::new(output).with_extension("srt");
    render::export(app,&project,&ass,&srt_path,"srt-english",&guard.job)?;
    let work=Path::new(input).parent().ok_or("Invalid input folder")?;
    let logo=work.join("qa-logo.png");
    image::RgbaImage::from_pixel(80,80,image::Rgba([211,184,111,255])).save(&logo).map_err(|e|e.to_string())?;
    let mut asset_project=project.clone();asset_project["style"]["logoPath"]=json!(logo);
    let asset_path=work.join("asset-roundtrip.athar").to_string_lossy().into_owned();
    let first=storage::save(app,Some(asset_path.clone()),serde_json::to_string(&asset_project).map_err(|e|e.to_string())?)?;
    let second=storage::save(app,Some(asset_path),first.clone())?;
    if first!=second{return Err("Saving a reopened project duplicated assets".into());}
    let mut variations=vec![];
    for (name,kind,ratio,fit,blur) in [("image-square","image","1:1","contain",3),("looping-video","video","16:9","cover",0),("source-video","original","9:16","cover",0)] {
        let mut variant=project.clone();
        variant["style"]["ratio"]=json!(ratio);
        variant["style"]["background"]["kind"]=json!(kind);
        variant["style"]["background"]["fit"]=json!(fit);
        variant["style"]["background"]["blur"]=json!(blur);
        variant["style"]["background"]["path"]=json!(if kind=="image"{logo.to_string_lossy().into_owned()}else{output.to_string()});
        variant["style"]["logoPath"]=json!(logo);
        if kind=="original"{
            variant["media"]=serde_json::to_value(media::import(app,output,&guard.job)?).map_err(|e|e.to_string())?;
            variant["clip"]=json!({"start":0,"end":6});
        }
        let ratio_ass=fs::read_to_string(work.join(format!("captions-{}.ass",ratio.replace(':',"x")))).map_err(|e|e.to_string())?;
        let output=work.join(format!("{}.mp4",name));
        render::export(app,&variant,&ratio_ass,&output,"mp4",&guard.job)?;
        variations.push(json!({"name":name,"probe":media::probe(app,&output,&guard.job)?}));
    }
    let mut pending=project.clone();pending["segments"][0]["english"]=json!("Unapproved replacement");
    if render::validate(&pending).is_ok(){return Err("Export approval gate failed".into());}
    guard.job.cancelled.store(true,Ordering::Relaxed);
    let cancel_path=Path::new(output).with_file_name("must-not-exist.mp4");
    if render::export(app,&project,&ass,&cancel_path,"mp4",&guard.job).is_ok()||cancel_path.exists(){return Err("Cancellation published an output".into());}
    guard.job.cancelled.store(false,Ordering::Relaxed);
    let mut report=json!({"ok":true,"projectRoundtrip":true,"savedPathRecovery":true,"assetRoundtrip":true,"concurrentJobGate":true,"unapprovedExportBlocked":true,"cancelledExportNotPublished":true,"cancelledModelDownloadSeconds":cancellation_seconds,"video":video_probe,"srt":srt_path,"variations":variations,"transcription":null});
    let sample=Path::new(input).with_file_name("arabic-example.wav");
    if sample.exists()&&config["skipTranscription"]!=true{
        let model="large-v3-turbo-q5_0";
        if !models::path(app,model)?.exists(){models::download(app,model,&guard.job)?;}
        let sample_probe=media::probe(app,&sample,&guard.job)?;
        let duration=sample_probe["format"]["duration"].as_str().and_then(|s|s.parse::<f64>().ok()).ok_or("Sample duration missing")?;
        let mut trials=vec![];
        for device in ["auto","cpu"]{
            jobs::check(&guard.job)?;
            let started=Instant::now();
            let transcript=media::transcribe(app,&sample.to_string_lossy(),0.0,duration,model,device,&guard.job)?;
            if transcript.segments.is_empty(){return Err("Arabic transcription was empty".into());}
            trials.push(json!({"requested":device,"elapsedSeconds":started.elapsed().as_secs_f64(),"result":transcript}));
        }
        report["transcription"]=json!(trials);
    }
    Ok(report)
}
