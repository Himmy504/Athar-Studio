import type { Project } from './types';
import catalog from './fontCatalog.json';

export const TRANSLATION_LANGUAGES = [
  { code: 'en', name: 'English', rtl: false },
  { code: 'fr', name: 'French', rtl: false },
  { code: 'es', name: 'Spanish', rtl: false },
  { code: 'pt', name: 'Portuguese', rtl: false },
  { code: 'de', name: 'German', rtl: false },
  { code: 'tr', name: 'Turkish', rtl: false },
  { code: 'id', name: 'Indonesian', rtl: false },
  { code: 'ms', name: 'Malay', rtl: false },
  { code: 'ru', name: 'Russian', rtl: false },
  { code: 'ur', name: 'Urdu', rtl: true },
  { code: 'fa', name: 'Persian', rtl: true },
  { code: 'nl', name: 'Dutch', rtl: false },
  { code: 'it', name: 'Italian', rtl: false },
  { code: 'pl', name: 'Polish', rtl: false },
  { code: 'sv', name: 'Swedish', rtl: false },
  { code: 'sw', name: 'Swahili', rtl: false },
  { code: 'hi', name: 'Hindi', rtl: false },
  { code: 'bn', name: 'Bengali', rtl: false },
  { code: 'ta', name: 'Tamil', rtl: false },
] as const;
export type TranslationLanguage = typeof TRANSLATION_LANGUAGES[number]['code'];
export const LANGUAGE_CODES = TRANSLATION_LANGUAGES.map(l => l.code) as [TranslationLanguage, ...TranslationLanguage[]];
export function languageFonts(code: TranslationLanguage | 'ar') {
  const script = code === 'hi' ? 'devanagari' : code === 'bn' ? 'bengali' : code === 'ta' ? 'tamil' : ['ar','ur','fa'].includes(code) ? 'arabic' : 'english';
  return catalog.filter(font => font.language === script && (code !== 'ru' || font.files.some(f => f.includes('-cyrillic-'))));
}
export function defaultLanguageFont(code: TranslationLanguage) {
  return code === 'hi' ? 'Noto Sans Devanagari' : code === 'bn' ? 'Noto Sans Bengali' : code === 'ta' ? 'Noto Sans Tamil' : ['ur','fa'].includes(code) ? 'Noto Naskh Arabic' : 'Inter';
}
export function targetLanguage(p: Pick<Project, 'targetLanguage'>) {
  return TRANSLATION_LANGUAGES.find(l => l.code === p.targetLanguage) ?? TRANSLATION_LANGUAGES[0];
}
export function changeTargetLanguage(p: Project, code: TranslationLanguage): Project {
  const language = TRANSLATION_LANGUAGES.find(l => l.code === code);
  if (!language) throw new Error('Choose a supported translation language.');
  if (targetLanguage(p).code === code) return p;
  return { ...p, targetLanguage: code, request: null, translationBatch: undefined,
    glossary: p.glossary.map(g => ({ ...g, english: '' })),
    segments: p.segments.map(s => ({ ...s, english: '', approval: null, emphasis: [] })),
    style: { ...p.style, english: { ...p.style.english, font: defaultLanguageFont(code) } },
  };
}
