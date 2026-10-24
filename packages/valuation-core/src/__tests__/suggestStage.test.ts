import { describe, it, expect } from 'vitest';
import { suggestStage, GROWTH_REVENUE_THRESHOLD } from '../intake/suggestStage';

type Row = [string, Parameters<typeof suggestStage>[0], ReturnType<typeof suggestStage>];
const r = (listingStage: any, lastActualRevenue: number, lastActualEbitda: number | null, productRollout: any) =>
  ({ listingStage, lastActualRevenue, lastActualEbitda, productRollout });

const CASES: Row[] = [
  // Planning with no revenue is idea, whatever the listing says.
  ['planning, $0, pre-seed', r('pre_seed', 0, null, 'Planning'), 'idea'],
  ['planning, $0, series A', r('series_a', 0, -50_000, 'Planning'), 'idea'],
  ['planning with revenue is not idea', r('pre_seed', 1, null, 'Planning'), 'startup'],
  // Pre-seed with no revenue.
  ['pre-seed, $0, prototype', r('pre_seed', 0, null, 'Prototype'), 'development'],
  ['pre-seed, negative revenue counts as none', r('pre_seed', -10, null, 'MVP'), 'development'],
  // Pre-seed, seed, seed_plus with revenue.
  ['pre-seed, $1', r('pre_seed', 1, -100, 'MVP'), 'startup'],
  ['seed with revenue', r('seed', 310_000, -900_000, 'MVP'), 'startup'],
  ['seed_plus with revenue', r('seed_plus', 2_000_000, -100_000, 'Market'), 'startup'],
  // Seed / seed_plus with no revenue: not stated by the spec; development.
  ['seed, $0', r('seed', 0, null, 'MVP'), 'development'],
  ['seed_plus, $0', r('seed_plus', 0, null, 'Prototype'), 'development'],
  // Series A.
  ['series A, revenue, loss', r('series_a', 3_000_000, -1, 'Market'), 'expansion'],
  ['series A, no revenue, not planning', r('series_a', 0, null, 'MVP'), 'expansion'],
  // Growth: positive EBITDA and revenue over $5m, any listing stage.
  ['growth from seed', r('seed', 5_000_001, 1, 'Market'), 'growth'],
  ['growth from series A', r('series_a', 12_000_000, 800_000, 'Market'), 'growth'],
  // Boundaries.
  ['revenue exactly $5m is not over $5m', r('series_a', GROWTH_REVENUE_THRESHOLD, 500_000, 'Market'), 'expansion'],
  ['revenue exactly $5m, seed', r('seed', 5_000_000, 500_000, 'Market'), 'startup'],
  ['EBITDA exactly 0 is not positive', r('seed', 9_000_000, 0, 'Market'), 'startup'],
  ['EBITDA unknown never qualifies for growth', r('seed', 9_000_000, null, 'Market'), 'startup'],
];

describe('suggestStage', () => {
  it.each(CASES)('%s', (_label, input, want) => {
    expect(suggestStage(input)).toBe(want);
  });

  it('never returns maturity', () => {
    const stages = ['pre_seed', 'seed', 'seed_plus', 'series_a'] as const;
    const rollouts = ['Planning', 'Prototype', 'MVP', 'Market'] as const;
    for (const s of stages) for (const p of rollouts) for (const rev of [0, 1, 5e6, 5e6 + 1, 1e9]) for (const e of [null, -1, 0, 1, 1e8]) {
      expect(suggestStage(r(s, rev, e, p))).not.toBe('maturity');
    }
  });
});
