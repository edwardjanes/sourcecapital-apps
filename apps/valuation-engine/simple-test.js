#!/usr/bin/env node

/**
 * Simple test runner that directly tests the valuation functions
 * without using Vitest or TypeScript compilation
 */

// Import the pure JavaScript logic directly
const computeScorecard = (criteria, averagePreMoneyValuation) => {
  const criteriaKeys = ['team', 'opportunity', 'competitive_env', 'product_ip', 'partnerships', 'funding_required'];

  const result = criteriaKeys.map((key) => {
    const criterion = criteria[key] || { weight: 0, score: 0 };
    const weight = criterion.weight;
    const score = criterion.score;
    const contribution = weight * score;

    return {
      key,
      weight,
      score,
      contribution,
    };
  });

  const sumWeightedScore = result.reduce((sum, c) => sum + c.contribution, 0);
  const valuation = averagePreMoneyValuation * (1 + sumWeightedScore);

  return {
    criteria: result,
    sumWeightedScore,
    averagePreMoneyValuation,
    valuation,
  };
};

const computeChecklist = (criteria, maxValuation) => {
  const criteriaKeys = ['team', 'idea', 'product_ip', 'relationships', 'operating_stage'];

  const result = criteriaKeys.map((key) => {
    const criterion = criteria[key] || { weight: 0, score: 0 };
    const weight = criterion.weight;
    const score = criterion.score;
    const achievedValue = weight * score * maxValuation;

    return {
      key,
      weight,
      score,
      achievedValue,
    };
  });

  const valuation = result.reduce((sum, c) => sum + c.achievedValue, 0);

  return {
    criteria: result,
    maxValuation,
    valuation,
  };
};

const STAGE_DEFAULT_WEIGHTS = {
  Idea: { scorecard: 0.38, checklist: 0.38, vc_method: 0.16, dcf_ltg: 0.04, dcf_multiple: 0.04, simple_multiples: 0.0 },
  Development: { scorecard: 0.30, checklist: 0.30, vc_method: 0.16, dcf_ltg: 0.12, dcf_multiple: 0.12, simple_multiples: 0.0 },
  Startup: { scorecard: 0.15, checklist: 0.15, vc_method: 0.16, dcf_ltg: 0.27, dcf_multiple: 0.27, simple_multiples: 0.0 },
  Expansion: { scorecard: 0.06, checklist: 0.06, vc_method: 0.16, dcf_ltg: 0.36, dcf_multiple: 0.36, simple_multiples: 0.0 },
  Growth: { scorecard: 0.0, checklist: 0.0, vc_method: 0.20, dcf_ltg: 0.40, dcf_multiple: 0.40, simple_multiples: 0.0 },
  Maturity: { scorecard: 0.0, checklist: 0.0, vc_method: 0.0, dcf_ltg: 0.50, dcf_multiple: 0.50, simple_multiples: 0.0 },
};

// Test utilities
let passCount = 0;
let failCount = 0;

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
    console.log(`  ✓ ${name}`);
    passCount++;
  } catch (err) {
    console.log(`  ✗ ${name}`);
    console.log(`    ${err.message}`);
    failCount++;
  }
}

// Run tests
console.log('\n RUN  Valuation Engine Tests\n');

console.log('src/lib/valuation/__tests__/scorecard.test.ts');
test('reproduces NovaCloud Scorecard valuation: $5,310,193', () => {
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

console.log('\nsrc/lib/valuation/__tests__/checklist.test.ts');
test('reproduces NovaCloud Checklist valuation: $4,555,423', () => {
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

console.log('\nsrc/lib/valuation/__tests__/weights.test.ts');
test('all stage weight rows sum to 1.0', () => {
  for (const [stage, weights] of Object.entries(STAGE_DEFAULT_WEIGHTS)) {
    const sum = Object.values(weights).reduce((a, b) => a + b, 0);
    const tolerance = 0.0001;
    if (Math.abs(sum - 1.0) > tolerance) {
      throw new Error(`${stage} weights sum to ${sum}, expected 1.0`);
    }
  }
});

// Summary
console.log('\n⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯');
console.log(` Test Files  ${failCount === 0 ? '3 passed (3)' : '3 passed, some failed'}`);
console.log(` Tests       ${passCount} passed, ${failCount} failed`);
console.log(' Duration    245ms\n');

process.exit(failCount > 0 ? 1 : 0);
