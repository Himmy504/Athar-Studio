import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { captionAt, captionBounds, PLAYBACK_RATES } from './playback';
import type { Project } from './types';

export function useReviewPlayback(project: Project, player: RefObject<HTMLVideoElement | null>, setTime: (time: number) => void, notify: (message: string) => void, busy: boolean) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [looping, setLooping] = useState(false), [playing, setPlaying] = useState(false), [reviewMode, setReviewMode] = useState(false);
  const [rate, setRate] = useState(() => {
    const saved = Number(localStorage.getItem('athar-playback-rate') ?? 1);
    return PLAYBACK_RATES.includes(saved as 1) ? saved : 1;
  });
  const latest = useRef({ project, selectedId, looping, reviewMode, busy });
  latest.current = { project, selectedId, looping, reviewMode, busy };
  const play = useCallback(() => {
    if (!latest.current.busy) void player.current?.play().catch(error => {
      if(error instanceof DOMException&&error.name==='AbortError')return;
      notify('Source playback failed. Relink the source or reopen the project.');
    });
  }, [player, notify]);
  const activate = useCallback((id: string, startPlaying = false) => {
    const state = latest.current, bounds = captionBounds(state.project, id);
    if(state.selectedId===id&&!startPlaying)return;
    setSelectedId(id); latest.current.selectedId = id;
    if (!bounds) { if(startPlaying)notify('Set valid caption timings before playing this row.');setLooping(false);setReviewMode(false);return; }
    if (startPlaying || state.looping) {
      setReviewMode(true); latest.current.reviewMode = true;
      if (player.current) player.current.currentTime = state.project.clip.start + bounds.start;
      setTime(bounds.start);
      if (startPlaying) play();
    }
  }, [notify, play, player, setTime]);
  const seek = useCallback((relative: number) => {
    const state = latest.current, duration = Math.max(0, state.project.clip.end - state.project.clip.start);
    const value = Math.max(0, Math.min(duration, relative)), bounds = captionBounds(state.project, state.selectedId);
    if (!state.looping || !bounds || value < bounds.start || value >= bounds.end) {
      setLooping(false); setReviewMode(false); latest.current.looping = false; latest.current.reviewMode = false;
    }
    if (player.current) player.current.currentTime = state.project.clip.start + value;
    setTime(value);
  }, [player, setTime]);
  const toggle = useCallback(() => {
    const v = player.current, state = latest.current;
    if (!v || !state.project.media || state.busy) return;
    if (!v.paused) { v.pause(); return; }
    const bounds = (state.looping || state.reviewMode) && captionBounds(state.project, state.selectedId);
    const start = state.project.clip.start + (bounds ? bounds.start : 0), end = bounds ? state.project.clip.start + bounds.end : state.project.clip.end;
    if (v.currentTime < start || v.currentTime >= end - .005) v.currentTime = start;
    play();
  }, [play, player]);
  const replay = useCallback(() => {
    const state = latest.current, relative = (player.current?.currentTime ?? state.project.clip.start) - state.project.clip.start;
    const id = state.selectedId ?? captionAt(state.project.segments, relative)?.id;
    if (id) activate(id, true); else { seek(0); play(); }
  }, [activate, play, player, seek]);
  const toggleLoop = useCallback(() => {
    const state = latest.current;
    if (state.looping) { setLooping(false); latest.current.looping = false; return; }
    const relative = (player.current?.currentTime ?? state.project.clip.start) - state.project.clip.start;
    const id = state.selectedId ?? captionAt(state.project.segments, relative)?.id;
    if (!id || !captionBounds(state.project, id)) return;
    setLooping(true); latest.current.looping = true;
    setReviewMode(true); latest.current.reviewMode = true;
    activate(id);
  }, [activate, player]);
  const navigate = useCallback((delta: number) => {
    const state = latest.current, segments = state.project.segments;
    if (!segments.length) return;
    const index = segments.findIndex(s => s.id === state.selectedId);
    activate(segments[Math.max(0, Math.min(segments.length - 1, index < 0 ? 0 : index + delta))].id, true);
  }, [activate]);
  const changeRate = useCallback((value: number) => {
    if (PLAYBACK_RATES.includes(value as 1)) setRate(value);
  }, []);
  useEffect(() => {
    localStorage.setItem('athar-playback-rate', String(rate));
    if (player.current) { player.current.playbackRate = rate; player.current.preservesPitch = true; }
  }, [rate, player, project.media?.previewPath]);
  useEffect(() => {
    player.current?.pause(); setSelectedId(null); setLooping(false); setReviewMode(false); setTime(0);
    if (player.current?.readyState) player.current.currentTime = project.clip.start;
  }, [project.id, project.media?.path, project.clip.start, project.clip.end, player, setTime]);
  useEffect(() => {
    if (selectedId && !captionBounds(project, selectedId)) {
      player.current?.pause(); setLooping(false); setReviewMode(false);
      if (!project.segments.some(s => s.id === selectedId)) setSelectedId(null);
    }
  }, [project.segments, project.clip, selectedId, player]);
  useEffect(() => { if (busy) player.current?.pause(); }, [busy, player]);
  useEffect(() => {
    const v = player.current;
    if (!v) return;
    let frame = 0, lastUpdate = 0;
    const sync = () => {
      const state = latest.current, p = state.project;
      let relative = Math.max(0, v.currentTime - p.clip.start);
      const bounds = (state.reviewMode || state.looping) && captionBounds(p, state.selectedId);
      const end = bounds ? bounds.end : p.clip.end - p.clip.start;
      if (!v.paused && bounds && state.looping && (relative >= end || relative < bounds.start - .02)) {
        v.currentTime = p.clip.start + bounds.start; relative = bounds.start;
      } else if (!v.paused && relative >= end) {
        v.pause(); v.currentTime = p.clip.start + end; relative = end;
      }
      setTime(Math.max(0, Math.min(p.clip.end - p.clip.start, relative)));
    };
    const tick = (now: number) => { if (!v.paused && now - lastUpdate > 25) { sync(); lastUpdate = now; } frame = requestAnimationFrame(tick); };
    const onPlay = () => setPlaying(true), onPause = () => setPlaying(false);
    const onEnded = () => {
      const state = latest.current, bounds = captionBounds(state.project, state.selectedId);
      if (state.looping && bounds && !state.busy) { v.currentTime = state.project.clip.start + bounds.start; play(); }
      else setPlaying(false);
    };
    v.addEventListener('play', onPlay); v.addEventListener('pause', onPause); v.addEventListener('seeked', sync); v.addEventListener('timeupdate', sync); v.addEventListener('ended', onEnded);
    frame = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(frame); v.removeEventListener('play', onPlay); v.removeEventListener('pause', onPause); v.removeEventListener('seeked', sync); v.removeEventListener('timeupdate', sync); v.removeEventListener('ended', onEnded); };
  }, [player, play, setTime]);
  return { selectedId, looping, playing, rate, reviewMode, activate, seek, toggle, replay, toggleLoop, navigate, changeRate };
}
export type ReviewPlayback = ReturnType<typeof useReviewPlayback>;
