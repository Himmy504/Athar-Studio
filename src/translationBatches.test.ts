import { describe, expect, it } from 'vitest';
import { approve, editSegment, importResponse, newProject, newSegment, parseProject } from './domain';
import { activeTranslationBatch, prepareTranslationBatch, restartTranslationBatches } from './translationBatches';
import { changeTargetLanguage, TRANSLATION_LANGUAGES } from './languages';
import type { Project } from './types';

function fixture(count=95) {
  const p=newProject();p.clip={start:0,end:count};
  p.segments=Array.from({length:count},(_,i)=>newSegment(i,i+1,'هذا كتاب مفيد '.repeat(8).trim()));
  return p;
}
function response(p:Project) {
  return JSON.stringify({schemaVersion:p.targetLanguage==='en'?1:2,requestId:p.request!.id,
    ...(p.targetLanguage==='en'?{}:{targetLanguage:p.targetLanguage}),
    segments:[...p.request!.segmentIds].reverse().map(id=>({id,arabic:p.segments.find(s=>s.id===id)!.arabic,
      [p.targetLanguage==='en'?'english':'translation']:'Translated text',correctionNote:'',uncertain:false}))});
}
describe('Sequential translation batches',()=>{
  it.each(TRANSLATION_LANGUAGES)('completes every caption in $name without overwriting earlier batches',({code})=>{
    let p=changeTargetLanguage(fixture(),code);const seen=new Set<string>();
    while (!activeTranslationBatch(p)||activeTranslationBatch(p)!.remainingIds.length) {
      const earlier=p.segments.filter(s=>seen.has(s.id));
      p=prepareTranslationBatch(p);
      expect(p.request!.prompt.length).toBeLessThanOrEqual(10000);
      expect(p.request!.segmentIds.length).toBeLessThanOrEqual(40);
      for(const id of p.request!.segmentIds){expect(seen.has(id)).toBe(false);seen.add(id);}
      p=importResponse(p,response(p));
      for(const s of earlier)expect(p.segments.find(v=>v.id===s.id)).toEqual(s);
      p.segments=p.segments.map(s=>s.english?approve(s):s);
      p=parseProject(JSON.stringify(p));
    }
    expect(seen.size).toBe(95);expect(p.translationBatch!.batchesDone).toBeGreaterThan(1);
    expect(()=>prepareTranslationBatch(p)).toThrow('All batches');
  });
  it('resumes an outstanding request after reopening and reuses it on copy',()=>{
    const p=prepareTranslationBatch(fixture());
    expect(prepareTranslationBatch(parseProject(JSON.stringify(p))).request).toEqual(p.request);
  });
  it('rejects missing, duplicate, unknown and previous-batch output without partial changes',()=>{
    const p=prepareTranslationBatch(fixture());const raw=response(p),value=JSON.parse(raw);
    for(const segments of [value.segments.slice(1),[...value.segments,value.segments[0]],[{...value.segments[0],id:'unknown'},...value.segments.slice(1)]]){
      const before=JSON.stringify(p);expect(()=>importResponse(p,JSON.stringify({...value,segments}))).toThrow();expect(JSON.stringify(p)).toBe(before);
    }
    const next=prepareTranslationBatch(importResponse(p,raw));
    expect(()=>importResponse(next,raw)).toThrow('different prompt');
  });
  it('keeps correction and uncertainty decisions local to the imported batch',()=>{
    const p=prepareTranslationBatch(fixture()),value=JSON.parse(response(p));
    const id=value.segments[0].id;value.segments[0].arabic='هذا كتاب جديد';value.segments[0].uncertain=true;
    const next=importResponse(p,JSON.stringify(value)),segment=next.segments.find(s=>s.id===id)!;
    expect(segment.correctionResolved).toBe(false);expect(segment.uncertaintyResolved).toBe(false);
    expect(()=>approve(segment)).toThrow();
    expect(next.segments.at(-1)).toEqual(p.segments.at(-1));
    expect(prepareTranslationBatch(next).request!.segmentIds).not.toContain(id);
  });
  it('refreshes stale prompts after edits and preserves progress when reducing the size',()=>{
    let p=prepareTranslationBatch(fixture());p=importResponse(p,response(p));
    p=prepareTranslationBatch(p);const old=response(p);
    const id=p.request!.segmentIds[0];p.segments=p.segments.map(s=>s.id===id?editSegment(s,{arabic:s.arabic+' جديد'}):s);
    expect(()=>importResponse(p,old)).toThrow('stale');
    p.translationPromptLimit=6000;
    const next=prepareTranslationBatch(p);expect(next.request!.prompt.length).toBeLessThanOrEqual(6000);
    expect(next.request!.id).not.toBe(p.request!.id);expect(next.translationBatch!.completedIds).toEqual(p.translationBatch!.completedIds);
  });
  it('starts with untranslated rows and supports explicit retranslation without clearing existing text',()=>{
    const p=fixture(4);p.segments[0]=approve({...p.segments[0],english:'Keep this'});
    const next=prepareTranslationBatch(p);expect(next.request!.segmentIds).not.toContain(p.segments[0].id);
    const restart=prepareTranslationBatch(restartTranslationBatches(next));
    expect(restart.request!.segmentIds).toContain(p.segments[0].id);expect(restart.segments[0]).toEqual(p.segments[0]);
  });
  it('invalidates progress when the source language or caption structure changes',()=>{
    let p=prepareTranslationBatch(fixture());p=importResponse(p,response(p));
    expect(activeTranslationBatch(changeTargetLanguage(p,'fr'))).toBeUndefined();
    expect(activeTranslationBatch(changeTargetLanguage(changeTargetLanguage(p,'fr'),'en'))).toBeUndefined();
    expect(activeTranslationBatch({...p,clip:{start:1,end:95}})).toBeUndefined();
    expect(activeTranslationBatch({...p,segments:[...p.segments,newSegment(95,96,'كتاب')]})).toBeUndefined();
  });
  it('does not truncate an oversized caption or glossary',()=>{
    const p=fixture(1);p.translationPromptLimit=6000;p.segments[0].arabic='علم '.repeat(5000);
    const before=JSON.stringify(p);expect(()=>prepareTranslationBatch(p)).toThrow('split that caption');expect(JSON.stringify(p)).toBe(before);
    p.segments[0].arabic='علم';p.glossary=[{arabic:'علم',english:'term'.repeat(5000)}];
    expect(()=>prepareTranslationBatch(p)).toThrow('glossary');
  });
});
