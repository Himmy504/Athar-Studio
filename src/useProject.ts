import { useCallback, useEffect, useRef, useState } from 'react';
import { applySavedAssets, newProject, parseProject } from './domain';
import { desktop, native } from './bridge';
import type { Project } from './types';

export function useProject() {
  const [project, setProject] = useState<Project>(newProject);
  const [path, setPath] = useState<string | null>(null);
  const [status, setStatus] = useState('Starting…');
  const [ready, setReady] = useState(false);
  const [history, setHistory] = useState<{ past: Project[]; future: Project[] }>({ past: [], future: [] });
  const current = useRef(project); current.current = project;
  const queue = useRef(Promise.resolve());
  const lastAction = useRef({ key: '', at: 0 });
  const replace = useCallback((p: Project, savedPath: string | null = null) => {
    setProject(p); setPath(savedPath); setHistory({ past: [], future: [] });
  }, []);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const recovered = desktop ? await native.recover() : {raw:localStorage.getItem('athar-recovery'),path:null};
        if (!cancelled && recovered?.raw) { setProject(parseProject(recovered.raw)); setPath(recovered.path); setStatus('Recovered'); }
      } catch { if (!cancelled) setStatus('Recovery unavailable · open a saved project'); }
      finally { if (!cancelled) setReady(true); }
    })();
    return () => { cancelled = true; };
  }, []);
  const update = useCallback((fn: (p: Project) => Project, key = '') => {
    const prev = current.current;
    const next = { ...fn(structuredClone(prev)), updatedAt: new Date().toISOString() };
    const now = Date.now(), coalesce = key && lastAction.current.key === key && now - lastAction.current.at < 900;
    setHistory(h => ({ past: coalesce ? h.past : [...h.past.slice(-59), prev], future: [] }));
    lastAction.current = { key, at: now };
    current.current = next; setProject(next);
  }, []);
  const undo = useCallback(() => {
    setHistory(h => {
      if (!h.past.length) return h;
      const next = { ...h.past[h.past.length - 1], updatedAt: new Date().toISOString() }; current.current = next; setProject(next); lastAction.current = { key: '', at: 0 };
      return { past: h.past.slice(0, -1), future: [project, ...h.future] };
    });
  }, [project]);
  const redo = useCallback(() => {
    setHistory(h => {
      if (!h.future.length) return h;
      const next = { ...h.future[0], updatedAt: new Date().toISOString() }; current.current = next; setProject(next); lastAction.current = { key: '', at: 0 };
      return { past: [...h.past, project], future: h.future.slice(1) };
    });
  }, [project]);
  const persist = useCallback(async (p: Project, savedPath: string | null) => {
    setStatus('Saving…');
    const operation = queue.current.catch(() => {}).then(async () => {
      if (desktop) {
        const saved=parseProject(await native.save(p,savedPath));
        const next=applySavedAssets(current.current,p,saved);
        if(next!==current.current){current.current=next;setProject(next);}
      }
      else localStorage.setItem('athar-recovery', JSON.stringify(p));
    });
    queue.current = operation;
    try { await operation; setStatus('Saved'); }
    catch (e) { setStatus('Save failed: ' + String(e)); throw e; }
  }, []);
  useEffect(() => {
    if (!ready) return;
    const timer = setTimeout(() => { void persist(project, path).catch(() => {}); }, 800);
    return () => clearTimeout(timer);
  }, [project, path, ready, persist]);
  useEffect(() => {
    const save = () => { try { localStorage.setItem('athar-recovery', JSON.stringify(current.current)); } catch { /* Native autosave remains authoritative. */ } };
    window.addEventListener('beforeunload', save); return () => window.removeEventListener('beforeunload', save);
  }, []);
  return { project, update, replace, path, setPath, status, ready, undo, redo, canUndo: !!history.past.length, canRedo: !!history.future.length, persist };
}
