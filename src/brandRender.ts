import qrcode from 'qrcode-generator';
import { brandSettings, timeRange } from './inspectorModel';
import { assColor, escapeAss } from './subtitles';
import { assFontFamily, assFontSize } from './fontSizing';
import { textWidth, wrapCaption } from './captionLayout';
import { directionalText } from './textDirection';
import type { Anchor, BrandLabel, Project, Typography } from './types';

export function anchorBox(anchor: Anchor, padding: number, width: number, height: number, w: number, h: number) {
  return { x: anchor.endsWith('left') ? padding : anchor.endsWith('right') ? w-width-padding : (w-width)/2, y: anchor.startsWith('top') ? padding : anchor.startsWith('bottom') ? h-height-padding : (h-height)/2 };
}
export function sourceQr(text: string) {
  try { const url=new URL(text);if(!['https:','http:'].includes(url.protocol))return null;
    if(url.href.length>1500)return null;
    const qr=qrcode(0,'M');qr.addData(url.href);qr.make();return qr;
  } catch { return null; }
}
const n=(value:number)=>Math.round(value*10)/10;
const alpha=(opacity:number)=>Math.round(255*(1-opacity/100)).toString(16).padStart(2,'0').toUpperCase();
function roundedRect(width:number,height:number,radius:number) {
  const r=Math.min(Math.max(0,radius),width/2,height/2);
  if(!r)return `m 0 0 l ${n(width)} 0 ${n(width)} ${n(height)} 0 ${n(height)}`;
  const c=r*.5522848;
  return `m ${n(r)} 0 l ${n(width-r)} 0 b ${n(width-r+c)} 0 ${n(width)} ${n(r-c)} ${n(width)} ${n(r)} l ${n(width)} ${n(height-r)} b ${n(width)} ${n(height-r+c)} ${n(width-r+c)} ${n(height)} ${n(width-r)} ${n(height)} l ${n(r)} ${n(height)} b ${n(r-c)} ${n(height)} 0 ${n(height-r+c)} 0 ${n(height-r)} l 0 ${n(r)} b 0 ${n(r-c)} ${n(r-c)} 0 ${n(r)} 0`;
}
export function brandEvents(p: Project,w:number,h:number,line:(start:number,end:number,name:string,text:string,layer?:number)=>string) {
  const brand=brandSettings(p.style), duration=Math.max(0,p.clip.end-p.clip.start),events:string[]=[];
  function label(item:BrandLabel,text:string,qrEnabled=false) {
    if(!item.enabled||!text.trim())return;
    const [start,end]=timeRange(item,duration);if(end<=start)return;
    const type:Typography={...p.style.english,font:item.font,size:item.size,bold:item.bold,italic:item.italic,underline:item.underline,outline:item.outline,outlineColor:item.outlineColor,shadow:item.shadow,shadowColor:item.shadowColor,spacing:item.spacing};
    const qr=qrEnabled?sourceQr(p.metadata.source):null,qrSize=qr?Math.max(180,(qr.getModuleCount()+8)*4):0;
    const edge=Math.min(item.padding,w*.3,h*.3),inner=Math.max(0,item.textPadding),available=Math.max(80,Math.min(w-edge*2,w*item.width/100));
    const qrGap=qr?inner:0,textMax=Math.max(40,available-inner*2-qrSize-qrGap);
    const rows=wrapCaption(text,textMax,t=>textWidth(t,type)).map(row=>row.text);
    const rowHeight=Math.ceil(item.size*item.lineHeight/100),actualTextWidth=Math.max(...rows.map(row=>textWidth(row,type)),40);
    const width=Math.min(available,actualTextWidth+inner*2+qrSize+qrGap),height=Math.max(rows.length*rowHeight,qrSize)+inner*2;
    const box=anchorBox(item.anchor,edge,width,height,w,h);
    const rect=(x:number,y:number,rw:number,rh:number,color:string,opacity:number,borderWidth=0,borderColor='#000000',radius=0)=>`{\\an7\\pos(${Math.round(x)},${Math.round(y)})\\p1\\shad0\\bord${borderWidth}\\1c${assColor(color)}\\1a&H${alpha(opacity)}&\\3c${assColor(borderColor)}\\3a&H00&}${roundedRect(rw,rh,radius)}{\\p0}`;
    if(item.backgroundEnabled)events.push(line(start,end,'Label',rect(box.x,box.y,width,height,item.background,item.backgroundOpacity,item.borderWidth,item.borderColor,item.cornerRadius),3));
    const alignTag=item.alignment==='center'?8:item.alignment==='right'?9:7,left=box.x+inner,right=box.x+width-inner-qrSize-qrGap;
    const textX=item.alignment==='center'?(left+right)/2:item.alignment==='right'?right:left;
    rows.forEach((row,i)=>events.push(line(start,end,'Label',`{\\an${alignTag}\\pos(${Math.round(textX)},${Math.round(box.y+inner+i*rowHeight)})\\fn${assFontFamily(item.font)}\\fs${assFontSize(type,'english')}\\c${assColor(item.color)}\\b${item.bold?1:0}\\i${item.italic?1:0}\\u${item.underline?1:0}\\bord${item.outline}\\3c${assColor(item.outlineColor)}\\shad${item.shadow}\\4c${assColor(item.shadowColor)}\\fsp${item.spacing}}${directionalText(escapeAss(row),/[\u0600-\u06ff]/.test(row))}`,4)));
    if(qr){
      const count=qr.getModuleCount(),cell=Math.floor(qrSize/(count+8)),size=(count+8)*cell,x=box.x+width-inner-qrSize,y=box.y+inner;
      events.push(line(start,end,'Label',rect(x,y,size,size,'#FFFFFF',100),4));
      const paths:string[]=[];
      for(let row=0;row<count;row++)for(let col=0;col<count;col++)if(qr.isDark(row,col)){const a=(col+4)*cell,b=(row+4)*cell;paths.push(`m ${a} ${b} l ${a+cell} ${b} ${a+cell} ${b+cell} ${a} ${b+cell}`);}
      events.push(line(start,end,'Label',`{\\an7\\pos(${Math.round(x)},${Math.round(y)})\\p1\\bord0\\shad0\\c&H000000&}${paths.join(' ')}{\\p0}`,5));
    }
  }
  label(brand.scholar,p.metadata.scholar);label(brand.source,p.metadata.lecture||p.metadata.source);label(brand.channel,p.metadata.channel);
  label(brand.sourceCard,[p.metadata.scholar,p.metadata.lecture,p.metadata.source].filter(Boolean).join('\n'),brand.sourceCard.qr);
  return events;
}
