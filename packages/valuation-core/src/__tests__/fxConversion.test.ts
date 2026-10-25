import { describe, it, expect } from 'vitest';
import { resolveBenchmark, VALUATION_BENCHMARKS, CHECKLIST_MAX_RATIO, benchmarkQuartiles } from '../benchmarks';
import { buildDefaultParameters } from '../defaults';
import { FX_RATES } from '../fx';
import { runAngelValuation } from '../angel/runAngelValuation';
import type { ValuationContext } from '../angel/context';
import type { CompanyProfile, CompanyStage, FinancialYear } from '../types';
import { readyNorthwind } from './fixtures/contexts';
import { NORTHWIND_COMPANY, NORTHWIND_FINANCIALS as NW_FIN, NORTHWIND_BALANCE_SHEET } from './fixtures/northwind';

const NORTHWIND_FINANCIALS = NW_FIN as FinancialYear[];

/**
 * Slice E3 (1.2.0): a benchmark in another currency is converted into the run's
 * currency at the dated ECB rate in fx.ts, and reported as a mismatch when no
 * rate is held. Rates below are the published ECB figures for 23 October 2026.
 */
const NW: CompanyProfile = { ...NORTHWIND_COMPANY, stage: NORTHWIND_COMPANY.stage as CompanyStage };
const USD_PER_EUR = 1.1193;
const GBP_PER_EUR = 0.83728;
const GBP_TO_USD = USD_PER_EUR / GBP_PER_EUR;

const ctxFor = (country: string, stage: CompanyStage, currency: string): ValuationContext => {
  const base = readyNorthwind();
  return {
    ...base,
    answers: { ...base.answers, country, stage_of_development: stage } as ValuationContext['answers'],
    opts: { ...base.opts, currency },
    confirmed: { ...base.confirmed, stageConfirmed: stage },
  };
};

/** Run with one benchmark cell replaced, restoring it afterwards. */
async function withCell<T>(geography: string, stage: string, replace: (c: (typeof VALUATION_BENCHMARKS)[number]) => (typeof VALUATION_BENCHMARKS)[number], fn: () => Promise<T>): Promise<T> {
  const i = VALUATION_BENCHMARKS.findIndex((b) => b.geography === geography && b.stage === stage);
  const saved = VALUATION_BENCHMARKS[i];
  VALUATION_BENCHMARKS[i] = replace(saved);
  try {
    return await fn();
  } finally {
    VALUATION_BENCHMARKS[i] = saved;
  }
}

describe('resolveBenchmark converts into the run currency', () => {
  it('GBP to USD: the cell is converted, the original kept in fx, and the note says so', () => {
    const r = resolveBenchmark({ countryCode: 'GB', stage: 'development', currency: 'USD' });
    expect(r.rung).toBe('stage_country');
    expect(r.converted).toBe(true);
    expect(r.currencyMismatch).toBe(false);
    expect(r.benchmark!.currency).toBe('USD');
    expect(r.benchmark!.preMoney.median).toBe(3_200_000 * GBP_TO_USD);
    expect(r.benchmark!.preMoney.mean).toBe(6_000_000 * GBP_TO_USD);
    expect(r.fx).toEqual({
      from: 'GBP', to: 'USD', rate: GBP_TO_USD, rateAsOf: '2026-10-23', source: FX_RATES.source, kind: 'reference',
      originalMedian: 3_200_000, originalMean: 6_000_000, originalCurrency: 'GBP', convertedMedian: 3_200_000 * GBP_TO_USD,
    });
    expect(r.note).toMatch(/The figure is quoted in GBP and was converted from GBP to USD at 1\.3368 \(ECB, 23 October 2026\)\.$/);
    // The published cell itself is untouched.
    expect(VALUATION_BENCHMARKS.find((b) => b.geography === 'GB')!.preMoney.median).toBe(3_200_000);
  });

  it('an unsupported pair reports the mismatch and does not convert', () => {
    const r = resolveBenchmark({ countryCode: 'NG', stage: 'development', currency: 'NGN' });
    expect(r.converted).toBe(false);
    expect(r.currencyMismatch).toBe(true);
    expect(r.fx).toBeUndefined();
    expect(r.benchmark!.currency).toBe('EUR');
    expect(r.benchmark!.preMoney.median).toBe(5_600_000);
    expect(r.note).toMatch(/has not been converted to NGN\.$/);
  });

  it('same currency is unchanged and carries no fx', () => {
    const r = resolveBenchmark({ countryCode: 'DE', stage: 'startup', currency: 'EUR' });
    expect(r.converted).toBe(false);
    expect(r.currencyMismatch).toBe(false);
    expect(r.fx).toBeUndefined();
    expect(r.benchmark).toBe(VALUATION_BENCHMARKS.find((b) => b.geography === 'DE'));
  });

  it('converts on every rung: country, region and global', () => {
    const country = resolveBenchmark({ countryCode: 'DE', stage: 'startup', currency: 'USD' });
    expect([country.rung, country.benchmark!.preMoney.median]).toEqual(['stage_country', 6_107_000 * USD_PER_EUR]);

    // Ireland at idea: the European pre-seed cell is in USD, the run in EUR.
    const region = resolveBenchmark({ countryCode: 'IE', stage: 'idea', currency: 'EUR' });
    expect(region.rung).toBe('stage_region');
    expect(region.converted).toBe(true);
    expect(region.benchmark!.preMoney.median).toBe(3_480_000 * (1 / USD_PER_EUR));

    // Canada at seed: no North American seed cell, so the global EUR cell.
    const global = resolveBenchmark({ countryCode: 'CA', stage: 'development', currency: 'USD' });
    expect(global.rung).toBe('stage_global');
    expect(global.converted).toBe(true);
    expect(global.benchmark!.preMoney.median).toBe(5_600_000 * USD_PER_EUR);
  });

  it('a pegged currency converts and says so', () => {
    const r = resolveBenchmark({ countryCode: 'AE', stage: 'development', currency: 'AED' });
    expect(r.converted).toBe(true);
    expect(r.fx!.kind).toBe('pegged');
    expect(r.benchmark!.preMoney.median).toBeCloseTo(5_600_000 * USD_PER_EUR * 3.6725, 4);
    expect(r.note).toMatch(/\(ECB and an official peg, 23 October 2026\)/);
  });
});

describe('buildDefaultParameters uses the converted benchmark', () => {
  it('Scorecard average and the Checklist ceiling are both in the run currency', () => {
    const p = buildDefaultParameters(NW, NORTHWIND_FINANCIALS, NORTHWIND_BALANCE_SHEET, { currency: 'USD' });
    expect(p.scorecard.average_pre_money_valuation).toBe(3_200_000 * GBP_TO_USD);
    expect(p.checklist.max_valuation).toBe(3_200_000 * GBP_TO_USD * CHECKLIST_MAX_RATIO);
  });

  it('with no currency it uses the country currency, as the Raise HQ engine app does', () => {
    const p = buildDefaultParameters(NW, NORTHWIND_FINANCIALS, NORTHWIND_BALANCE_SHEET);
    expect(p.benchmark_resolution!.converted).toBe(false);
    expect(p.scorecard.average_pre_money_valuation).toBe(3_200_000);
  });

  it('size-premium bands are in USD: GBP revenue is converted for the lookup', () => {
    // GBP 4.5m is about USD 6.0m: decile-9-to-10 band (3.0%), not the bottom band (4.7%).
    const fin = NORTHWIND_FINANCIALS.map((f) => (f.yearOffset === -1 ? { ...f, revenue: 4_500_000 } : f));
    const gbp = buildDefaultParameters(NW, fin, NORTHWIND_BALANCE_SHEET, { currency: 'GBP' });
    expect(gbp.discount_rate_build_up!.sizeBandRevenue).toBe(4_500_000 * GBP_TO_USD);
    expect(gbp.discount_rate_build_up!.sizePremium).toBe(0.03);
    expect(gbp.discount_rate_build_up!.sizeBandFx).toMatchObject({ from: 'GBP', to: 'USD', rate: GBP_TO_USD });
    // Below about GBP 3.74m nothing moves.
    const small = buildDefaultParameters(NW, NORTHWIND_FINANCIALS, NORTHWIND_BALANCE_SHEET, { currency: 'GBP' });
    expect(small.discount_rate_build_up!.sizePremium).toBe(0.047);
    // A USD run makes no conversion; an unsupported currency compares as entered, as in 1.1.0.
    const usd = buildDefaultParameters(NW, fin, NORTHWIND_BALANCE_SHEET, { currency: 'USD' });
    expect(usd.discount_rate_build_up!.sizeBandFx).toBeNull();
    const ngn = buildDefaultParameters({ ...NW, country: 'Nigeria' }, fin, NORTHWIND_BALANCE_SHEET, { currency: 'NGN' });
    expect(ngn.discount_rate_build_up!.sizeBandRevenue).toBe(4_500_000);
    expect(ngn.discount_rate_build_up!.sizeBandFx).toBeNull();
  });
});

describe('pipeline: GB and DE run in USD match the hand-converted benchmark', () => {
  // The A3 correctness test: the 1.2.0 figure equals the same intake run with the
  // benchmark cell pre-converted by hand at the same rate (no conversion in the run).
  const CASES: Array<[string, string, CompanyStage, number, number]> = [
    ['United Kingdom', 'GB', 'startup', 3_200_000 * GBP_TO_USD, 6_000_000 * GBP_TO_USD],
    ['United Kingdom', 'GB', 'development', 3_200_000 * GBP_TO_USD, 6_000_000 * GBP_TO_USD],
    ['Germany', 'DE', 'startup', 6_107_000 * USD_PER_EUR, NaN],
    ['Germany', 'DE', 'development', 6_107_000 * USD_PER_EUR, NaN],
  ];
  // 1.1.0 read the cell as if it were USD (computed from the 1.1.0 source, 25 Oct 2026).
  const POINT_110: Record<string, number> = {
    'GB startup': 3422989.485149741,
    'GB development': 3850711.9933998846,
    'DE startup': 6240438.00142245,
    'DE development': 7219010.5058405325,
  };

  it.each(CASES)('%s %s', async (country, code, stage, median, mean) => {
    const converted = await runAngelValuation(ctxFor(country, stage, 'USD'));
    const byHand = await withCell(code, 'seed', (c) => ({
      ...c, currency: 'USD', preMoney: { median, ...(Number.isNaN(mean) ? {} : { mean }) },
    }), () => runAngelValuation(ctxFor(country, stage, 'USD')));

    expect(byHand.report!.benchmarkResolution!.converted).toBe(false);
    expect(converted.report!.benchmarkResolution!.converted).toBe(true);
    expect({ point: converted.point, low: converted.low, high: converted.high }).toEqual({
      point: byHand.point, low: byHand.low, high: byHand.high,
    });
    expect(converted.point).toBeGreaterThan(POINT_110[`${code} ${stage}`]);
  });
});

describe('same currency: identical to 1.1.0, to the dollar', () => {
  // Point, low, high from the 1.1.0 source on the same intake (25 Oct 2026).
  const V110: Array<[string, CompanyStage, string, [number, number, number]]> = [
    ['United Kingdom', 'startup', 'GBP', [3422989.485149741, 2628453.4358777767, 5115612.5770500265]],
    ['United Kingdom', 'development', 'GBP', [3850711.9933998846, 2261639.894855956, 7235958.177200455]],
    ['United Kingdom', 'expansion', 'GBP', [3166355.9801996546, 2459855.7016135636, 3843405.216959769]],
    ['Germany', 'startup', 'EUR', [6240438.00142245, 4724115.609889985, 9470703.3833709]],
    ['Germany', 'development', 'EUR', [7219010.5058405325, 4186365.7227756027, 13679541.269737434]],
    ['United States', 'startup', 'USD', [10042877.66205609, 6119855.918775764, 18400204.17831375]],
    ['United States', 'development', 'USD', [15964831.391469374, 8118787.904908723, 32679484.42398469]],
    ['United States', 'expansion', 'USD', [6489705.424408118, 4920496.727095989, 9832636.030911181]],
  ];
  it.each(V110)('%s %s in %s', async (country, stage, currency, [point, low, high]) => {
    const r = await runAngelValuation(ctxFor(country, stage, currency));
    expect([r.point, r.low, r.high]).toEqual([point, low, high]);
    expect(r.report!.benchmarkResolution!.converted).toBe(false);
    expect(r.parametersSnapshot.fx.filter((f) => f.applies === 'benchmark_pre_money')).toEqual([]);
  });

  it('the Germany validated cell still drives a German run at 6,107,000', async () => {
    const r = await runAngelValuation(ctxFor('Germany', 'startup', 'EUR'));
    expect(r.report!.benchmarkResolution!.benchmark!.basis).toBe('validated');
    expect(r.parametersSnapshot.parameters.scorecard.average_pre_money_valuation).toBe(6_107_000);
  });
});

describe('replay uses the stored rate, never the live table', () => {
  it('run, change the table, replay from the snapshot: identical output', async () => {
    const ctx = ctxFor('United Kingdom', 'development', 'USD');
    const first = await runAngelValuation(ctx);
    expect(first.parametersSnapshot.fx).toEqual([
      expect.objectContaining({ applies: 'benchmark_pre_money', from: 'GBP', to: 'USD', rate: GBP_TO_USD, rateAsOf: '2026-10-23', original: 3_200_000, converted: 3_200_000 * GBP_TO_USD }),
    ]);

    const saved = { asOf: FX_RATES.asOf, gbp: FX_RATES.rates.GBP };
    try {
      FX_RATES.asOf = '2027-01-15';
      FX_RATES.rates.GBP = { kind: 'reference', perEur: 0.9 };
      // A fresh run now converts at the new rate, so the change is real...
      const fresh = await runAngelValuation(ctx);
      expect(fresh.point).not.toBe(first.point);
      // ...and the replay ignores it.
      const replay = await runAngelValuation({ ...ctx, replayParameters: first.parametersSnapshot.parameters });
      expect({ point: replay.point, low: replay.low, high: replay.high }).toEqual({ point: first.point, low: first.low, high: first.high });
      expect(replay.report).toEqual(first.report);
      expect(replay.sensitivity).toEqual(first.sensitivity);
      expect(replay.checks).toEqual(first.checks);
      expect(replay.parametersSnapshot.fx).toEqual(first.parametersSnapshot.fx);
    } finally {
      FX_RATES.asOf = saved.asOf;
      FX_RATES.rates.GBP = saved.gbp;
    }
  });
});

describe('sensitivity moves the converted benchmark', () => {
  it('the benchmark driver runs between the converted quartiles', async () => {
    const r = await runAngelValuation(ctxFor('United Kingdom', 'development', 'USD'));
    const driver = r.sensitivity!.drivers.find((d) => d.key === 'benchmark_pre_money')!;
    const q = benchmarkQuartiles(r.report!.benchmarkResolution!.benchmark!);
    expect(q.median).toBe(3_200_000 * GBP_TO_USD);
    expect([driver.low!.value, driver.high!.value].sort((a, b) => a - b)).toEqual([q.p25, q.p75]);
    expect(driver.source).toContain(Math.round(3_200_000 * GBP_TO_USD).toLocaleString('en-GB'));
  });
});
