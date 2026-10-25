/**
 * As-of date of each reference dataset, taken from the source comments in
 * referenceData.ts and benchmarks.ts. Precision follows the source: a day where
 * the source names a day, a month where it names only a month ("Jan 2026
 * update"). TheAngel's parameter_stale check reads this and warns once a
 * dataset is over 12 months old (the FX table: over FX_STALE_DAYS).
 *
 * `null` means the source comments give no single date for the dataset. Do not
 * fill one in without a source.
 */
import { FX_RATES } from './fx';

export const REFERENCE_DATA_AS_OF: {
  readonly riskFreeRates: string | null;
  readonly countryEquityRiskPremiums: string | null;
  readonly damodaranIndustryRows: string | null;
  readonly pitchbookNvca: string | null;
  readonly britishBusinessBank: string | null;
  readonly survivalCurves: string | null;
  /** fx.ts: the ECB reference date of the FX table. Never null: the table always has a date. Stale after FX_STALE_DAYS. */
  readonly fxRates: string;
} = {
  // referenceData.ts header: "Trading Economics (10Y govn't bond yields, Aug 21 2026)".
  riskFreeRates: '2026-08-21',
  // referenceData.ts header: Damodaran/NYU Stern "Country Default Spreads" (Jan 2026 update).
  countryEquityRiskPremiums: '2026-01',
  // referenceData.ts SECTOR_SOURCE: "Aswath Damodaran's US industry datasets, January 2026"
  // (multiples and betas, both re-sourced 27-28 Sep 2026 from that release).
  damodaranIndustryRows: '2026-01',
  // benchmarks.ts: PitchBook-NVCA Venture Monitor, Q3 2025, asOf '2025-09-30'.
  pitchbookNvca: '2025-09-30',
  // benchmarks.ts: British Business Bank, Small Business Equity Tracker 2026 (2025 calendar year), asOf '2025-12-31'.
  britishBusinessBank: '2025-12-31',
  // SURVIVAL_RATES_BY_COUNTRY: each country cites a different cohort and report year
  // (ONS 2024, INSEE 2010-2015 cohort, CSO 2023, ...); there is no single as-of date.
  survivalCurves: null,
  // fx.ts FX_RATES.asOf: ECB euro foreign exchange reference rates, reference date of the file.
  fxRates: FX_RATES.asOf,
};
