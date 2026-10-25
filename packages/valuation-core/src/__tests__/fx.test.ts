import { describe, it, expect } from 'vitest';
import { convertAmount, describeConversion, FX_RATES, FX_STALE_DAYS, FX_UNSUPPORTED, isCurrencySupported } from '../fx';
import { VALUATION_BENCHMARKS } from '../benchmarks';
import { COUNTRIES, CURRENCY_BY_COUNTRY, DEFAULT_CURRENCY } from '../referenceData';
import { INTAKE_FIELDS } from '../intake/fields';
import { REFERENCE_DATA_AS_OF } from '../data-as-of';

/**
 * Each COUNTRIES entry's own currency (ISO 4217). Kept here, not in the package,
 * because the engine reports in CURRENCY_BY_COUNTRY; this list only exists to
 * make the coverage test below fail when a country is added without a rate.
 */
const LOCAL_CURRENCY: Record<Exclude<keyof typeof COUNTRIES, 'default'>, string> = {
  US: 'USD', GB: 'GBP', DE: 'EUR', FR: 'EUR', NL: 'EUR', IE: 'EUR', ES: 'EUR', IT: 'EUR', SE: 'SEK', CH: 'CHF',
  IL: 'ILS', AE: 'AED', SG: 'SGD', HK: 'HKD', IN: 'INR', CN: 'CNY', JP: 'JPY', KR: 'KRW', CA: 'CAD', BR: 'BRL',
  MX: 'MXN', AU: 'AUD', ZA: 'ZAR', NG: 'NGN', PL: 'PLN',
};

describe('FX table', () => {
  it('is dated, sourced from the ECB file, and the reference date is REFERENCE_DATA_AS_OF.fxRates', () => {
    expect(FX_RATES.asOf).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(FX_RATES.source).toMatch(/ecb\.europa\.eu\/stats\/eurofxref/);
    expect(REFERENCE_DATA_AS_OF.fxRates).toBe(FX_RATES.asOf);
    expect(FX_STALE_DAYS).toBe(180);
  });

  it('every pegged entry cites its source and anchors on a reference rate', () => {
    for (const [code, r] of Object.entries(FX_RATES.rates)) {
      if (r.kind !== 'pegged') continue;
      expect(r.source.length, code).toBeGreaterThan(30);
      expect(FX_RATES.rates[r.anchor]?.kind, code).toBe('reference');
    }
  });

  it('covers every currency the benchmarks, the country table and the intake use, or says why not', () => {
    // A new country must be added to LOCAL_CURRENCY, and so to this check.
    expect(Object.keys(LOCAL_CURRENCY).sort()).toEqual(Object.keys(COUNTRIES).filter((k) => k !== 'default').sort());
    const reportingOptions =
      (INTAKE_FIELDS.find((f) => f.id === 'reporting_currency') as { options?: string[] } | undefined)?.options ?? [];
    const used = new Set<string>([
      ...VALUATION_BENCHMARKS.map((b) => b.currency),
      ...Object.values(CURRENCY_BY_COUNTRY),
      DEFAULT_CURRENCY,
      ...Object.values(LOCAL_CURRENCY),
      ...reportingOptions.filter((o) => o !== 'Other'),
    ]);
    for (const c of used) {
      const ok = isCurrencySupported(c) || (c in FX_UNSUPPORTED && FX_UNSUPPORTED[c].length > 20);
      expect({ c, ok }).toEqual({ c, ok: true });
    }
    // Nothing is both supported and listed as unsupported.
    for (const c of Object.keys(FX_UNSUPPORTED)) expect(isCurrencySupported(c), c).toBe(false);
  });
});

describe('convertAmount', () => {
  it('derives crosses through EUR at full published precision (three by hand)', () => {
    // GBP to USD: 1.1193 / 0.83728 = 1.3368287789...
    const gbpUsd = convertAmount({ amount: 3_200_000, from: 'GBP', to: 'USD' })!;
    expect(gbpUsd.rate).toBe(1.1193 / 0.83728);
    expect(gbpUsd.rate).toBeCloseTo(1.3368287789, 9);
    expect(gbpUsd.amount).toBeCloseTo(4_277_852.0924899, 6);

    // EUR to USD: the published rate itself.
    const eurUsd = convertAmount({ amount: 6_107_000, from: 'EUR', to: 'USD' })!;
    expect(eurUsd.rate).toBe(1.1193);
    expect(eurUsd.amount).toBeCloseTo(6_835_565.1, 6);

    // USD to SEK: 11.131 / 1.1193 = 9.9446082372...
    const usdSek = convertAmount({ amount: 1_000_000, from: 'USD', to: 'SEK' })!;
    expect(usdSek.rate).toBeCloseTo(9.9446082373, 9);
    expect(usdSek.kind).toBe('reference');
    expect(usdSek.rateAsOf).toBe(FX_RATES.asOf);
  });

  it('every supported pair round-trips to the identity', () => {
    const codes = ['EUR', ...Object.keys(FX_RATES.rates)];
    for (const a of codes) {
      for (const b of codes) {
        const there = convertAmount({ amount: 1_000_000, from: a, to: b })!;
        const back = convertAmount({ amount: there.amount, from: b, to: a })!;
        expect(back.amount, `${a}->${b}`).toBeCloseTo(1_000_000, 4);
        // Through EUR: rate(a,b) = perEur(b) / perEur(a).
        const viaEur = convertAmount({ amount: 1, from: a, to: 'EUR' })!.amount * convertAmount({ amount: 1, from: 'EUR', to: b })!.amount;
        expect(there.rate, `${a}->${b}`).toBeCloseTo(viaEur, 9);
      }
    }
  });

  it('same currency is the identity at rate 1', () => {
    expect(convertAmount({ amount: 1234.5, from: 'GBP', to: 'GBP' })).toMatchObject({ amount: 1234.5, rate: 1 });
  });

  it('returns null when either side is unsupported', () => {
    expect(convertAmount({ amount: 1, from: 'NGN', to: 'USD' })).toBeNull();
    expect(convertAmount({ amount: 1, from: 'USD', to: 'NGN' })).toBeNull();
    expect(convertAmount({ amount: 1, from: 'XXX', to: 'EUR' })).toBeNull();
  });

  it('converts through a peg: AED is 3.6725 per USD', () => {
    const r = convertAmount({ amount: 3_672_500, from: 'AED', to: 'USD' })!;
    expect(r.amount).toBeCloseTo(1_000_000, 6);
    expect(r.kind).toBe('pegged');
    expect(r.source).toMatch(/Central Bank of the UAE/);
    // AED to EUR: 1 / (3.6725 x 1.1193) = 0.24327175699...
    expect(convertAmount({ amount: 1, from: 'AED', to: 'EUR' })!.rate).toBeCloseTo(0.243271757, 9);
  });

  it('describes a conversion in plain words with the real rate and date', () => {
    const c = convertAmount({ amount: 1, from: 'GBP', to: 'USD' })!;
    const text = describeConversion({ from: 'GBP', to: 'USD', rate: c.rate, rateAsOf: '2026-10-23', kind: c.kind });
    expect(text).toBe('converted from GBP to USD at 1.3368 (ECB, 23 October 2026)');
    expect(text).not.toMatch(/[—!]/);
  });
});
