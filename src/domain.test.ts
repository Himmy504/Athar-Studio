import { describe, expect, it } from 'vitest';
import { applySavedAssets, approve, arabicDifference, createRequest, editSegment, exportErrors, importResponse, isApproved, isCorrected, mergeSegment, newProject, newSegment, parseProject, resolveCorrection, splitSegment } from './domain';
import { escapeAss, generateAss, generateSrt, srtTime } from './subtitles';
import type { Project } from './types';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

function fixture():Project {
  const p=newProject();p.name='QA bilingual clip';p.media={path:path.resolve('test-results/source.wav'),name:'source.wav',duration:12,size:384044,hasVideo:false,width:0,height:0,previewPath:'/qa-audio.wav',waveform:Array.from({length:100},(_,i)=>.2+(i%7)/10)};
  p.clip={start:2,end:8};
  p.segments=[newSegment(0,3,'هذا كتاب'),newSegment(3,6,'هذا قلم')];
  p.request=createRequest(p);
  return p;
}
function response(p:Project){
  return {schemaVersion:1,requestId:p.request!.id,segments:p.segments.map((s,i)=>({id:s.id,arabic:s.arabic,english:i?'This is a pen.':'This is a book.',correctionNote:'',uncertain:false}))};
}
describe('Gemini handoff',()=>{
  it('imports re-ordered segments by stable ID, leaving timings local',()=>{
    const p=fixture(),r=response(p);r.segments.reverse();const result=importResponse(p,JSON.stringify(r));
    expect(result.segments[0].english).toBe('This is a book.');expect(result.segments[1].start).toBe(3);expect(result.request).toBeNull();expect(result.imports).toHaveLength(1);
  });
  it('accepts a fenced JSON block',()=>{
    const p=fixture();const fence=String.fromCharCode(96).repeat(3);
    expect(importResponse(p,fence+'json\n'+JSON.stringify(response(p))+'\n'+fence).segments).toHaveLength(2);
  });
  it('does not apply partial output when JSON is malformed',()=>{
    const p=fixture(),before=JSON.stringify(p);
    expect(()=>importResponse(p,'{"schemaVersion":')).toThrow('not valid JSON');expect(JSON.stringify(p)).toBe(before);
  });
  it.each(['duplicate','missing','unknown','wrong request','extra timestamp'] as const)('rejects %s output atomically',kind=>{
    const p=fixture(),r=response(p),before=JSON.stringify(p);
    if(kind==='duplicate')r.segments[1].id=r.segments[0].id;
    if(kind==='missing')r.segments.pop();
    if(kind==='unknown')r.segments[1].id='foreign';
    if(kind==='wrong request')r.requestId='other';
    if(kind==='extra timestamp')Object.assign(r.segments[0],{start:500});
    expect(()=>importResponse(p,JSON.stringify(r))).toThrow();expect(JSON.stringify(p)).toBe(before);
  });
  it.each(['arabic','timing','clip','glossary','source'] as const)('rejects responses after %s changes',kind=>{
    const p=fixture(),r=response(p);
    if(kind==='arabic')p.segments[0].arabic='نص مختلف';
    if(kind==='timing')p.segments[0].start=.1;
    if(kind==='clip')p.clip.start=1;
    if(kind==='glossary')p.glossary.push({arabic:'العلم',english:'knowledge'});
    if(kind==='source')p.media!.path='another.wav';
    expect(()=>importResponse(p,JSON.stringify(r))).toThrow('stale');
  });
  it('finds a correction even when Gemini omits its explanation',()=>{
    const p=fixture(),r=response(p);r.segments[0].arabic='هذا كتاب جديد';
    const s=importResponse(p,JSON.stringify(r)).segments[0];
    expect(isCorrected(s)).toBe(true);expect(s.correctionResolved).toBe(false);expect(s.originalArabic).toBe('هذا كتاب');expect(s.correctionNote).toContain('without explaining');expect(()=>approve(s)).toThrow();
  });
  it('compares against creator-edited prompt text while preserving the original ASR',()=>{
    const p=fixture();p.segments[0]=editSegment(p.segments[0],{arabic:'هذا كتاب جديد'});p.request=createRequest(p);
    const r=response(p),unchanged=importResponse(p,JSON.stringify(r)).segments[0];
    expect(isCorrected(unchanged)).toBe(false);expect(unchanged.originalArabic).toBe('هذا كتاب');
    r.segments[0].arabic='هذا كتاب قديم';
    const corrected=importResponse(p,JSON.stringify(r)).segments[0];expect(isCorrected(corrected)).toBe(true);
    expect(resolveCorrection(corrected,false).arabic).toBe('هذا كتاب جديد');
  });
  it('requires uncertainty resolution separately from correction approval',()=>{
    const p=fixture(),r=response(p);r.segments[0].uncertain=true;r.segments[0].arabic='هذا كتاب جديد';
    const s=resolveCorrection(importResponse(p,JSON.stringify(r)).segments[0],true);
    expect(()=>approve(s)).toThrow();expect(isApproved(approve({...s,uncertaintyResolved:true}))).toBe(true);
  });
  it('preserves meaningful instructions, glossary, and untrusted transcript delimiters',()=>{
    const p=fixture();p.glossary=[{arabic:'التوحيد',english:'tawhid'}];const request=createRequest(p);
    expect(request.prompt).toContain('NOT the original audio');expect(request.prompt).toContain('negation');expect(request.prompt).toContain('tawhid');expect(request.prompt).toContain('TRANSCRIPT DATA:');
  });
});
describe('review and timing',()=>{
  it('computes correction differences locally without losing diacritics or punctuation',()=>{
    for(const [before,after] of [['هٰذا كتاب.','هٰذا قلم.'],['نص','نص جديد'],['نص جديد','نص'],['','كتاب'],['نص','نص']]){
      const d=arabicDifference(before,after);
      expect(d.prefix+d.removed+d.suffix).toBe(before);expect(d.prefix+d.added+d.suffix).toBe(after);
    }
    expect(arabicDifference('هٰذا كتاب.','هٰذا قلم.').removed).toBe('كتاب');
  });
  function translated(){const p=fixture();return importResponse(p,JSON.stringify(response(p)));}
  it('requires approval of every exact text and timing value',()=>{
    const p=translated();expect(exportErrors(p).join()).toContain('approval');
    p.segments=p.segments.map(approve);expect(exportErrors(p)).toEqual([]);
    p.segments[0]=editSegment(p.segments[0],{end:2.8});expect(isApproved(p.segments[0])).toBe(false);
  });
  it('keeps approvals when changing presentation',()=>{
    const p=translated();p.segments=p.segments.map(approve);p.style.english.color='#DDCC99';p.style.captionY=60;
    expect(exportErrors(p)).toEqual([]);
  });
  it('rejecting a correction restores the transcript and clears approval',()=>{
    const p=fixture(),r=response(p);r.segments[0].arabic='هذا كتاب جديد';
    let s=importResponse(p,JSON.stringify(r)).segments[0];s=approve(resolveCorrection(s,true));s=resolveCorrection(s,false);
    expect(s.arabic).toBe('هذا كتاب');expect(isApproved(s)).toBe(false);
  });
  it('splits Arabic and English at independently chosen boundaries',()=>{
    let p=translated();p.segments=p.segments.map(approve);
    p=splitSegment(p,p.segments[0].id,1.5,3,7);
    expect(p.segments.map(s=>[s.start,s.end])).toEqual([[0,1.5],[1.5,3],[3,6]]);
    expect(p.segments[0].arabic).toBe('هذا');expect(p.segments[1].arabic).toBe('كتاب');expect(isApproved(p.segments[0])).toBe(false);expect(isApproved(p.segments[2])).toBe(true);
  });
  it('merges neighboring segments and requires renewed approval',()=>{
    let p=translated();p.segments=p.segments.map(approve);p=mergeSegment(p,p.segments[0].id);
    expect(p.segments).toHaveLength(1);expect(p.segments[0].end).toBe(6);expect(p.segments[0].english).toBe('This is a book. This is a pen.');expect(isApproved(p.segments[0])).toBe(false);
  });
  it('rejects overlap and out-of-excerpt timing',()=>{
    const p=translated();p.segments=p.segments.map(approve);p.segments[1].start=2;
    expect(exportErrors(p).join()).toContain('overlaps');p.segments[1].end=12;expect(exportErrors(p).join()).toContain('invalid timing');
  });
});
describe('subtitle rendering and storage',()=>{
  it('uses saved asset copies while preserving edits made during a save',()=>{
    const before=fixture();before.style.logoPath='original.png';const saved=structuredClone(before);saved.style.logoPath='project.assets/copied.png';
    const current=structuredClone(before);current.segments[0].english='An edit made while saving';current.style.english.color='#123456';
    const result=applySavedAssets(current,before,saved);
    expect(result.style.logoPath).toBe('project.assets/copied.png');expect(result.style.english.color).toBe('#123456');expect(result.segments[0].english).toBe('An edit made while saving');
  });
  it('does not replace a newly chosen asset or a different project after a save finishes',()=>{
    const before=fixture(),saved=structuredClone(before);saved.style.logoPath='copied.png';
    const current=structuredClone(before);current.style.logoPath='new-choice.png';expect(applySavedAssets(current,before,saved)).toBe(current);
    const different=fixture();expect(applySavedAssets(different,before,saved)).toBe(different);
  });
  it('neutralizes ASS tags in all creator and Gemini text',()=>{
    expect(escapeAss('{\\pos(0,0)}one\\Ntwo\nline')).toBe('｛＼pos(0,0)｝one＼Ntwo\\Nline');
    const p=fixture();p.segments[0].english='{\\p1}drawing';p.metadata.scholar='{\\an7}unsafe';
    const ass=generateAss(p);expect(ass).toContain('｛＼p1｝drawing');expect(ass).toContain('｛＼an7｝unsafe');
  });
  it('uses current reviewed Arabic and never burns review markers',()=>{
    const p=fixture();p.segments[0].arabic='النص المصحح';p.segments[0].correctionNote='DO NOT BURN THIS';
    const ass=generateAss(p);expect(ass).toContain('النص المصحح');expect(ass).not.toContain('DO NOT BURN THIS');expect(ass).not.toContain('AI-corrected');
  });
  it('preserves multiline captions and handles rounding across minute boundaries',()=>{
    expect(srtTime(59.9996)).toBe('00:01:00,000');
    const p=fixture();p.segments[0].english='Line one\nLine two';
    expect(generateSrt(p,'english')).toContain('00:00:00,000 --> 00:00:03,000\nLine one\nLine two');
    expect(generateAss(p)).toContain('Line one\\NLine two');
  });
  it('roundtrips project history, requests and approvals',()=>{
    const p=fixture();expect(parseProject(JSON.stringify(p))).toEqual(p);
    const q=importResponse(p,JSON.stringify(response(p)));q.segments=q.segments.map(approve);
    expect(parseProject(JSON.stringify(q))).toEqual(q);
  });
  it('rejects unsupported project versions and invalid style values',()=>{
    const p=fixture();expect(()=>parseProject(JSON.stringify({...p,schemaVersion:99}))).toThrow();
    p.style.background.dim=500;expect(()=>parseProject(JSON.stringify(p))).toThrow();
  });
  it('writes a synthetic, unattributed integration fixture for browser and native QA',()=>{
    const p=fixture();p.request=null;p.metadata.lecture='Synthetic QA text — not a scholar quotation';
    mkdirSync('test-results',{recursive:true});writeFileSync('test-results/project.athar',JSON.stringify(p,null,2));
    const approved=fixture();const translated=importResponse(approved,JSON.stringify(response(approved)));translated.request=null;translated.segments=translated.segments.map(approve);
    writeFileSync('test-results/approved.athar',JSON.stringify(translated,null,2));writeFileSync('test-results/captions.ass',generateAss(translated));
    for(const ratio of ['1:1','16:9','9:16'] as const){
      const variant=structuredClone(translated);variant.style.ratio=ratio;
      writeFileSync('test-results/captions-'+ratio.replace(':','x')+'.ass',generateAss(variant));
    }
    writeFileSync('test-results/smoke-input.json',JSON.stringify({project:path.resolve('test-results/approved.athar'),ass:path.resolve('test-results/captions.ass'),output:path.resolve('test-results/native-export.mp4')}));
    expect(translated.segments.every(isApproved)).toBe(true);
  });
});
