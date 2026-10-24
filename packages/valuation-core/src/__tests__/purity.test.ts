import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// The package is pure: no framework, database or monitoring code, and no runtime
// dependency at all. Every import under src/ (tests aside) is relative.
const SRC = fileURLToPath(new URL('..', import.meta.url));

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return name === '__tests__' ? [] : sourceFiles(p);
    return /\.tsx?$/.test(name) ? [p] : [];
  });
}

const IMPORT = /(?:import|export)\s[^'"]*?from\s*['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)|require\(\s*['"]([^'"]+)['"]\s*\)/g;

describe('package purity', () => {
  const files = sourceFiles(SRC);

  it('finds the source files', () => {
    expect(files.length).toBeGreaterThan(20);
  });

  it.each(files.map((f) => [f.slice(SRC.length)]))('%s imports nothing outside the package', (rel) => {
    const text = readFileSync(join(SRC, rel), 'utf8');
    const specifiers = [...text.matchAll(IMPORT)].map((m) => m[1] ?? m[2] ?? m[3]);
    for (const s of specifiers) {
      expect(s, `${rel} imports ${s}`).toMatch(/^\.\.?\//);
      expect(s).not.toMatch(/@sentry|@supabase|^next|^react/);
    }
  });
});
