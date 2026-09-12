import { describe, expect, it } from 'vitest';
import { approve, createRequest, importResponse, isApproved, newProject, newSegment, parseProject, snapshot } from './domain';
import { changeTargetLanguage, targetLanguage, TRANSLATION_LANGUAGES } from './languages';
import { EXPORT_FRAME_RATES, exportSettingsSchema } from './exportSettings';
import { generateAss, generateSrt } from './subtitles';
import { fontFiles } from './fonts';

function fixture() {
  const p=newProject(); p.clip={start:0,end:4};
  p.segments=[approve({...newSegment(0,4,'العلم'),english:'Knowledge'})];
  p.glossary=[{arabic:'العلم',english:'Knowledge'}];
  return p;
}
const samples=['Knowledge','Connaissance','Conocimiento','Conhecimento','Wissen','İlim','Pengetahuan','Pengetahuan','Знание','علم ہے','دانش'];
describe('Translation languages',()=>{
  it('preserves legacy English approvals and outstanding prompt snapshots',()=>{
    const p=fixture(); p.request=createRequest(p);
    delete p.targetLanguage;
    const loaded=parseProject(JSON.stringify(p));
    expect(targetLanguage(loaded).code).toBe('en');
    expect(isApproved(loaded.segments[0])).toBe(true);
    expect(loaded.request!.snapshot).toBe(snapshot(loaded));
    expect(changeTargetLanguage(loaded,'en')).toBe(loaded);
  });
  it.each(TRANSLATION_LANGUAGES.map((l,i)=>({...l,sample:samples[i]})))('roundtrips $name through the prompt, review, save and subtitles',({code,name,sample})=>{
    let p=changeTargetLanguage(fixture(),code); p.request=createRequest(p);
    expect(p.request.prompt).toContain('Arabic-to-'+name);
    const response={schemaVersion:code==='en'?1:2,requestId:p.request.id,...(code==='en'?{}:{targetLanguage:code}),segments:[{id:p.segments[0].id,arabic:'العلم',[code==='en'?'english':'translation']:sample,correctionNote:'',uncertain:false}]};
    p=importResponse(p,JSON.stringify(response));
    expect(p.segments[0].english).toBe(sample);
    expect(isApproved(p.segments[0])).toBe(false);
    p.segments=p.segments.map(approve);
    p=parseProject(JSON.stringify(p));
    expect(targetLanguage(p).code).toBe(code);
    expect(isApproved(p.segments[0])).toBe(true);
    expect(generateSrt(p,'english')).toContain(sample);
    expect(generateAss(p)).toContain(sample);
  });
  it('clears translation, glossary equivalents, requests and approvals on a language switch',()=>{
    const p=fixture();p.request=createRequest(p);
    const changed=changeTargetLanguage(p,'ur');
    expect(changed.request).toBeNull(); expect(changed.segments[0].english).toBe('');
    expect(changed.segments[0].approval).toBeNull();expect(changed.glossary[0].english).toBe('');
    expect(changed.segments[0].arabic).toBe(p.segments[0].arabic);
    expect(changed.style.english.font).toBe('Noto Naskh Arabic');
    expect(p.segments[0].english).toBe('Knowledge');
    expect(snapshot(changed)).not.toBe(snapshot(p));
  });
  it('rejects wrong languages, legacy envelopes for new languages and stale responses atomically',()=>{
    const p=changeTargetLanguage(fixture(),'ru');p.request=createRequest(p);
    const before=JSON.stringify(p);
    const response={schemaVersion:2,targetLanguage:'fr',requestId:p.request.id,segments:[{id:p.segments[0].id,arabic:'العلم',translation:'Знание',correctionNote:'',uncertain:false}]};
    expect(()=>importResponse(p,JSON.stringify(response))).toThrow('different target language');
    expect(()=>importResponse(p,JSON.stringify({...response,schemaVersion:1}))).toThrow();
    expect(()=>importResponse({...p,targetLanguage:'de'},JSON.stringify(response))).toThrow('stale');
    expect(JSON.stringify(p)).toBe(before);
  });
  it('bundles Cyrillic fonts for Russian preview and export',()=>{
    const p=changeTargetLanguage(fixture(),'ru');
    expect(fontFiles(p.style)).toContain('inter-cyrillic-400-normal.ttf');
    expect(fontFiles(p.style)).toContain('inter-cyrillic-700-normal.ttf');
  });
});
describe('Lower frame rates',()=>{
  it.each(EXPORT_FRAME_RATES)('persists %i fps without changing approvals or subtitle timing',fps=>{
    const p=fixture(),before=generateSrt(p,'english');
    p.exportSettings={resolution:720,fps,speed:'quick'};
    const loaded=parseProject(JSON.stringify(p));
    expect(loaded.exportSettings!.fps).toBe(fps);
    expect(isApproved(loaded.segments[0])).toBe(true);
    expect(generateSrt(loaded,'english')).toBe(before);
  });
  it.each([0,1,7,60,-5,12.5])('rejects unsupported fps %i',fps=>{
    expect(exportSettingsSchema.safeParse({resolution:720,fps,speed:'quick'}).success).toBe(false);
  });
});
