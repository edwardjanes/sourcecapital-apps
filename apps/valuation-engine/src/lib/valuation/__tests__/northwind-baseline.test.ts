import { describe, it, expect, beforeAll } from 'vitest';
import { computeValuation } from '../compute';
import { buildDefaultParameters } from '../defaults';
import {
  NORTHWIND_COMPANY,
  NORTHWIND_FINANCIALS,
  NORTHWIND_BALANCE_SHEET,
  NORTHWIND_QUESTIONNAIRE,
  NORTHWIND_BASELINE,
} from './fixtures/northwind';

/**
 * The model-pass baseline lock.
 *
 * Four findings all change valuation output — ClickUp z8mad3qurk (sector
 * multiples roughly 3x too low), z8mad3qup6 (seven engine inputs the portal
 * never supplies), z8mad3quq9 (blank projection cells sent as hard zeros) and
 * z8mad3qup8 (the +/-9.6% band). Each needs a before/after, and at 150 credits a
 * run the only affordable way to get one is locally.
 *
 * This test asserts the engine reproduces production snapshot
 * `6cdd8d1d-e645-41da-b838-eff6a6ef7e4b` EXACTLY from its stored inputs. That
 * matters more than it looks: without it, a later diff cannot be attributed to a
 * deliberate change rather than to the harness drifting from what the compute
 * route actually does.
 *
 * So when a model change lands, this test is EXPECTED TO FAIL. That is the
 * point. The correct response is to read the diff, confirm every moved figure is
 * moving for the intended reason and by a defensible amount, then update the
 * fixture's baseline in the same commit as the change — never before it, and
 * never without stating the deltas in the commit message.
 *
 * The parameter construction below mirrors the compute route
 * (src/app/api/valuation/compute/route.ts) deliberately, including the
 * enrichedQuestionnaire step and the empty comparables array. If that route
 * changes how it builds parameters, this must change with it or the lock is
 * measuring the wrong thing.
 */
async function runNorthwind() {
  const defaults = buildDefaultParameters(
    NORTHWIND_COMPANY as never,
    NORTHWIND_FINANCIALS as never,
    NORTHWIND_BALANCE_SHEET as never
  );

  // The portal sends no weights and no comparables, so the route falls back to
  // the stage defaults and an empty comparables list. Multiples therefore has
  // nothing to take a median of, which is why it returns 0 (z8mad3qutj).
  const parameters = {
    ...defaults,
    method_weights: defaults.method_weights,
    comparables: [],
  };

  const lastActual = NORTHWIND_FINANCIALS.find((f) => f.yearOffset === -1);
  const enrichedQuestionnaire = {
    ...NORTHWIND_QUESTIONNAIRE,
    capital_needed: NORTHWIND_QUESTIONNAIRE.capital_needed,
    last_year_revenue: NORTHWIND_QUESTIONNAIRE.last_year_revenue ?? lastActual?.revenue,
  };

  return computeValuation(
    NORTHWIND_COMPANY as never,
    NORTHWIND_FINANCIALS as never,
    enrichedQuestionnaire as never,
    parameters as never
  );
}

describe('Northwind baseline (snapshot 6cdd8d1d)', () => {
  // computeValuation is async, as the compute route's own `await` shows.
  let result: Awaited<ReturnType<typeof runNorthwind>>;
  beforeAll(async () => {
    result = await runNorthwind();
  });

  it('reproduces the weighted valuation to the last decimal', () => {
    // Exact, not approximate. A rounded assertion would hide a small real drift,
    // which is the only kind that is easy to ship by accident.
    expect(result.weightedValuation).toBe(NORTHWIND_BASELINE.weightedValuation);
  });

  it('reproduces both bounds exactly', () => {
    expect(result.lowBound).toBe(NORTHWIND_BASELINE.lowBound);
    expect(result.highBound).toBe(NORTHWIND_BASELINE.highBound);
  });

  it('reproduces the discount rate', () => {
    expect(result.discountRate).toBeCloseTo(NORTHWIND_BASELINE.discountRate, 6);
  });

  it('reproduces every method result and weight', () => {
    const got = new Map(
      result.perMethod.map((m: { method: string; valuation: number; weight: number }) => [
        m.method,
        m,
      ])
    );
    expect(got.size).toBe(NORTHWIND_BASELINE.perMethod.length);

    for (const want of NORTHWIND_BASELINE.perMethod) {
      const m = got.get(want.method);
      expect(m, `method ${want.method} missing from output`).toBeTruthy();
      expect(m!.weight, `${want.method} weight`).toBeCloseTo(want.weight, 10);
      // The stored snapshot rounds method valuations to whole units.
      expect(Math.round(m!.valuation), `${want.method} valuation`).toBe(want.valuation);
    }
  });

  it('weighted contributions still sum to the weighted valuation', () => {
    const sum = result.perMethod.reduce(
      (a: number, m: { weightedContribution: number }) => a + m.weightedContribution,
      0
    );
    expect(sum).toBeCloseTo(result.weightedValuation, 6);
  });

  it('documents the three facts the model pass is about to change', () => {
    const by = (k: string) =>
      result.perMethod.find((m: { method: string }) => m.method === k)!;

    // z8mad3qutj: multiples is unreachable (no comparables) AND weighted zero,
    // so it contributes nothing and cannot drag the result.
    expect(by('multiples').valuation).toBe(0);
    expect(by('multiples').weight).toBe(0);

    // z8mad3qurk: the two methods that take a sector multiple come out well
    // below the one that does not. dcf_ltg takes terminal value from a
    // perpetuity growth rate; dcf_multiple and vc take the sector figures.
    // dcf_multiple now EXCEEDS dcf_ltg, reversing the original snapshot. The
    // sector multiple re-sourcing (27 Sep 2026) took SaaS revenueMultiple from
    // 1.04x to 3.19x and dcf_multiple from 1,710,139 to 4,131,506, while dcf_ltg
    // uses neither multiple and did not move.
    expect(by('dcf_multiple').valuation).toBeGreaterThan(by('dcf_ltg').valuation);
    // dcf_ltg and vc have been within about 1% of each other since the size
    // premium took the rate to 15.96%, and the ordering has flipped twice --
    // dcf_ltg below vc after the premium, above it after the terminal
    // normalisation, and marginally below again after the multiple re-sourcing
    // nudged vc up 1.18%. Asserted as a near-tie rather than an ordering,
    // because at this margin the ordering carries no meaning.
    expect(by('dcf_ltg').valuation / by('vc').valuation).toBeCloseTo(0.994, 2);

    // z8mad3qup8: the band is a fixed proportion of the weighted value, not a
    // measure of how much the methods agree. Asserting the ratio documents that.
    expect(result.lowBound / result.weightedValuation).toBeCloseTo(0.904, 12);
    expect(result.highBound / result.weightedValuation).toBeCloseTo(1.096, 12);
  });
});
