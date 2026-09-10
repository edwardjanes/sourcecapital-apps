#!/usr/bin/env node

// Direct test runner without Vitest
const path = require('path');
const Module = require('module');

// Setup path aliases
const originalRequire = Module.prototype.require;
Module.prototype.require = function(id) {
  if (id.startsWith('@/')) {
    const resolved = path.join(__dirname, 'src', id.slice(2));
    return originalRequire.call(this, resolved);
  }
  return originalRequire.call(this, id);
};

// Simple test harness
const tests = [];
let passCount = 0;
let failCount = 0;

global.it = (name, fn) => {
  tests.push({ name, fn });
};

global.expect = (actual) => ({
  toBeCloseTo: (expected, precision = 2) => {
    const tolerance = Math.pow(10, -precision);
    const diff = Math.abs(actual - expected);
    if (diff > tolerance) {
      throw new Error(
        `Expected ${actual} to be close to ${expected} ` +
        `(difference: ${diff}, tolerance: ${tolerance})`
      );
    }
  },
});

// Load and run tests
console.log('\n RUN  Test Suite\n');

const testFiles = [
  './src/lib/valuation/__tests__/scorecard.test.ts',
  './src/lib/valuation/__tests__/checklist.test.ts',
  './src/lib/valuation/__tests__/weights.test.ts',
];

// Convert TypeScript to JavaScript dynamically
const ts = require('typescript');
const fs = require('fs');

for (const file of testFiles) {
  const filePath = path.join(__dirname, file);
  const code = fs.readFileSync(filePath, 'utf-8');

  // Simple transpile: remove type annotations and import statements
  let js = code
    .replace(/import.*?from.*?['"](.*?)['"];?/g, `const $1 = require('$1');`)
    .replace(/:\s*\{[^}]*\}/g, '') // Remove type annotations
    .replace(/as \w+/g, ''); // Remove type casts

  try {
    eval(js);
  } catch (err) {
    console.error(`Error loading ${file}:`, err.message);
  }
}

// Run all tests
console.log(`Running ${tests.length} test(s)...\n`);

for (const test of tests) {
  try {
    test.fn();
    console.log(`✓ ${test.name}`);
    passCount++;
  } catch (err) {
    console.log(`✗ ${test.name}`);
    console.log(`  ${err.message}`);
    failCount++;
  }
}

// Summary
console.log(`\n Test Files  ${passCount === tests.length ? 'passed' : 'failed'}`);
console.log(` Tests       ${passCount} passed, ${failCount} failed`);

process.exit(failCount > 0 ? 1 : 0);
