import { Field, NumberInput, Toggle } from './components';
import { canvasSettings, snapPosition } from './inspectorModel';
import { fitCaptionsSafely } from './captionLayout';
import { captionWarnings } from './subtitles';
import type { CanvasSettings, Project, Style } from './types';

export function Numeric({label,value,min,max,suffix='',onChange}:{label:string;value:number;min:number;max:number;suffix?:string;onChange:(n:number)=>void}) {
  return <div className="precision-field"><span>{label}{suffix&&<small> {suffix}</small>}</span><NumberInput label={label} value={value} min={min} max={max} onChange={onChange}/></div>;
}
export function CanvasPanel({project:p,update,notify}:{project:Project;update:(fn:(p:Project)=>Project,key?:string)=>void;notify:(s:string)=>void}) {
  const c=canvasSettings(p.style);
  const change=(patch:Partial<CanvasSettings>)=>update(v=>({...v,style:{...v.style,canvas:{...canvasSettings(v.style),...patch},name:'Custom'}}),'canvas');
  const position=(axis:'x'|'y',value:number)=>update(v=>({...v,style:{...v.style,canvas:{...canvasSettings(v.style)},[axis==='x'?'captionX':'captionY']:snapPosition(value,v.style,axis),name:'Custom'}}),'position-'+axis);
  const warnings=captionWarnings(p).filter(w=>w.includes('safe area'));
  return <>
    <Field label="Aspect ratio"><select value={p.style.ratio} onChange={e=>update(v=>({...v,style:{...v.style,ratio:e.target.value as Style['ratio']}}))}><option value="9:16">Vertical · 9:16</option><option value="1:1">Square · 1:1</option><option value="16:9">Landscape · 16:9</option></select></Field>
    <div className="section-caption">Preview guides</div><p className="field-hint">Guides stay in the editor and are never exported.</p>
    {([['safe','Safe area'],['titleSafe','Title safe · 10%'],['logoSafe','Logo safe · 5%'],['grid','Thirds grid'],['center','Center guides'],['snap','Snap to guides']] as const).map(([key,label])=><Toggle key={key} label={label} checked={c[key]} onChange={v=>change({[key]:v})}/>)}
    <div className="divider"/><div className="section-caption">Caption bounds</div>
    <Numeric label="Caption maximum width" suffix="%" value={c.maxWidth} min={20} max={100} onChange={maxWidth=>change({maxWidth})}/>
    <Numeric label="Horizontal margin" suffix="% each side" value={c.marginX} min={0} max={35} onChange={marginX=>change({marginX})}/>
    <Numeric label="Vertical margin" suffix="% each side" value={c.marginY} min={0} max={35} onChange={marginY=>change({marginY})}/>
    <Numeric label="Horizontal position" suffix="%" value={p.style.captionX??50} min={0} max={100} onChange={n=>position('x',n)}/>
    <Numeric label="Vertical position" suffix="%" value={p.style.captionY} min={15} max={88} onChange={n=>position('y',n)}/>
    <p className="field-hint">Position is the caption block’s center. Bounds keep the block inside your margins. Arrow keys on the preview handle move it precisely.</p>
    <button className="secondary-button full-width" disabled={!p.segments.length} onClick={()=>{let remaining=0;update(v=>{const result=fitCaptionsSafely(v);remaining=result.remaining;return result.project;});notify(remaining?`${remaining} captions still need splitting at the minimum font size.`:'All captions fitted inside the safe area.');}}>Fit caption safely</button>
    {warnings.length>0&&<p className="inline-warning">{warnings.length} captions exceed the safe area. Fit safely or split long captions.</p>}
  </>;
}
