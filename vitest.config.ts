import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { include: ['src/**/*.test.ts'], exclude: ['node_modules/**', '.runtime-cache/**', 'src-tauri/**'] } });
