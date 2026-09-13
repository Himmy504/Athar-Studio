import { useEffect, useState } from 'react';
import { Copy, Star, Trash2, ArrowUp, ArrowDown, RotateCcw } from 'lucide-react';
import { presets, styleSchema } from './domain';
import { applyScopedStyle, brandSettings } from './inspectorModel';
import { Field } from './components';
import { mediaUrl } from './bridge';
import { createPanel, PANEL_PRESETS } from './panelPresets';
import type { PresetScope, SavedStyle, Style } from './types';

const scopes:Record<PresetScope,string>={caption:'Caption style',background:'Background look',brand:'Brand kit',composition:'Complete composition'};
function withPanel(base:Style,name:string,preset:Style['panel']['preset']) {
  const palette=PANEL_PRESETS[preset];return {...structuredClone(base),name,panel:createPanel(preset),english:{...base.english,color:palette.ink,outline:preset==='paper'?0:.5},arabic:{...base.arabic,color:palette.arabicInk,outline:preset==='paper'?0:.5}};
}
function builtinStyles():Record<PresetScope,Style[]> {
  const caption=[{...structuredClone(presets.Clean),name:'Minimal'},withPanel(presets.Bold,'Bold Statement','solid'),withPanel(presets.Bilingual,'Bilingual Glass','glass'),withPanel(presets.Quote,'Archive Quote','paper')];
  const backgrounds=[
    {...structuredClone(presets.Clean),name:'Deep Emerald'},
    {...structuredClone(presets.Bold),name:'Charcoal Gold'},
    {...structuredClone(presets.Quote),name:'Warm Archive'},
    {...structuredClone(presets.Clean),name:'Midnight Blue',background:{...presets.Clean.background,color:'#17243A',color2:'#070B12',dim:14}},
  ];
  const brandBase=(name:string)=>{const style=structuredClone(presets.Clean),brand=structuredClone(brandSettings(style));style.name=name;style.brand=brand;style.logoPath='';return {style,brand};};
  const minimal=brandBase('Scholar Minimal');minimal.brand.channel.enabled=false;minimal.brand.scholar={...minimal.brand.scholar,font:'Playfair Display',size:34,alignment:'center',color:'#F2E7CD'};
  const channel=brandBase('Channel Signature');channel.brand.scholar.enabled=false;channel.brand.channel={...channel.brand.channel,bold:true,spacing:4,size:26,backgroundEnabled:true,background:'#101722',backgroundOpacity:82,textPadding:14,cornerRadius:40};
  const source=brandBase('Source Plaque');source.brand.scholar.enabled=false;source.brand.channel.enabled=false;source.brand.source={...source.brand.source,enabled:true,anchor:'bottom-center',alignment:'center',backgroundEnabled:true,background:'#0C4C40',backgroundOpacity:96,borderColor:'#D8B46B',borderWidth:2,cornerRadius:14,textPadding:18};
  const card=brandBase('Citation Card');card.brand.scholar.enabled=false;card.brand.channel.enabled=false;card.brand.sourceCard={...card.brand.sourceCard,enabled:true,qr:true,font:'Merriweather',color:'#29251D',background:'#EADAB4',backgroundOpacity:100,borderColor:'#AB8545',borderWidth:2,cornerRadius:18};
  const compositions=[{...structuredClone(presets.Clean),name:'Clean Vertical'},withPanel(presets.Bold,'Bold Statement','gold'),withPanel(presets.Bilingual,'Bilingual Glass','glass'),withPanel(presets.Quote,'Archive Quote','paper')];
  return {caption,background:backgrounds,brand:[minimal.style,channel.style,source.style,card.style],composition:compositions};
}
const defaults=()=>Object.entries(builtinStyles()).flatMap(([scope,styles])=>styles.map(style=>({id:`builtin-${scope}-${style.name}`,builtin:style.name,name:style.name,scope:scope as PresetScope,style,favorite:false})));
export function readGallery():SavedStyle[]{
  try {const raw=localStorage.getItem('athar-style-gallery');if(raw){const list=JSON.parse(raw);if(Array.isArray(list))return list.flatMap(v=>{const parsed=styleSchema.safeParse(v.style);return parsed.success&&typeof v.id==='string'&&typeof v.name==='string'&&Object.hasOwn(scopes,v.scope)?[{...v,style:parsed.data,favorite:!!v.favorite}]:[];});}
    const legacy=JSON.parse(localStorage.getItem('athar-presets')||'[]');return [...defaults(),...(Array.isArray(legacy)?legacy.flatMap((s,i)=>{const p=styleSchema.safeParse(s);return p.success?[{id:'legacy-'+i,name:p.data.name,scope:'composition' as const,style:p.data,favorite:false}]:[];}):[])];
  }catch{return defaults();}
}
export function addGalleryStyle(style:Style,scope:PresetScope,name:string) {
  const next=[...readGallery(),{id:crypto.randomUUID(),name:name.trim(),style:structuredClone(style),scope,favorite:false}];
  localStorage.setItem('athar-style-gallery',JSON.stringify(next));
}
const withOpacity=(hex:string,opacity:number)=>hex+Math.round(opacity*2.55).toString(16).padStart(2,'0');
function itemDescription(item:SavedStyle) {
  const s=item.style;
  if(item.scope==='caption')return `${s.english.font} · ${s.panel.preset==='none'?'No panel':s.panel.preset+' panel'}`;
  if(item.scope==='background')return `${s.background.kind[0].toUpperCase()+s.background.kind.slice(1)} · ${s.background.dim}% dim`;
  if(item.scope==='brand'){const b=brandSettings(s);return `${b.logos.length} logo${b.logos.length===1?'':'s'} · ${[b.scholar,b.source,b.channel,b.sourceCard].filter(v=>v.enabled).length} labels`;}
  return `${s.ratio} · ${s.mode==='bilingual'?'Bilingual':'Single language'}`;
}
function Thumbnail({s,scope}:{s:Style;scope:PresetScope}) {
  const b=brandSettings(s),bg=s.background;
  const showCaption=scope==='caption'||scope==='composition',showBrand=scope==='brand'||scope==='composition',showBackground=scope==='background'||scope==='composition';
  const surface=showBackground?(bg.kind==='gradient'?`linear-gradient(145deg,${bg.color},${bg.color2})`:bg.color):'linear-gradient(145deg,#303844,#151a20)';
  const labelStyle=(label:typeof b.channel)=>({fontFamily:label.font,color:label.color,fontWeight:label.bold?700:400,fontStyle:label.italic?'italic':'normal',textDecoration:label.underline?'underline':undefined,letterSpacing:`${Math.max(0,label.spacing/5)}px`,background:label.backgroundEnabled?withOpacity(label.background,label.backgroundOpacity):'transparent',border:label.backgroundEnabled&&label.borderWidth?`1px solid ${label.borderColor}`:'none',borderRadius:label.cornerRadius/4,padding:label.backgroundEnabled?'4px 8px':undefined,textAlign:label.alignment} as const);
  return <span className={`style-thumbnail scope-${scope}`} style={{background:surface}}>
    {showBackground&&bg.path&&bg.kind==='image'&&<img className="thumbnail-background" src={mediaUrl(bg.path)} alt=""/>}
    {showBackground&&<span className="thumbnail-background-kind">{bg.kind==='original'?'Footage':bg.kind}</span>}
    {showBrand&&b.channel.enabled&&<span className="thumbnail-channel" style={labelStyle(b.channel)}>ATHAR STUDIO</span>}
    {showBrand&&b.sourceCard.enabled?<span className="thumbnail-brand-card" style={labelStyle(b.sourceCard)}>Scholar Name<br/><small>Lecture source</small></span>:showBrand&&b.scholar.enabled?<span className="thumbnail-brand-card" style={labelStyle(b.scholar)}>Scholar Name</span>:showBrand&&b.source.enabled?<span className="thumbnail-brand-card" style={labelStyle(b.source)}>Lecture source</span>:null}
    {showCaption&&<span className="thumbnail-caption" style={{top:`${Math.min(70,s.captionY)}%`,background:s.panel.preset==='none'?'transparent':withOpacity(s.panel.fill,s.panel.opacity),border:s.panel.preset==='none'?'none':`${Math.max(1,s.panel.borderWidth/2)}px solid ${s.panel.border}`,borderRadius:['glass','gold','emerald','azure'].includes(s.panel.preset)?8:2,textAlign:s.alignment}}>
      {s.mode==='bilingual'&&<span lang="ar" dir="rtl" style={{fontFamily:s.arabic.font,color:s.arabic.color,fontWeight:s.arabic.bold?700:400,fontSize:Math.max(17,Math.min(24,s.arabic.size/4))}}>العلم نور</span>}
      <span style={{fontFamily:s.english.font,color:s.english.color,fontWeight:s.english.bold?700:400,fontStyle:s.english.italic?'italic':'normal',textDecoration:s.english.underline?'underline':undefined,textShadow:s.english.shadow?'1px 1px 3px #000':undefined,fontSize:Math.max(15,Math.min(21,s.english.size/4))}}>Knowledge is light</span>
    </span>}
    {showBrand&&(b.logos[0]?<img className="thumbnail-logo" src={mediaUrl(b.logos[0].path)} alt=""/>:<span className="thumbnail-logo-placeholder">A</span>)}
  </span>;
}
export function StyleGallery({style,scope,setScope,apply,preview,notify}:{style:Style;scope:PresetScope;setScope:(s:PresetScope)=>void;apply:(s:Style,scope:PresetScope)=>void;preview:(s:Style|null)=>void;notify:(s:string)=>void}) {
  const [items,setItems]=useState(readGallery),[name,setName]=useState(''),[favorites,setFavorites]=useState(false),[renaming,setRenaming]=useState<string|null>(null),[rename,setRename]=useState('');
  useEffect(()=>()=>preview(null),[]);
  const save=(next:SavedStyle[])=>{try{localStorage.setItem('athar-style-gallery',JSON.stringify(next));setItems(next);}catch{notify('Could not save the style library. Storage may be full.');}};
  const shown=items.filter(v=>v.scope===scope&&(!favorites||v.favorite));
  const move=(id:string,delta:number)=>{const next=[...items],visible=items.filter(v=>v.scope===scope),at=visible.findIndex(v=>v.id===id),other=visible[at+delta];if(!other)return;const a=next.findIndex(v=>v.id===id),b=next.findIndex(v=>v.id===other.id);[next[a],next[b]]=[next[b],next[a]];save(next);};
  return <><div className="section-caption">Style library</div><div className="gallery-scope-tabs" role="group" aria-label="Style category">{(Object.entries(scopes) as [PresetScope,string][]).map(([id,label])=><button key={id} aria-pressed={scope===id} className={scope===id?'active':''} onClick={()=>{preview(null);setScope(id);}}><span>{label}</span><small>{items.filter(item=>item.scope===id).length}</small></button>)}</div>
    <p className="field-hint">Hover or focus to preview. Click to apply {scope==='composition'?'the full composition, including aspect ratio':`only the ${scopes[scope].toLowerCase()}`}.</p>
    <button className="gallery-favorites" aria-pressed={favorites} onClick={()=>setFavorites(!favorites)}><Star size={15} fill={favorites?'currentColor':'none'}/>{favorites?'Showing favorites':'Show favorites'}</button>
    <div className="style-gallery" onMouseLeave={()=>preview(null)}>{shown.map(item=><div className="gallery-card" key={item.id}>
      <button className="gallery-preview" aria-label={'Apply '+item.name} onMouseEnter={()=>preview(applyScopedStyle(style,item.style,scope))} onFocus={()=>preview(applyScopedStyle(style,item.style,scope))} onBlur={()=>preview(null)} onClick={()=>{preview(null);apply(item.style,scope);}}><Thumbnail s={item.style} scope={scope}/><span className="gallery-card-copy"><strong>{item.name}</strong><small>{itemDescription(item)}</small><em>{item.builtin?'Built-in':'Personal'}</em></span></button>
      <div className="gallery-actions"><button title="Favorite" aria-label={'Favorite '+item.name} aria-pressed={item.favorite} onClick={()=>save(items.map(v=>v.id===item.id?{...v,favorite:!v.favorite}:v))}><Star size={15} fill={item.favorite?'currentColor':'none'}/></button>
        <button title="Duplicate" aria-label={'Duplicate '+item.name} onClick={()=>save([...items,{...structuredClone(item),id:crypto.randomUUID(),builtin:undefined,name:item.name+' copy'}])}><Copy size={15}/></button>
        <button title="Rename" aria-label={'Rename '+item.name} onClick={()=>{setRenaming(item.id);setRename(item.name);}}>Aa</button>
        <button title="Move up" aria-label={'Move '+item.name+' up'} disabled={items.filter(v=>v.scope===scope)[0]?.id===item.id} onClick={()=>move(item.id,-1)}><ArrowUp size={15}/></button>
        <button title="Move down" aria-label={'Move '+item.name+' down'} disabled={items.filter(v=>v.scope===scope).at(-1)?.id===item.id} onClick={()=>move(item.id,1)}><ArrowDown size={15}/></button>
        <button title="Delete" aria-label={'Delete '+item.name} onClick={()=>{preview(null);save(items.filter(v=>v.id!==item.id));}}><Trash2 size={15}/></button></div>
      {renaming===item.id&&<form onSubmit={e=>{e.preventDefault();if(rename.trim()){save(items.map(v=>v.id===item.id?{...v,name:rename.trim()}:v));setRenaming(null);}}}><input aria-label="New style name" value={rename} onChange={e=>setRename(e.target.value)}/><button type="submit">Save name</button><button type="button" onClick={()=>setRenaming(null)}>Cancel</button></form>}
    </div>)}</div>
    {!shown.length&&<p className="field-hint">No styles here yet. Save your current look below.</p>}
    <div className="divider"/><Field label="Style name"><input value={name} onChange={e=>setName(e.target.value)} placeholder="My style"/></Field>
    <button className="secondary-button full-width" disabled={!name.trim()} onClick={()=>{save([...items,{id:crypto.randomUUID(),name:name.trim(),style:structuredClone(style),scope,favorite:false}]);setName('');notify('Style saved.');}}>Save {scopes[scope].toLowerCase()}</button>
    <button className="text-button" onClick={()=>{preview(null);save([...items.filter(v=>v.scope!==scope||!v.builtin),...defaults().filter(v=>v.scope===scope)]);notify('Built-in defaults restored. Personal styles kept.');}}><RotateCcw size={13}/>Restore built-in default</button>
  </>;
}
