import type { Segment, Style, Typography } from './types';
import { cssFontSize, fontMetrics } from './fontSizing';
import { canvasSettings, effectiveStyle } from './inspectorModel';
import type { Project } from './types';

export interface TextLine { start: number; end: number; text: string }
let context: CanvasRenderingContext2D | null = null;
function metrics(text: string, type: Typography, language:'arabic'|'english') {
  if (typeof document === 'undefined') return null;
  context ??= document.createElement('canvas').getContext('2d');
  if (!context) return null;
  context.font=`${type.italic?'italic ':''}${type.bold?700:400} ${cssFontSize(type,language)}px "${type.font}", "Noto Naskh Arabic", sans-serif`;
  return context.measureText(text);
}
export function textWidth(text: string, type: Typography, language:'arabic'|'english'='english') {
  const measured=metrics(text,type,language);
  const count=[...new Intl.Segmenter(undefined,{granularity:'grapheme'}).segment(text)].length;
  return (measured?Math.max(measured.width,measured.actualBoundingBoxLeft+measured.actualBoundingBoxRight):count*cssFontSize(type,language)*.62)+Math.max(0,count-1)*type.spacing;
}
export function wrapCaption(text: string, width: number, measure: (text:string)=>number): TextLine[] {
  const lines: TextLine[]=[];let offset=0;
  for(const paragraph of text.split('\n')) {
    const words=[...paragraph.matchAll(/\S+/gu)];let start=-1,end=-1;
    const push=()=>{if(start>=0){lines.push({start:offset+start,end:offset+end,text:paragraph.slice(start,end)});start=-1;}};
    if(!words.length)lines.push({start:offset,end:offset,text:''});
    for(const word of words){
      const from=word.index!,to=from+word[0].length;
      if(start>=0&&measure(paragraph.slice(start,to))>width)push();
      if(measure(word[0])<=width){if(start<0)start=from;end=to;continue;}
      push();
      for(const cluster of new Intl.Segmenter(undefined,{granularity:'grapheme'}).segment(word[0])){
        const a=from+cluster.index,b=a+cluster.segment.length;
        if(start>=0&&measure(paragraph.slice(start,b))>width)push();
        if(start<0)start=a;end=b;
      }
    }
    push();offset+=paragraph.length+1;
  }
  return lines;
}
export function panelLayout(style: Style, segment: Segment, width: number, height: number) {
  const panel=style.panel, c=canvasSettings(style), bare=panel.preset==='none';
  const panelWidth=Math.round(width*(style.canvas?Math.min(bare?c.maxWidth:panel.width,c.maxWidth,100-c.marginX*2):panel.width)/100), edge=bare?0:panel.preset==='azure'||panel.preset==='emerald'?30:14;
  const padding=bare?0:panel.padding;
  const inset=bare?0:padding+edge+panel.borderWidth*2, textArea=Math.max(1,panelWidth-inset*2);
  const bold=segment.emphasis.some(e=>e.bold);
  const measure=(text:string,type:Typography,language:'arabic'|'english')=>Math.max(textWidth(text,type,language),bold?textWidth(text,{...type,bold:true},language):0)+type.outline*2+4;
  const layoutLines=(language:'arabic'|'english')=>wrapCaption(segment[language],textArea,text=>measure(text,style[language],language)).map(line=>{
    const type=style[language],em=cssFontSize(type,language),m=metrics(line.text||' ',type,language),font=fontMetrics(type);
    const ascent=m?.actualBoundingBoxAscent??em,descent=m?.actualBoundingBoxDescent??em*.3;
    // Center visible glyphs, rather than the font's often oversized line box.
    const offset=((ascent-descent)-em*(font.ascent-font.descent)/font.units)/2;
    const height=Math.ceil(Math.max(em*.8,ascent+descent)+type.outline*2+type.shadow+12);
    return {...line,offset,height};
  });
  const arabic=style.mode==='bilingual'?layoutLines('arabic'):[],english=layoutLines('english');
  const arabicPitch=Math.max(0,...arabic.map(line=>line.height)),englishPitch=Math.max(0,...english.map(line=>line.height)),gap=arabic.length?style.lineGap:0;
  const panelHeight=Math.ceil(arabic.length*arabicPitch+english.length*englishPitch+gap+padding*2);
  const marginX=style.canvas?width*c.marginX/100:0,marginY=style.canvas?height*c.marginY/100:20;
  const x=Math.max(marginX,Math.min(width-panelWidth-marginX,width*(style.captionX??50)/100-panelWidth/2)),top=Math.max(marginY,Math.min(height-panelHeight-marginY,height*style.captionY/100-panelHeight/2));
  return {x,top,width:panelWidth,height:panelHeight,inset,padding,arabic,english,arabicPitch,englishPitch,gap};
}
/** Shrink to the largest shared size that fits every caption, without editing its text. */
export function fitCaptionsSafely(p: Project): { project: Project; remaining: number } {
  const project=structuredClone(p),s=project.style,c={...canvasSettings(s)};
  s.canvas=c;c.maxWidth=Math.min(c.maxWidth,100-2*c.marginX);
  const [w,h]=s.ratio==='16:9'?[1920,1080]:s.ratio==='1:1'?[1080,1080]:[1080,1920];
  const fits=(style:Style,segment:Segment)=>panelLayout(style,segment,w,h).height<=h*(1-2*c.marginY/100);
  for(let i=0;i<282&&project.segments.some(seg=>!seg.overrides&&!fits(s,seg));i++) {
    s.arabic.size=Math.max(18,s.arabic.size-1);s.english.size=Math.max(18,s.english.size-1);
  }
  let remaining=0;
  project.segments=project.segments.map(seg=>{
    let st=effectiveStyle(s,seg);
    if(seg.overrides){for(let i=0;i<282&&!fits(st,seg);i++) {st={...st,arabic:{...st.arabic,size:Math.max(18,st.arabic.size-1)},english:{...st.english,size:Math.max(18,st.english.size-1)}};}
      seg.overrides={...seg.overrides,arabicSize:st.arabic.size,englishSize:st.english.size};}
    if(!fits(st,seg))remaining++;
    return seg;
  });
  s.name='Custom';return {project,remaining};
}
