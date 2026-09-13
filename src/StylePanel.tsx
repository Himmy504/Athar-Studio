import { targetLanguage, languageFonts, defaultLanguageFont } from './languages';
import { useState } from 'react';
import { AlignCenter, AlignLeft, AlignRight, ChevronDown, ImagePlus, Video } from 'lucide-react';
import { Field, NumberInput, Range, Toggle } from './components';
import { presets } from './domain';
import { chooseAsset } from './bridge';
import type { Project, Style, Typography, PresetScope, Animation } from './types';
import { createPanel, PANEL_PRESETS } from './panelPresets';
import { CanvasPanel } from './CanvasPanel';
import { BrandPanel } from './BrandPanel';
import { addGalleryStyle, StyleGallery } from './StyleGallery';
import { CaptionOverrides } from './CaptionOverrides';
import { applyScopedStyle } from './inspectorModel';

export function StylePanel({ project: p, update, notify, selectedId, selectedIds, onPreview }: { project: Project; update: (fn:(p:Project)=>Project,key?:string)=>void; notify:(message:string)=>void;selectedId:string|null;selectedIds:string[];onPreview:(s:Style|null)=>void }) {
  const [tab,setTab]=useState<'canvas'|'captions'|'background'|'brand'|'styles'>('captions');
  const [scope,setScope]=useState<PresetScope>('caption');
  const [language,setLanguage]=useState<'english'|'arabic'>('english');
  const s=p.style;
  const translation=targetLanguage(p);
  const availableFonts=languageFonts(language==='arabic'?'ar':translation.code);
  const change=(patch:Partial<Style>,key='style')=>update(v=>{
    const style={...v.style,name:'Custom',...patch};
    if(!languageFonts(translation.code).some(f=>f.family===style.english.font))style.english={...style.english,font:defaultLanguageFont(translation.code)};
    return {...v,style};
  },key);
  const typography=s[language];
  const typeLabel=language==='arabic'?'arabic':translation.name.toLowerCase();
  const type=(patch:Partial<Typography>)=>change({[language]:{...typography,...patch}},'type-'+language);
  const background=(patch:Partial<Style['background']>)=>change({background:{...s.background,...patch}},'background');
  const pick=async(kind:'image'|'video'|'logo')=>{
    try {const path=await chooseAsset(kind==='video'?'video':'image');if(path)kind==='logo'?change({logoPath:path}):background({kind,path});}catch(e){notify(String(e));}
  };
  return <aside className="style-panel">
    <div className="panel-heading"><span>Inspector</span></div>
    <div className="style-tabs">{(['canvas','captions','background','brand','styles'] as const).map(t=><button key={t} aria-pressed={tab===t} className={tab===t?'active':''} onClick={()=>{onPreview(null);setTab(t);}}>{t[0].toUpperCase()+t.slice(1)}</button>)}</div>
    <div className="style-scroll">
      {tab==='canvas'&&<CanvasPanel project={p} update={update} notify={notify}/>}
      {tab==='styles'&&<StyleGallery style={s} scope={scope} setScope={setScope} apply={(style,scope)=>change(applyScopedStyle(s,style,scope),'gallery')} preview={onPreview} notify={notify}/>}
      {tab==='brand'&&<BrandPanel project={p} update={update} notify={notify} onSaveKit={name=>{try{addGalleryStyle(s,'brand',name);notify('Brand kit saved.');setScope('brand');setTab('styles');}catch{notify('Could not save the brand kit. Storage may be full.');}}}/>}
      {tab==='captions'&&<>
        <button className="secondary-button full-width" onClick={()=>{setScope('caption');setTab('styles');}}>Browse caption styles</button>
        <CaptionOverrides project={p} selectedId={selectedId} selectedIds={selectedIds} update={update} notify={notify}/>
        <Field label="Display"><select value={s.mode} onChange={e=>change({mode:e.target.value as Style['mode']})}><option value="bilingual">Arabic + {translation.name}</option><option value="english">{translation.name} only</option></select></Field>
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
        <div className="section-caption inspector-section-title">Typography<button className="text-button" onClick={()=>type(structuredClone(presets.Bilingual[language]))} title="Reset this language's typography">Reset</button></div>
        <div className="segmented">{(['english','arabic'] as const).map(l=><button key={l} onClick={()=>setLanguage(l)} className={language===l?'active':''}>{l==='arabic'?'العربية':translation.name}</button>)}</div>
        <Field label="Font family"><select aria-label={typeLabel+' caption font'} value={typography.font} onChange={e=>type({font:e.target.value})}>
          {!availableFonts.some(font=>font.family===typography.font)&&<option>{typography.font}</option>}
          {availableFonts.map(font=><option key={font.id}>{font.family}</option>)}
        </select></Field>
        <div className="field-row"><Field label="Size"><NumberInput key={language} label={typeLabel+' font size'} min={18} max={300} value={typography.size} onChange={size=>type({size})}/></Field>
        <Field label="Text color"><div className="color-input"><input aria-label={typeLabel+' text color'} type="color" value={typography.color} onChange={e=>type({color:e.target.value})}/><span>{typography.color}</span></div></Field></div>
        <Toggle label="Bold text" checked={typography.bold} onChange={bold=>type({bold})}/>
        <div className="segmented type-effects"><button aria-pressed={!!typography.italic} className={typography.italic?'active':''} onClick={()=>type({italic:!typography.italic})}><i>Italic</i></button><button aria-pressed={!!typography.underline} className={typography.underline?'active':''} onClick={()=>type({underline:!typography.underline})}><u>Underline</u></button></div>
        <details className="advanced"><summary>Outline, shadow & spacing <ChevronDown size={13}/></summary>
          <Range label="Outline" min={0} max={16} step={.5} value={typography.outline} onChange={outline=>type({outline})}/>
          <Field label="Outline color"><input aria-label={typeLabel+' outline color'} type="color" value={typography.outlineColor??'#161910'} onChange={e=>type({outlineColor:e.target.value})}/></Field>
          <Range label="Shadow" min={0} max={20} value={typography.shadow} onChange={shadow=>type({shadow})}/>
          <Field label="Shadow color"><input aria-label={typeLabel+' shadow color'} type="color" value={typography.shadowColor??'#000000'} onChange={e=>type({shadowColor:e.target.value})}/></Field>
          <Range label="Letter spacing" min={-3} max={20} step={.5} value={typography.spacing} onChange={spacing=>type({spacing})}/>
        </details>
        <div className="divider"/><div className="section-caption">Layout</div>
        <div className="segmented align-buttons">{(['left','center','right'] as const).map(a=><button key={a} aria-label={'Align '+a} className={s.alignment===a?'active':''} onClick={()=>change({alignment:a})}>{a==='left'?<AlignLeft size={17}/>:a==='right'?<AlignRight size={17}/>:<AlignCenter size={17}/>}</button>)}</div>
        <Range label="Caption position" value={s.captionY} min={15} max={88} suffix="%" onChange={captionY=>change({captionY})}/>
        <div className="segmented position-shortcuts">{([['Top',30],['Middle',50],['Bottom',72]] as const).map(([label,captionY])=><button key={label} className={s.captionY===captionY?'active':''} onClick={()=>change({captionY})}>{label}</button>)}</div>
        {s.mode==='bilingual'&&<Range label="Space between languages" value={s.lineGap} min={0} max={60} onChange={lineGap=>change({lineGap})}/>}
        <Field label="Animation"><select value={s.animation??(s.fade?'fade':'none')} onChange={e=>change({animation:e.target.value as Animation,fade:e.target.value!=='none'})}>{['none','fade','slide','pop'].map(a=><option key={a}>{a}</option>)}</select></Field>
      </>}
      {tab==='background'&&<>
        <Field label="Type"><select aria-label="Background type" value={s.background.kind} onChange={e=>background({kind:e.target.value as Style['background']['kind']})}>
          <option value="original">Source footage</option><option value="solid">Solid color</option><option value="gradient">Gradient</option><option value="image">Image</option><option value="video">Video</option>
        </select></Field>
        {s.background.kind==='original'&&!p.media?.hasVideo&&<p className="inline-warning">Import video footage, or choose another background for an audio-only clip.</p>}
        {(s.background.kind==='solid'||s.background.kind==='gradient')&&<div className="field-row"><Field label="Color"><input type="color" value={s.background.color} onChange={e=>background({color:e.target.value})}/></Field>{s.background.kind==='gradient'&&<Field label="Second color"><input type="color" value={s.background.color2} onChange={e=>background({color2:e.target.value})}/></Field>}</div>}
        {(s.background.kind==='image'||s.background.kind==='video')&&<><button className="upload-asset" onClick={()=>void pick(s.background.kind as 'image'|'video')}>{s.background.kind==='image'?<ImagePlus size={24}/>:<Video size={24}/>}Choose background {s.background.kind}</button>{s.background.path&&<p className="asset-name">{s.background.path.split(/[\\/]/).pop()}</p>}</>}
        {!['solid','gradient'].includes(s.background.kind)&&<Field label="Frame fit"><select value={s.background.fit} onChange={e=>background({fit:e.target.value as 'cover'|'contain'})}><option value="cover">Fill frame · crop edges</option><option value="contain">Fit entire image</option></select></Field>}
        <Range label="Dim background" value={s.background.dim} min={0} max={90} suffix="%" onChange={dim=>background({dim})}/>
        <Range label="Background blur" value={s.background.blur} min={0} max={30} onChange={blur=>background({blur})}/>
{s.background.kind==='video'&&<p className="field-hint">Background audio is muted.</p>}
      </>}
    </div>
  </aside>;
}
