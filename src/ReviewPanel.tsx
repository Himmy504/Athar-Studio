import { useEffect, useState } from 'react';
import { AlertCircle, Check, CheckCheck, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Copy, ExternalLink, FileInput, Languages, Merge, Play, Plus, Scissors, Trash2 } from 'lucide-react';
import { approve, arabicDifference, editSegment, formatTime, isApproved, isCorrected, mergeSegment, needsResolution, newSegment, resolveCorrection, splitSegment } from './domain';
import { Field, Modal } from './components';
import type { Project, Segment } from './types';

export function ReviewPanel({project:p,update,selectedId,onSelect,onPlay,onNavigate,onPrompt,onPaste,onGemini,onTranscribe,busy,notify}:{
  project:Project; update:(fn:(p:Project)=>Project,key?:string)=>void;selectedId:string|null;onSelect:(id:string)=>void;onPlay:(id:string)=>void;onNavigate:(delta:number)=>void;onPrompt:()=>void;onPaste:()=>void;onGemini:()=>void;onTranscribe:()=>void;busy:boolean;notify:(s:string)=>void;
}){
  const [filter,setFilter]=useState<'all'|'review'|'approved'>('all'),[expanded,setExpanded]=useState<string|null>(null),[split,setSplit]=useState<Segment|null>(null);
  const approved=p.segments.filter(isApproved).length, flagged=p.segments.filter(needsResolution).length;
  const modify=(id:string,fn:(s:Segment)=>Segment,key='')=>update(v=>({...v,segments:v.segments.map(s=>s.id===id?fn(s):s)}),key);
  const act=(fn:()=>void)=>{try{fn();}catch(e){notify(e instanceof Error?e.message:String(e));}};
  const add=()=>{
    const duration=p.clip.end-p.clip.start, start=p.segments.at(-1)?.end??0;
    if(duration<=start){notify('No space remains after the last caption. Split an existing caption or adjust its timing.');return;}
    const segment=newSegment(start,Math.min(duration,start+5));
    update(v=>({...v,segments:[...v.segments,segment],request:null}));setExpanded(segment.id);
  };
  const filtered=p.segments.filter(s=>filter==='all'||(filter==='approved'?isApproved(s):!isApproved(s)));
  useEffect(()=>{
    if(!selectedId)return;
    if(!filtered.some(s=>s.id===selectedId)){setFilter('all');return;}
    document.querySelector('[data-caption-id="'+CSS.escape(selectedId)+'"]')?.scrollIntoView({block:'nearest'});
  },[selectedId,filter]);
  return <section className="review-panel">
    <div className="review-heading"><h2>Captions</h2><div className="review-navigation">{p.segments.length>0&&<span className="review-count">{approved}/{p.segments.length} approved{flagged>0&&<span className="flag-count"> · {flagged} flagged</span>}</span>}<button className="icon-button" aria-label="Previous caption" title="Previous caption (↑)" disabled={busy||!p.segments.length||selectedId===p.segments[0]?.id} onClick={()=>onNavigate(-1)}><ChevronLeft size={15}/></button><button className="icon-button" aria-label="Next caption" title="Next caption (↓)" disabled={busy||!p.segments.length||selectedId===p.segments.at(-1)?.id} onClick={()=>onNavigate(1)}><ChevronRight size={15}/></button></div></div>
    <div className="translation-actions">
      <button onClick={onPrompt} disabled={busy||!p.segments.length}><Copy size={15}/><span>Copy prompt</span></button>
      <button onClick={onGemini}><ExternalLink size={15}/><span>Open Gemini</span></button>
      <button className="paste-action" onClick={onPaste} disabled={busy||!p.request}><FileInput size={15}/><span>Paste response</span></button>
    </div>
    <div className="caption-toolbar"><div className="caption-tabs">{(['all','review','approved'] as const).map(f=><button key={f} className={filter===f?'active':''} onClick={()=>setFilter(f)}>{f==='all'?'All captions':f==='review'?'Needs review':'Approved'}</button>)}</div><button className="icon-button" aria-label="Add caption manually" title="Add caption manually" onClick={add} disabled={busy||!p.media}><Plus size={17}/></button></div>
    <div className="caption-list">
      {!p.segments.length?<div className="empty-captions"><h3>No transcript</h3><p>{p.media?'Transcribe the selected excerpt or add captions manually.':'Import media to start transcribing.'}</p>{p.media&&<><button className="secondary-button" onClick={onTranscribe} disabled={busy}><Languages size={15}/>Transcribe Arabic</button><button className="text-button" disabled={busy} onClick={add}>Add captions manually</button></>}</div>:
      filtered.length===0?<div className="empty-filter"><CheckCheck size={30}/><p>{filter==='review'?'All captions approved.':'No matching captions.'}</p></div>:
      filtered.map(s=>{
        const i=p.segments.findIndex(v=>v.id===s.id),open=expanded===s.id,checked=isApproved(s);
        return <article key={s.id} data-caption-id={s.id} aria-current={selectedId===s.id?'true':undefined} onFocusCapture={()=>onSelect(s.id)} onClick={()=>onSelect(s.id)} className={'caption-card '+(open?'expanded ':'')+(selectedId===s.id?'selected ':'')+(checked?'approved':'')}>
          <div className="caption-top"><button className="caption-time" onClick={()=>onPlay(s.id)} aria-label={'Play caption '+(i+1)}><Play size={11}/><span>{String(i+1).padStart(2,'0')}</span><b>{formatTime(s.start)} – {formatTime(s.end)}</b></button>
            <div className="caption-badges">{isCorrected(s)&&<span className={'correction-badge '+(s.correctionResolved?'resolved':'')}>AI-corrected Arabic</span>}
            <button className="icon-button" aria-label={(open?'Collapse':'Expand')+' caption '+(i+1)} onClick={()=>setExpanded(open?null:s.id)}>{open?<ChevronUp size={15}/>:<ChevronDown size={15}/>}</button></div>
          </div>
          {open&&<div className="original-text"><span>Original transcript</span><p className="arabic" dir="rtl">{s.originalArabic||'No original text — manually added caption'}</p>{s.inputArabic&&s.inputArabic!==s.originalArabic&&<><span>Submitted Arabic</span><p className="arabic" dir="rtl">{s.inputArabic}</p></>}</div>}
          {isCorrected(s)&&(open||!s.correctionResolved)&&<ArabicComparison segment={s}/>}
          <label className="caption-language-label"><span>Arabic</span><textarea aria-label={'Arabic caption '+(i+1)} className="arabic arabic-input" dir="rtl" rows={Math.min(5,Math.max(1,s.arabic.split('\n').length))} value={s.arabic} placeholder="النص العربي…" onFocus={()=>setExpanded(s.id)} disabled={busy} onChange={e=>modify(s.id,v=>editSegment(v,{arabic:e.target.value}),'arabic-'+s.id)}/></label>
          <label className="caption-language-label"><span>English</span><textarea aria-label={'English caption '+(i+1)} className="english-input" rows={Math.min(5,Math.max(1,s.english.split('\n').length))} value={s.english} placeholder="English translation" disabled={busy} onChange={e=>modify(s.id,v=>editSegment(v,{english:e.target.value}),'english-'+s.id)}/></label>
          {!s.correctionResolved&&<div className="correction-box"><div><AlertCircle size={15}/><strong>Check this correction against the audio</strong></div><p>{s.correctionNote||'Gemini proposed a change to the Arabic.'}</p><div className="button-row"><button disabled={busy} onClick={()=>modify(s.id,v=>resolveCorrection(v,true))}><Check size={13}/>Accept correction</button><button disabled={busy} onClick={()=>modify(s.id,v=>resolveCorrection(v,false))}>Keep submitted Arabic</button>{s.arabic!==s.proposedArabic&&<button disabled={busy} onClick={()=>modify(s.id,v=>({...v,correctionResolved:true,approval:null}))}>Use my edit</button>}</div></div>}
          {s.uncertain&&!s.uncertaintyResolved&&<div className="uncertainty-box"><p><AlertCircle size={14}/> Gemini marked this passage as uncertain.</p><button disabled={busy} onClick={()=>modify(s.id,v=>({...v,uncertaintyResolved:true,approval:null}))}>I checked this passage against the audio</button></div>}
          {open&&<>
            {s.correctionResolved&&s.correctionNote&&<p className="correction-history">{s.correctionNote}</p>}
            <div className="caption-timing"><Field label="Start (seconds)"><input aria-label={'Start caption '+(i+1)} type="number" step=".1" min="0" max={p.clip.end-p.clip.start} value={s.start} disabled={busy} onChange={e=>modify(s.id,v=>editSegment(v,{start:+e.target.value}),'timing-'+s.id)}/></Field><Field label="End (seconds)"><input aria-label={'End caption '+(i+1)} type="number" step=".1" min="0" max={p.clip.end-p.clip.start} value={s.end} disabled={busy} onChange={e=>modify(s.id,v=>editSegment(v,{end:+e.target.value}),'timing-'+s.id)}/></Field></div>
            <EmphasisEditor segment={s} onChange={emphasis=>modify(s.id,v=>({...v,emphasis}))}/>
            <div className="caption-edit-actions"><button disabled={busy} onClick={()=>setSplit(s)}><Scissors size={13}/>Split</button><button disabled={busy||i===p.segments.length-1} onClick={()=>act(()=>update(v=>mergeSegment(v,s.id)))}><Merge size={13}/>Merge next</button><button className="danger-text" disabled={busy} onClick={()=>update(v=>({...v,segments:v.segments.filter(c=>c.id!==s.id),request:null}))}><Trash2 size={13}/>Remove</button></div>
          </>}
          <div className="caption-footer"><span>{open&&s.english ? Math.round(s.english.length/Math.max(.1,s.end-s.start))+' chars/s' : ''}</span><button className={'approve-button '+(checked?'is-approved':'')} disabled={busy||checked||needsResolution(s)||!s.arabic.trim()||!s.english.trim()} onClick={()=>act(()=>modify(s.id,approve))}><Check size={14}/>{checked?'Approved':'Approve caption'}</button></div>
        </article>;
      })}
    </div>
    {split&&<SplitDialog segment={split} onClose={()=>setSplit(null)} onSplit={(at,a,e)=>{act(()=>{update(v=>splitSegment(v,split.id,at,a,e));setSplit(null);});}}/>}
  </section>;
}
function EmphasisEditor({segment:s,onChange}:{segment:Segment;onChange:(e:Segment['emphasis'])=>void}){
  const [text,setText]=useState(''),[color,setColor]=useState('#E6C480');
  return <details className="emphasis-editor"><summary>Highlight words</summary><div className="emphasis-add"><input aria-label="Words to emphasize" value={text} onChange={e=>setText(e.target.value)} placeholder="Exact word or phrase…"/><input aria-label="Emphasis color" type="color" value={color} onChange={e=>setColor(e.target.value)}/><button className="icon-button" aria-label="Add emphasis" disabled={!text.trim()||(!s.arabic.includes(text)&&!s.english.includes(text))} onClick={()=>{onChange([...s.emphasis,{text,color,bold:true}]);setText('');}}><Plus size={15}/></button></div><div className="emphasis-tags">{s.emphasis.map((e,i)=><button key={i} style={{color:e.color}} onClick={()=>onChange(s.emphasis.filter((_,j)=>j!==i))}>{e.text} ×</button>)}</div></details>;
}
function ArabicComparison({segment:s}:{segment:Segment}){
  const diff=arabicDifference(s.inputArabic??s.originalArabic,s.proposedArabic??s.arabic);
  return <div className="arabic-comparison"><span>Submitted Arabic</span><p className="arabic" dir="rtl">{diff.prefix}<del>{diff.removed}</del>{diff.suffix}</p><span>Gemini Arabic</span><p className="arabic" dir="rtl">{diff.prefix}<ins>{diff.added}</ins>{diff.suffix}</p></div>;
}
function SplitDialog({segment:s,onClose,onSplit}:{segment:Segment;onClose:()=>void;onSplit:(at:number,a:number,e:number)=>void}){
  const [at,setAt]=useState(+((s.start+s.end)/2).toFixed(2)),[a,setA]=useState(0),[e,setE]=useState(0);
  return <Modal title="Split this caption" subtitle="Click at the split point in each language, then set the matching time." onClose={onClose}>
    <Field label="Split at (seconds)"><input type="number" step=".01" min={s.start} max={s.end} value={at} onChange={v=>setAt(+v.target.value)}/></Field>
    <Field label="Arabic text split"><textarea className="arabic" dir="rtl" readOnly value={s.arabic} onSelect={v=>setA(v.currentTarget.selectionStart)}/></Field><p className="split-preview arabic" dir="rtl">{s.arabic.slice(0,a)} <b>│</b> {s.arabic.slice(a)}</p>
    {s.english&&<><Field label="English text split"><textarea readOnly value={s.english} onSelect={v=>setE(v.currentTarget.selectionStart)}/></Field><p className="split-preview">{s.english.slice(0,e)} <b>│</b> {s.english.slice(e)}</p></>}
    <p className="field-hint">Both resulting captions will need approval again. The original transcript is retained for reference.</p>
    <div className="modal-actions"><button className="secondary-button" onClick={onClose}>Cancel</button><button className="primary-button" disabled={a===0||a>=s.arabic.length||(!!s.english&&(e===0||e>=s.english.length))} onClick={()=>onSplit(at,a,e)}><Scissors size={15}/>Split caption</button></div>
  </Modal>;
}
