import { useEffect, useRef, useState, type RefObject } from 'react';
import { Maximize2, Pause, Play, RotateCcw, Upload, Volume2, VolumeX } from 'lucide-react';
import { mediaUrl } from './bridge';
import { generateAss, dimensions } from './subtitles';
import { formatTime } from './domain';
import type { Project } from './types';

interface Octopus { setTrack: (ass: string) => void; setCurrentTime: (time: number) => void; dispose: () => void }
declare global { interface Window { SubtitlesOctopus: new (options: Record<string, unknown>) => Octopus } }
const fontNames = ['inter-latin-400-normal.ttf', 'inter-latin-700-normal.ttf', 'noto-naskh-arabic-arabic-400-normal.ttf', 'noto-naskh-arabic-arabic-700-normal.ttf', 'noto-naskh-arabic-latin-400-normal.ttf', 'noto-naskh-arabic-latin-700-normal.ttf'];
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
export function Preview({ project: p, player, time, setTime, onPlaybackError, onImport, busy }: {
  project: Project; player: RefObject<HTMLVideoElement | null>; time: number; setTime: (n: number) => void; onPlaybackError: (s: string) => void;
  onImport:()=>void; busy:boolean;
}) {
  const [playing, setPlaying] = useState(false), [muted, setMuted] = useState(false), [error, setError] = useState('');
  const canvas = useRef<HTMLCanvasElement>(null), engine = useRef<Octopus | null>(null), bgVideo = useRef<HTMLVideoElement>(null);
  const container = useRef<HTMLDivElement>(null), [w,h] = dimensions(p.style.ratio);
  const ass = generateAss(p), assRef = useRef(ass); assRef.current = ass;
  const timeRef = useRef(time); timeRef.current = time;
  const duration = p.clip.end - p.clip.start;
  useEffect(() => {
    let disposed = false;
    const timer = setTimeout(() => {
      void loadEngine().then(() => {
        if (disposed || !canvas.current) return;
        engine.current = new window.SubtitlesOctopus({
          canvas: canvas.current, subContent: assRef.current,
          fonts: fontNames.map(n => '/fonts/' + n), workerUrl: '/libass/subtitles-octopus-worker.js',
          legacyWorkerUrl: '/libass/subtitles-octopus-worker-legacy.js',
          fallbackFont: '/fonts/noto-naskh-arabic-arabic-400-normal.ttf',
          targetFps: 30, libassMemoryLimit: 32, libassGlyphLimit: 8,
          onReady: () => { engine.current?.setCurrentTime(timeRef.current); setError(''); },
          onError: () => setError('Caption preview could not render. Reopen the project to retry.'),
        });
      }).catch(e => setError(String(e)));
    }, 60);
    return () => { disposed = true; clearTimeout(timer); engine.current?.dispose(); engine.current = null; };
  }, [p.style.ratio]);
  useEffect(() => {
    const timer = setTimeout(() => { engine.current?.setTrack(ass); engine.current?.setCurrentTime(timeRef.current); }, 120);
    return () => clearTimeout(timer);
  }, [ass]);
  useEffect(() => { engine.current?.setCurrentTime(time); }, [time]);
  useEffect(() => {
    let frame = 0;
    const loop = () => {
      const v = player.current;
      if (v && !v.paused) {
        const relative = Math.max(0, v.currentTime - p.clip.start);
        engine.current?.setCurrentTime(relative);
        if (v.currentTime >= p.clip.end) { v.pause(); v.currentTime = p.clip.end; }
        setTime(Math.min(relative, Math.max(0,duration)));
      }
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop); return () => cancelAnimationFrame(frame);
  }, [p.clip.start, p.clip.end, player, setTime, duration]);
  useEffect(() => {
    const v=bgVideo.current;
    if (!v) return;
    if (v.duration && Math.abs(v.currentTime - time % v.duration) > .3) v.currentTime = time % v.duration;
    if (playing) void v.play().catch(() => {}); else v.pause();
  }, [time, playing]);
  const toggle = async () => {
    const v = player.current; if (!v || !p.media) return;
    if (v.paused) {
      if (v.currentTime < p.clip.start || v.currentTime >= p.clip.end) v.currentTime = p.clip.start;
      try { await v.play(); } catch { onPlaybackError('Source playback failed. Relink the source or reopen it in the desktop app.'); }
    } else v.pause();
  };
  const seek = (relative: number) => { if (player.current) player.current.currentTime = p.clip.start + relative; setTime(relative); };
  const bg=p.style.background, original=bg.kind==='original' && p.media?.hasVideo;
  const fit=bg.fit==='cover'?'cover':'contain';
  const visualStyle={ objectFit: fit as 'cover'|'contain', filter: bg.blur ? 'blur(' + (bg.blur/w*100) + 'cqw)' : undefined };
  return <section className="preview-panel">
    <div className="panel-heading"><span>Preview</span><span className="muted">{p.style.ratio} · 1080p</span></div>
    <div className="canvas-area">
      <div className="video-canvas" ref={container} style={{aspectRatio: w + '/' + h, width:'min(100cqw, calc(100cqh * '+w/h+'))', background: !p.media?'#111214':bg.kind==='gradient' ? 'linear-gradient(180deg,'+bg.color+','+bg.color2+')' : bg.kind==='solid' ? bg.color : '#000000'}}>
        <video ref={player} src={p.media ? mediaUrl(p.media.previewPath || p.media.path) : undefined}
          className={'source-player ' + (original ? '' : 'audio-source')} style={visualStyle} muted={muted}
          onLoadedMetadata={() => { if(player.current) player.current.currentTime=p.clip.start; }}
          onPlay={()=>setPlaying(true)} onPause={()=>setPlaying(false)} onEnded={()=>setPlaying(false)}
          onSeeked={()=>{if(player.current)setTime(Math.max(0,player.current.currentTime-p.clip.start));}} playsInline />
        {bg.kind==='image' && bg.path && <img className="canvas-background" src={mediaUrl(bg.path)} style={visualStyle} alt="Selected background" />}
        {bg.kind==='video' && bg.path && <video ref={bgVideo} className="canvas-background" src={mediaUrl(bg.path)} style={visualStyle} muted loop playsInline />}
        <div className="canvas-dim" style={{opacity:bg.dim/100}} />
        {p.style.logoPath && <div className="canvas-logo" style={{top:60/h*100+'%',right:60/w*100+'%',width:100/w*100+'%',height:100/h*100+'%'}}><img src={mediaUrl(p.style.logoPath)} alt="Channel logo" style={{maxWidth:'100%',maxHeight:'100%',objectFit:'contain'}}/></div>}
        <canvas ref={canvas} className="subtitle-canvas" width={w} height={h} />
      </div>
      {!p.media&&<div className="preview-empty"><span>No media</span><button className="secondary-button" onClick={onImport} disabled={busy}><Upload size={15}/>Import media</button></div>}
    </div>
    {error && <p className="inline-error">{error}</p>}
    <div className="player-controls">
      <button className="icon-button" aria-label="Return to start" onClick={()=>seek(0)} disabled={!p.media}><RotateCcw size={15}/></button>
      <button className="play-button" aria-label={playing?'Pause':'Play excerpt'} onClick={()=>void toggle()} disabled={!p.media}>{playing?<Pause size={18} fill="currentColor"/>:<Play size={18} fill="currentColor"/>}</button>
      <span className="timecode">{formatTime(time)} <span>/ {formatTime(duration)}</span></span>
      <button className="icon-button" aria-label={muted?'Unmute':'Mute'} onClick={()=>setMuted(!muted)}>{muted?<VolumeX size={17}/>:<Volume2 size={17}/>}</button>
      <button className="icon-button" aria-label="Fullscreen preview" onClick={()=>void container.current?.requestFullscreen()}><Maximize2 size={16}/></button>
    </div>
    <input className="playhead" aria-label="Preview position" type="range" min="0" max={Math.max(0.01,duration)} step=".01" value={Math.min(time,Math.max(0,duration))} onChange={e=>seek(+e.target.value)} disabled={!p.media}/>
  </section>;
}
