import { useEffect, useState } from 'react';
import catalog from './fontCatalog.json';
import type { Style } from './types';

export const FONT_CATALOG = catalog;
export const FONT_FAMILIES = catalog.map(font => font.family);
export function fontFiles(style: Style) {
  const families = new Set([style.english.font, ...(style.mode === 'bilingual' ? [style.arabic.font] : []), 'Inter', 'Noto Naskh Arabic']);
  return catalog.filter(font => families.has(font.family)).flatMap(font => font.files);
}
const promises = new Map<string, Promise<void>>();
export function loadCaptionFonts(style: Style) {
  const families = [...new Set([style.english.font, ...(style.mode === 'bilingual' ? [style.arabic.font] : []), 'Inter', 'Noto Naskh Arabic'])];
  return Promise.all(families.map(family => {
    if (!promises.has(family)) {
      promises.set(family, Promise.all([400,700].map(weight => document.fonts.load(`${weight} 48px "${family}"`, 'بِسْمِ اللَّهِ ABC ā ī ū ḥ ṣ ḍ ṭ ʿ ʾ'))).then(results => {
        if (results.some(fonts => !fonts.length)) throw new Error('Could not load caption font: '+family);
      }).catch(error => { promises.delete(family); throw error; }));
    }
    return promises.get(family)!;
  })).then(() => undefined);
}
export function useCaptionFonts(style: Style) {
  const key = [style.english.font, style.mode, style.arabic.font].join('|');
  const [state,setState] = useState({key:'',error:''});
  useEffect(() => {
    let cancelled=false;
    void loadCaptionFonts(style).then(()=>{if(!cancelled)setState({key,error:''});}).catch(error=>{if(!cancelled)setState({key,error:String(error)});});
    return()=>{cancelled=true;};
  },[key]);
  return {ready:state.key===key&&!state.error,error:state.key===key?state.error:''};
}
