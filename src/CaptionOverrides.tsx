import { useState } from 'react';
import { Field, Toggle } from './components';
import { Numeric } from './CanvasPanel';
import { applyOverrides, effectiveStyle } from './inspectorModel';
import { createPanel, PANEL_PRESETS } from './panelPresets';
import type { CaptionOverrides as Overrides, Project, Segment, Animation } from './types';

export function CaptionOverrides({project:p,selectedId,selectedIds,update,notify}:{project:Project;selectedId:string|null;selectedIds:string[];update:(fn:(p:Project)=>Project)=>void;notify:(s:string)=>void}) {
  const segment=p.segments.find(s=>s.id===selectedId);
  return <details className="advanced override-editor"><summary>Selected caption overrides {segment?.overrides?'· Custom':''}</summary>{segment?<OverrideForm key={segment.id} p={p} segment={segment} selectedIds={selectedIds} update={update} notify={notify}/>:<p className="field-hint">Select a caption in the review list to create an exception to the global style.</p>}</details>;
}
function OverrideForm({p,segment,selectedIds,update,notify}:{p:Project;segment:Segment;selectedIds:string[];update:(fn:(p:Project)=>Project)=>void;notify:(s:string)=>void}){
  const [patch,setPatch]=useState<Overrides>({}),[word,setWord]=useState(''),[color,setColor]=useState('#E6C480'),[bold,setBold]=useState(true);
  const s=effectiveStyle(p.style,{...segment,overrides:{...segment.overrides,...patch}});
  const apply=(ids:string[])=>{if(!ids.length)return;const emphasis=word.trim()?[{text:word.trim(),color,bold}]:undefined;
    update(v=>{const result=applyOverrides(v,ids,patch);if(emphasis)result.segments=result.segments.map(seg=>ids.includes(seg.id)&&(seg.arabic.includes(word.trim())||seg.english.includes(word.trim()))?{...seg,emphasis:[...seg.emphasis.filter(e=>e.text!==word.trim()),...emphasis]}:seg);return result;});setPatch({});setWord('');notify(`Style applied to ${ids.length} caption${ids.length===1?'':'s'}.`);};
  const dirty=Object.keys(patch).length>0||!!word.trim();
  return <><p className="field-hint">Caption {p.segments.indexOf(segment)+1}. Only the controls you change are overridden; everything else follows the global style.</p>
    <Numeric label="Override horizontal position" value={s.captionX??50} min={0} max={100} onChange={captionX=>setPatch({...patch,captionX})}/>
    <Numeric label="Override vertical position" value={s.captionY} min={15} max={88} onChange={captionY=>setPatch({...patch,captionY})}/>
    <Numeric label="Override Arabic size" value={s.arabic.size} min={18} max={300} onChange={arabicSize=>setPatch({...patch,arabicSize})}/>
    <Numeric label="Override translation size" value={s.english.size} min={18} max={300} onChange={englishSize=>setPatch({...patch,englishSize})}/>
    <Field label="Override panel"><select value={s.panel.preset} onChange={e=>setPatch({...patch,panel:createPanel(e.target.value as typeof s.panel.preset)})}>{Object.entries(PANEL_PRESETS).map(([id,v])=><option value={id} key={id}>{v.label}</option>)}</select></Field>
    <Field label="Override alignment"><select value={s.alignment} onChange={e=>setPatch({...patch,alignment:e.target.value as typeof s.alignment})}>{['left','center','right'].map(a=><option key={a}>{a}</option>)}</select></Field>
    <Field label="Override animation"><select value={s.animation??(s.fade?'fade':'none')} onChange={e=>setPatch({...patch,animation:e.target.value as Animation})}>{['none','fade','slide','pop'].map(a=><option key={a}>{a}</option>)}</select></Field>
    <Field label="Emphasize exact word or phrase"><input value={word} onChange={e=>setWord(e.target.value)}/></Field><Field label="Override emphasis color"><input type="color" value={color} onChange={e=>setColor(e.target.value)}/></Field><Toggle label="Bold emphasis" checked={bold} onChange={setBold}/>
    <p className="field-hint">Emphasis is added only to captions containing that exact phrase.</p>
    <div className="override-actions"><button className="secondary-button" disabled={!dirty} onClick={()=>apply([segment.id])}>Apply to this caption</button><button className="secondary-button" disabled={!dirty||!selectedIds.length} onClick={()=>apply(selectedIds)}>Apply to selected captions ({selectedIds.length})</button>
    <button className="text-button" onClick={()=>{update(v=>({...v,segments:v.segments.map(s=>s.id===segment.id?{...s,overrides:undefined,emphasis:[]}:s)}));setPatch({});setWord('');}}>Reset to global style</button>
    {selectedIds.length>0&&<button className="text-button" onClick={()=>{update(v=>({...v,segments:v.segments.map(s=>selectedIds.includes(s.id)?{...s,overrides:undefined,emphasis:[]}:s)}));setPatch({});}}>Reset selected to global style</button>}</div>
  </>;
}
