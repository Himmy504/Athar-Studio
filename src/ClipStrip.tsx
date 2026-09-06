import { useEffect, useMemo, useRef, useState } from 'react';
import { Languages, MoreHorizontal, ScanLine, Upload, ZoomIn, ZoomOut } from 'lucide-react';
import { formatTime } from './domain';
import { zoomWindow } from './playback';
import type { Project } from './types';

export function ClipStrip({project:p,busy,onImport,onTrim,onTranscribe,time,onSeek}:{project:Project;busy:boolean;onImport:()=>void;onTrim:(clip:{start:number;end:number})=>void;onTranscribe:()=>void;time:number;onSeek:(time:number)=>void}) {
  const [range,setRange] = useState(p.clip), [zoom,setZoom] = useState(1), [center,setCenter] = useState((p.clip.start+p.clip.end)/2);
  const ref = useRef<HTMLDivElement>(null), drag = useRef<'start'|'end'|null>(null), rangeRef = useRef(range);
  const duration = p.media?.duration ?? 60, view = zoomWindow(duration,zoom,center);
  useEffect(() => { setRange(p.clip); rangeRef.current=p.clip; }, [p.clip]);
  const peaks = useMemo(() => {
    const values=p.media?.waveform ?? Array.from({length:180},()=>.08);
    const first=Math.floor(view.start/duration*values.length), last=Math.ceil(view.end/duration*values.length), count=Math.min(1000,Math.max(1,last-first));
    return Array.from({length:count},(_,i)=>{
      const from=first+Math.floor(i/count*(last-first)),to=Math.max(from+1,first+Math.floor((i+1)/count*(last-first)));
      let peak=0;for(let j=from;j<Math.min(to,values.length);j++)peak=Math.max(peak,values[j]);
      return Math.min(1,Math.max(0,peak));
    });
  }, [p.media?.waveform,duration,view.start,view.end]);
  const percent=(value:number)=>Math.max(0,Math.min(100,(value-view.start)/view.span*100));
  const changeZoom=(factor:number)=>{
    const playhead=p.clip.start+time,anchor=playhead>=view.start&&playhead<=view.end?playhead:(view.start+view.end)/2;
    setCenter(anchor);setZoom(Math.max(1,Math.min(128,zoom*factor)));
  };
  const move=(e:React.PointerEvent<HTMLButtonElement>)=>{
    if(!drag.current||!ref.current)return;
    const rect=ref.current.getBoundingClientRect(),fraction=(e.clientX-rect.left)/rect.width;
    const n=Math.max(0,Math.min(duration,view.start+fraction*view.span));
    const current=rangeRef.current,key=drag.current;
    const next={...current,[key]:key==='start'?Math.max(0,Math.min(n,current.end-.1)):Math.min(duration,Math.max(n,current.start+.1))};
    rangeRef.current=next;setRange(next);
    if(fraction<0||fraction>1)setCenter((view.start+view.end)/2+(fraction<0?-.05:.05)*view.span);
  };
  return <section className="clip-strip">
    <div className="clip-source"><div className="source-icon"><Languages size={21}/></div><div><strong>{p.media?.name??'No source'}</strong><span>{p.media?formatTime(duration)+' · '+(p.media.hasVideo?'VIDEO':'AUDIO'):'MP3, WAV, M4A, MP4, MOV, MKV'}</span></div><button className="icon-button" aria-label="Import media" disabled={busy} onClick={onImport}>{p.media?<MoreHorizontal size={19}/>:<Upload size={19}/>}</button></div>
    <div className="waveform-section">
      <div className="waveform-label"><span>Excerpt</span><div className="waveform-tools">
        <button className="icon-button" aria-label="Zoom waveform out" title="Zoom out" disabled={!p.media||zoom<=1} onClick={()=>changeZoom(.5)}><ZoomOut size={14}/></button>
        <span className="zoom-value" aria-live="polite">{+(duration/view.span).toFixed(1)}×</span>
        <button className="icon-button" aria-label="Zoom waveform in" title="Zoom in" disabled={!p.media||zoom>=128||view.span<=1} onClick={()=>changeZoom(2)}><ZoomIn size={14}/></button>
        <button className="icon-button" aria-label="Fit waveform to excerpt" title="Fit excerpt" disabled={!p.media} onClick={()=>{setCenter((range.start+range.end)/2);setZoom(Math.max(1,Math.min(128,duration/Math.max(1,(range.end-range.start)*1.15))));}}><ScanLine size={14}/></button>
        <button className="text-button" aria-label="Show entire waveform" disabled={!p.media||zoom===1} onClick={()=>{setZoom(1);setCenter(duration/2);}}>All</button>
      </div><span>{formatTime(range.end-range.start)} selected</span></div>
      <div className="waveform" ref={ref} data-view-start={view.start} data-view-end={view.end} onPointerDown={e=>{
        if(!p.media||busy||(e.target as HTMLElement).closest('button'))return;
        const rect=e.currentTarget.getBoundingClientRect();onSeek(Math.max(0,Math.min(p.clip.end-p.clip.start,view.start+(e.clientX-rect.left)/rect.width*view.span-p.clip.start)));
      }}>
        <svg viewBox="0 0 1080 46" preserveAspectRatio="none" aria-label={p.media?'Audio waveform':'Import media to see its waveform'}>{peaks.map((n,i)=><rect key={i} x={i/peaks.length*1080} y={23-n*21} width={Math.max(.6,1080/peaks.length-1)} height={Math.max(2,n*42)}/>)}</svg>
        <div className="trim-region" style={{left:percent(range.start)+'%',right:(100-percent(range.end))+'%'}}/>
        {p.media&&(['start','end'] as const).map(key=>(range[key]>=view.start&&range[key]<=view.end||drag.current===key)&&<button key={key} aria-label={'Drag excerpt '+key} className={'trim-handle '+key} style={{left:percent(range[key])+'%'}} disabled={busy}
          onPointerDown={e=>{if(busy)return;e.currentTarget.setPointerCapture(e.pointerId);drag.current=key;}}
          onPointerMove={move} onPointerUp={()=>{if(drag.current){drag.current=null;onTrim(rangeRef.current);}}}
          onPointerCancel={()=>{drag.current=null;setRange(p.clip);rangeRef.current=p.clip;}}
          onKeyDown={e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){
            e.preventDefault();e.stopPropagation();const n=range[key]+(e.key==='ArrowLeft'?-1:1)*(e.shiftKey?1:.1);
            const next={...range,[key]:key==='start'?Math.max(0,Math.min(n,range.end-.1)):Math.min(duration,Math.max(n,range.start+.1))};
            setRange(next);rangeRef.current=next;onTrim(next);
          }}}><span/></button>)}
        {p.media&&p.clip.start+time>=view.start&&p.clip.start+time<=view.end&&<div className="waveform-playhead" style={{left:percent(p.clip.start+time)+'%'}}/>}
      </div>
      <div className="waveform-navigation"><span>{formatTime(view.start)}</span><input aria-label="Waveform scroll position" type="range" min="0" max={Math.max(0,duration-view.span)} step=".01" value={view.start} disabled={!p.media||zoom<=1} onChange={e=>setCenter(+e.target.value+view.span/2)}/><span>{formatTime(view.end)}</span></div>
      <div className="trim-fields"><label>In <input aria-label="Excerpt start seconds" type="number" value={+range.start.toFixed(2)} step=".1" min="0" max={duration} disabled={!p.media||busy} onChange={e=>setRange(v=>({...v,start:+e.target.value}))} onBlur={()=>onTrim(range)}/></label><span>{p.media?formatTime(duration)+' total':''}</span><label>Out <input aria-label="Excerpt end seconds" type="number" value={+range.end.toFixed(2)} step=".1" min="0" max={duration} disabled={!p.media||busy} onChange={e=>setRange(v=>({...v,end:+e.target.value}))} onBlur={()=>onTrim(range)}/></label></div>
    </div>
    <button className={p.media?'transcribe-button':'primary-button import-first'} onClick={p.media?onTranscribe:onImport} disabled={busy}>{p.media?<Languages size={16}/>:<Upload size={16}/>}<span>{p.media?'Transcribe Arabic':'Import media'}</span></button>
  </section>;
}
