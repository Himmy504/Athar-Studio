import { createRequest, snapshot } from './domain';
import { targetLanguage } from './languages';
import type { Project } from './types';

export const PROMPT_LIMITS = [6000, 10000, 16000] as const;
export function batchSourceKey(p: Project) {
  return JSON.stringify({ id:p.id, media:p.media && {path:p.media.path,size:p.media.size,duration:p.media.duration}, clip:p.clip,
    language:targetLanguage(p).code, ids:p.segments.map(s=>s.id) });
}
export function activeTranslationBatch(p: Project) {
  return p.translationBatch?.sourceKey === batchSourceKey(p) ? p.translationBatch : undefined;
}
export function restartTranslationBatches(p: Project): Project {
  return {...p, request:null, translationBatch:{remainingIds:p.segments.map(s=>s.id),completedIds:[],sourceKey:batchSourceKey(p),batchesDone:0}};
}
export function prepareTranslationBatch(p: Project): Project {
  const limit=p.translationPromptLimit??10000;
  if (!PROMPT_LIMITS.includes(limit)) throw new Error('Choose a supported prompt size.');
  let batch=activeTranslationBatch(p);
  if (!batch) {
    const untranslated=p.segments.filter(s=>!s.english.trim());
    batch={remainingIds:(untranslated.length?untranslated:p.segments).map(s=>s.id),completedIds:[],sourceKey:batchSourceKey(p),batchesDone:0};
  }
  if (!batch.remainingIds.length) throw new Error('All batches are imported. Restart batches to translate these captions again.');
  if (p.request && p.request.snapshot===snapshot(p) && p.request.prompt.length<=limit &&
      p.request.segmentIds.every((id,i)=>batch!.remainingIds[i]===id)) return {...p,translationBatch:batch};
  let request:Project['request']=null;
  // Bound both the input length and likely response size. Captions stay intact.
  for (let count=1;count<=Math.min(40,batch.remainingIds.length);count++) {
    const ids=batch.remainingIds.slice(0,count);
    const candidate=createRequest(p,ids);
    const first=p.segments.findIndex(s=>s.id===ids[0]),last=p.segments.findIndex(s=>s.id===ids.at(-1));
    const context=[first>0?{position:'before',arabic:Array.from(p.segments[first-1].arabic).slice(-300).join('')}:null,
      last+1<p.segments.length?{position:'after',arabic:Array.from(p.segments[last+1].arabic).slice(0,300).join('')}:null].filter(Boolean);
    const note=`BATCH ${batch.batchesDone+1}. Return only the IDs in TRANSCRIPT DATA. Neighboring Arabic below is context only: do not return or translate extra rows. Each prompt is self-contained.\nCONTEXT ONLY: ${JSON.stringify(context)}\n\n`;
    candidate.prompt=note+candidate.prompt;
    if (candidate.prompt.length>limit) break;
    request=candidate;
  }
  if (!request) throw new Error('One caption plus the instructions and glossary exceeds this prompt size. Choose a larger prompt size, shorten the glossary, or split that caption. Nothing has been imported.');
  return {...p,request,translationBatch:batch};
}
