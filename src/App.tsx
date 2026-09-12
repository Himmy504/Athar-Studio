import { targetLanguage } from './languages';
import { prepareTranslationBatch } from './translationBatches';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { listen } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { ArrowDownToLine, ArrowRight, BookOpen, Check, CheckCheck, CircleHelp, Cpu, Download, FilePlus2, FolderOpen, Languages, LoaderCircle, Monitor, Pause, Plus, Redo2, Save, Undo2, Upload, X } from 'lucide-react';
import { desktop, chooseExport, chooseMedia, chooseProject, chooseSaveProject, downloadText, launchGemini, native, showFile } from './bridge';
import { approve, exportErrors, formatTime, importResponse, isApproved, newProject, newSegment, parseProject, repairPrompt } from './domain';
import { captionWarnings, generateAss, generateSrt } from './subtitles';
import { Modal, Field } from './components';
import { useProject } from './useProject';
import { Preview } from './Preview';
import { ReviewPanel } from './ReviewPanel';
import { StylePanel } from './StylePanel';
import { ClipStrip } from './ClipStrip';
import { useReviewPlayback } from './useReviewPlayback';
import { PLAYBACK_RATES } from './playback';
import { useCaptionFonts } from './fonts';
import { DEFAULT_EXPORT, EXPORT_SPEEDS, EXPORT_FRAME_RATES } from './exportSettings';
import type { Device, ExportSettings, Progress, Project, RuntimeStatus } from './types';

type Dialog = 'translate'|'models'|'glossary'|'export'|'help'|'new'|'retranscribe'|null;
export default function App(){
  const store=useProject(),{project:p,update,replace,path,setPath,status,undo,redo,canUndo,canRedo,persist}=store;
  const exportSettings=p.exportSettings??DEFAULT_EXPORT;
  const translation=targetLanguage(p);
  const [dialog,setDialog]=useState<Dialog>(null),[notice,setNotice]=useState(''),[job,setJob]=useState<Progress|null>(null);
  const [runtime,setRuntime]=useState<RuntimeStatus|null>(null),[model,setModel]=useState(()=>localStorage.getItem('athar-model')||'large-v3-turbo-q5_0');
  const [device,setDevice]=useState<Device>(()=>localStorage.getItem('athar-device')==='cpu'?'cpu':'auto'),[lastDevice,setLastDevice]=useState('Auto');
  const [response,setResponse]=useState(''),[pasteError,setPasteError]=useState(''),[exportFormat,setExportFormat]=useState('mp4'),[exported,setExported]=useState('');
  const [time,setTime]=useState(0),[trim,setTrim]=useState<{start:number;end:number}|null>(null),[trimKey,setTrimKey]=useState(0),[missing,setMissing]=useState(false);
  const [exportConfirmed,setExportConfirmed]=useState(false),[missingPreview,setMissingPreview]=useState(false);
  const player=useRef<HTMLVideoElement>(null),fileInput=useRef<HTMLInputElement>(null),jobRef=useRef<Progress|null>(null),latest=useRef(p),latestPath=useRef(path);
  latest.current=p;
  latestPath.current=path;
  const notify=useCallback((message:string)=>setNotice(message.replace(/^Error:\s*/,'')),[]);
  const playback=useReviewPlayback(p,player,setTime,notify,!!job);
  const captionFonts=useCaptionFonts(p.style);
  const ass=useMemo(()=>generateAss(p),[p,captionFonts.ready]);
  useEffect(()=>{
    if(!/^(Prompt copied|Repair prompt copied|Project opened|Project saved|Transcript ready|Translation imported|Subtitles exported|Export complete|Style saved)/.test(notice))return;
    const timer=setTimeout(()=>setNotice(''),3500);return()=>clearTimeout(timer);
  },[notice]);
  const edit=useCallback((fn:(p:Project)=>Project,key?:string)=>{if(!jobRef.current)update(fn,key);},[update]);
  const refreshRuntime=useCallback(async()=>{if(desktop)try{setRuntime(await native.status());}catch(e){notify(String(e));}},[notify]);
  useEffect(()=>{void refreshRuntime();},[refreshRuntime]);
  useEffect(()=>{localStorage.setItem('athar-model',model);localStorage.setItem('athar-device',device);},[model,device]);
  useEffect(()=>{
    if(!desktop)return;
    const subscription=listen<Progress>('job-progress',event=>{if(event.payload.jobId===jobRef.current?.jobId){jobRef.current=event.payload;setJob(event.payload);}});
    return()=>{void subscription.then(fn=>fn());};
  },[]);
  useEffect(()=>{
    if(!desktop)return;
    const subscription=getCurrentWindow().onCloseRequested(async event=>{
      event.preventDefault();
      try{
        if(jobRef.current)await native.cancel(jobRef.current.jobId);
        await persist(latest.current,latestPath.current);
        await getCurrentWindow().destroy();
      }catch(e){notify('Could not save before closing: '+String(e));}
    });
    return()=>{void subscription.then(fn=>fn());};
  },[persist,notify]);
  useEffect(()=>{
    let cancelled=false;
    if(desktop&&p.media)void Promise.all([native.exists(p.media.path),native.exists(p.media.previewPath||p.media.path)]).then(([source,preview])=>{if(!cancelled){setMissing(!source);setMissingPreview(source&&!preview);}}).catch(()=>{if(!cancelled)setMissing(true);});
    else{setMissing(false);setMissingPreview(false);}
    return()=>{cancelled=true;};
  },[p.media?.path,p.media?.previewPath]);
  useEffect(()=>{
    const listener=(e:KeyboardEvent)=>{
      const target=e.target as HTMLElement,isInput=['INPUT','TEXTAREA','SELECT'].includes(target.tagName)||target.isContentEditable;
      if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'){e.preventDefault();void saveProject();}
      if(!isInput&&!jobRef.current&&(e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();if(e.shiftKey)redo();else undo();}
      if(!isInput&&!jobRef.current&&(e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='y'){e.preventDefault();redo();}
      if(dialog||trim||jobRef.current||e.repeat||document.querySelector('dialog[open],[role="dialog"]'))return;
      if((e.ctrlKey||e.metaKey)&&e.key==='Enter'&&(!isInput||target.classList.contains('english-input')||target.classList.contains('arabic-input'))){
        const selected=p.segments.find(s=>s.id===playback.selectedId);if(!selected)return;e.preventDefault();
        try{const reviewed=approve(selected);edit(v=>({...v,segments:v.segments.map(s=>s.id===reviewed.id?reviewed:s)}));target.blur();playback.navigate(1);}catch(error){notify(error instanceof Error?error.message:String(error));}
        return;
      }
      if(isInput){if(e.key==='Escape'&&target.tagName==='TEXTAREA')target.blur();return;}
      if(e.ctrlKey||e.metaKey||e.altKey)return;
      const key=e.key.toLowerCase();
      if(key===' '&&target.tagName!=='BUTTON'){e.preventDefault();playback.toggle();}
      else if(key==='r'){e.preventDefault();playback.replay();}
      else if(key==='l'){e.preventDefault();playback.toggleLoop();}
      else if(key==='arrowdown'){e.preventDefault();playback.navigate(1);}
      else if(key==='arrowup'){e.preventDefault();playback.navigate(-1);}
      else if(key==='['||key===']'){e.preventDefault();const i=PLAYBACK_RATES.indexOf(playback.rate as 1);playback.changeRate(PLAYBACK_RATES[Math.max(0,Math.min(PLAYBACK_RATES.length-1,i+(key==='['?-1:1)))]);}
    };
    window.addEventListener('keydown',listener);return()=>window.removeEventListener('keydown',listener);
  });
  async function runJob<T>(kind:string,message:string,action:(id:string)=>Promise<T>):Promise<T|undefined>{
    if(jobRef.current){notify('Wait for the current job or cancel it first.');return;}
    const initial={jobId:crypto.randomUUID(),kind,percent:0,message};jobRef.current=initial;setJob(initial);setNotice('');
    try{return await action(initial.jobId);}catch(e){notify(String(e));return undefined;}
    finally{jobRef.current=null;setJob(null);void refreshRuntime();}
  }
  async function importMedia(relink=false){
    try{
      const selected=await chooseMedia();if(!selected)return;
      const media=await runJob('import','Reading source media',id=>native.importMedia(selected,id));if(!media)return;
      if(relink){
        if(Math.abs(media.duration-(p.media?.duration??0))>.15){notify('This file has a different duration. Import it as a new project so captions are not attached to the wrong speech.');return;}
        update(v=>({...v,media,request:null,segments:v.segments.map(s=>({...s,approval:null}))}));
        notify('Source relinked. Review the captions again to confirm they match this file.');
      }else{
        const next=newProject();next.media=media;next.name=media.name.replace(/\.[^.]+$/,'');next.clip={start:0,end:Math.min(60,media.duration)};
        if(media.hasVideo)next.style.background.kind='original';
        replace(next);setTime(0);
      }
      setMissing(false);
    }catch(e){notify(String(e));}
  }
  async function rebuildPlayback(){
    if(!p.media)return;
    const original=p.media;
    const media=await runJob('import','Restoring source playback',id=>native.importMedia(original.path,id));
    if(!media)return;
    const same=media.size===original.size&&Math.abs(media.duration-original.duration)<.01&&media.previewPath===original.previewPath;
    if(!same){notify('This source has changed. Relink it and review the captions again.');setMissing(true);return;}
    update(v=>({...v,media}));setMissingPreview(false);notify('Playback restored.');
  }
  async function openProject(){
    try{
      if(!desktop){fileInput.current?.click();return;}
      const selected=await chooseProject();if(!selected)return;
      const project=parseProject(await native.open(selected));replace(project,selected);setTime(0);notify('Project opened.');
    }catch(e){notify(String(e));}
  }
  async function saveProject(){
    try{
      if(!desktop){downloadText(p.name+'.athar',JSON.stringify(p,null,2));notify('Project downloaded. Browser recovery is also saved locally.');return;}
      const target=path||await chooseSaveProject(p.name);if(!target)return;
      await persist(latest.current,target);setPath(target);notify('Project saved.');
    }catch(e){notify(String(e));}
  }
  async function transcribe(replaceExisting=false){
    if(!p.media){notify('Import a lecture first.');return;}
    if(!desktop){notify('Local AI runs in the Windows app. You can edit imported projects in this browser preview.');return;}
    if(missing){notify('Relink the missing source before transcribing.');return;}
    if(!runtime?.models.find(m=>m.id===model)?.installed){setDialog('models');notify('Download a local model, then choose Transcribe Arabic.');return;}
    if(p.segments.length&&!replaceExisting){setDialog('retranscribe');return;}
    setDialog(null);
    const result=await runJob('transcribe','Preparing local Arabic transcription',id=>native.transcribe(p,model,device,id));
    if(result){update(v=>({...v,segments:result.segments.map(s=>newSegment(s.start,s.end,s.arabic)),request:null}));setLastDevice(result.device);notify('Transcript ready.');}
  }
  async function copyPrompt(){
    try{
      const prepared=prepareTranslationBatch(p);
      await navigator.clipboard.writeText(prepared.request!.prompt);
      edit(()=>prepared);setPasteError('');setResponse('');
      notify('Prompt copied.');
    }catch(e){notify(String(e));}
  }
  function paste(){
    try{const next=importResponse(p,response);edit(()=>next);setDialog(null);setPasteError('');setResponse('');notify(next.translationBatch?.remainingIds.length?'Translation imported. Copy the next prompt to continue.':'Translation imported.');}
    catch(e){setPasteError(e instanceof Error?e.message:String(e));}
  }
  async function doExport(){
    if(exportFormat==='mp4'&&!captionFonts.ready){notify(captionFonts.error||'Caption fonts are loading. Try exporting again in a moment.');return;}
    const errors=exportErrors(p);if(errors.length){notify(errors.join(' '));return;}
    if(!exportConfirmed){notify('Confirm that you reviewed the final captions first.');return;}
    try{
      if(!desktop){
        if(exportFormat==='mp4'){notify('Video rendering is available in the Windows app.');return;}
        const lang=exportFormat==='srt-arabic'?'arabic':'english';
        downloadText(p.name+'-'+(lang==='arabic'?'ar':translation.code)+'.srt',generateSrt(p,lang),'text/plain;charset=utf-8');notify('Subtitles exported.');return;
      }
      const target=await chooseExport(p.name,exportFormat,translation.code);if(!target)return;
      const result=await runJob('export','Preparing your export',id=>native.export(p,ass,target,exportFormat,id));
      if(result){setExported(result);notify('Export complete.');}
    }catch(e){notify(String(e));}
  }
  function changeTrim(clip:{start:number;end:number}){
    if(clip.end<=clip.start||clip.start<0||clip.end>(p.media?.duration??0)){notify('Choose a valid excerpt.');setTrimKey(k=>k+1);return;}
    if(clip.start===p.clip.start&&clip.end===p.clip.end)return;
    if(p.segments.length)setTrim(clip);else{edit(v=>({...v,clip,request:null}));setTime(0);if(player.current)player.current.currentTime=clip.start;}
  }
  const warnings=useMemo(()=>captionWarnings(p),[p,captionFonts.ready]);
  const busy=!!job,approved=p.segments.filter(isApproved).length,errors=exportErrors(p);
  return <div className="app-shell">
    <input type="file" ref={fileInput} accept=".athar,.json,.bak" hidden onChange={async e=>{const file=e.target.files?.[0];if(file)try{replace(parseProject(await file.text()));setTime(0);}catch(err){notify(String(err));}e.target.value='';}}/>
    <header className="topbar">
      <strong className="brand"><img src="/app-icon.png" alt="" width="24" height="24"/>Athar Studio</strong>
      <div className="topbar-divider"/>
      <div className="file-actions">
        <button className="icon-button" aria-label="New project" title="New project" disabled={busy} onClick={()=>setDialog('new')}><FilePlus2 size={16}/></button>
        <button className="icon-button" aria-label="Open project" title="Open project" disabled={busy} onClick={()=>void openProject()}><FolderOpen size={16}/></button>
        <button className="icon-button" aria-label="Save project" title="Save project (Ctrl+S)" onClick={()=>void saveProject()}><Save size={16}/></button>
        <div className="topbar-divider"/>
        <button className="icon-button" aria-label="Undo" title="Undo (Ctrl+Z)" disabled={!canUndo||busy} onClick={undo}><Undo2 size={16}/></button>
        <button className="icon-button" aria-label="Redo" title="Redo (Ctrl+Y)" disabled={!canRedo||busy} onClick={redo}><Redo2 size={16}/></button>
      </div>
      <div className="project-title"><input aria-label="Project name" value={p.name} onChange={e=>edit(v=>({...v,name:e.target.value}),'name')} disabled={busy}/><span title={status}>{status}</span></div>
      <div className="topbar-actions">
        {!desktop&&<span className="browser-banner" title="Transcription and video export require the Windows app">Browser preview</span>}
        <button onClick={()=>setDialog('glossary')}><BookOpen size={15}/>Glossary</button>
        <button onClick={()=>setDialog('models')}><Cpu size={15}/>Models</button>
        <button className="icon-button" aria-label="Workflow help" title="Help" onClick={()=>setDialog('help')}><CircleHelp size={16}/></button>
        <button className="export-top" onClick={()=>{setExportConfirmed(false);setExported('');setDialog('export');}} disabled={busy}><ArrowDownToLine size={15}/>Export clip</button>
      </div>
    </header>
    {notice&&<div className="notice" role="status"><span>{notice}</span><button className="icon-button" aria-label="Dismiss notification" onClick={()=>setNotice('')}><X size={16}/></button></div>}
    {missing&&<div className="missing-banner">Source media not found.<button disabled={busy} onClick={()=>void importMedia(true)}>Relink source</button></div>}
    {missingPreview&&!missing&&<div className="missing-banner">Playback cache not found.<button disabled={busy} onClick={()=>void rebuildPlayback()}>Restore playback</button></div>}
    <main className={'workspace '+(busy?'processing':'')}>
      <Preview project={p} player={player} time={time} playback={playback} ass={ass} fontsReady={captionFonts.ready} fontError={captionFonts.error} onImport={()=>p.media?setDialog('new'):void importMedia()} busy={busy}/>
      <ReviewPanel project={p} update={edit} selectedId={playback.selectedId} onSelect={id=>playback.activate(id)} onPlay={id=>playback.activate(id,true)} onNavigate={playback.navigate} onPrompt={()=>void copyPrompt()} onPaste={()=>setDialog('translate')} onGemini={()=>void launchGemini().catch(e=>notify(String(e)))} onTranscribe={()=>void transcribe()} busy={busy} notify={notify}/>
      <StylePanel project={p} update={edit} notify={notify}/>
    </main>
    <ClipStrip key={p.id+'-'+trimKey} project={p} busy={busy} onImport={()=>p.media?setDialog('new'):void importMedia()} onTrim={changeTrim} onTranscribe={()=>void transcribe()} time={time} onSeek={playback.seek}/>
    {job&&<div className="job-panel" role="status"><div className="job-spinner"><LoaderCircle size={22}/></div><div><strong>{job.message}</strong><div className="job-progress"><span style={{width:Math.max(2,job.percent)+'%'}}/></div><small>{Math.round(job.percent)}%</small></div><button className="secondary-button" onClick={()=>void native.cancel(job.jobId).catch(e=>notify(String(e)))}><Pause size={14}/>Cancel</button></div>}
    {dialog==='translate'&&<Modal title="Import translation" subtitle={`Paste the JSON response for the current prompt (${p.request?.segmentIds.length??0} captions).`} onClose={()=>setDialog(null)} wide>
      <textarea className="response-input" aria-label="Gemini JSON response" spellCheck={false} placeholder={'{\n  "schemaVersion": 1,\n  "requestId": "…",\n  "segments": [ … ]\n}'} value={response} onChange={e=>setResponse(e.target.value)}/>
      {pasteError&&<div className="inline-error"><p>{pasteError}</p><button className="secondary-button" onClick={()=>void navigator.clipboard.writeText(repairPrompt(p,pasteError)).then(()=>notify('Repair prompt copied.')).catch(e=>notify(String(e)))}>Copy repair prompt</button></div>}
      <div className="modal-actions"><button className="secondary-button" onClick={()=>setDialog(null)}>Cancel</button><button className="primary-button" onClick={paste} disabled={!response.trim()||busy}><CheckCheck size={16}/>Import for review</button></div>
    </Modal>}
    {dialog==='models'&&<Modal title="Speech models" subtitle="Choose a model for Arabic transcription." onClose={()=>setDialog(null)} wide>
      {job&&<ModalJob job={job} notify={notify}/>}
      <div className="hardware-summary"><Cpu size={22}/><div><strong>{desktop?runtime?runtime.memoryGb.toFixed(0)+' GB RAM':'Checking this computer…':'Windows desktop feature'}</strong><p>{lastDevice!=='Auto'?'Last transcription: '+lastDevice:'Select Auto or CPU below.'}</p></div></div>
      {desktop&&runtime&&!runtime.ffmpeg&&<p className="inline-error">FFmpeg runtime missing. Run npm run prepare:runtime and rebuild.</p>}
      {desktop&&runtime&&!runtime.cpu&&<p className="inline-error">Local transcription runtime missing. Run npm run prepare:runtime and rebuild.</p>}
      {(runtime?.models??[{id:'large-v3-turbo-q5_0',name:'Balanced',bytes:574041195,installed:false,description:'Recommended · multilingual Turbo'},{id:'small',name:'Low memory',bytes:487601967,installed:false,description:'Smaller working memory'},{id:'large-v3-q5_0',name:'Larger model',bytes:1081140203,installed:false,description:'More processing time and memory'}]).map(m=><div className={'model-card '+(model===m.id?'selected':'')} key={m.id}><label><input type="radio" name="model" value={m.id} checked={model===m.id} disabled={busy} onChange={()=>setModel(m.id)}/><div><strong>{m.name}{m.id==='large-v3-turbo-q5_0'&&<span className="recommended">Recommended</span>}</strong><p>{m.description}</p><small>{(m.bytes/1024/1024).toFixed(0)} MB download · {m.id}</small></div></label>{m.installed?<button className="installed" title="Download and verify this model again" disabled={busy} onClick={()=>void runJob('download','Replacing local model',id=>native.downloadModel(m.id,id))}><Check size={14}/>Ready · reinstall</button>:<button className="secondary-button" disabled={busy||!desktop} onClick={()=>void runJob('download','Starting verified model download',id=>native.downloadModel(m.id,id))}><Download size={15}/>Download</button>}</div>)}
      <Field label="Processing device"><select value={device} onChange={e=>setDevice(e.target.value as Device)} disabled={busy}><option value="auto">Auto · use a compatible GPU, otherwise CPU</option><option value="cpu">CPU only</option></select></Field>
      <div className="modal-actions"><button className="primary-button" onClick={()=>setDialog(null)}>Done <Check size={15}/></button></div>
    </Modal>}
    {dialog==='glossary'&&<Modal title="Glossary" subtitle="Preferred translations for names and religious terms." onClose={()=>setDialog(null)}>
      {p.glossary.map((g,i)=><div className="glossary-row" key={i}><input aria-label={'Arabic glossary term '+(i+1)} className="arabic" dir="rtl" placeholder="المصطلح" value={g.arabic} onChange={e=>edit(v=>({...v,glossary:v.glossary.map((x,j)=>j===i?{...x,arabic:e.target.value}:x)}),'glossary-ar-'+i)}/><ArrowRight size={15}/><input aria-label={translation.name+' glossary term '+(i+1)} dir={translation.rtl?'rtl':'ltr'} placeholder={'Preferred '+translation.name} value={g.english} onChange={e=>edit(v=>({...v,glossary:v.glossary.map((x,j)=>j===i?{...x,english:e.target.value}:x)}),'glossary-en-'+i)}/><button className="icon-button" aria-label={'Remove glossary term '+(i+1)} onClick={()=>edit(v=>({...v,glossary:v.glossary.filter((_,j)=>i!==j)}))}><X size={15}/></button></div>)}
      <button className="secondary-button" onClick={()=>edit(v=>({...v,glossary:[...v.glossary,{arabic:'',english:''}]}))}><Plus size={15}/>Add term</button>
      <div className="modal-actions"><button className="primary-button" onClick={()=>setDialog(null)}>Save preferences</button></div>
    </Modal>}
    {dialog==='export'&&<Modal title={exported?'Export complete':'Export'} onClose={()=>setDialog(null)}>
      {job&&<ModalJob job={job} notify={notify}/>}
      {exported?<div className="export-success"><div><CheckCheck size={36}/></div><p>{exported.split(/[\\/]/).pop()}</p><button className="primary-button" onClick={()=>void showFile(exported).catch(e=>notify(String(e)))}><FolderOpen size={16}/>Show in folder</button></div>:<>
        <div className="export-summary"><span><CheckCheck size={22}/><strong>{approved} / {p.segments.length}</strong> approved captions</span>{exportFormat==='mp4'&&<span><Monitor size={22}/><strong>{p.style.ratio}</strong> {exportSettings.resolution}p · {exportSettings.fps} fps</span>}</div>
        <Field label="Format"><select value={exportFormat} onChange={e=>setExportFormat(e.target.value)} disabled={busy}><option value="mp4">MP4 video · captions burned in</option><option value="srt-english">{translation.name} subtitles · SRT</option><option value="srt-arabic">Arabic subtitles · SRT</option></select></Field>
        {exportFormat==='mp4'&&<>
          <Field label="Aspect ratio"><select value={p.style.ratio} onChange={e=>edit(v=>({...v,style:{...v.style,ratio:e.target.value as Project['style']['ratio']}}))} disabled={busy}><option value="9:16">Vertical · 9:16</option><option value="1:1">Square · 1:1</option><option value="16:9">Landscape · 16:9</option></select></Field>
          <div className="field-row">
            <Field label="Resolution"><select value={exportSettings.resolution} disabled={busy} onChange={e=>edit(v=>({...v,exportSettings:{...(v.exportSettings??DEFAULT_EXPORT),resolution:Number(e.target.value) as ExportSettings['resolution']}}))}><option value="1080">1080p · Full HD</option><option value="720">720p · Faster export</option></select></Field>
            <Field label="Frame rate"><select value={exportSettings.fps} disabled={busy} onChange={e=>edit(v=>({...v,exportSettings:{...(v.exportSettings??DEFAULT_EXPORT),fps:Number(e.target.value) as ExportSettings['fps']}}))}>{EXPORT_FRAME_RATES.map(fps=><option key={fps} value={fps}>{fps} fps</option>)}</select></Field>
          </div>
          <p className="field-hint">Lower frame rates suit still backgrounds. Higher rates give smoother motion and fades. Audio speed stays unchanged.</p>
          <Field label="Encoding" hint={EXPORT_SPEEDS[exportSettings.speed].hint}><select value={exportSettings.speed} disabled={busy} onChange={e=>edit(v=>({...v,exportSettings:{...(v.exportSettings??DEFAULT_EXPORT),speed:e.target.value as ExportSettings['speed']}}))}>{Object.entries(EXPORT_SPEEDS).map(([id,speed])=><option key={id} value={id}>{speed.label}</option>)}</select></Field>
        </>}
        {errors.length>0&&<div className="inline-warning"><strong>Before you export</strong><ul>{errors.slice(0,5).map(e=><li key={e}>{e}</li>)}</ul></div>}
        {warnings.length>0&&<details className="readability"><summary>{warnings.length} readability suggestion{warnings.length===1?'':'s'}</summary><ul>{warnings.map((w,i)=><li key={i}>{w}</li>)}</ul></details>}
        <label className="approval-confirm"><input type="checkbox" checked={exportConfirmed} onChange={e=>setExportConfirmed(e.target.checked)} disabled={busy}/><span>I reviewed the final Arabic, translation, and caption timings against the audio.</span></label>
        <div className="modal-actions"><button className="secondary-button" onClick={()=>setDialog(null)}>Back to editor</button><button className="primary-button" disabled={busy||!!errors.length||!exportConfirmed} onClick={()=>void doExport()}><ArrowDownToLine size={16}/>Export {exportFormat==='mp4'?'video':'subtitles'}</button></div>
      </>}
    </Modal>}
    {dialog==='help'&&<Modal title="Workflow" onClose={()=>setDialog(null)}>
      <dl className="shortcut-list"><dt>Space</dt><dd>Play / pause</dd><dt>R</dt><dd>Replay selected caption</dd><dt>L</dt><dd>Loop selected caption</dd><dt>↑ / ↓</dt><dd>Previous / next caption</dd><dt>[ / ]</dt><dd>Slower / faster playback</dd><dt>Ctrl + Enter</dt><dd>Approve caption and advance</dd><dt>Esc</dt><dd>Leave a caption text field</dd></dl>
      <ol className="help-steps"><li><strong>Import & select</strong><p>Choose a lecture file and drag the excerpt handles. One project holds one continuous passage.</p></li><li><strong>Transcribe locally</strong><p>Download a model in Models. Arabic transcription runs on your GPU when compatible, or your CPU.</p></li><li><strong>Translate with Gemini</strong><p>Copy the prepared prompt, paste it in Gemini, then paste its complete JSON response back here. Only text is shared manually.</p></li><li><strong>Listen & approve</strong><p>Replay each passage. Check proposed Arabic corrections, edit the translation, and approve your captions.</p></li><li><strong>Choose a look & export</strong><p>Customize captions, background, and branding. Export your approved clip or subtitle files.</p></li></ol>
      <button className="primary-button" onClick={()=>setDialog(null)}>Close</button>
    </Modal>}
    {(dialog==='new'||dialog==='retranscribe')&&<Modal title={dialog==='new'?'Start a new clip?':'Create a fresh transcript?'} subtitle={dialog==='new'?'Save this project first if you want to return to it.':'The existing captions and translation will be replaced. Your source and visual style stay available.'} onClose={()=>setDialog(null)}>
      <div className="modal-actions"><button className="secondary-button" onClick={()=>void saveProject()}>Save current project</button><button className="primary-button" onClick={()=>{if(dialog==='new'){setDialog(null);void importMedia();}else void transcribe(true);}}>{dialog==='new'?<Upload size={15}/>:<Languages size={15}/>} {dialog==='new'?'Choose new source':'Replace transcript'}</button></div>
    </Modal>}
    {trim&&<Modal title="Change this excerpt?" subtitle="Changing the source passage clears its transcript and translation. You can undo the change." onClose={()=>{setTrim(null);setTrimKey(k=>k+1);}}>
      <p>{formatTime(trim.start)} → {formatTime(trim.end)}</p><div className="modal-actions"><button className="secondary-button" onClick={()=>{setTrim(null);setTrimKey(k=>k+1);}}>Keep current excerpt</button><button className="primary-button" onClick={()=>{edit(v=>({...v,clip:trim,segments:[],request:null}));setTime(0);setTrim(null);}}>Change excerpt</button></div>
    </Modal>}
  </div>;
}

function ModalJob({job,notify}:{job:Progress;notify:(s:string)=>void}){
  return <div className="modal-job" role="status"><LoaderCircle className="job-spinner" size={18}/><div><strong>{job.message}</strong><div className="job-progress"><span style={{width:Math.max(2,job.percent)+'%'}}/></div><small>{Math.round(job.percent)}%</small></div><button className="secondary-button" onClick={()=>void native.cancel(job.jobId).catch(e=>notify(String(e)))}>Cancel</button></div>;
}
