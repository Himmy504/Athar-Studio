import type { BrandLabel, BrandSettings, CanvasSettings, CaptionOverrides, Project, Segment, Style, PresetScope } from './types';

export const DEFAULT_CANVAS: CanvasSettings = { maxWidth: 86, marginX: 7, marginY: 5, safe: false, titleSafe: false, logoSafe: false, grid: false, center: false, snap: true };
export const canvasSettings = (s: Style) => s.canvas ?? DEFAULT_CANVAS;
function labelDefaults(s: Style, enabled: boolean, anchor: BrandLabel['anchor'], padding: number): BrandLabel {
  return { enabled, anchor, padding, timing: 'all', seconds: 5, font: s.english.font, size: 30, color: '#E9DCB9', bold: false, italic: false, underline: false,
    alignment: 'left', outline: 0, outlineColor: '#161910', shadow: 0, shadowColor: '#000000', spacing: 0, lineHeight: 145, width: 70,
    backgroundEnabled: false, background: '#141820', backgroundOpacity: 86, textPadding: 18, borderColor: '#CDBD8C', borderWidth: 0, cornerRadius: 12 };
}
export function brandSettings(s: Style): BrandSettings {
  const defaults={scholar:labelDefaults(s,s.showScholar,'top-center',125),source:labelDefaults(s,s.showSource,'bottom-center',85),channel:{...labelDefaults(s,true,'top-center',70),size:24,alignment:'center' as const},sourceCard:{...labelDefaults(s,false,'bottom-left',60),size:26,width:82,backgroundEnabled:true,backgroundOpacity:90,textPadding:24,cornerRadius:18,qr:false}};
  if(s.brand)return {...s.brand,scholar:{...defaults.scholar,...s.brand.scholar},source:{...defaults.source,...s.brand.source},channel:{...defaults.channel,...s.brand.channel},sourceCard:{...defaults.sourceCard,...s.brand.sourceCard},logos:s.brand.logos??[]};
  return { ...defaults, logos: s.logoPath ? [{ id: 'legacy', path: s.logoPath, anchor: 'top-right', size: 100, opacity: 100, padding: 60, watermark: false, timing: 'all', seconds: 5 }] : [] };
}
export function effectiveStyle(style: Style, segment: Segment): Style {
  const o = segment.overrides;
  if (!o) return style;
  return { ...style, captionX: o.captionX ?? style.captionX, captionY: o.captionY ?? style.captionY, alignment: o.alignment ?? style.alignment, panel: o.panel ?? style.panel, animation: o.animation ?? style.animation,
    arabic: { ...style.arabic, size: o.arabicSize ?? style.arabic.size }, english: { ...style.english, size: o.englishSize ?? style.english.size } };
}
export function applyScopedStyle(current: Style, preset: Style, scope: PresetScope): Style {
  const copy = structuredClone(preset);
  if (scope === 'composition') return { ...copy, name: 'Custom', canvas: { ...canvasSettings(copy), safe: canvasSettings(current).safe, titleSafe: canvasSettings(current).titleSafe, logoSafe: canvasSettings(current).logoSafe, grid: canvasSettings(current).grid, center: canvasSettings(current).center } };
  if (scope === 'background') return { ...current, name: 'Custom', background: copy.background };
  if (scope === 'brand') return { ...current, name: 'Custom', brand: brandSettings(copy), logoPath: '', showScholar: copy.showScholar, showSource: copy.showSource };
  return { ...current, name: 'Custom', mode: copy.mode, arabic: copy.arabic, english: copy.english, panel: copy.panel, alignment: copy.alignment, captionX: copy.captionX, captionY: copy.captionY, lineGap: copy.lineGap, fade: copy.fade, animation: copy.animation };
}
export function applyOverrides(p: Project, ids: string[], patch: CaptionOverrides, emphasis?: Segment['emphasis']): Project {
  return { ...p, segments: p.segments.map(s => ids.includes(s.id) ? { ...s, overrides: { ...s.overrides, ...structuredClone(patch) }, ...(emphasis ? { emphasis: structuredClone(emphasis).filter(e => s.arabic.includes(e.text) || s.english.includes(e.text)) } : {}) } : s) };
}
export function timeRange(item: { timing: 'all' | 'intro' | 'outro'; seconds: number }, duration: number): [number, number] {
  return item.timing === 'intro' ? [0, Math.min(duration, item.seconds)] : item.timing === 'outro' ? [Math.max(0, duration - item.seconds), duration] : [0, duration];
}
export function snapPosition(value: number, s: Style, axis: 'x' | 'y') {
  const c = canvasSettings(s), margin = axis === 'x' ? c.marginX : c.marginY;
  if (!c.snap) return value;
  const guides = [margin, 50, 100 - margin, ...(c.grid ? [100 / 3, 200 / 3] : []), ...(c.titleSafe ? [10, 90] : [])];
  return Math.round((guides.find(g => Math.abs(g - value) < 2) ?? value) * 10) / 10;
}
