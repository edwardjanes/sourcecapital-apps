import { computeScorecard } from './src/lib/valuation/scorecard.ts';
import { computeChecklist } from './src/lib/valuation/checklist.ts';
import { STAGE_DEFAULT_WEIGHTS } from './src/lib/valuation/referenceData.ts';

console.log('\n 🧪 Running Valuation Engine Tests\n');

let passed = 0;
let failed = 0;

function expect(actual) {
  return {
    toBeCloseTo(expected, precision = 2) {
      const tolerance = Math.pow(10, -precision);
      const diff = Math.abs(actual - expected);
      if (diff > tolerance) {
        throw new Error(
          `Expected ${actual} to be close to ${expected} ` +
          `(diff: ${diff}, tolerance: ${tolerance})`
        );
      }
    },
  };
}

function test(name, fn) {
  try {
    fn();
    console.log(`✓ ${name}`);
    passed++;
  } catch (err) {
    console.log(`✗ ${name}`);
    console.log(`  Error: ${err.message}\n`);
    failed++;
  }
}

// Test 1: Scorecard
test('Scorecard: reproduces NovaCloud valuation ($5,310,193)', () => {
  const criteria = {
    team: { weight: 0.30, score: 0.0 },
    opportunity: { weight: 0.25, score: 0.5 },
    competitive_env: { weight: 0.10, score: 0.25 },
    product_ip: { weight: 0.15, score: 0.25 },
    partnerships: { weight: 0.10, score: 0.375 },
    funding_required: { weight: 0.10, score: 0.5 },
  };
  const averagePreMoneyValuation = 4164857;
  const result = computeScorecard(criteria, averagePreMoneyValuation);
  expect(result.valuation).toBeCloseTo(5310193, -2);
});

// Test 2: Checklist
test('Checklist: reproduces NovaCloud valuation ($4,555,423)', () => {
  const criteria = {
    team: { weight: 0.30, score: 0.55 },
    idea: { weight: 0.20, score: 0.55 },
    product_ip: { weight: 0.15, score: 0.0556 },
    relationships: { weight: 0.15, score: 0.50 },
    operating_stage: { weight: 0.20, score: 0.05 },
  };
  const maxValuation = 12367664;
  const result = computeChecklist(criteria, maxValuation);
  expect(result.valuation).toBeCloseTo(4555423, -2);
});

// Test 3: Weights sum to 1.0
test('Stage weights: all rows sum to 1.0', () => {
  for (const [stage, weights] of Object.entries(STAGE_DEFAULT_WEIGHTS)) {
    const sum = Object.values(weights).reduce((a, b) => a + b, 0);
    const tolerance = 0.0001;
    if (Math.abs(sum - 1.0) > tolerance) {
      throw new Error(`${stage} weights sum to ${sum}, expected 1.0`);
    }
  }
});

// Summary
console.log(`\n ✨ Test Results`);
console.log(` ━━━━━━━━━━━━━━━━━━━━━━━━`);
console.log(` Passed: ${passed}`);
console.log(` Failed: ${failed}`);
console.log(` Total:  ${passed + failed}\n`);

process.exit(failed > 0 ? 1 : 0);
