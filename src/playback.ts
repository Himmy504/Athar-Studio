import type { Project, Segment } from './types';

export const PLAYBACK_RATES = [0.5, 0.75, 1, 1.25, 1.5, 2] as const;
export function captionBounds(project: Project, id: string | null) {
  const s = project.segments.find(segment => segment.id === id);
  const duration = project.clip.end - project.clip.start;
  return s && Number.isFinite(s.start) && Number.isFinite(s.end) && s.start >= 0 && s.end > s.start && s.end <= duration + .01
    ? { start: s.start, end: Math.min(s.end, duration) } : null;
}
export function captionAt(segments: Segment[], time: number) {
  return segments.find(s => time >= s.start && time < s.end) ?? segments.find(s => s.start >= time) ?? segments.at(-1);
}
export function zoomWindow(duration: number, zoom: number, center: number) {
  const span = Math.min(duration, Math.max(Math.min(1, duration), duration / Math.max(1, zoom)));
  const start = Math.max(0, Math.min(duration - span, center - span / 2));
  return { start, end: start + span, span };
}
