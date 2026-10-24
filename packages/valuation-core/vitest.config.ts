import { readFileSync } from 'node:fs';
import { defineConfig } from 'vitest/config';

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

export default defineConfig({
  // Same value tsup bakes into the build, so tests see the real ENGINE_VERSION.
  define: { __ENGINE_VERSION__: JSON.stringify(version) },
  // Stops Vite walking up to the repo root's postcss.config.mjs, which needs
  // tailwindcss (installed only for the deck app). Same fix as the engine app.
  css: { postcss: { plugins: [] } },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/__tests__/**/*.test.ts'],
    testTimeout: 10000,
  },
});
