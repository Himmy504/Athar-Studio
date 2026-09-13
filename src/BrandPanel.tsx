import { useState } from 'react';
import { AlignCenter, AlignLeft, AlignRight, Bold, Italic, Underline } from 'lucide-react';
import { Field, Range, Toggle } from './components';
import { Numeric } from './CanvasPanel';
import { brandSettings } from './inspectorModel';
import { FONT_FAMILIES } from './fonts';
import { chooseAsset } from './bridge';
import { sourceQr } from './brandRender';
import type { Anchor, BrandLabel, BrandPlacement, BrandSettings, Project } from './types';

const anchors:Anchor[]=['top-left','top-center','top-right','middle-left','middle-center','middle-right','bottom-left','bottom-center','bottom-right'];
export function Placement({value,onChange}:{value:BrandPlacement;onChange:(v:Partial<BrandPlacement>)=>void}) {
  return <><div className="anchor-grid" role="group" aria-label="Position">{anchors.map(a=><button key={a} aria-label={a.replaceAll('-',' ')} title={a.replaceAll('-',' ')} aria-pressed={value.anchor===a} onClick={()=>onChange({anchor:a})}><span/></button>)}</div>
    <Numeric label="Edge padding" value={value.padding} min={0} max={400} onChange={padding=>onChange({padding})}/>
    <Field label="Show during"><select value={value.timing} onChange={e=>onChange({timing:e.target.value as BrandPlacement['timing']})}><option value="all">Entire clip</option><option value="intro">Intro only</option><option value="outro">Outro only</option></select></Field>
    {value.timing!=='all'&&<Numeric label="Duration in seconds" value={value.seconds} min={.1} max={600} onChange={seconds=>onChange({seconds})}/>}</>;
}
function LabelControls({value,onChange}:{value:BrandLabel;onChange:(v:Partial<BrandLabel>)=>void}) {
  return <><div className="brand-control-group"><div className="section-caption">Text treatment</div>
    <Field label="Font family"><select value={value.font} onChange={e=>onChange({font:e.target.value})}>{FONT_FAMILIES.map(f=><option key={f}>{f}</option>)}</select></Field>
    <Numeric label="Font size" value={value.size} min={18} max={120} onChange={size=>onChange({size})}/>
    <Field label="Text color"><div className="color-input"><input aria-label="Text color" type="color" value={value.color} onChange={e=>onChange({color:e.target.value})}/><span>{value.color}</span></div></Field>
    <div className="segmented brand-type-buttons" aria-label="Text emphasis">
      <button aria-label="Bold" aria-pressed={value.bold} className={value.bold?'active':''} onClick={()=>onChange({bold:!value.bold})}><Bold size={15}/><span>Bold</span></button>
      <button aria-label="Italic" aria-pressed={value.italic} className={value.italic?'active':''} onClick={()=>onChange({italic:!value.italic})}><Italic size={15}/><span>Italic</span></button>
      <button aria-label="Underline" aria-pressed={value.underline} className={value.underline?'active':''} onClick={()=>onChange({underline:!value.underline})}><Underline size={15}/><span>Line</span></button>
    </div>
    <div className="segmented align-buttons brand-align" aria-label="Text alignment">{(['left','center','right'] as const).map(alignment=><button key={alignment} aria-label={'Align '+alignment} aria-pressed={value.alignment===alignment} className={value.alignment===alignment?'active':''} onClick={()=>onChange({alignment})}>{alignment==='left'?<AlignLeft size={17}/>:alignment==='right'?<AlignRight size={17}/>:<AlignCenter size={17}/>}</button>)}</div>
    <Range label="Letter spacing" value={value.spacing} min={-3} max={20} step={.5} onChange={spacing=>onChange({spacing})}/>
    <Range label="Line height" value={value.lineHeight} min={80} max={240} suffix="%" onChange={lineHeight=>onChange({lineHeight})}/>
    <details className="advanced"><summary>Outline & shadow</summary>
      <Range label="Outline" value={value.outline} min={0} max={16} step={.5} onChange={outline=>onChange({outline})}/>
      <Field label="Outline color"><div className="color-input"><input type="color" value={value.outlineColor} onChange={e=>onChange({outlineColor:e.target.value})}/><span>{value.outlineColor}</span></div></Field>
      <Range label="Shadow" value={value.shadow} min={0} max={20} step={.5} onChange={shadow=>onChange({shadow})}/>
      <Field label="Shadow color"><div className="color-input"><input type="color" value={value.shadowColor} onChange={e=>onChange({shadowColor:e.target.value})}/><span>{value.shadowColor}</span></div></Field>
    </details></div>
    <div className="brand-control-group"><div className="section-caption">Text background</div>
      <div className="segmented brand-bg-presets">{([['None',false,0],['Box',true,0],['Rounded',true,14],['Pill',true,80]] as const).map(([name,enabled,cornerRadius])=><button key={name} className={value.backgroundEnabled===enabled&&(!enabled||value.cornerRadius===cornerRadius)?'active':''} aria-pressed={value.backgroundEnabled===enabled&&(!enabled||value.cornerRadius===cornerRadius)} onClick={()=>onChange({backgroundEnabled:enabled,cornerRadius})}>{name}</button>)}</div>
      {value.backgroundEnabled&&<><div className="field-row"><Field label="Fill color"><div className="color-input"><input type="color" value={value.background} onChange={e=>onChange({background:e.target.value})}/><span>{value.background}</span></div></Field><Field label="Border color"><div className="color-input"><input type="color" value={value.borderColor} onChange={e=>onChange({borderColor:e.target.value})}/><span>{value.borderColor}</span></div></Field></div>
        <Range label="Fill opacity" suffix="%" value={value.backgroundOpacity} min={0} max={100} onChange={backgroundOpacity=>onChange({backgroundOpacity})}/>
        <Range label="Text padding" value={value.textPadding} min={0} max={80} onChange={textPadding=>onChange({textPadding})}/>
        <Range label="Border width" value={value.borderWidth} min={0} max={8} step={.5} onChange={borderWidth=>onChange({borderWidth})}/>
        <Range label="Corner radius" value={value.cornerRadius} min={0} max={80} onChange={cornerRadius=>onChange({cornerRadius})}/></>}
    </div>
    <div className="brand-control-group"><div className="section-caption">Layout & timing</div>
      <Range label="Maximum width" value={value.width} min={20} max={100} suffix="%" onChange={width=>onChange({width})}/>
      <Placement value={value} onChange={onChange}/>
    </div></>;
}
export function BrandPanel({project:p,update,notify,onSaveKit}:{project:Project;update:(fn:(p:Project)=>Project,key?:string)=>void;notify:(s:string)=>void;onSaveKit:(name:string)=>void}) {
  const b=brandSettings(p.style),[active,setActive]=useState<'scholar'|'source'|'channel'|'sourceCard'>('scholar'),[kitName,setKitName]=useState('');
  const change=(patch:Partial<BrandSettings>)=>update(v=>({...v,style:{...v.style,brand:{...brandSettings(v.style),...patch},logoPath:'',name:'Custom'}}),'brand');
  const label=b[active];
  const labels={scholar:'Scholar’s name',source:'Lecture / source label',channel:'Channel name',sourceCard:'Source card'};
  async function pick(id?:string){try{const path=await chooseAsset('image');if(!path)return;update(v=>{const current=brandSettings(v.style);return {...v,style:{...v.style,logoPath:'',brand:{...current,logos:id?current.logos.map(l=>l.id===id?{...l,path}:l):[...current.logos,{id:crypto.randomUUID(),path,anchor:'top-right',padding:60,size:100,opacity:100,watermark:false,timing:'all',seconds:5}]}}};});}catch(e){notify(String(e));}}
  return <><div className="section-caption">Source information</div>
    {([['scholar','Scholar’s name'],['lecture','Lecture title'],['source','Source link'],['channel','Channel name']] as const).map(([key,label])=><Field key={key} label={label}><input value={p.metadata[key]} onChange={e=>update(v=>({...v,metadata:{...v.metadata,[key]:e.target.value}}),'metadata-'+key)}/></Field>)}
    <div className="divider"/><Field label="Customize label"><select value={active} onChange={e=>setActive(e.target.value as typeof active)}>{Object.entries(labels).map(([key,name])=><option value={key} key={key}>{name}</option>)}</select></Field>
    <Toggle label={'Show '+labels[active]} checked={label.enabled} onChange={enabled=>change({[active]:{...label,enabled}})}/>
    {active==='sourceCard'&&<><Toggle label="Include source QR code" checked={b.sourceCard.qr} onChange={qr=>change({sourceCard:{...b.sourceCard,qr}})}/>{b.sourceCard.qr&&!sourceQr(p.metadata.source)&&<p className="inline-warning">Enter an HTTP or HTTPS source link of up to 1,500 characters to generate the QR code.</p>}<p className="field-hint">Uses the scholar, lecture and source link above. QR codes are generated locally.</p></>}
    <LabelControls value={label} onChange={patch=>change({[active]:{...label,...patch}})}/>
    <div className="divider"/><div className="section-caption">Logos & watermarks</div>
    {b.logos.map((logo,i)=><details key={logo.id} className="advanced logo-editor"><summary>Logo {i+1} · {logo.path.split(/[\\/]/).pop()}</summary>
      <button className="text-button" onClick={()=>void pick(logo.id)}>Replace logo</button>
      <Numeric label="Logo size" value={logo.size} min={24} max={500} onChange={size=>change({logos:b.logos.map(l=>l.id===logo.id?{...l,size}:l)})}/>
      <Numeric label="Logo opacity" suffix="%" value={logo.opacity} min={0} max={100} onChange={opacity=>change({logos:b.logos.map(l=>l.id===logo.id?{...l,opacity}:l)})}/>
      <Toggle label="Small watermark" checked={logo.watermark} onChange={watermark=>change({logos:b.logos.map(l=>l.id===logo.id?{...l,watermark}:l)})}/>
      <Placement value={logo} onChange={patch=>change({logos:b.logos.map(l=>l.id===logo.id?{...l,...patch}:l)})}/><button className="text-button danger-text" onClick={()=>change({logos:b.logos.filter(l=>l.id!==logo.id)})}>Remove logo</button>
    </details>)}
    <button className="upload-asset" disabled={b.logos.length>=8} onClick={()=>void pick()}>Add channel logo {b.logos.length}/8</button>
    <div className="brand-kit-save"><Field label="Brand kit name"><input value={kitName} onChange={e=>setKitName(e.target.value)} placeholder="My channel brand"/></Field><button className="secondary-button full-width" disabled={!kitName.trim()} onClick={()=>{onSaveKit(kitName);setKitName('');}}>Save reusable brand kit</button></div>
  </>;
}
