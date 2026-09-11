export interface Media {
  path: string; name: string; duration: number; size: number; hasVideo: boolean;
  width: number; height: number; previewPath: string; waveform: number[];
}
export interface Approval { arabic: string; english: string; start: number; end: number }
export interface Emphasis { text: string; color: string; bold: boolean }
export interface Segment {
  id: string; start: number; end: number; originalArabic: string; arabic: string;
  english: string; inputArabic?: string; proposedArabic: string | null; correctionNote: string;
  correctionResolved: boolean; uncertain: boolean; uncertaintyResolved: boolean;
  approval: Approval | null; emphasis: Emphasis[];
}
export interface Typography {
  font: string; size: number; bold: boolean; color: string;
  outline: number; shadow: number; spacing: number;
  italic?: boolean; underline?: boolean; outlineColor?: string; shadowColor?: string;
}
export interface ExportSettings { resolution: 720 | 1080; fps: 24 | 25 | 30; speed: 'quality' | 'balanced' | 'quick' }
export type BackgroundKind = 'original' | 'solid' | 'gradient' | 'image' | 'video';
export interface CaptionPanel {
  preset: 'none' | 'solid' | 'glass' | 'gold' | 'paper' | 'emerald' | 'azure' | 'midnight';
  fill: string; border: string; opacity: number; width: number; padding: number; borderWidth: number;
}
export interface Style {
  name: string; mode: 'english' | 'bilingual'; ratio: '9:16' | '1:1' | '16:9';
  arabic: Typography; english: Typography; alignment: 'left' | 'center' | 'right';
  captionY: number; lineGap: number; fade: boolean;
  panel: CaptionPanel;
  background: { kind: BackgroundKind; color: string; color2: string; path: string; fit: 'cover' | 'contain'; dim: number; blur: number };
  showScholar: boolean; showSource: boolean; logoPath: string;
}
export interface TranslationRequest { id: string; snapshot: string; segmentIds: string[]; prompt: string }
export interface ImportRecord { importedAt: string; requestId: string; raw: string }
export interface Project {
  schemaVersion: 1; id: string; name: string; createdAt: string; updatedAt: string;
  media: Media | null; clip: { start: number; end: number };
  metadata: { scholar: string; lecture: string; source: string; channel: string };
  segments: Segment[]; style: Style; glossary: { arabic: string; english: string }[];
  exportSettings?: ExportSettings;
  request: TranslationRequest | null; imports: ImportRecord[];
}
export interface Progress { jobId: string; kind: string; percent: number; message: string }
export interface ModelInfo { id: string; name: string; bytes: number; installed: boolean; description: string }
export interface RuntimeStatus { ffmpeg: boolean; cpu: boolean; vulkan: boolean; memoryGb: number; models: ModelInfo[] }
export type Device = 'auto' | 'cpu';
