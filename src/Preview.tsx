import { useEffect, useRef, useState, type RefObject } from 'react';
import { Maximize2, Pause, Play, Repeat2, RotateCcw, Upload, Volume2, VolumeX } from 'lucide-react';
import { mediaUrl } from './bridge';
import { dimensions } from './subtitles';
import { fontFiles } from './fonts';
import { PLAYBACK_RATES } from './playback';
import type { ReviewPlayback } from './useReviewPlayback';
import { formatTime } from './domain';
import type { Project } from './types';

interface Octopus { setTrack: (ass: string) => void; setCurrentTime: (time: number) => void; dispose: () => void }
declare global { interface Window { SubtitlesOctopus: new (options: Record<string, unknown>) => Octopus } }
let enginePromise: Promise<void> | null = null;
function loadEngine() {
  if (!enginePromise) enginePromise = new Promise<void>((resolve, reject) => {
    if (window.SubtitlesOctopus) return resolve();
    const script = document.createElement('script'); script.src = '/libass/subtitles-octopus.js';
    script.onload = () => resolve(); script.onerror = () => { enginePromise = null; reject(new Error('Caption preview engine could not load. Run npm run prepare:assets.')); };
    document.head.appendChild(script);
  });
  return enginePromise;
}
export function Preview({project:p,player,time,playback,ass,fontsReady,fontError,onImport,busy}:{
  project:Project;player:RefObject<HTMLVideoElement|null>;time:number;playback:ReviewPlayback;ass:string;fontsReady:boolean;fontError:string;onImport:()=>void;busy:boolean;
}) {
  const [muted,setMuted]=useState(false),[error,setError]=useState('');
  const canvas=useRef<HTMLCanvasElement>(null),engine=useRef<Octopus|null>(null),bgVideo=useRef<HTMLVideoElement>(null),container=useRef<HTMLDivElement>(null);
  const [w,h]=dimensions(p.style.ratio),files=fontFiles(p.style),fontKey=files.join('|');
  const assRef=useRef(ass),timeRef=useRef(time);assRef.current=ass;timeRef.current=time;
  const duration=p.clip.end-p.clip.start;
  useEffect(()=>{
    if(!fontsReady)return;
    let disposed=false;
    void loadEngine().then(()=>{
      if(disposed||!canvas.current)return;
      engine.current=new window.SubtitlesOctopus({canvas:canvas.current,subContent:assRef.current,fonts:files.map(file=>'/fonts/'+file),workerUrl:'/libass/subtitles-octopus-worker.js',legacyWorkerUrl:'/libass/subtitles-octopus-worker-legacy.js',fallbackFont:'/fonts/noto-naskh-arabic-arabic-400-normal.ttf',targetFps:30,libassMemoryLimit:64,libassGlyphLimit:8,
        onReady:()=>{engine.current?.setCurrentTime(timeRef.current);setError('');},onError:()=>setError('Caption preview could not render. Reopen the project to retry.')});
    }).catch(error=>setError(String(error)));
    return()=>{disposed=true;engine.current?.dispose();engine.current=null;};
  },[p.style.ratio,fontKey,fontsReady]);
  useEffect(()=>{const timer=setTimeout(()=>{engine.current?.setTrack(ass);engine.current?.setCurrentTime(timeRef.current);},100);return()=>clearTimeout(timer);},[ass]);
  useEffect(()=>{engine.current?.setCurrentTime(time);},[time]);
  useEffect(()=>{
    const v=bgVideo.current;if(!v)return;
    v.playbackRate=playback.rate;
    if(v.duration&&Math.abs(v.currentTime-time%v.duration)>.15)v.currentTime=time%v.duration;
    if(playback.playing)void v.play().catch(()=>{});else v.pause();
  },[time,playback.playing,playback.rate]);
  const bg=p.style.background,original=bg.kind==='original'&&p.media?.hasVideo;
  const visualStyle={objectFit:(bg.fit==='cover'?'cover':'contain') as 'cover'|'contain',filter:bg.blur?'blur('+(bg.blur/w*100)+'cqw)':undefined};
  return <section className="preview-panel">
    <div className="panel-heading"><span>Preview</span><span className="muted">{p.style.ratio} · 1080p</span></div>
    <div className="canvas-area">
      <div className="video-canvas" ref={container} style={{aspectRatio:w+'/'+h,width:'min(100cqw, calc(100cqh * '+w/h+'))',background:!p.media?'#111214':bg.kind==='gradient'?'linear-gradient(180deg,'+bg.color+','+bg.color2+')':bg.kind==='solid'?bg.color:'#000000'}}>
        <video ref={player} src={p.media?mediaUrl(p.media.previewPath||p.media.path):undefined} className={'source-player '+(original?'':'audio-source')} style={visualStyle} muted={muted}
          onLoadedMetadata={()=>{if(player.current){player.current.currentTime=p.clip.start;player.current.playbackRate=playback.rate;player.current.preservesPitch=true;}}} playsInline/>
        {bg.kind==='image'&&bg.path&&<img className="canvas-background" src={mediaUrl(bg.path)} style={visualStyle} alt="Selected background"/>}
        {bg.kind==='video'&&bg.path&&<video ref={bgVideo} className="canvas-background" src={mediaUrl(bg.path)} style={visualStyle} muted loop playsInline/>}
        <div className="canvas-dim" style={{opacity:bg.dim/100}}/>
        {p.style.logoPath&&<div className="canvas-logo" style={{top:60/h*100+'%',right:60/w*100+'%',width:100/w*100+'%',height:100/h*100+'%'}}><img src={mediaUrl(p.style.logoPath)} alt="Channel logo" style={{maxWidth:'100%',maxHeight:'100%',objectFit:'contain'}}/></div>}
        <canvas ref={canvas} className="subtitle-canvas" width={w} height={h}/>
      </div>
      {!p.media&&<div className="preview-empty"><span>No media</span><button className="secondary-button" onClick={onImport} disabled={busy}><Upload size={15}/>Import media</button></div>}
    </div>
    {(error||fontError)&&<p className="inline-error">{error||fontError}</p>}
    <div className="player-controls">
      <button className="icon-button" aria-label="Replay selected caption" title="Replay (R)" onClick={playback.replay} disabled={!p.media||busy}><RotateCcw size={15}/></button>
      <button className="play-button" aria-label={playback.playing?'Pause':playback.reviewMode?'Play selected caption':'Play excerpt'} title="Play / pause (Space)" onClick={playback.toggle} disabled={!p.media||busy}>{playback.playing?<Pause size={18} fill="currentColor"/>:<Play size={18} fill="currentColor"/>}</button>
      <span className="timecode">{formatTime(time)} <span>/ {formatTime(duration)}</span></span>
      <button className="icon-button" aria-label={muted?'Unmute':'Mute'} onClick={()=>setMuted(!muted)}><>{muted?<VolumeX size={17}/>:<Volume2 size={17}/>}</></button>
      <button className="icon-button" aria-label="Fullscreen preview" onClick={()=>void container.current?.requestFullscreen()}><Maximize2 size={16}/></button>
    </div>
    <div className="review-playback-controls"><label title="Review playback speed; exports retain the original speed.">Speed<select aria-label="Playback speed" value={playback.rate} onChange={e=>playback.changeRate(+e.target.value)}>{PLAYBACK_RATES.map(rate=><option key={rate} value={rate}>{rate}×</option>)}</select></label><button className={'loop-toggle '+(playback.looping?'active':'')} aria-label="Loop selected caption" aria-pressed={playback.looping} title="Loop selected caption (L)" disabled={!p.media||!p.segments.length||busy} onClick={playback.toggleLoop}><Repeat2 size={14}/>Loop caption</button></div>
    <input className="playhead" aria-label="Preview position" type="range" min="0" max={Math.max(.01,duration)} step=".01" value={Math.min(time,Math.max(0,duration))} onChange={e=>playback.seek(+e.target.value)} disabled={!p.media||busy}/>
  </section>;
}
