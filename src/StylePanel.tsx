import { useState } from 'react';
import { AlignCenter, AlignLeft, AlignRight, ChevronDown, ImagePlus, Plus, Video, X } from 'lucide-react';
import { Field, Range, Toggle } from './components';
import { presets, styleSchema } from './domain';
import { chooseAsset } from './bridge';
import type { Project, Style, Typography } from './types';
import { FONT_CATALOG } from './fonts';
import { createPanel, PANEL_PRESETS } from './panelPresets';

export function StylePanel({ project: p, update, notify }: { project: Project; update: (fn:(p:Project)=>Project,key?:string)=>void; notify:(message:string)=>void }) {
  const [tab,setTab]=useState<'captions'|'background'|'brand'>('captions');
  const [language,setLanguage]=useState<'english'|'arabic'>('english');
  const [saved,setSaved]=useState<Style[]>(()=>{
    try {const arr=JSON.parse(localStorage.getItem('athar-presets')||'[]');return Array.isArray(arr)?arr.map(s=>styleSchema.parse(s)):[];}catch{return[];}
  });
  const [presetName,setPresetName]=useState('');
  const s=p.style;
  const change=(patch:Partial<Style>,key='style')=>update(v=>({...v,style:{...v.style,...patch}}),key);
  const typography=s[language];
  const type=(patch:Partial<Typography>)=>change({[language]:{...typography,...patch}},'type-'+language);
  const background=(patch:Partial<Style['background']>)=>change({background:{...s.background,...patch}},'background');
  const pick=async(kind:'image'|'video'|'logo')=>{
    try {const path=await chooseAsset(kind==='video'?'video':'image');if(path)kind==='logo'?change({logoPath:path}):background({kind,path});}catch(e){notify(String(e));}
  };
  const save=()=>{
    if(!presetName.trim())return;
    const next=[...saved.filter(v=>v.name!==presetName.trim()),{...structuredClone(s),name:presetName.trim()}];
    try{localStorage.setItem('athar-presets',JSON.stringify(next));setSaved(next);setPresetName('');notify('Style saved.');}catch{notify('Could not save the preset. Local storage may be full.');}
  };
  return <aside className="style-panel">
    <div className="panel-heading"><span>Inspector</span></div>
    <div className="style-tabs">{(['captions','background','brand'] as const).map(t=><button key={t} className={tab===t?'active':''} onClick={()=>setTab(t)}>{t==='captions'?'Captions':t==='background'?'Background':'Brand'}</button>)}</div>
    <div className="style-scroll">
      {tab==='captions'&&<>
        <Field label="Preset"><select aria-label="Caption preset" value={Object.hasOwn(presets,s.name)?s.name:''} onChange={e=>{const preset=presets[e.target.value];if(preset)change({...structuredClone(preset),ratio:s.ratio,logoPath:s.logoPath},'preset-'+preset.name);}}>
          {!Object.hasOwn(presets,s.name)&&<option value="">Custom</option>}
          {Object.values(presets).map(preset=><option key={preset.name}>{preset.name}</option>)}
        </select></Field>
        <Field label="Display"><select value={s.mode} onChange={e=>change({mode:e.target.value as Style['mode']})}><option value="bilingual">Arabic + English</option><option value="english">English only</option></select></Field>
        <Field label="Caption panel"><select aria-label="Caption panel preset" title="Apply a panel with matching text colors and outlines" value={s.panel.preset} onChange={e=>{
          const preset=e.target.value as Style['panel']['preset'],palette=PANEL_PRESETS[preset];
          const effects=preset==='none'?{}:{outline:preset==='paper'?0:.5,shadow:0};
          change({panel:createPanel(preset),english:{...s.english,...effects,color:palette.ink},arabic:{...s.arabic,...effects,color:palette.arabicInk}},'panel-preset');
        }}>{Object.entries(PANEL_PRESETS).map(([id,preset])=><option key={id} value={id}>{preset.label}</option>)}</select></Field>
        {s.panel.preset!=='none'&&<details className="advanced panel-settings"><summary>Panel settings <ChevronDown size={13}/></summary>
          <div className="field-row"><Field label="Panel fill"><input aria-label="Panel fill color" type="color" value={s.panel.fill} onChange={e=>change({panel:{...s.panel,fill:e.target.value}},'panel-fill')}/></Field><Field label="Border"><input aria-label="Panel border color" type="color" value={s.panel.border} onChange={e=>change({panel:{...s.panel,border:e.target.value}},'panel-border')}/></Field></div>
          <Range label="Panel opacity" value={s.panel.opacity} min={10} max={100} suffix="%" onChange={opacity=>change({panel:{...s.panel,opacity}},'panel-opacity')}/>
          <Range label="Panel width" value={s.panel.width} min={50} max={94} suffix="%" onChange={width=>change({panel:{...s.panel,width}},'panel-width')}/>
          <Range label="Panel padding" value={s.panel.padding} min={12} max={80} onChange={padding=>change({panel:{...s.panel,padding}},'panel-padding')}/>
          <Range label="Border width" value={s.panel.borderWidth} min={0} max={8} step={.5} onChange={borderWidth=>change({panel:{...s.panel,borderWidth}},'panel-border-width')}/>
        </details>}
        <div className="divider"/>
        <div className="section-caption">Typography</div>
        <div className="segmented">{(['english','arabic'] as const).map(l=><button key={l} onClick={()=>setLanguage(l)} className={language===l?'active':''}>{l==='arabic'?'العربية':'English'}</button>)}</div>
        <Field label="Font family"><select aria-label={language+' caption font'} value={typography.font} onChange={e=>type({font:e.target.value})}>
          {!FONT_CATALOG.some(font=>font.language===language&&font.family===typography.font)&&<option>{typography.font}</option>}
          {FONT_CATALOG.filter(font=>font.language===language).map(font=><option key={font.id}>{font.family}</option>)}
        </select></Field>
        <div className="field-row"><Field label="Size"><input type="number" min="18" max="110" value={typography.size} onChange={e=>type({size:Math.min(110,Math.max(18,+e.target.value))})}/></Field>
        <Field label="Text color"><div className="color-input"><input aria-label={language+' text color'} type="color" value={typography.color} onChange={e=>type({color:e.target.value})}/><span>{typography.color}</span></div></Field></div>
        <Toggle label="Bold text" checked={typography.bold} onChange={bold=>type({bold})}/>
        <details className="advanced"><summary>Outline, shadow & spacing <ChevronDown size={13}/></summary><Range label="Outline" min={0} max={8} step={.5} value={typography.outline} onChange={outline=>type({outline})}/><Range label="Shadow" min={0} max={10} value={typography.shadow} onChange={shadow=>type({shadow})}/><Range label="Letter spacing" min={-3} max={12} step={.5} value={typography.spacing} onChange={spacing=>type({spacing})}/></details>
        <div className="divider"/><div className="section-caption">Layout</div>
        <div className="segmented align-buttons">{(['left','center','right'] as const).map(a=><button key={a} aria-label={'Align '+a} className={s.alignment===a?'active':''} onClick={()=>change({alignment:a})}>{a==='left'?<AlignLeft size={17}/>:a==='right'?<AlignRight size={17}/>:<AlignCenter size={17}/>}</button>)}</div>
        <Range label="Caption position" value={s.captionY} min={15} max={88} suffix="%" onChange={captionY=>change({captionY})}/>
        {s.mode==='bilingual'&&<Range label="Space between languages" value={s.lineGap} min={0} max={60} onChange={lineGap=>change({lineGap})}/>}
        <Toggle label="Phrase fade" checked={s.fade} onChange={fade=>change({fade})}/>
      </>}
      {tab==='background'&&<>
        <Field label="Type"><select aria-label="Background type" value={s.background.kind} onChange={e=>background({kind:e.target.value as Style['background']['kind']})}>
          <option value="original">Source footage</option><option value="solid">Solid color</option><option value="gradient">Gradient</option><option value="image">Image</option><option value="video">Video</option>
        </select></Field>
        {s.background.kind==='original'&&!p.media?.hasVideo&&<p className="inline-warning">Import video footage, or choose another background for an audio-only clip.</p>}
        {(s.background.kind==='solid'||s.background.kind==='gradient')&&<div className="field-row"><Field label="Color"><input type="color" value={s.background.color} onChange={e=>background({color:e.target.value})}/></Field>{s.background.kind==='gradient'&&<Field label="Second color"><input type="color" value={s.background.color2} onChange={e=>background({color2:e.target.value})}/></Field>}</div>}
        {(s.background.kind==='image'||s.background.kind==='video')&&<><button className="upload-asset" onClick={()=>void pick(s.background.kind as 'image'|'video')}>{s.background.kind==='image'?<ImagePlus size={24}/>:<Video size={24}/>}Choose background {s.background.kind}</button>{s.background.path&&<p className="asset-name">{s.background.path.split(/[\\/]/).pop()}</p>}</>}
        <Field label="Frame fit"><select value={s.background.fit} onChange={e=>background({fit:e.target.value as 'cover'|'contain'})}><option value="cover">Fill frame · crop edges</option><option value="contain">Fit entire image</option></select></Field>
        <Range label="Dim background" value={s.background.dim} min={0} max={90} suffix="%" onChange={dim=>background({dim})}/>
        <Range label="Background blur" value={s.background.blur} min={0} max={30} onChange={blur=>background({blur})}/>
{s.background.kind==='video'&&<p className="field-hint">Background audio is muted.</p>}
      </>}
      {tab==='brand'&&<>
        <div className="section-caption">Source information</div>
        {([['scholar','Scholar’s name'],['lecture','Lecture title'],['source','Source link'],['channel','Channel name']] as const).map(([key,label])=><Field key={key} label={label}><input placeholder={key==='source'?'https://':''} value={p.metadata[key]} onChange={e=>update(v=>({...v,metadata:{...v.metadata,[key]:e.target.value}}),'metadata-'+key)}/></Field>)}
        <Toggle label="Show scholar’s name" checked={s.showScholar} onChange={showScholar=>change({showScholar})}/>
        <Toggle label="Show lecture / source label" checked={s.showSource} onChange={showSource=>change({showSource})}/>
        <button className="upload-asset" onClick={()=>void pick('logo')}><ImagePlus size={23}/>{s.logoPath?'Replace channel logo':'Add channel logo'}</button>
        {s.logoPath&&<button className="text-button" onClick={()=>change({logoPath:''})}><X size={13}/> Remove logo</button>}
      </>}
      <div className="divider"/>
      <details className="personal-presets"><summary>Saved styles <ChevronDown size={14}/></summary>
        {saved.map((v,i)=><button className="saved-preset" key={v.name+i} onClick={()=>change(structuredClone(v),'saved-'+v.name)}>{v.name}<Plus size={12}/></button>)}
        <div className="save-preset"><input aria-label="Personal preset name" placeholder="Style name" value={presetName} onChange={e=>setPresetName(e.target.value)}/><button className="icon-button" aria-label="Save personal preset" onClick={save} disabled={!presetName.trim()}><Plus size={17}/></button></div>
      </details>
    </div>
  </aside>;
}
