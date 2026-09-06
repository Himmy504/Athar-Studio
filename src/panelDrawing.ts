import { PANEL_PRESETS } from './panelPresets';
import type { CaptionPanel } from './types';

const n=(v:number)=>Math.round(v*10)/10;
export function panelPath(shape:string,w:number,h:number):string {
  const r=Math.min(24,h/5),tip=Math.min(20,h/5);
  if(shape==='box')return `m 0 0 l ${n(w)} 0 ${n(w)} ${n(h)} 0 ${n(h)}`;
  if(shape==='ticket')return `m ${n(tip)} 0 l ${n(w-tip)} 0 ${n(w)} ${n(h/2)} ${n(w-tip)} ${n(h)} ${n(tip)} ${n(h)} 0 ${n(h/2)}`;
  if(shape==='cartouche')return `m ${n(tip+r)} 0 l ${n(w-tip-r)} 0 b ${n(w-tip)} 0 ${n(w-tip)} ${n(r)} ${n(w-tip)} ${n(h/2-tip)} l ${n(w)} ${n(h/2)} ${n(w-tip)} ${n(h/2+tip)} b ${n(w-tip)} ${n(h-r)} ${n(w-tip)} ${n(h)} ${n(w-tip-r)} ${n(h)} l ${n(tip+r)} ${n(h)} b ${n(tip)} ${n(h)} ${n(tip)} ${n(h-r)} ${n(tip)} ${n(h/2+tip)} l 0 ${n(h/2)} ${n(tip)} ${n(h/2-tip)} b ${n(tip)} ${n(r)} ${n(tip)} 0 ${n(tip+r)} 0`;
  return `m ${n(r)} 0 l ${n(w-r)} 0 b ${n(w)} 0 ${n(w)} 0 ${n(w)} ${n(r)} l ${n(w)} ${n(h-r)} b ${n(w)} ${n(h)} ${n(w)} ${n(h)} ${n(w-r)} ${n(h)} l ${n(r)} ${n(h)} b 0 ${n(h)} 0 ${n(h)} 0 ${n(h-r)} l 0 ${n(r)} b 0 0 0 0 ${n(r)} 0`;
}
const color=(hex:string)=>'&H'+hex.slice(5,7)+hex.slice(3,5)+hex.slice(1,3)+'&';
const alpha=(opacity:number)=>'&H'+Math.round(255*(1-opacity/100)).toString(16).padStart(2,'0').toUpperCase()+'&';
export function panelDrawings(panel:CaptionPanel,x:number,y:number,w:number,h:number,fade:string) {
  const shape=PANEL_PRESETS[panel.preset].shape;
  const draw=(dx:number,dy:number,width:number,height:number,fill:string,opacity:number,borderWidth:number,border:string,borderOpacity:number,path?:string)=>
    `{\\an7\\pos(${n(dx)},${n(dy)})\\p1\\fscx100\\fscy100\\shad0\\bord${borderWidth}\\1c${color(fill)}\\1a${alpha(opacity)}\\3c${color(border)}\\3a${alpha(borderOpacity)}${fade}}${path??panelPath(shape,width,height)}{\\p0}`;
  const result=[draw(x+2,y+5,w,h,'#000000',Math.min(28,panel.opacity),0,'#000000',0),draw(x,y,w,h,panel.fill,panel.opacity,panel.borderWidth,panel.border,panel.opacity)];
  if(['cartouche','ticket'].includes(shape)) {
    result.push(draw(x+8,y+8,w-16,h-16,panel.fill,0,1,panel.border,panel.opacity*.65));
  }
  if(shape==='cartouche') {
    const paths:string[]=[];
    // A sparse geometric texture stays subtle beneath the caption text.
    const columns=Math.max(1,Math.floor((w-100)/32)),rows=Math.max(1,Math.min(9,Math.floor((h-36)/28)));
    for(let row=0;row<rows;row++)for(let col=0;col<columns;col++){
      const cx=col*32+(row%2?8:0),cy=row*28;
      paths.push(`m ${cx+5} ${cy} l ${cx+10} ${cy+5} ${cx+5} ${cy+10} ${cx} ${cy+5} ${cx+5} ${cy}`);
    }
    result.push(draw(x+45,y+18,w-90,h-36,'#BDE2DD',panel.opacity*.09,0,panel.border,0,paths.join(' ')));
  }
  return result;
}
