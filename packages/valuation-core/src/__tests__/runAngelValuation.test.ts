import { describe, it, expect } from 'vitest';
import { buildStageNote, runAngelValuation, snapshotParameters } from '../angel/runAngelValuation';
import { runPipeline } from '../angel/pipeline';
import { ENGINE_VERSION } from '../version';
import { REFERENCE_DATA_AS_OF } from '../data-as-of';
import type { ValuationReportOutput } from '../types';
import type { ValuationContext } from '../angel/context';
import { readyNorthwind } from './fixtures/contexts';
import { northwindContext } from './fixtures/northwindIntake';

// The engine app's hosted response for the Northwind fixture (E1, PR #43).
const NORTHWIND = { point: 3166355.9801996546, low: 2459855.7016135636, high: 3843405.216959769 };

describe('runAngelValuation', () => {
  it('Northwind end to end: the same numbers as the compute route, to the cent, and draft', async () => {
    const r = await runAngelValuation(northwindContext());
    expect({ point: r.point, low: r.low, high: r.high }).toEqual(NORTHWIND);
    expect(r.status).toBe('draft');
    expect(r.checks.filter((c) => c.severity === 'blocking' && c.passed === false).map((c) => c.id)).toEqual([
      'required_missing', 'stage_mismatch', 'balance_sheet_unbalanced', 'use_of_funds_missing',
    ]);
    // draft still computes everything
    expect(r.report).not.toBeNull();
    expect(r.actions.length).toBeGreaterThan(0);
    expect(r.actions.slice(0, 3).every((a) => a.appliesToBlocking)).toBe(true);
    expect(r.range!.basis).toBe('sensitivity');
    expect(r.engineVersion).toBe(ENGINE_VERSION);
    expect(r.asOf).toBe('2026-10-24');
    expect(r.currency).toBe('GBP');
  });

  it('a Northwind with every blocking check cleared is ready, with the same numbers', async () => {
    const r = await runAngelValuation(readyNorthwind());
    expect(r.status).toBe('ready');
    expect({ point: r.point, low: r.low, high: r.high }).toEqual(NORTHWIND);
  });

  it('benchmark_only (UAE): no point, range or report, but checks, quality and actions', async () => {
    const ctx: ValuationContext = { ...readyNorthwind(), answers: { ...readyNorthwind().answers, country: 'United Arab Emirates' } as ValuationContext['answers'] };
    const r = await runAngelValuation(ctx);
    expect(r.status).toBe('benchmark_only');
    expect([r.point, r.low, r.high, r.report, r.sensitivity, r.range, r.headroom]).toEqual([null, null, null, null, null, null, null]);
    expect(r.checks.find((c) => c.id === 'region_illustrative')!.passed).toBe(false);
    expect(r.quality.score).toBeGreaterThan(0);
    expect(r.actions.length).toBeGreaterThan(0);
    expect(r.actions.every((a) => a.estimatedDeltaPoint === null && a.headroomUpTo === null)).toBe(true);
  });

  it('benchmark_only also covers a country with no row', async () => {
    const ctx: ValuationContext = { ...readyNorthwind(), answers: { ...readyNorthwind().answers, country: 'Atlantis' } as ValuationContext['answers'] };
    expect((await runAngelValuation(ctx)).status).toBe('benchmark_only');
  });

  it('replays a stored parametersSnapshot to the same numbers', async () => {
    const first = await runAngelValuation(readyNorthwind());
    const stored = JSON.parse(JSON.stringify(first.parametersSnapshot)); // as it would come back from jsonb
    const replay = await runAngelValuation({ ...readyNorthwind(), replayParameters: stored.parameters });
    expect({ point: replay.point, low: replay.low, high: replay.high }).toEqual({ point: first.point, low: first.low, high: first.high });
    expect(replay.parametersSnapshot).toEqual(first.parametersSnapshot);
  });

  it('a replay ignores overrides: the stored parameters already include them', async () => {
    const withOverride = { ...readyNorthwind(), overrides: [{ parameter: 'dcf_shared.discount_rate', value: 0.4, source: 'advisor' as const, reason: 'Test' }] };
    const first = await runAngelValuation(withOverride);
    const replay = await runAngelValuation({ ...withOverride, replayParameters: first.parametersSnapshot.parameters });
    expect(replay.point).toBe(first.point);
  });

  it('is pure: the same context gives the same result', async () => {
    expect(await runAngelValuation(readyNorthwind())).toEqual(await runAngelValuation(readyNorthwind()));
  });

  it('applies overrides and records each, with the value it replaced', async () => {
    const base = await runAngelValuation(readyNorthwind());
    const r = await runAngelValuation({
      ...readyNorthwind(),
      overrides: [
        { parameter: 'dcf_shared.discount_rate', value: 0.4, source: 'advisor', reason: 'Stage risk' },
        { parameter: 'no_such.parameter', value: 1, source: 'founder', reason: 'Typo' },
      ],
    });
    expect(r.overridesApplied[0]).toMatchObject({ parameter: 'dcf_shared.discount_rate', applied: true, previous: base.report!.discountRate });
    expect(r.overridesApplied[1]).toMatchObject({ applied: false, previous: null });
    expect(r.report!.discountRate).toBe(0.4);
    expect(r.point).not.toBe(base.point);
    expect(r.checks.find((c) => c.id === 'override_present')!.passed).toBe(false);
  });

  it('parametersSnapshot carries every numeric parameter with its dataset date', async () => {
    const { parameters } = await runPipeline(readyNorthwind());
    const { values } = snapshotParameters(parameters);
    const at = (path: string) => values.find((v) => v.path === path)!;
    expect(at('discount_rate_build_up.riskFreeRate').asOf).toBe(REFERENCE_DATA_AS_OF.riskFreeRates);
    expect(at('discount_rate_build_up.equityRiskPremium').asOf).toBe(REFERENCE_DATA_AS_OF.countryEquityRiskPremiums);
    expect(at('dcf_multiple.exit_multiple').asOf).toBe(REFERENCE_DATA_AS_OF.damodaranIndustryRows);
    expect(at('scorecard.average_pre_money_valuation').asOf).toBe(parameters.benchmark_resolution!.benchmark!.asOf);
    expect(at('dcf_ltg.survival_rates').asOf).toBeNull();
    expect(at('dcf_shared.discount_rate').value).toBe(parameters.dcf_shared.discount_rate);
    expect(at('method_weights.dcf_ltg').value).toBe(0.36);
  });
});

describe('stageNote', () => {
  const report = (stage: Record<string, [number, boolean]>, allOut = false) =>
    ({
      allMethodsInapplicable: allOut,
      perMethod: Object.entries(stage).map(([method, [weight, applicable]]) => ({ method, weight, applicable, effectiveWeight: 0 })),
    }) as unknown as ValuationReportOutput;
  /** Effective weights the way computeWeightedValuation sets them. */
  const redistributed = (weights: Record<string, number>, excluded: string[] = []) => {
    const r = report(Object.fromEntries(Object.entries(weights).map(([m, w]) => [m, [w, !excluded.includes(m)]])));
    const kept = r.perMethod.filter((p) => p.applicable).reduce((s, p) => s + p.weight, 0);
    const total = r.perMethod.reduce((s, p) => s + p.weight, 0);
    r.perMethod.forEach((p) => (p.effectiveWeight = p.applicable ? (p.weight * total) / kept : 0));
    return r;
  };
  const W = {
    startup: { scorecard: 0.15, checklist: 0.15, vc: 0.16, dcf_ltg: 0.27, dcf_multiple: 0.27, multiples: 0 },
    idea: { scorecard: 0.38, checklist: 0.38, vc: 0.16, dcf_ltg: 0.04, dcf_multiple: 0.04, multiples: 0 },
  };

  it('reproduces the spec\'s example', () => {
    expect(buildStageNote('startup', redistributed(W.startup, ['multiples']))).toBe(
      'At the Startup stage the two DCF methods carry 54% of the weight because there is revenue to project.'
    );
  });

  it('names methods that dropped out, and the lead family after redistribution', () => {
    expect(buildStageNote('idea', redistributed(W.idea, ['vc', 'multiples']))).toBe(
      'At the Idea stage the Scorecard and Checklist methods carry 90% of the weight because there is little trading history yet, ' +
        'so the company is compared with funded peers, after the VC method dropped out and its weight moved to the rest.'
    );
    // 0.30 of 0.57 kept is 53% for Scorecard and Checklist, against 47% for DCF-Multiple.
    expect(buildStageNote('startup', redistributed(W.startup, ['vc', 'dcf_ltg']))).toBe(
      'At the Startup stage the Scorecard and Checklist methods carry 53% of the weight because there is little trading history yet, ' +
        'so the company is compared with funded peers, after the VC and DCF with long-term growth methods dropped out and their weight moved to the rest.'
    );
    // One DCF method left leading: the note names it alone.
    expect(buildStageNote('expansion', redistributed({ scorecard: 0.06, checklist: 0.06, vc: 0.16, dcf_ltg: 0.36, dcf_multiple: 0.36, multiples: 0 }, ['vc', 'dcf_ltg', 'multiples']))).toBe(
      'At the Expansion stage the DCF with exit multiple method carries 75% of the weight because there is revenue to project, ' +
        'after the VC and DCF with long-term growth methods dropped out and their weight moved to the rest.'
    );
  });

  it('says so when no method could be applied', () => {
    expect(buildStageNote('growth', report({}, true))).toBe(
      'At the Growth stage no method could be applied to these inputs, so there is no valuation yet.'
    );
  });
});
