import { z } from 'zod';
import type { ExportSettings } from './types';

export const DEFAULT_EXPORT: ExportSettings = { resolution: 1080, fps: 30, speed: 'balanced' };
export const EXPORT_FRAME_RATES = [5, 10, 12, 15, 20, 24, 25, 30] as const;
export const exportSettingsSchema = z.object({
  resolution: z.union([z.literal(720), z.literal(1080)]),
  fps: z.union([z.literal(5), z.literal(10), z.literal(12), z.literal(15), z.literal(20), z.literal(24), z.literal(25), z.literal(30)]),
  speed: z.enum(['quality', 'balanced', 'quick']),
}).default(() => ({ ...DEFAULT_EXPORT }));
export const EXPORT_SPEEDS = {
  quality: { label: 'Quality', hint: 'Slower encoding with better compression.' },
  balanced: { label: 'Balanced', hint: 'Faster encoding at the same quality target; files may be larger.' },
  quick: { label: 'Quick draft', hint: 'Fastest encoding with lower quality and less efficient compression.' },
};
