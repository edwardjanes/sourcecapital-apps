import type { CountryDataTier } from './referenceData';

/**
 * Country data-quality disclaimer, worded per tier.
 *
 * Ticket 1 of the 25 Sep valuation brief is explicit that a single generic
 * "this is an estimate" footer is the failure mode to avoid, because it
 * undersells how uneven the underlying confidence actually is: one country is
 * validated, seven are partially sourced with a proxy maximum, and seventeen-plus
 * are openly illustrative. So each tier gets its own wording, and the
 * illustrative one is the strongest of the three.
 *
 * DRAFT COPY, PENDING SIGN-OFF. The brief specifies that three distinct
 * wordings are needed, not what they say, and lists the exact wording as an open
 * decision requiring sign-off before ship. These are written to be shippable if
 * approved as-is, but they are a starting point, not an approved string. The copy
 * lives here, separate from the tier logic in referenceData.ts, so it can be
 * rewritten without touching anything that computes.
 *
 * Deliberately absent: any attribution to Equidam. The reference data's own
 * header says it is "NOT Equidam's proprietary/internal data" -- it is sourced
 * from Damodaran/NYU Stern, PitchBook-NVCA, the British Business Bank and
 * Equidam's *published* industry multiples. Only Germany's figures were checked
 * against a real Equidam sample report. Presenting the output as an Equidam run
 * would attribute the methodology to a provider that is not powering it, on a
 * document founders forward to investors.
 */
export interface DataQualityDisclaimer {
  tier: CountryDataTier;
  /** Short label for a badge or table cell. */
  label: string;
  /** One-line summary, safe to use as a subtitle. */
  summary: string;
  /** The full disclaimer paragraph for the report's methodology section. */
  body: string;
  /** What the founder can do about it, where there is anything. */
  guidance: string | null;
}

const DISCLAIMERS: Record<CountryDataTier, Omit<DataQualityDisclaimer, 'tier'>> = {
  validated: {
    label: 'Benchmarks validated',
    summary:
      'The benchmark data for this country has been checked against a real sample valuation report.',
    body:
      'This valuation uses benchmark data for your country that we have validated: both the average ' +
      'and the maximum early-stage pre-money valuation were checked against a real sample valuation ' +
      'report, and the business survival curve is a sourced national figure rather than an ' +
      'approximation. The six methods, their weights and your own inputs still drive the result, so ' +
      'it remains an estimate rather than a price — but the country benchmarks it is measured ' +
      'against are the most reliable set we hold.',
    guidance: null,
  },
  partial: {
    label: 'Benchmarks partially sourced',
    summary:
      'Benchmarks for this country are drawn from published market data, but are not fully validated.',
    body:
      'This valuation uses benchmark data for your country that is partially sourced. The average ' +
      'early-stage pre-money valuation comes from published market data (PitchBook-NVCA, the British ' +
      'Business Bank, or PitchBook Europe 2025, depending on the country). The maximum used by the ' +
      'Checklist method is not independently sourced: it is estimated by applying the ratio observed ' +
      'in the one country where we hold a validated maximum. Treat the Scorecard and Checklist ' +
      'figures as indicative of the right order of magnitude rather than as precise market ' +
      'comparisons, and expect an investor to test them against their own data.',
    guidance:
      'If an investor questions the country benchmarks, the DCF and VC method results depend on your ' +
      'own projections rather than on these averages, and are the stronger figures to discuss.',
  },
  illustrative: {
    label: 'Benchmarks illustrative only',
    summary:
      'We hold no sourced benchmark data for this country. The country figures in this report are illustrative.',
    body:
      'Read this valuation with real caution. We could not find an adequate public source for ' +
      'early-stage valuation benchmarks in your country, so the country-level figures behind the ' +
      'Scorecard and Checklist methods are illustrative placeholders, not benchmarks — they have not ' +
      'been validated against market data and should not be presented to an investor as though they ' +
      'had. The business survival curve may also fall back to a generic default rather than a ' +
      'national figure. This affects the two methods that compare you to a country average or ' +
      'maximum, and therefore affects the weighted result.',
    guidance:
      'The DCF and VC method results are driven by your own projections rather than by country ' +
      'benchmarks, so they do not carry this limitation. Consider leading with those, and treat the ' +
      'weighted figure as a working number for your own planning rather than a defensible market ' +
      'valuation.',
  },
};

export function getDataQualityDisclaimer(tier: CountryDataTier): DataQualityDisclaimer {
  return { tier, ...DISCLAIMERS[tier] };
}
