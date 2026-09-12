import { convertFileSrc, invoke, isTauri } from '@tauri-apps/api/core';
import { open, save } from '@tauri-apps/plugin-dialog';
import { openUrl, revealItemInDir } from '@tauri-apps/plugin-opener';
import type { Media, Project, Device, RuntimeStatus } from './types';
export const desktop = isTauri();
export const mediaUrl = (path: string) => !path ? '' : path.startsWith('blob:') || path.startsWith('/') ? path : desktop ? convertFileSrc(path) : '';
export async function chooseMedia(): Promise<string | null> {
  if (!desktop) throw new Error('Open the Windows app to import and process local media. The browser preview supports project editing.');
  return await open({ multiple: false, filters: [{ name: 'Audio and video', extensions: ['mp3', 'wav', 'm4a', 'mp4', 'mov', 'mkv'] }] });
}
export async function chooseAsset(type: 'image' | 'video') {
  if (!desktop) throw new Error('Open the Windows app to add local assets.');
  return await open({ multiple: false, filters: [{ name: type === 'image' ? 'Image' : 'Video', extensions: type === 'image' ? ['png', 'jpg', 'jpeg', 'webp'] : ['mp4', 'mov', 'mkv'] }] });
}
export async function chooseProject() {
  if (!desktop) return null;
  return await open({ multiple: false, filters: [{ name: 'Athar project', extensions: ['athar', 'bak'] }] });
}
export async function chooseSaveProject(name: string) {
  return await save({ defaultPath: name.replace(/[<>:"/\\|?*]/g, '') + '.athar', filters: [{ name: 'Athar project', extensions: ['athar'] }] });
}
export async function chooseExport(name: string, format: string, targetCode = 'en') {
  const ext = format === 'mp4' ? 'mp4' : 'srt';
  return await save({ defaultPath: name.replace(/[<>:"/\\|?*]/g, '') + (ext === 'srt' ? '-' + (format === 'srt-arabic' ? 'ar' : targetCode) : '') + '.' + ext, filters: [{ name: ext.toUpperCase(), extensions: [ext] }] });
}
export const native = {
  importMedia: (path: string, jobId: string) => invoke<Media>('import_media', { path, jobId }),
  transcribe: (p: Project, model: string, device: Device, jobId: string) => invoke<{ segments: { start: number; end: number; arabic: string }[]; device: string }>('transcribe', { path: p.media!.path, start: p.clip.start, end: p.clip.end, model, device, jobId }),
  save: (p: Project, path: string | null) => invoke<string>('save_project', { raw: JSON.stringify(p), path }),
  open: (path: string) => invoke<string>('open_project', { path }),
  recover: () => invoke<{raw:string;path:string|null} | null>('recover_project'),
  exists: (path: string) => invoke<boolean>('path_exists', { path }),
  status: () => invoke<RuntimeStatus>('runtime_status'),
  downloadModel: (model: string, jobId: string) => invoke<void>('download_model', { model, jobId }),
  cancel: (jobId: string) => invoke<void>('cancel_job', { jobId }),
  export: (p: Project, ass: string, path: string, format: string, jobId: string) => invoke<string>('export_project', { raw: JSON.stringify(p), ass, path, format, jobId }),
};
export const launchGemini = () => desktop ? openUrl('https://gemini.google.com/app') : Promise.resolve(window.open('https://gemini.google.com/app', '_blank', 'noopener,noreferrer'));
export const showFile = (path: string) => desktop ? revealItemInDir(path) : Promise.resolve();
export function downloadText(name: string, text: string, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 2000);
}
