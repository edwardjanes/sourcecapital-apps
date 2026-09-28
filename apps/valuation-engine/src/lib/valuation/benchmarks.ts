/**
 * Benchmark pre-money valuations by geography and stage.
 *
 * Replaces `COUNTRIES[x].avgSeedPreMoney`, a single figure per country used at
 * every stage. Two things were wrong with it, and they were NOT the same thing in
 * every country -- which is why one blanket correction could never have worked:
 *
 *   US  $7,700,000  was EXACTLY PitchBook-NVCA's PRE-SEED median (Q3 2025).
 *                   A median, of the wrong stage. Their seed median is $15.8M.
 *   GB  £7,100,000  was close to the BBB seed MEAN of £6.0m.
 *                   The right stage, the wrong statistic. Their median is £3.2m.
 *
 * Correcting both to a seed median roughly DOUBLES the US benchmark and roughly
 * HALVES the UK one.
 *
 * HONEST SPARSITY IS THE DESIGN. 25 countries x 5 stages is 125 cells and
 * credible medians exist for a handful. The Simple Multiples spec says it
 * plainly: "True comparables are often scarce, and private-company terms are
 * incompletely disclosed." Chasing coverage means inventing figures, which is
 * exactly how the previous table came to carry illustrative numbers presented as
 * benchmarks. So: few well-sourced cells, an explicit fallback, and a resolution
 * that always says which rung it landed on. A founder benchmarked against a
 * global figure is told so.
 *
 * NO FX CONVERSION, consistent with the engine's standing decision (31 Aug 2026).
 * Each cell carries its own currency and the resolver reports a mismatch rather
 * than converting.
 */

export type BenchmarkStage = 'pre_seed' | 'seed' | 'series_a' | 'series_b' | 'series_c_plus';

export type BenchmarkBasis =
  /** Reproduces a real sample valuation report. Do not change without re-validating. */
  | 'validated'
  /** A published median from a named report. */
  | 'sourced'
  /** Derived from another cell by a documented rule. Not observed. */
  | 'modelled';

export interface ValuationBenchmark {
  /** ISO 3166-1 alpha-2, or a region code prefixed `r:`. */
  geography: string;
  stage: BenchmarkStage;
  preMoney: {
    median: number;
    /**
     * The published MEAN, where the same source publishes both. Its distance
     * above the median is a direct reading of how right-skewed the market is,
     * and it is the only distribution evidence available for most cells.
     */
    mean?: number;
  };
  currency: string;
  basis: BenchmarkBasis;
  /** Specific enough to re-find: publication, table, period. */
  source: string;
  /** ISO date of the underlying data, not of when it was entered. */
  asOf: string;
}

/**
 * Engine stage -> benchmark stage. DECIDED 28 Sep 2026 by Ed: `development` maps
 * to `seed`.
 *
 * WHY EVERYTHING FROM `development` UP ALSO MAPS TO SEED, rather than climbing the
 * funding ladder. Scorecard and Checklist are early-stage methods by construction:
 * Payne's benchmark is defined as the pre-money valuation of comparable
 * EARLY-STAGE companies, and the Checklist spec quotes Berkus saying his method
 * "is no longer appropriate once a company has generated revenue for a meaningful
 * period". Feeding a Series A benchmark into them does not make them more accurate
 * for a scaled company, it uses them outside their domain and inflates the answer.
 *
 * That was not theoretical. Mapping `expansion` to `series_a` -- the mapping this
 * table originally proposed -- sent a UK company with GBP 900k of revenue to a
 * global Series A cell and produced a Scorecard of GBP 34,230,000.
 *
 * Relevance at later stages is already handled, and handled better, by the stage
 * WEIGHTS: Scorecard and Checklist fall from 38% each at `idea` to 6% at
 * `expansion` and zero at `growth` and `maturity`. So the benchmark stays where the
 * method works, and the weight decides how much it counts.
 *
 * `pre_seed` is kept for `idea` because a pre-product company genuinely is priced
 * against a different population, and because that is the one place the
 * distinction is well evidenced.
 */
export const BENCHMARK_STAGE_BY_COMPANY_STAGE = {
  idea: 'pre_seed',
  development: 'seed',
  startup: 'seed',
  expansion: 'seed',
  growth: 'seed',
  maturity: 'seed',
} as const satisfies Record<string, BenchmarkStage>;

/** Which region a country falls back to. Only countries we can place are listed. */
export const REGION_BY_COUNTRY: Record<string, string> = {
  GB: 'r:europe', DE: 'r:europe', FR: 'r:europe', NL: 'r:europe', IE: 'r:europe',
  ES: 'r:europe', IT: 'r:europe', SE: 'r:europe', CH: 'r:europe', PL: 'r:europe',
  US: 'r:north_america', CA: 'r:north_america',
};

export const VALUATION_BENCHMARKS: ValuationBenchmark[] = [
  // --- United States. The one country with a published median at every stage.
  {
    geography: 'US', stage: 'pre_seed', preMoney: { median: 7_700_000 }, currency: 'USD',
    basis: 'sourced', asOf: '2025-09-30',
    source: 'PitchBook-NVCA Venture Monitor, Q3 2025 — median pre-seed pre-money valuation.',
  },
  {
    geography: 'US', stage: 'seed', preMoney: { median: 15_800_000 }, currency: 'USD',
    basis: 'sourced', asOf: '2025-09-30',
    source: 'PitchBook-NVCA Venture Monitor, Q3 2025 — median seed pre-money valuation.',
  },
  {
    geography: 'US', stage: 'series_a', preMoney: { median: 46_500_000 }, currency: 'USD',
    basis: 'sourced', asOf: '2025-09-30',
    source: 'PitchBook-NVCA Venture Monitor, Q3 2025 — median Series A pre-money valuation.',
  },

  // --- United Kingdom. Seed only: the BBB and Beauhurst classify companies as
  // seed, venture or growth, so there is no UK pre-seed dataset to cite. The mean
  // is published alongside and is nearly twice the median, which is the clearest
  // single piece of evidence in this file that these distributions are skewed and
  // that a mean is the wrong statistic.
  {
    geography: 'GB', stage: 'seed',
    preMoney: { median: 3_200_000, mean: 6_000_000 }, currency: 'GBP',
    basis: 'sourced', asOf: '2025-12-31',
    source: 'British Business Bank, Small Business Equity Tracker 2026 (2025 calendar year) — median UK seed pre-money £3.2m, mean £6.0m.',
  },

  // --- Germany. Kept at its existing figure and marked `validated`: it is the one
  // country that reproduces a real Equidam sample report, which is also what the
  // survival curve work was checked against. Changing it breaks that reproduction,
  // so it should not move without re-validating. Its stage is not documented by
  // the original source note; recorded at `seed` to match how it was used.
  {
    geography: 'DE', stage: 'seed', preMoney: { median: 6_107_000 }, currency: 'EUR',
    basis: 'validated', asOf: '2026-08-01',
    source: 'Validated against a real Equidam sample valuation report. The only reproduction point this table has — re-validate before changing.',
  },

  // --- Europe, regional. Finer grain is not published.
  {
    geography: 'r:europe', stage: 'pre_seed', preMoney: { median: 3_480_000 }, currency: 'USD',
    basis: 'sourced', asOf: '2026-03-31',
    source: 'Equidam, Q1 2026 — median European pre-seed valuation, reported in USD.',
  },
  {
    geography: 'r:europe', stage: 'seed', preMoney: { median: 5_600_000 }, currency: 'EUR',
    basis: 'sourced', asOf: '2025-03-31',
    source: 'PitchBook European Venture Report, Q1 2025 — median European seed valuation.',
  },

  // --- Global, the last rung. Nothing falls through this.
  {
    geography: 'r:global', stage: 'pre_seed', preMoney: { median: 5_870_000 }, currency: 'USD',
    basis: 'sourced', asOf: '2026-03-31',
    source: 'Equidam, Q1 2026 — global median pre-seed valuation.',
  },
  {
    geography: 'r:global', stage: 'seed', preMoney: { median: 5_600_000 }, currency: 'EUR',
    basis: 'modelled', asOf: '2025-03-31',
    source: 'No global seed median is published. Carries the European figure, which is the more conservative of the two regions with data, rather than inventing one.',
  },
  // NO global or European Series A cell, deliberately.
  //
  // A ~$28M median European Series A pre-money is reported in the trade press, and
  // it was in this table briefly. It came out because it is a single secondary
  // citation, quoted in USD, and using it gave a UK expansion-stage company a
  // Scorecard of GBP 34,230,000 on GBP 900k of revenue. That is the exact failure
  // this file exists to end: a weak figure, unlabelled at the point of use,
  // producing a confident wrong answer.
  //
  // With it gone, an expansion-stage company outside the US resolves to NO
  // benchmark, and Scorecard and Checklist are excluded and surrender their weight
  // -- which is a true statement about what is known, and reuses the exclusion
  // machinery already in the engine. Both are early-stage methods by design; the
  // Checklist spec quotes Berkus saying his method "is no longer appropriate once a
  // company has generated revenue for a meaningful period", so having them drop out
  // for a scaled company is not much of a loss.
];

export type BenchmarkRung =
  | 'stage_country'
  | 'stage_region'
  | 'stage_global'
  | 'none';

export interface BenchmarkResolution {
  benchmark: ValuationBenchmark | null;
  /** Which rung matched, most specific first. */
  rung: BenchmarkRung;
  /** True when the match is not this company's own country. */
  substituted: boolean;
  /** True when the cell's currency is not the company's own. Never converted. */
  currencyMismatch: boolean;
  /** Plain-language line the report can print. */
  note: string;
}

/**
 * Resolve the benchmark for a company, and always say what was resolved.
 *
 * There is deliberately no silent `default` bucket: a founder in Nigeria
 * benchmarked against a global median should be TOLD that, which is a more honest
 * statement than the unlabelled country figure they used to get.
 */
export function resolveBenchmark(args: {
  countryCode: string;
  stage: keyof typeof BENCHMARK_STAGE_BY_COMPANY_STAGE;
  currency: string;
}): BenchmarkResolution {
  const stage = BENCHMARK_STAGE_BY_COMPANY_STAGE[args.stage];
  const region = REGION_BY_COUNTRY[args.countryCode];

  const find = (geography: string) =>
    VALUATION_BENCHMARKS.find((b) => b.geography === geography && b.stage === stage) ?? null;

  const attempts: Array<[BenchmarkRung, ValuationBenchmark | null]> = [
    ['stage_country', find(args.countryCode)],
    ['stage_region', region ? find(region) : null],
    ['stage_global', find('r:global')],
  ];

  for (const [rung, benchmark] of attempts) {
    if (!benchmark) continue;
    const substituted = rung !== 'stage_country';
    const currencyMismatch = benchmark.currency !== args.currency;
    const where =
      rung === 'stage_country'
        ? `${args.countryCode} ${stage.replace('_', '-')} companies`
        : rung === 'stage_region'
          ? `${benchmark.geography.replace('r:', '')} ${stage.replace('_', '-')} companies, as no ${args.countryCode} figure is published`
          : `${stage.replace('_', '-')} companies globally, as neither a ${args.countryCode} nor a regional figure is published`;
    return {
      benchmark,
      rung,
      substituted,
      currencyMismatch,
      note:
        `Benchmarked against the median pre-money valuation of ${where}. ${benchmark.source}` +
        (currencyMismatch
          ? ` Note this figure is quoted in ${benchmark.currency} and has not been converted to ${args.currency}.`
          : ''),
    };
  }

  return {
    benchmark: null,
    rung: 'none',
    substituted: false,
    currencyMismatch: false,
    note: `No benchmark is published for ${stage.replace('_', '-')} companies at any level of geography.`,
  };
}

/**
 * The Checklist ceiling.
 *
 * Still the Germany-validated max/median ratio of 2.155x, now applied to a
 * corrected base. The spec prefers a p75 of a well-matched dataset and says so
 * explicitly -- "A high percentile, such as the 75th or 90th percentile ... is
 * often more stable than the literal maximum" -- but no source in this file
 * publishes quartiles, so inventing one would be the same mistake this table
 * exists to correct. Marked `modelled` wherever it is used.
 */
export const CHECKLIST_MAX_RATIO = 2.155;
