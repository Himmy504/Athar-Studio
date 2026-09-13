import { describe, expect, it } from 'vitest';
import { approve, applySavedAssets, isApproved, newProject, newSegment, parseProject, presets } from './domain';
import { applyOverrides, applyScopedStyle, brandSettings, DEFAULT_CANVAS, effectiveStyle, snapPosition, timeRange } from './inspectorModel';
import { fitCaptionsSafely, panelLayout } from './captionLayout';
import { dimensions, generateAss, generateSrt } from './subtitles';
import { anchorBox, sourceQr } from './brandRender';
import { createPanel } from './panelPresets';

function fixture(){const p=newProject();p.clip={start:0,end:12};p.metadata={scholar:'Scholar',lecture:'Source lecture',source:'https://example.com/lecture',channel:'Channel'};p.segments=[approve({...newSegment(0,6,'هذا كتاب'),english:'This is a book.'}),approve({...newSegment(6,12,'هذا قلم'),english:'This is a pen.'})];return p;}
describe('Inspector customization',()=>{
  it('keeps legacy layout and label settings until a new control is used',()=>{const p=fixture(),old=generateAss(p);const opened=parseProject(JSON.stringify(p));expect(generateAss(opened)).toBe(old);expect(brandSettings(opened.style).scholar.enabled).toBe(true);expect(brandSettings(opened.style).source.enabled).toBe(false);});
  it('applies each gallery category without touching unrelated properties',()=>{
    const p=fixture();p.style.logoPath='logo.png';p.style.ratio='16:9';p.style.background.path='scene.png';
    const caption=applyScopedStyle(p.style,presets.Quote,'caption');expect(caption.background).toEqual(p.style.background);expect(caption.logoPath).toBe('logo.png');expect(caption.ratio).toBe('16:9');
    const bg=applyScopedStyle(p.style,presets.Bold,'background');expect(bg.arabic).toEqual(p.style.arabic);expect(bg.logoPath).toBe('logo.png');
    const brand=applyScopedStyle(p.style,presets.Bold,'brand');expect(brand.background).toEqual(p.style.background);expect(brand.english).toEqual(p.style.english);
  });
  it('roundtrips canvas, branding, logos and overrides without invalidating review or subtitles',()=>{
    let p=fixture();const srt=generateSrt(p,'english');p.style.canvas={...DEFAULT_CANVAS,safe:true};p.style.brand=brandSettings(p.style);p.style.brand.sourceCard.qr=true;
    p.style.brand.logos=[{id:'one',path:'logo.png',anchor:'bottom-left',opacity:40,size:90,padding:45,timing:'outro',seconds:4,watermark:true}];
    p=applyOverrides(p,p.segments.map(s=>s.id),{englishSize:80,captionY:30,animation:'slide',panel:createPanel('gold')});
    const opened=parseProject(JSON.stringify(p));expect(opened).toEqual(p);expect(opened.segments.every(isApproved)).toBe(true);expect(generateSrt(opened,'english')).toBe(srt);
    const ass=generateAss(opened);expect(ass).toContain('\\move(');expect(ass).toContain('\\fs');expect(ass).not.toContain('Safe area');
  });
  it('does not change unselected captions and keeps other override properties inherited',()=>{
    const p=fixture(),next=applyOverrides(p,[p.segments[0].id],{englishSize:120});expect(next.segments[1]).toEqual(p.segments[1]);
    next.style.captionY=42;next.style.english.color='#123456';const effective=effectiveStyle(next.style,next.segments[0]);expect(effective.captionY).toBe(42);expect(effective.english.color).toBe('#123456');expect(effective.english.size).toBe(120);
  });
  it.each(['9:16','1:1','16:9'] as const)('fits large captions inside %s margins while preserving exact text',ratio=>{
    const p=fixture();p.style.ratio=ratio;p.style.canvas={...DEFAULT_CANVAS,marginX:15,marginY:15};p.style.panel=createPanel('gold');p.style.english.size=240;p.style.arabic.size=200;
    p.segments[0].english='A long sentence with many words for wrapping and fitting inside the safe caption rectangle.';
    const before=generateSrt(p,'english'),result=fitCaptionsSafely(p);expect(result.remaining).toBe(0);expect(generateSrt(result.project,'english')).toBe(before);
    const [w,h]=dimensions(ratio);for(const seg of result.project.segments){const box=panelLayout(effectiveStyle(result.project.style,seg),seg,w,h);expect(box.x).toBeGreaterThanOrEqual(w*.15);expect(box.top).toBeGreaterThanOrEqual(h*.15);expect(box.top+box.height).toBeLessThanOrEqual(h*.85+1);}
  });
  it('snaps only near enabled guides',()=>{const s={...fixture().style,canvas:{...DEFAULT_CANVAS,grid:true}};expect(snapPosition(49,s,'x')).toBe(50);expect(snapPosition(34,s,'x')).toBe(33.3);expect(snapPosition(42,s,'x')).toBe(42);s.canvas.snap=false;expect(snapPosition(49,s,'x')).toBe(49);});
  it('renders independent labels and source cards only during their chosen window',()=>{
    const p=fixture();p.style.brand=brandSettings(p.style);p.style.brand.channel.enabled=false;p.style.brand.scholar.timing='intro';p.style.brand.scholar.seconds=3;p.style.brand.sourceCard={...p.style.brand.sourceCard,enabled:true,qr:true,timing:'outro',seconds:4};
    const ass=generateAss(p);expect(ass).not.toContain('Channel');expect(ass).toContain('0:00:00.00,0:00:03.00,Label');expect(ass).toContain('0:00:08.00,0:00:12.00,Label');expect(ass).toContain('Dialogue: 5,');
    expect(sourceQr(p.metadata.source)?.getModuleCount()).toBeGreaterThan(20);expect(sourceQr('javascript:bad')).toBeNull();
  });
  it('renders brand typography, alignment, spacing, outline, shadow and rounded background cards',()=>{
    const p=fixture();p.style.brand=brandSettings(p.style);p.style.brand.scholar={...p.style.brand.scholar,backgroundEnabled:true,backgroundOpacity:72,background:'#102030',borderColor:'#D0B060',borderWidth:2,cornerRadius:18,textPadding:26,width:55,alignment:'right',bold:true,italic:true,underline:true,outline:2,outlineColor:'#111111',shadow:3,shadowColor:'#222222',spacing:4,lineHeight:170};
    const ass=generateAss(p);expect(ass).toContain('\\an9');expect(ass).toContain('\\b1\\i1\\u1\\bord2');expect(ass).toContain('\\shad3');expect(ass).toContain('\\fsp4');expect(ass).toContain('\\p1\\shad0\\bord2');expect(ass).toContain(' b ');
  });
  it('fills new brand text defaults when opening an earlier brand configuration',()=>{
    const p=fixture();p.style.brand=brandSettings(p.style);const oldLabel=p.style.brand.scholar as unknown as Record<string,unknown>;
    for(const key of ['bold','italic','underline','alignment','outline','outlineColor','shadow','shadowColor','spacing','lineHeight','width','backgroundEnabled','textPadding','borderColor','borderWidth','cornerRadius'])delete oldLabel[key];
    const opened=parseProject(JSON.stringify(p));expect(opened.style.brand?.scholar).toMatchObject({bold:false,alignment:'left',lineHeight:145,width:70,backgroundEnabled:false,textPadding:18,cornerRadius:12});
  });
  it('clamps brand timing and maps anchors consistently',()=>{expect(timeRange({timing:'intro',seconds:20},12)).toEqual([0,12]);expect(timeRange({timing:'outro',seconds:3},12)).toEqual([9,12]);expect(anchorBox('bottom-right',60,100,100,1080,1920)).toEqual({x:920,y:1760});expect(anchorBox('middle-center',60,100,100,1080,1920)).toEqual({x:490,y:910});});
  it('updates copied logo paths without overwriting a logo edited during save',()=>{
    const before=fixture();before.style.brand=brandSettings(before.style);before.style.brand.logos=[{id:'one',path:'before.png',anchor:'top-right',size:100,opacity:100,padding:60,timing:'all',seconds:5,watermark:false}];
    const saved=structuredClone(before);saved.style.brand!.logos[0].path='assets/copied.png';expect(applySavedAssets(before,before,saved).style.brand!.logos[0].path).toBe('assets/copied.png');
    const current=structuredClone(before);current.style.brand!.logos[0].path='new.png';expect(applySavedAssets(current,before,saved).style.brand!.logos[0].path).toBe('new.png');
  });
  it('rejects invalid positions, brand fonts, and override ranges',()=>{const p=fixture();p.style.brand=brandSettings(p.style);p.style.brand.channel.font='Invalid font';expect(()=>parseProject(JSON.stringify(p))).toThrow();delete p.style.brand;p.segments[0].overrides={englishSize:1000};expect(()=>parseProject(JSON.stringify(p))).toThrow();});
});
