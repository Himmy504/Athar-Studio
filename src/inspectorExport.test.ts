import { describe, expect, it } from 'vitest';
import { approve, isApproved, newProject, newSegment, parseProject, snapshot, styleSchema } from './domain';
import { DEFAULT_EXPORT } from './exportSettings';
import { generateAss, generateSrt } from './subtitles';

function fixture() {
  const p=newProject();p.clip={start:0,end:4};
  p.segments=[approve({...newSegment(0,4,'العلم'),english:'Knowledge'})];
  return p;
}
describe('Inspector and export project compatibility',()=>{
  it('opens older projects without changing approved captions',()=>{
    const old=JSON.parse(JSON.stringify(fixture()));delete old.exportSettings;
    for(const lang of ['arabic','english'])for(const key of ['italic','underline','outlineColor','shadowColor'])delete old.style[lang][key];
    const p=parseProject(JSON.stringify(old));expect(p.exportSettings).toEqual(DEFAULT_EXPORT);
    expect(p.style.arabic.italic).toBe(false);expect(p.style.english.outlineColor).toBe('#161910');
    expect(p.segments.every(isApproved)).toBe(true);
  });
  it('roundtrips large typography, effects, and export settings without invalidating review',()=>{
    const p=fixture(),before=snapshot(p),srt=generateSrt(p,'english');
    p.style.arabic={...p.style.arabic,size:300,italic:true,underline:true,outline:16,shadow:20,spacing:20,outlineColor:'#FF0000',shadowColor:'#0000FF'};
    p.exportSettings={resolution:720,fps:24,speed:'quick'};
    const loaded=parseProject(JSON.stringify(p));expect(loaded.style).toEqual(styleSchema.parse(p.style));
    expect(loaded.exportSettings).toEqual(p.exportSettings);expect(snapshot(loaded)).toBe(before);
    expect(loaded.segments.every(isApproved)).toBe(true);expect(generateSrt(loaded,'english')).toBe(srt);
    const arabic=generateAss(loaded).split('\n').find(l=>l.startsWith('Style: Arabic,'))!.slice(7).split(',');
    expect(arabic[2]).toBe('300');expect(arabic.slice(5,11)).toEqual(['&H000000FF','&H80FF0000','0','-1','-1','0']);
    expect(generateAss(loaded)).toContain('PlayResX: 1080'); // Stable composition coordinates at both export resolutions.
  });
  it('rejects unsupported export settings and out-of-range typography',()=>{
    for(const settings of [{resolution:480,fps:30,speed:'balanced'},{resolution:720,fps:0,speed:'balanced'},{resolution:720,fps:30,speed:'shell;command'}]){
      expect(()=>parseProject(JSON.stringify({...fixture(),exportSettings:settings}))).toThrow();
    }
    const p=fixture();p.style.english.size=301;expect(()=>parseProject(JSON.stringify(p))).toThrow();
  });
});
