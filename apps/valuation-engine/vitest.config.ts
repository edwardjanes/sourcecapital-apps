import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  // Matches the `@/*` path alias in tsconfig, so a test can import app code.
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
  css: {
    postcss: {
      plugins: [],
    },
  },
  // The report components use the classic JSX runtime via Next's compiler;
  // esbuild needs telling so a rendered test does not hit "React is not defined".
  esbuild: { jsx: 'automatic' },
  test: {
    globals: true,
    environment: 'node',
    // .tsx so the report can be rendered for real -- see reportRender.test.tsx.
    include: ['src/**/__tests__/**/*.test.ts', 'src/**/__tests__/**/*.test.tsx'],
    testTimeout: 10000,
  },
})
