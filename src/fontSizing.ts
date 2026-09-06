import catalog from './fontCatalog.json';
import type { Typography } from './types';

type Language = 'arabic' | 'english';
export function assFontFamily(family:string) {
  return catalog.find(font=>font.family===family)?.assFamily??family;
}
export function fontMetrics(type: Typography) {
  const font=catalog.find(font=>font.family===type.font)??catalog[0];
  return font.metrics[type.bold?'bold':'regular'];
}
export function cssFontSize(type:Typography,language:Language) {
  const reference=fontMetrics({...type,font:language==='arabic'?'Noto Naskh Arabic':'Inter'});
  // ASS uses Windows ascent + descent; CSS sizes the em square. Preserve the
  // existing default fonts' size and normalize other families to that scale.
  return type.size*reference.units/(reference.ascent+reference.descent);
}
export function assFontSize(type:Typography,language:Language) {
  const m=fontMetrics(type);
  return Math.round(cssFontSize(type,language)*(m.ascent+m.descent)/m.units*100)/100;
}
