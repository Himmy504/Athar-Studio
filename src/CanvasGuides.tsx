import { canvasSettings, snapPosition } from './inspectorModel';
import type { Project } from './types';

export function CanvasGuides({project:p,onPosition}:{project:Project;onPosition:(x:number,y:number)=>void}) {
  const c=canvasSettings(p.style),visible=c.safe||c.titleSafe||c.logoSafe||c.grid||c.center;
  if(!visible)return null;
  return <div className="canvas-guides" aria-label="Preview guides">
    {c.safe&&<div className="guide-rect safe-guide" style={{inset:`${c.marginY}% ${c.marginX}%`}}><span>Safe area</span></div>}
    {c.titleSafe&&<div className="guide-rect title-guide" style={{inset:'10%'}}><span>Title safe</span></div>}
    {c.logoSafe&&<div className="guide-rect logo-guide" style={{inset:'5%'}}><span>Logo safe</span></div>}
    {c.grid&&<><i className="guide-v" style={{left:'33.333%'}}/><i className="guide-v" style={{left:'66.667%'}}/><i className="guide-h" style={{top:'33.333%'}}/><i className="guide-h" style={{top:'66.667%'}}/></>}
    {c.center&&<><i className="guide-v center-guide" style={{left:'50%'}}/><i className="guide-h center-guide" style={{top:'50%'}}/></>}
    <button className="caption-drag" aria-label="Position global captions" title="Drag to position captions. Arrow keys move; Shift moves faster." style={{left:`${p.style.captionX??50}%`,top:`${p.style.captionY}%`}}
      onPointerDown={e=>{e.currentTarget.setPointerCapture(e.pointerId);}}
      onPointerMove={e=>{if(!e.currentTarget.hasPointerCapture(e.pointerId))return;const box=e.currentTarget.parentElement!.getBoundingClientRect();onPosition(snapPosition(Math.max(0,Math.min(100,(e.clientX-box.left)/box.width*100)),p.style,'x'),snapPosition(Math.max(15,Math.min(88,(e.clientY-box.top)/box.height*100)),p.style,'y'));}}
      onPointerUp={e=>e.currentTarget.releasePointerCapture(e.pointerId)}
      onKeyDown={e=>{const delta=e.shiftKey?5:1;if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();e.stopPropagation();onPosition(Math.max(0,Math.min(100,(p.style.captionX??50)+(e.key==='ArrowLeft'?-delta:e.key==='ArrowRight'?delta:0))),Math.max(15,Math.min(88,p.style.captionY+(e.key==='ArrowUp'?-delta:e.key==='ArrowDown'?delta:0))));}}>Move captions</button>
  </div>;
}
