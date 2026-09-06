import { describe, expect, it } from 'vitest';
import { approve, isApproved, newProject, newSegment, parseProject, snapshot } from './domain';
import { captionBounds, zoomWindow } from './playback';
import { wrapCaption } from './captionLayout';
import { createPanel, PANEL_PRESETS } from './panelPresets';
import { captionWarnings, generateAss, generateSrt } from './subtitles';
import catalog from './fontCatalog.json';
import { assFontSize, cssFontSize } from './fontSizing';

function project(){
  const p=newProject();p.clip={start:10,end:16};
  p.segments=[approve({...newSegment(0,3,'هذا كتاب'),english:'This is a book.'}),approve({...newSegment(3,6,'هذا قلم'),english:'This is a pen.'})];
  return p;
}
describe('review boundaries and waveform navigation',()=>{
  it('keeps caption playback excerpt-relative, including the last caption',()=>{
    const p=project();expect(captionBounds(p,p.segments[1].id)).toEqual({start:3,end:6});
    expect(captionBounds(p,'removed')).toBeNull();p.segments[1].end=7;expect(captionBounds(p,p.segments[1].id)).toBeNull();
  });
  it('disables looping when an edited caption has invalid timing',()=>{
    const p=project();p.segments[0].start=4;expect(captionBounds(p,p.segments[0].id)).toBeNull();
    p.segments[0].start=Number.NaN;expect(captionBounds(p,p.segments[0].id)).toBeNull();
  });
  it('clamps zoom and pan to the source without changing excerpt timing',()=>{
    expect(zoomWindow(3600,1,400)).toEqual({start:0,end:3600,span:3600});
    expect(zoomWindow(60,4,0)).toEqual({start:0,end:15,span:15});
    expect(zoomWindow(60,4,60)).toEqual({start:45,end:60,span:15});
    expect(zoomWindow(.5,128,0)).toEqual({start:0,end:.5,span:.5});
  });
});
describe('font and caption panel projects',()=>{
  it('preserves default font sizes and normalizes other font families to the same em size',()=>{
    const p=project();expect(assFontSize(p.style.arabic,'arabic')).toBe(p.style.arabic.size);
    expect(assFontSize(p.style.english,'english')).toBe(p.style.english.size);
    const amiri={...p.style.arabic,font:'Amiri'};
    expect(cssFontSize(amiri,'arabic')).toBe(cssFontSize(p.style.arabic,'arabic'));
    expect(assFontSize(amiri,'arabic')).toBeGreaterThan(amiri.size);
  });
  it('opens older projects with panels disabled and approvals preserved',()=>{
    const p=project(),old=JSON.parse(JSON.stringify(p));delete old.style.panel;
    const reopened=parseProject(JSON.stringify(old));expect(reopened.style.panel.preset).toBe('none');expect(reopened.segments.every(isApproved)).toBe(true);
  });
  it('accepts every bundled font and rejects font-name injection',()=>{
    const p=project();for(const font of catalog){p.style.arabic.font=font.family;expect(parseProject(JSON.stringify(p)).style.arabic.font).toBe(font.family);}
    p.style.arabic.font='Injected\nDialogue: 0';expect(()=>parseProject(JSON.stringify(p))).toThrow();
  });
  it('changes panel presentation without changing translation snapshots, SRT, or approvals',()=>{
    const p=project(),before=snapshot(p),srt=generateSrt(p,'english');
    for(const preset of Object.keys(PANEL_PRESETS) as (keyof typeof PANEL_PRESETS)[]){p.style.panel=createPanel(preset);expect(snapshot(p)).toBe(before);expect(generateSrt(p,'english')).toBe(srt);expect(p.segments.every(isApproved)).toBe(true);}
  });
  it('draws panels beneath captions and keeps returned markup as text',()=>{
    const p=project();p.style.panel=createPanel('azure');p.segments[0].english='{\\p1}unsafe';
    const ass=generateAss(p);expect(ass).toContain('Dialogue: 0,');expect(ass).toContain('Dialogue: 1,');expect(ass).toContain('｛＼p1｝unsafe');
    expect(ass).not.toContain('AI-corrected Arabic');
  });
  it('warns about text too tall to fit a panel',()=>{
    const p=project();p.style.ratio='16:9';p.style.panel=createPanel('paper');p.segments[0].english=Array.from({length:35},()=> 'A separate caption line.').join('\n');
    expect(captionWarnings(p).some(w=>w.includes('too tall'))).toBe(true);
  });
});
describe('caption line wrapping',()=>{
  it('retains manual breaks, punctuation, and original text offsets',()=>{
    const text='First line.\nSecond line, with more words.';
    const rows=wrapCaption(text,13,t=>t.length);expect(rows.map(row=>row.text)).toEqual(['First line.','Second line,','with more','words.']);
    for(const row of rows)expect(text.slice(row.start,row.end)).toBe(row.text);
  });
  it('keeps Arabic diacritics attached when breaking an oversized word',()=>{
    const text='بِسْمِ';const rows=wrapCaption(text,1,t=>[...new Intl.Segmenter('ar',{granularity:'grapheme'}).segment(t)].length);
    expect(rows.map(row=>row.text)).toEqual(['بِ','سْ','مِ']);expect(rows.map(row=>row.text).join('')).toBe(text);
  });
  it('keeps phrase emphasis when panel wrapping breaks the phrase across lines',()=>{
    const p=project();p.style.panel=createPanel('solid');p.style.panel.width=50;p.style.english.size=100;
    p.segments[0].english='Knowledge brings benefit';p.segments[0].emphasis=[{text:'Knowledge brings benefit',color:'#FF8800',bold:true}];
    const ass=generateAss(p);expect((ass.match(/\\c&H000088FF/g)??[]).length).toBeGreaterThan(1);
  });
});
