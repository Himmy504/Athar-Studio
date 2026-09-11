use std::{io::{Read, BufRead, BufReader}, path::Path, process::{Command, Stdio}, sync::{Arc, Mutex, atomic::{AtomicBool, Ordering}}, thread, time::{Duration, Instant}};
use tauri::{AppHandle, Emitter};
use serde::Serialize;

#[derive(Clone, Default)]
pub struct JobState { active: Arc<Mutex<Option<Arc<Job>>>> }
pub struct Job { pub id: String, pub kind: String, pub cancelled: AtomicBool }
pub struct Guard { pub job: Arc<Job>, state: JobState }
impl Drop for Guard {
    fn drop(&mut self) {
        if let Ok(mut active) = self.state.active.lock() {
            if active.as_ref().is_some_and(|j| j.id == self.job.id) { *active = None; }
        }
    }
}
impl JobState {
    pub fn start(&self, id: String, kind: &str) -> Result<Guard, String> {
        let mut active = self.active.lock().map_err(|_| "Job state unavailable")?;
        if active.is_some() { return Err("Another media or model job is running. Wait or cancel it first.".into()); }
        let job = Arc::new(Job { id, kind: kind.into(), cancelled: AtomicBool::new(false) });
        *active = Some(job.clone());
        Ok(Guard { job, state: self.clone() })
    }
    pub fn cancel(&self, id: &str) -> Result<(), String> {
        let active = self.active.lock().map_err(|_| "Job state unavailable")?;
        if let Some(job) = active.as_ref().filter(|j| j.id == id) { job.cancelled.store(true, Ordering::Relaxed); }
        Ok(())
    }
    pub fn running(&self,id:&str)->bool{
        self.active.lock().ok().is_some_and(|a|a.as_ref().is_some_and(|j|j.id==id))
    }
}
#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct Progress<'a> { job_id: &'a str, kind: &'a str, percent: f64, message: &'a str }
pub fn report(app: &AppHandle, job: &Job, percent: f64, message: &str) {
    let _ = app.emit("job-progress", Progress { job_id: &job.id, kind: &job.kind, percent: percent.clamp(0.0, 100.0), message });
}
pub fn check(job: &Job) -> Result<(), String> {
    if job.cancelled.load(Ordering::Relaxed) { Err("Cancelled. Your project has been preserved.".into()) } else { Ok(()) }
}
pub fn hidden_command(exe: &Path) -> Command {
    let mut cmd = Command::new(exe);
    #[cfg(windows)] {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x08000000);
    }
    cmd
}
pub fn process(exe: &Path, args: &[String], cwd: Option<&Path>, app: &AppHandle, job: &Job, duration: f64, label: &str) -> Result<Vec<u8>, String> {
    process_output(exe,args,cwd,app,job,duration,label).map(|(out,_)|out)
}
pub fn process_output(exe: &Path, args: &[String], cwd: Option<&Path>, app: &AppHandle, job: &Job, duration: f64, label: &str) -> Result<(Vec<u8>,String), String> {
    check(job)?;
    let mut cmd = hidden_command(exe);
    cmd.args(args).stdin(Stdio::null()).stdout(Stdio::piped()).stderr(Stdio::piped());
    if let Some(dir) = cwd { cmd.current_dir(dir); }
    let mut child = cmd.spawn().map_err(|e| format!("Could not start {}: {}", exe.display(), e))?;
    let stdout = child.stdout.take().ok_or("Process output unavailable")?;
    let stderr = child.stderr.take().ok_or("Process error output unavailable")?;
    let out_thread = thread::spawn(move || {
        let mut out = Vec::new();
        let mut reader = BufReader::new(stdout);
        let mut chunk = [0_u8; 16384];
        while let Ok(n) = reader.read(&mut chunk) {
            if n == 0 { break; }
            if out.len() + n <= 64 * 1024 * 1024 { out.extend_from_slice(&chunk[..n]); }
        }
        out
    });
    let (sender, receiver) = std::sync::mpsc::channel();
    let err_thread = thread::spawn(move || {
        let mut errors = String::new();
        for line in BufReader::new(stderr).lines().map_while(Result::ok) {
            let _ = sender.send(line.clone());
            errors.push_str(&line); errors.push('\n');
            if errors.len() > 64000 {
                let cut = errors.char_indices().find(|(i, _)| *i >= 32000).map(|(i, _)| i).unwrap_or(0);
                errors.drain(..cut);
            }
        }
        errors
    });
    let mut last = Instant::now();
    let mut percent: f64 = 0.0;
    let result = loop {
        if check(job).is_err() { let _ = child.kill(); let _ = child.wait(); break Err("Cancelled. Your project has been preserved.".into()); }
        while let Ok(line) = receiver.try_recv() {
            if let Some(value) = line.strip_prefix("out_time_us=") {
                if let Ok(us) = value.parse::<f64>() { if duration > 0.0 { percent = us / 1_000_000.0 / duration * 100.0; } }
            }
            if line.contains("progress =") {
                if let Some(value) = line.split("progress =").nth(1).and_then(|s| s.trim().trim_end_matches('%').trim().parse::<f64>().ok()) { percent = value; }
            }
        }
        if last.elapsed() > Duration::from_millis(250) { report(app, job, percent.min(99.0), label); last = Instant::now(); }
        match child.try_wait() {
            Ok(Some(status)) => break if status.success() { Ok(()) } else { Err(format!("{} failed ({}).", label, status)) },
            Ok(None) => thread::sleep(Duration::from_millis(70)),
            Err(e) => { let _ = child.kill(); let _ = child.wait(); break Err(e.to_string()); }
        }
    };
    let output = out_thread.join().map_err(|_| "Output reader failed")?;
    let errors = err_thread.join().unwrap_or_default();
    result.map_err(|e| if e.starts_with("Cancelled") { e } else { format!("{}\n{}", e, errors.chars().rev().take(2500).collect::<String>().chars().rev().collect::<String>()) })?;
    Ok((output,errors))
}
