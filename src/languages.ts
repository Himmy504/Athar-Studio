import type { Project } from './types';

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
] as const;
export type TranslationLanguage = typeof TRANSLATION_LANGUAGES[number]['code'];
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
    style: { ...p.style, english: { ...p.style.english, font: language.rtl ? 'Noto Naskh Arabic' : 'Inter' } },
  };
}
