/**
 * Currency conversion for the reference data, added in 1.2.0 (slice E3).
 *
 * WHY. Until 1.2.0 the engine never converted currency (the standing decision of
 * 31 Aug 2026). A benchmark quoted in GBP was read as if it were the run's
 * currency, so a UK listing reported in USD had a GBP 3.2m benchmark treated as
 * USD 3.2m. TheAngel slice A3 measured the damage at 6% to 20% of the point
 * value. Ed approved reversing the decision for the case where the currencies
 * differ. Where they match nothing is converted and nothing changes.
 *
 * WHAT IS HELD. The raw ECB euro foreign exchange reference rates (units of a
 * currency per 1 EUR), exactly as published, for one reference date. Cross rates
 * are derived through EUR at use, never stored. A currency the ECB does not
 * publish is held only when it has an official peg that can be cited, recorded
 * as `kind: 'pegged'` against its anchor. Anything else is unsupported, and
 * conversion returns null rather than inventing a rate.
 *
 * HOW TO REFRESH. Download the ECB daily file (FX_SOURCE_URL, or the CSV in
 * https://www.ecb.europa.eu/stats/eurofxref/eurofxref.zip), copy each rate into
 * FX_RATES.rates unchanged, and set FX_RATES.asOf to the file's reference date
 * (the `time` attribute of the XML, or the Date column of the CSV). Then run
 * `npm test`: fx.test.ts fails if any currency used by the benchmarks or the
 * country table has neither a rate nor a reason in FX_UNSUPPORTED. Never type a
 * rate from memory.
 */

export const FX_SOURCE_URL = 'https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml';

/** The FX table goes stale faster than the other reference data. Ed can change this. */
export const FX_STALE_DAYS = 180;

export type FxRateKind = 'reference' | 'pegged';

export interface FxReferenceRate {
  kind: 'reference';
  /** Units of this currency per 1 EUR, at full published precision. */
  perEur: number;
}

export interface FxPeggedRate {
  kind: 'pegged';
  /** The currency it is pegged to. Must itself hold a reference rate. */
  anchor: string;
  /** Units of this currency per 1 unit of `anchor`. */
  perAnchor: number;
  source: string;
}

export type FxRate = FxReferenceRate | FxPeggedRate;

export interface FxTable {
  /** Reference date of the published file, ISO. */
  asOf: string;
  source: string;
  /** Every supported currency except EUR, which is the base (1). */
  rates: Record<string, FxRate>;
}

/**
 * ECB euro foreign exchange reference rates, reference date 23 October 2026,
 * from eurofxref-daily.xml (and the identical eurofxref.csv in eurofxref.zip),
 * downloaded 25 October 2026. Only the currencies the engine uses are copied;
 * the file publishes 29.
 */
export const FX_RATES: FxTable = {
  asOf: '2026-10-23',
  source: `European Central Bank, euro foreign exchange reference rates, ${FX_SOURCE_URL}`,
  rates: {
    USD: { kind: 'reference', perEur: 1.1193 },
    GBP: { kind: 'reference', perEur: 0.83728 },
    SEK: { kind: 'reference', perEur: 11.131 },
    CHF: { kind: 'reference', perEur: 0.9227 },
    PLN: { kind: 'reference', perEur: 4.3945 },
    ILS: { kind: 'reference', perEur: 3.4939 },
    SGD: { kind: 'reference', perEur: 1.431 },
    HKD: { kind: 'reference', perEur: 8.7793 },
    INR: { kind: 'reference', perEur: 106.272 },
    CNY: { kind: 'reference', perEur: 7.466 },
    JPY: { kind: 'reference', perEur: 175.51 },
    KRW: { kind: 'reference', perEur: 1482.46 },
    CAD: { kind: 'reference', perEur: 1.5665 },
    BRL: { kind: 'reference', perEur: 5.6485 },
    MXN: { kind: 'reference', perEur: 21.0226 },
    AUD: { kind: 'reference', perEur: 1.5939 },
    ZAR: { kind: 'reference', perEur: 18.5777 },
    AED: {
      kind: 'pegged',
      anchor: 'USD',
      perAnchor: 3.6725,
      source:
        'Central Bank of the UAE, Dirham Monetary Framework (FX swaps facility terms, 6 April 2023): ' +
        'reference spot rate AED 3.6725 per USD 1. https://centralbank.ae/media/5xmpymzi/fx-swaps-facility-t-c_06-04-2023.pdf',
    },
  },
};

/**
 * Currencies the engine can meet that hold no rate, and why. Conversion to or
 * from one of these returns null, and the resolver reports the mismatch.
 */
export const FX_UNSUPPORTED: Record<string, string> = {
  NGN: 'The ECB publishes no reference rate for the Nigerian naira, and it has no official peg.',
};

export interface FxConversion {
  /** The converted amount, unrounded. */
  amount: number;
  /** Units of `to` per 1 unit of `from`, derived through EUR at full precision. */
  rate: number;
  rateAsOf: string;
  source: string;
  /** `pegged` when either side goes through a peg. */
  kind: FxRateKind;
}

/** Units of `currency` per 1 EUR, and whether a peg was used. Null when unsupported. */
function perEur(currency: string, table: FxTable): { perEur: number; pegSource: string | null } | null {
  if (currency === 'EUR') return { perEur: 1, pegSource: null };
  const r = table.rates[currency];
  if (!r) return null;
  if (r.kind === 'reference') return { perEur: r.perEur, pegSource: null };
  const anchor = table.rates[r.anchor];
  if (r.anchor !== 'EUR' && (!anchor || anchor.kind !== 'reference')) return null;
  const anchorPerEur = r.anchor === 'EUR' ? 1 : (anchor as FxReferenceRate).perEur;
  return { perEur: r.perAnchor * anchorPerEur, pegSource: r.source };
}

export function isCurrencySupported(currency: string, table: FxTable = FX_RATES): boolean {
  return perEur(currency, table) !== null;
}

/**
 * Convert an amount between two currencies through EUR.
 *
 * Same currency returns the amount unchanged at rate 1; callers record no FX
 * entry for it. Null when either currency is unsupported. Nothing is rounded:
 * rounding belongs to whoever displays the figure.
 */
export function convertAmount(
  args: { amount: number; from: string; to: string },
  table: FxTable = FX_RATES
): FxConversion | null {
  const { amount, from, to } = args;
  if (from === to) return { amount, rate: 1, rateAsOf: table.asOf, source: table.source, kind: 'reference' };
  const f = perEur(from, table);
  const t = perEur(to, table);
  if (!f || !t) return null;
  const rate = t.perEur / f.perEur;
  const pegs = [f.pegSource, t.pegSource].filter((s): s is string => s !== null);
  return {
    amount: amount * rate,
    rate,
    rateAsOf: table.asOf,
    source: pegs.length ? `${table.source}; ${pegs.join('; ')}` : table.source,
    kind: pegs.length ? 'pegged' : 'reference',
  };
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/** '2026-10-23' to '23 October 2026', '2026-01' to 'January 2026'. */
export function formatAsOfDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  const month = MONTHS[Number(m) - 1] ?? m;
  return d ? `${Number(d)} ${month} ${y}` : `${month} ${y}`;
}

/** Plain words for a conversion: "converted from GBP to USD at 1.3368 (ECB, 23 October 2026)". */
export function describeConversion(c: { from: string; to: string; rate: number; rateAsOf: string; kind: FxRateKind }): string {
  const by = c.kind === 'pegged' ? 'ECB and an official peg' : 'ECB';
  return `converted from ${c.from} to ${c.to} at ${c.rate.toFixed(4)} (${by}, ${formatAsOfDate(c.rateAsOf)})`;
}
