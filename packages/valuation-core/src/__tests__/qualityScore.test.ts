import { describe, it, expect } from 'vitest';
import { applyRangeSpread, computeQualityScore, moneyInputs, qualityLabel, type QualityScore } from '../quality/qualityScore';
import type { CheckResult } from '../checks/evaluateChecks';
import type { SensitivityResult } from '../sensitivity';
import type { ValuationReportOutput } from '../types';
import type { ValuationContext } from '../angel/context';
import { readyNorthwind } from './fixtures/contexts';
import { northwindContext } from './fixtures/northwindIntake';

const block = (q: QualityScore, key: string) => q.blocks.find((b) => b.key === key)!.points;
const warning = (passed: boolean | null): CheckResult => ({
  id: 'w', severity: 'warning', passed, title: 't', why: 'w', fieldRoute: { kind: 'none' }, fixLabel: 'f',
});
/** Every money input verified. */
const allVerified = (ctx: ValuationContext): ValuationContext => ({
  ...ctx,
  sources: Object.fromEntries(moneyInputs(ctx).map((i) => [i.key, 'verified' as const])),
});

describe('computeQualityScore', () => {
  describe('completeness (40)', () => {
    it('is 40 with every required answer and capped there', () => {
      expect(block(computeQualityScore(readyNorthwind(), []), 'completeness')).toBe(40);
    });
    it('is the answered share of 40, plus half a point per optional financials row entered', () => {
      const ctx = northwindContext(); // 53 of 62 required; all 10 optional rows entered
      expect(block(computeQualityScore(ctx, []), 'completeness')).toBeCloseTo((53 / 62) * 40 + 10 * 0.5, 10);
    });
    it('is 0 with nothing answered', () => {
      const empty: ValuationContext = { ...northwindContext(), answers: {}, financials: [], balance: {} };
      expect(block(computeQualityScore(empty, []), 'completeness')).toBe(0);
    });
  });

  describe('evidence (30)', () => {
    it('is 0 when every money input is founder-sourced', () => {
      expect(block(computeQualityScore(readyNorthwind(), []), 'evidence')).toBe(0);
    });
    it('is 30 when every money input is verified or from a confirmed model parse', () => {
      expect(block(computeQualityScore(allVerified(readyNorthwind()), []), 'evidence')).toBe(30);
    });
    it('weighs base-year revenue double', () => {
      const ctx = readyNorthwind();
      const total = moneyInputs(ctx).reduce((s, i) => s + i.weight, 0);
      const onlyRevenue = computeQualityScore({ ...ctx, sources: { 'grid.revenue.0': 'verified' } }, []);
      const onlyCogs = computeQualityScore({ ...ctx, sources: { 'grid.cogs.0': 'dataroom' } }, []);
      expect(block(onlyRevenue, 'evidence')).toBeCloseTo((2 / total) * 30, 10);
      expect(block(onlyCogs, 'evidence')).toBeCloseTo((1 / total) * 30, 10);
    });
    it('does not count market, platform or estimated sources as evidence', () => {
      const ctx = readyNorthwind();
      const sources = Object.fromEntries(moneyInputs(ctx).map((i) => [i.key, 'estimated' as const]));
      expect(block(computeQualityScore({ ...ctx, sources }, []), 'evidence')).toBe(0);
    });
  });

  describe('consistency (20)', () => {
    it('is 20 with no failed warning, minus 5 per failed warning, floor 0', () => {
      expect(block(computeQualityScore(readyNorthwind(), []), 'consistency')).toBe(20);
      expect(block(computeQualityScore(readyNorthwind(), [warning(false)]), 'consistency')).toBe(15);
      expect(block(computeQualityScore(readyNorthwind(), Array(5).fill(warning(false))), 'consistency')).toBe(0);
    });
    it('does not count not-evaluated or passing warnings', () => {
      expect(block(computeQualityScore(readyNorthwind(), [warning(null), warning(true)]), 'consistency')).toBe(20);
    });
  });

  describe('freshness (10)', () => {
    const at = (asOf: string, lastUpdateAgeDays: number | null) =>
      block(computeQualityScore({ ...readyNorthwind(), opts: { asOf, currency: 'GBP' }, facts: { lastUpdateAgeDays } }, []), 'freshness');
    it('is 10 when both hold, 5 when one holds, 0 when neither', () => {
      expect(at('2026-09-01', 30)).toBe(10);
      expect(at('2026-09-01', 120)).toBe(5);
      expect(at('2026-10-24', 30)).toBe(5);
      expect(at('2026-10-24', 90)).toBe(0); // 90 days is not under 90
      expect(at('2026-10-24', null)).toBe(0);
    });
  });

  it('labels: 0-39 Low, 40-59 Fair, 60-79 Good, 80-100 Strong, at each boundary', () => {
    expect([39, 40, 59, 60, 79, 80].map(qualityLabel)).toEqual(['Low', 'Fair', 'Fair', 'Good', 'Good', 'Strong']);
    expect([0, 100].map(qualityLabel)).toEqual(['Low', 'Strong']);
  });

  it('a ready, verified, fresh Northwind scores 100 Strong', () => {
    const ctx = { ...allVerified(readyNorthwind()), opts: { asOf: '2026-09-01', currency: 'GBP' } };
    expect(computeQualityScore(ctx, [])).toMatchObject({ score: 100, label: 'Strong' });
  });
});

describe('applyRangeSpread', () => {
  const report = { weightedValuation: 1_000_000, lowBound: 904_000, highBound: 1_096_000 } as ValuationReportOutput;
  const sens = (understated: boolean, low = 950_000, high = 1_050_000) => ({ lowBound: low, highBound: high, understated }) as SensitivityResult;
  const q = (label: QualityScore['label']): QualityScore => ({ score: 0, label, blocks: [] });

  it('uses the sensitivity bounds when the sensitivity is not understated', () => {
    expect(applyRangeSpread(report, sens(false), q('Low'))).toEqual({ low: 950_000, high: 1_050_000, basis: 'sensitivity', spread: null });
  });
  it('widens to 10% at Strong, 20% at Good, 30% at Fair and Low when understated', () => {
    expect(applyRangeSpread(report, sens(true), q('Strong'))).toMatchObject({ low: 900_000, high: 1_100_000, basis: 'spread', spread: 0.1 });
    expect(applyRangeSpread(report, sens(true), q('Good'))).toMatchObject({ low: 800_000, high: 1_200_000, spread: 0.2 });
    expect(applyRangeSpread(report, sens(true), q('Fair'))).toMatchObject({ low: 700_000, high: 1_300_000, spread: 0.3 });
    expect(applyRangeSpread(report, sens(true), q('Low'))).toMatchObject({ low: 700_000, high: 1_300_000, spread: 0.3 });
  });
  it('never narrows a measured bound that is already wider', () => {
    expect(applyRangeSpread(report, sens(true, 500_000, 1_050_000), q('Strong'))).toMatchObject({ low: 500_000, high: 1_100_000 });
  });
  it('falls back to the engine bounds when no sensitivity ran', () => {
    expect(applyRangeSpread(report, null, q('Good'))).toEqual({ low: 904_000, high: 1_096_000, basis: 'fixed', spread: null });
  });
});
