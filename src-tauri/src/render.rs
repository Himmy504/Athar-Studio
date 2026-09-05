use std::{fs, path::{Path, PathBuf}};
use serde_json::Value;
use tauri::AppHandle;
use crate::{jobs::{self, Job}, storage};

fn number(v: &Value, key: &str) -> Result<f64, String> {
    v[key].as_f64().filter(|n| n.is_finite()).ok_or(format!("Invalid {}", key))
}
pub fn validate(p: &Value) -> Result<(), String> {
    storage::project_check(p)?;
    let start = number(&p["clip"], "start")?; let end = number(&p["clip"], "end")?;
    if start < 0.0 || end <= start || end > number(&p["media"], "duration")? + 0.05 { return Err("Invalid excerpt timing".into()); }
    let segments = p["segments"].as_array().ok_or("No captions")?;
    if segments.is_empty() { return Err("Add captions before exporting".into()); }
    let mut previous = 0.0;
    for (i, s) in segments.iter().enumerate() {
        let a = number(s, "start")?; let b = number(s, "end")?;
        if a < previous - 0.01 || a < 0.0 || b <= a || b > end - start + 0.05 { return Err(format!("Caption {} has invalid or overlapping timing", i+1)); }
        previous = b;
        if s["arabic"].as_str().is_none_or(|v| v.trim().is_empty()) || s["english"].as_str().is_none_or(|v| v.trim().is_empty()) { return Err(format!("Caption {} is incomplete", i+1)); }
        if s["correctionResolved"] != true || (s["uncertain"] == true && s["uncertaintyResolved"] != true) { return Err(format!("Resolve caption {} flags before exporting", i+1)); }
        for key in ["arabic", "english", "start", "end"] {
            if s["approval"][key] != s[key] { return Err(format!("Caption {} needs creator approval", i+1)); }
        }
    }
    Ok(())
}
fn color(hex: &str) -> Result<[u8;3], String> {
    if hex.len() != 7 || !hex.starts_with('#') || !hex[1..].bytes().all(|c| c.is_ascii_hexdigit()) { return Err("Invalid background color".into()); }
    Ok([u8::from_str_radix(&hex[1..3],16).unwrap(),u8::from_str_radix(&hex[3..5],16).unwrap(),u8::from_str_radix(&hex[5..7],16).unwrap()])
}
fn dimensions(p: &Value) -> Result<(u32,u32),String> {
    match p["style"]["ratio"].as_str() {
        Some("9:16") => Ok((1080,1920)), Some("1:1") => Ok((1080,1080)), Some("16:9") => Ok((1920,1080)), _ => Err("Invalid export aspect ratio".into())
    }
}
pub fn srt(p: &Value, lang: &str) -> Result<String,String> {
    validate(p)?;
    if !["arabic","english"].contains(&lang) { return Err("Unknown subtitle language".into()); }
    let time = |v:f64| { let n=(v*1000.0).round() as u64; format!("{:02}:{:02}:{:02},{:03}",n/3600000,(n/60000)%60,(n/1000)%60,n%1000) };
    let mut result = String::new();
    for (i,s) in p["segments"].as_array().unwrap().iter().enumerate() {
        let text=s[lang].as_str().unwrap_or("").replace('<',"＜").replace('>',"＞").replace("\r\n","\n").replace("\n\n","\n");
        result.push_str(&format!("{}\n{} --> {}\n{}\n\n",i+1,time(number(s,"start")?),time(number(s,"end")?),text.trim()));
    }
    Ok(result)
}
pub fn export(app: &AppHandle, p: &Value, ass: &str, dest: &Path, format: &str, job: &Job) -> Result<(), String> {
    validate(p)?;
    if format == "srt-arabic" || format == "srt-english" {
        let text = srt(p, if format == "srt-arabic" {"arabic"} else {"english"})?;
        jobs::check(job)?; storage::atomic_write(dest,text.as_bytes())?;
        jobs::report(app,job,100.0,"Subtitles exported"); return Ok(());
    }
    if format != "mp4" { return Err("Unknown export format".into()); }
    if ass.len()>2_000_000 || !ass.starts_with("[Script Info]") { return Err("Invalid caption render document".into()); }
    let source=p["media"]["path"].as_str().ok_or("No source media")?;
    if !Path::new(source).is_file() { return Err("Source media is missing. Relink it before exporting.".into()); }
    let parent=dest.parent().ok_or("Invalid export destination")?;
    fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    let output=tempfile::Builder::new().prefix("athar-export-").suffix(".mp4").tempfile_in(parent).map_err(|e| format!("Cannot create export (check disk space): {}",e))?;
    let work=tempfile::tempdir_in(storage::cache_dir(app)?).map_err(|e|e.to_string())?;
    fs::write(work.path().join("captions.ass"),ass.as_bytes()).map_err(|e|e.to_string())?;
    let fonts=work.path().join("fonts"); fs::create_dir_all(&fonts).map_err(|e|e.to_string())?;
    for entry in fs::read_dir(storage::resources(app)?.join("fonts")).map_err(|e|format!("Bundled fonts missing: {}",e))? {
        let entry=entry.map_err(|e|e.to_string())?;
        if entry.path().extension().and_then(|e|e.to_str())!=Some("ttf"){continue;}
        fs::copy(entry.path(),fonts.join(entry.file_name())).map_err(|e|e.to_string())?;
    }
    let (w,h)=dimensions(p)?; let bg=&p["style"]["background"];
    let kind=bg["kind"].as_str().unwrap_or("");
    let start=number(&p["clip"],"start")?; let duration=number(&p["clip"],"end")?-start;
    let mut args=vec!["-y".into(),"-nostdin".into(),"-v".into(),"error".into(),"-progress".into(),"pipe:2".into(),"-ss".into(),start.to_string(),"-i".into(),source.into()];
    let mut input_index=0;
    match kind {
        "original" => {
            if p["media"]["hasVideo"] != true { return Err("Choose a background for this audio-only source.".into()); }
        },
        "solid" | "gradient" => {
            let c1=color(bg["color"].as_str().unwrap_or(""))?;
            let c2=if kind=="gradient" {color(bg["color2"].as_str().unwrap_or(""))?} else {c1};
            let image=image::RgbImage::from_fn(w,h,|_,y| {
                let ratio=y as f32/(h-1) as f32;
                image::Rgb(std::array::from_fn(|i| ((c1[i] as f32)*(1.0-ratio)+(c2[i] as f32)*ratio).round() as u8))
            });
            image.save(work.path().join("background.png")).map_err(|e|e.to_string())?;
            args.extend(["-loop","1","-framerate","30","-i","background.png"].map(String::from));
            input_index=1;
        },
        "image" | "video" => {
            let path=bg["path"].as_str().filter(|s|!s.is_empty()).ok_or("Select a background file")?;
            if !Path::new(path).is_file() {return Err("The background file is missing. Select it again.".into());}
            if kind=="image" {args.extend(["-loop","1","-framerate","30"].map(String::from));}
            else {args.extend(["-stream_loop","-1"].map(String::from));}
            args.extend(["-i".into(),path.into()]); input_index=1;
        },
        _=>return Err("Unknown background type".into()),
    }
    let dim=number(bg,"dim")?; let blur=number(bg,"blur")?;
    if !(0.0..=90.0).contains(&dim)||!(0.0..=30.0).contains(&blur) {return Err("Invalid background effect".into());}
    let fit=match bg["fit"].as_str() {
        Some("cover")=>format!("scale={}:{}:force_original_aspect_ratio=increase,crop={}:{},setsar=1",w,h,w,h),
        Some("contain")=>format!("scale={}:{}:force_original_aspect_ratio=decrease,pad={}:{}:(ow-iw)/2:(oh-ih)/2:black,setsar=1",w,h,w,h),
        _=>return Err("Invalid background fit".into()),
    };
    let mut graph=format!("[{}:v:0]setpts=PTS-STARTPTS,{},fps=30",input_index,fit);
    if blur>0.0 {graph.push_str(&format!(",gblur=sigma={}",blur));}
    if dim>0.0 {graph.push_str(&format!(",drawbox=color=black@{}:t=fill",dim/100.0));}
    graph.push_str("[background];");
    let logo=p["style"]["logoPath"].as_str().unwrap_or("");
    if !logo.is_empty() {
        if !Path::new(logo).is_file() {return Err("The channel logo is missing. Select it again.".into());}
        let index=if input_index==0 {1} else {2};
        args.extend(["-loop".into(),"1".into(),"-i".into(),logo.into()]);
        graph.push_str(&format!("[{}:v:0]scale=100:100:force_original_aspect_ratio=decrease,format=rgba[logo];[background][logo]overlay=W-w-60:60:shortest=1[branded];[branded]",index));
    } else {graph.push_str("[background]");}
    graph.push_str("ass=filename=captions.ass:fontsdir=fonts,format=yuv420p[out]");
    args.extend(["-filter_complex".into(),graph,"-map".into(),"[out]".into(),"-map".into(),"0:a:0".into(),"-t".into(),duration.to_string(),
        "-c:v".into(),"libx264".into(),"-preset".into(),"fast".into(),"-crf".into(),"20".into(),"-r".into(),"30".into(),"-c:a".into(),"aac".into(),"-b:a".into(),"192k".into(),
        "-af".into(),"asetpts=PTS-STARTPTS".into(),"-movflags".into(),"+faststart".into(),"-threads".into(),"4".into(),output.path().to_string_lossy().into()]);
    jobs::process(&storage::binary(app,"ffmpeg")?,&args,Some(work.path()),app,job,duration,"Rendering your clip")?;
    jobs::check(job)?;
    if output.as_file().metadata().map_err(|e|e.to_string())?.len()==0 {return Err("The renderer produced an empty file".into());}
    output.persist(dest).map_err(|e|format!("Could not publish completed export: {}",e))?;
    jobs::report(app,job,100.0,"Your video is ready");
    Ok(())
}
pub fn destination(path: &str, project: &Value) -> Result<PathBuf,String> {
    let dest=PathBuf::from(path);
    let key=|p:&Path| p.canonicalize().unwrap_or_else(|_|p.to_path_buf()).to_string_lossy().to_lowercase();
    for source in [project["media"]["path"].as_str(),project["style"]["background"]["path"].as_str(),project["style"]["logoPath"].as_str()].into_iter().flatten().filter(|s|!s.is_empty()) {
        if key(&dest)==key(Path::new(source)) {return Err("Choose an export path different from your source assets.".into());}
    }
    Ok(dest)
}
#[cfg(test)]
mod tests {
    use super::*;
    fn project() -> Value { serde_json::json!({"schemaVersion":1,"id":"p","media":{"duration":12},"clip":{"start":2,"end":8},"segments":[{
        "start":0,"end":6,"arabic":"العلم","english":"Knowledge","correctionResolved":true,"uncertain":false,
        "approval":{"start":0,"end":6,"arabic":"العلم","english":"Knowledge"}
    }]}) }
    #[test] fn native_gate_checks_exact_approved_text() {
        let mut p=project(); assert!(validate(&p).is_ok());
        p["segments"][0]["english"]=Value::String("Changed".into()); assert!(validate(&p).is_err());
    }
    #[test] fn native_gate_rejects_unresolved_and_overlaps() {
        let mut p=project(); p["segments"][0]["uncertain"]=Value::Bool(true); assert!(validate(&p).is_err());
        let mut p=project(); p["segments"][0]["end"]=serde_json::json!(9); assert!(validate(&p).is_err());
    }
    #[test] fn srt_uses_excerpt_relative_timing() {
        assert!(srt(&project(),"english").unwrap().contains("00:00:00,000 --> 00:00:06,000"));
    }
}
