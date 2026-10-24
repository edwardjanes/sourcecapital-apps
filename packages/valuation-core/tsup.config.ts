import { readFileSync } from 'node:fs';
import { defineConfig } from 'tsup';

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

// ESM (dist/index.js), CJS (dist/index.cjs) and types, from tsconfig.build.json.
// ENGINE_VERSION is baked in from package.json here so the published code never
// reads package.json at runtime.
export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  tsconfig: 'tsconfig.build.json',
  clean: true,
  sourcemap: true,
  target: 'es2020',
  define: { __ENGINE_VERSION__: JSON.stringify(version) },
});
