import { describe, it, expect } from 'vitest';
import { computeWeightedValuation } from '../weights';
import { runPipeline } from '../angel/pipeline';
import { evaluateChecks } from '../checks/evaluateChecks';
import type { ValuationMethodKey, MethodApplicability, ValuationReportOutput } from '../types';
import { readyNorthwind, lossMakingNorthwind, emptyTerminalYearNorthwind } from './fixtures/contexts';

/**
 * Audit item 2b, decided by Ed on 24 Oct 2026: each DCF on its own basis.
 * DCF-LTG is excluded when terminal-year net income is <= 0; DCF-Multiple only
 * when terminal-year revenue is <= 0. This departs from the handoff's "both".
 *
 * "Before" is recomputed from the same method values with the pre-2b exclusions
 * only (VC's hurdle and the empty comparable set), which is exactly what
 * compute.ts did before this change.
 */
function before(report: ValuationReportOutput) {
  const values = Object.fromEntries(report.perMethod.map((p) => [p.method, p.valuation])) as Record<ValuationMethodKey, number>;
  const weights = Object.fromEntries(report.perMethod.map((p) => [p.method, p.weight])) as Record<ValuationMethodKey, number>;
  const oldApplicability: Partial<Record<ValuationMethodKey, MethodApplicability>> = {};
  for (const p of report.perMethod) {
    if (!p.applicable && p.method !== 'dcf_ltg' && p.method !== 'dcf_multiple') {
      oldApplicability[p.method] = { applicable: false, reason: p.inapplicableReason ?? '' };
    }
  }
  return computeWeightedValuation(values, weights, oldApplicability);
}
const method = (r: ValuationReportOutput, m: ValuationMethodKey) => r.perMethod.find((p) => p.method === m)!;

describe('item 2b: DCF exclusion on each method\'s own terminal basis', () => {
  it('a positive terminal year is unchanged (Northwind, to the cent)', async () => {
    const { report } = await runPipeline(readyNorthwind());
    expect(method(report, 'dcf_ltg').applicable).toBe(true);
    expect(method(report, 'dcf_multiple').applicable).toBe(true);
    expect(report.weightedValuation).toBe(3166355.9801996546);
    expect(before(report).weightedValuation).toBe(report.weightedValuation);
  });

  it('terminal net income below zero drops DCF-LTG only, and raises the point', async () => {
    const { report } = await runPipeline(lossMakingNorthwind());
    expect(method(report, 'dcf_ltg').applicable).toBe(false);
    expect(method(report, 'dcf_ltg').inapplicableReason).toMatch(/net income is -909,000/);
    expect(method(report, 'dcf_multiple').applicable).toBe(true);

    const old = before(report);
    // Before: DCF-LTG's clamped 0 averaged in at 42.86%. After: its weight moved pro rata.
    // Hand check: (3,912,000 + 4,473,780) x 6/84 + 0 x 36/84 + 3,749,306 x 36/84.
    expect(old.weightedValuation).toBeCloseTo(2_205_829.51, 1);
    expect(report.weightedValuation).toBeCloseTo(3_860_201.64, 1);
  });

  it('redistributes DCF-LTG\'s weight pro rata to the methods left', async () => {
    const { report } = await runPipeline(lossMakingNorthwind());
    // Expansion stage weights 6/6/16/36/36/0. VC (hurdle) and Multiples (no comparables) were
    // already out, DCF-LTG now too: 6 + 6 + 36 = 48 carries 100.
    expect(method(report, 'scorecard').effectiveWeight).toBeCloseTo(0.06 / 0.48, 12);
    expect(method(report, 'checklist').effectiveWeight).toBeCloseTo(0.06 / 0.48, 12);
    expect(method(report, 'dcf_multiple').effectiveWeight).toBeCloseTo(0.36 / 0.48, 12);
    expect(method(report, 'dcf_ltg').effectiveWeight).toBe(0);
    expect(report.perMethod.reduce((s, p) => s + p.effectiveWeight, 0)).toBeCloseTo(1, 12);
  });

  it('terminal net income of exactly zero also drops DCF-LTG (the boundary is <= 0)', async () => {
    const { report } = await runPipeline(emptyTerminalYearNorthwind());
    expect(method(report, 'dcf_ltg').applicable).toBe(false);
  });

  it('zero terminal revenue drops DCF-Multiple as well', async () => {
    const { report } = await runPipeline(emptyTerminalYearNorthwind());
    expect(method(report, 'dcf_multiple').applicable).toBe(false);
    expect(method(report, 'dcf_multiple').inapplicableReason).toMatch(/revenue is 0/);
    expect(method(report, 'scorecard').effectiveWeight + method(report, 'checklist').effectiveWeight).toBeCloseTo(1, 12);
  });

  it('dcf_excluded names the method dropped and why', async () => {
    const one = await runPipeline(lossMakingNorthwind());
    const c1 = evaluateChecks(lossMakingNorthwind(), one.report).find((c) => c.id === 'dcf_excluded')!;
    expect(c1.passed).toBe(false);
    expect(c1.title).toBe('One DCF method was left out');
    expect(c1.why).toBe('DCF with long-term growth was left out because terminal-year net income is zero or below. Its weight went to the other methods.');

    const two = await runPipeline(emptyTerminalYearNorthwind());
    const c2 = evaluateChecks(emptyTerminalYearNorthwind(), two.report).find((c) => c.id === 'dcf_excluded')!;
    expect(c2.title).toBe('Both DCF methods were left out');
    expect(c2.why).toMatch(/exit multiple was left out because terminal-year revenue is zero or below\. Their weight/);

    const none = await runPipeline(readyNorthwind());
    expect(evaluateChecks(readyNorthwind(), none.report).find((c) => c.id === 'dcf_excluded')!.passed).toBe(true);
  });
});
