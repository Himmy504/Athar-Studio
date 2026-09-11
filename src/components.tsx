import { Children, cloneElement, isValidElement, useEffect, useId, useRef, useState, type ReactNode, type ReactElement } from 'react';
import { X } from 'lucide-react';

export function Modal({ title, subtitle, children, onClose, wide = false }: { title: string; subtitle?: string; children: ReactNode; onClose: () => void; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null), closeRef = useRef(onClose); closeRef.current = onClose;
  useEffect(() => {
    const dialog=ref.current; dialog?.showModal();
    const cancel=(e:Event)=>{e.preventDefault();closeRef.current();};
    dialog?.addEventListener('cancel',cancel);
    return()=>{dialog?.removeEventListener('cancel',cancel);dialog?.close();};
  },[]);
  return <dialog className={'modal '+(wide?'wide':'')} ref={ref} aria-labelledby="modal-title">
    <div className="modal-header"><div><h2 id="modal-title">{title}</h2>{subtitle&&<p>{subtitle}</p>}</div><button className="icon-button" onClick={onClose} aria-label="Close dialog"><X size={19}/></button></div>
    <div className="modal-content">{children}</div>
  </dialog>;
}
export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  const id=useId();
  const controls=Children.map(children,child=>{
    if(isValidElement(child)&&typeof child.type==='string'&&['input','select','textarea'].includes(child.type)){
      const element=child as ReactElement<{ 'aria-label'?:string; 'aria-labelledby'?:string }>;
      if(!element.props['aria-label'])return cloneElement(element,{'aria-labelledby':id});
    }
    return child;
  });
  return <label className="field"><span id={id}>{label}</span>{controls}{hint&&<small>{hint}</small>}</label>;
}
export function Range({ label, value, min, max, step = 1, suffix = '', onChange }: { label: string; value: number; min: number; max: number; step?: number; suffix?: string; onChange: (n: number) => void }) {
  return <label className="range-field"><span>{label}<b>{value}{suffix}</b></span><input aria-label={label} type="range" min={min} max={max} step={step} value={value} onChange={e=>onChange(+e.target.value)}/></label>;
}
export function NumberInput({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (n: number) => void }) {
  const [draft,setDraft]=useState(String(value));
  useEffect(()=>setDraft(String(value)),[value]);
  const commit=()=>{const n=draft.trim()===''?value:Number(draft);const next=Number.isFinite(n)?Math.min(max,Math.max(min,n)):value;setDraft(String(next));onChange(next);};
  return <input aria-label={label} type="number" min={min} max={max} value={draft} onChange={e=>{const text=e.target.value;setDraft(text);const n=Number(text);if(text.trim()!==''&&Number.isFinite(n)&&n>=min&&n<=max)onChange(n);}} onBlur={commit} onKeyDown={e=>{if(e.key==='Enter'){commit();e.currentTarget.blur();}}}/>;
}
export function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (b: boolean) => void }) {
  return <label className="toggle-field"><span>{label}</span><input type="checkbox" checked={checked} onChange={e=>onChange(e.target.checked)}/><span className="switch"/></label>;
}
