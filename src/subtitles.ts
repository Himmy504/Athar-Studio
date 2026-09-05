import type { Project, Segment, Style, Typography } from './types';

export function dimensions(ratio: Style['ratio']): [number, number] {
  return ratio === '16:9' ? [1920, 1080] : ratio === '1:1' ? [1080, 1080] : [1080, 1920];
}
export function escapeAss(text: string) {
  return text.replace(/\\/g, '＼').replace(/\{/g, '｛').replace(/\}/g, '｝').replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008\u000B-\u001F]/g, '').replace(/\n/g, '\\N');
}
export function assColor(hex: string) {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) return '&H00FFFFFF';
  return '&H00' + hex.slice(5, 7) + hex.slice(3, 5) + hex.slice(1, 3);
}
function assTime(sec: number) {
  const cs = Math.round(Math.max(0, sec) * 100);
  return Math.floor(cs / 360000) + ':' + String(Math.floor(cs / 6000) % 60).padStart(2, '0') + ':' + String(Math.floor(cs / 100) % 60).padStart(2, '0') + '.' + String(cs % 100).padStart(2, '0');
}
export function srtTime(sec: number) {
  const ms = Math.round(Math.max(0, sec) * 1000);
  return String(Math.floor(ms / 3600000)).padStart(2, '0') + ':' + String(Math.floor(ms / 60000) % 60).padStart(2, '0') + ':' + String(Math.floor(ms / 1000) % 60).padStart(2, '0') + ',' + String(ms % 1000).padStart(3, '0');
}
export function generateSrt(project: Project, lang: 'arabic' | 'english') {
  return project.segments.map((s, i) => (i + 1) + '\n' + srtTime(s.start) + ' --> ' + srtTime(s.end) + '\n' +
    s[lang].replace(/</g, '＜').replace(/>/g, '＞').replace(/\r\n?/g, '\n').replace(/\n{2,}/g, '\n').trim()).join('\n\n') + '\n';
}
function styledText(s: Segment, lang: 'arabic' | 'english', typography: Typography) {
  const text = s[lang];
  const highlights = s.emphasis.filter(e => e.text.trim()).sort((a, b) => b.text.length - a.text.length);
  let result = '', position = 0;
  while (position < text.length) {
    const match = highlights.find(e => text.startsWith(e.text, position));
    if (match) {
      result += '{\\c' + assColor(match.color) + '\\b' + (match.bold ? '1' : typography.bold ? '1' : '0') + '}' +
        escapeAss(match.text) + '{\\c' + assColor(typography.color) + '\\b' + (typography.bold ? '1' : '0') + '}';
      position += match.text.length;
    } else {
      const next = String.fromCodePoint(text.codePointAt(position)!);
      result += escapeAss(next); position += next.length;
    }
  }
  return result;
}
export function generateAss(p: Project) {
  const st = p.style, [w, h] = dimensions(st.ratio);
  const alignment = st.alignment === 'left' ? 1 : st.alignment === 'right' ? 3 : 2;
  const x = alignment === 1 ? 80 : alignment === 3 ? w - 80 : w / 2;
  const y = Math.round(h * st.captionY / 100);
  const style = (name: string, t: Typography) => 'Style: ' + [name, t.font.replace(/,/g, ''), t.size, assColor(t.color), assColor(t.color), '&H00101916', '&H80000000', t.bold ? -1 : 0, 0, 0, 0, 100, 100, t.spacing, 0, 1, t.outline, t.shadow, 2, 80, 80, 80, 1].join(',');
  const header = [
    '[Script Info]', 'ScriptType: v4.00+', 'PlayResX: ' + w, 'PlayResY: ' + h, 'WrapStyle: 0', 'ScaledBorderAndShadow: yes', '',
    '[V4+ Styles]', 'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
    style('English', st.english), style('Arabic', st.arabic),
    style('Label', { ...st.english, size: 30, color: '#E9DCB9', bold: false, outline: 1, spacing: 1 }), '',
    '[Events]', 'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
  ];
  const line = (start: number, end: number, name: string, text: string) => 'Dialogue: 0,' + assTime(start) + ',' + assTime(end) + ',' + name + ',,0,0,0,,' + text;
  p.segments.forEach(s => {
    const fade = st.fade ? '\\fad(' + Math.min(140, Math.floor((s.end - s.start) * 200)) + ',100)' : '';
    if (st.mode === 'bilingual') header.push(line(s.start, s.end, 'Arabic', '{\\an' + alignment + '\\pos(' + x + ',' + (y - st.lineGap) + ')' + fade + '}' + styledText(s, 'arabic', st.arabic)));
    header.push(line(s.start, s.end, 'English', '{\\an' + (alignment + 6) + '\\pos(' + x + ',' + y + ')' + fade + '}' + styledText(s, 'english', st.english)));
  });
  const end = Math.max(0, p.clip.end - p.clip.start);
  if (st.showScholar && p.metadata.scholar) header.push(line(0, end, 'Label', '{\\an8\\pos(' + (w / 2) + ',125)}' + escapeAss(p.metadata.scholar)));
  if (st.showSource && (p.metadata.lecture || p.metadata.source)) header.push(line(0, end, 'Label', '{\\an2\\pos(' + (w / 2) + ',' + (h - 85) + ')}' + escapeAss(p.metadata.lecture || p.metadata.source)));
  if (p.metadata.channel) header.push(line(0, end, 'Label', '{\\an8\\fs24\\pos(' + (w / 2) + ',70)}' + escapeAss(p.metadata.channel)));
  return header.join('\n') + '\n';
}
export function captionWarnings(p: Project): string[] {
  const [w, h] = dimensions(p.style.ratio);
  return p.segments.flatMap((s, i) => {
    const lines = s.english.split('\n').reduce((n, l) => n + Math.max(1, Math.ceil(l.length * p.style.english.size * .55 / (w - 160))), 0);
    const duration = s.end - s.start;
    const warnings = [];
    if (lines * p.style.english.size * 1.35 + h * p.style.captionY / 100 > h - 100) warnings.push('Caption ' + (i + 1) + ' may extend beyond the safe area. Split it or reduce the text size.');
    if (s.english.length / duration > 23) warnings.push('Caption ' + (i + 1) + ' may read too quickly. Review its timing or split the phrase.');
    return warnings;
  });
}
