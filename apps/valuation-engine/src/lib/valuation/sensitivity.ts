import { computeValuation } from './compute';
import {
  SIZE_PREMIUM_BANDS,
  SMALL_COMPANY_MULTIPLE_FACTOR,
  LTG_GROWTH_RATE_MIN,
  LTG_GROWTH_RATE_MAX,
  VC_REQUIRED_ROI,
} from './referenceData';
import type {
  CompanyProfile,
  FinancialYear,
  QuestionnaireAnswers,
  UpdatedValuationParameters,
} from './types';

/**
 * Sensitivity of the composite valuation to the inputs that actually drive it.
 *
 * WHY THIS EXISTS. All six method specs ask for one, and the engine reported a
 * point estimate with a FIXED +/-9.6% band regardless of inputs -- the same width
 * for a company with five years of audited accounts and one with a blank forecast.
 * That is not a sensitivity, it is a decoration. The DCF-LTG spec lists "Reporting
 * a point estimate without WACC/g sensitivity" among its Common Errors and the
 * DCF-EM spec repeats it; Scorecard and Checklist both have a "Test Sensitivity"
 * step; Simple Multiples has a "Median and Range" section. Six for six.
 *
 * WHAT THIS IS. A one-at-a-time (tornado) sensitivity: each driver is moved to
 * each end of ITS OWN documented range while everything else is held at base, and
 * the composite is recomputed. Drivers are returned sorted by impact, so the
 * report can say which assumption the answer actually rests on.
 *
 * WHAT THIS IS NOT. It is not a joint scenario. Moving every driver to its adverse
 * end at once would produce a far wider band and imply a correlation nobody has
 * estimated. `lowBound`/`highBound` below are therefore the widest SINGLE-driver
 * move in each direction, which is the standard reading of a tornado chart and is
 * labelled as such rather than presented as a confidence interval.
 */

export type SensitivityBasis = 'sourced' | 'modelled' | 'unavailable';

export interface SensitivityPoint {
  /** The driver's value at this end of its range. */
  value: number;
  weightedValuation: number;
  /** Change against the base composite, as a fraction. */
  delta: number;
}

export interface SensitivityDriver {
  key: string;
  label: string;
  basis: SensitivityBasis;
  /** Where the range comes from, specific enough to check. */
  source: string;
  low: SensitivityPoint | null;
  high: SensitivityPoint | null;
  /** Largest absolute delta either way. Null when the range is unavailable. */
  impact: number | null;
  note?: string;
}

export interface SensitivityResult {
  baseValuation: number;
  drivers: SensitivityDriver[];
  /** Widest single-driver move each way. NOT a joint scenario, NOT a confidence interval. */
  lowBound: number;
  highBound: number;
  /**
   * Share of the composite's weight carried by methods whose key driver HAS a
   * range. Below 1 means the band understates: something material could not be
   * varied. Read it before quoting the band.
   */
  coverage: number;
  /** Drivers that could not be varied, and why. */
  gaps: string[];
  /**
   * True when coverage < 1, i.e. something material could not be varied and the
   * band is therefore TOO NARROW.
   *
   * This is not a formality. At `development` stage the benchmark drives roughly
   * 60% of the weight and cannot be varied at all, so the computed band comes out
   * at about -3%/+5% -- NARROWER than the arbitrary +/-9.6% it replaces, and so
   * more misleading, not less. A partial sensitivity presented as a full one is
   * worse than no sensitivity. Do not render the bounds without this flag.
   */
  understated: boolean;
}

type Inputs = {
  profile: CompanyProfile;
  financials: FinancialYear[];
  questionnaire: QuestionnaireAnswers | null;
  parameters: UpdatedValuationParameters;
};

/** Deep-enough clone for the parameter tweaks below. */
const withParams = (
  p: UpdatedValuationParameters,
  tweak: (p: UpdatedValuationParameters) => void
): UpdatedValuationParameters => {
  const next = {
    ...p,
    vc_method: { ...p.vc_method },
    dcf_shared: { ...p.dcf_shared },
    dcf_ltg: { ...p.dcf_ltg },
    dcf_multiple: { ...p.dcf_multiple },
    scorecard: { ...p.scorecard },
    checklist: { ...p.checklist },
    simple_multiples: { ...p.simple_multiples },
  };
  tweak(next);
  return next;
};

export async function computeSensitivity(inputs: Inputs): Promise<SensitivityResult> {
  const { profile, financials, questionnaire, parameters } = inputs;

  const base = await computeValuation(profile, financials, questionnaire, parameters);
  const baseValuation = base.weightedValuation;

  const at = async (
    value: number,
    tweak: (p: UpdatedValuationParameters) => void
  ): Promise<SensitivityPoint> => {
    const r = await computeValuation(profile, financials, questionnaire, withParams(parameters, tweak));
    return {
      value,
      weightedValuation: r.weightedValuation,
      delta: baseValuation === 0 ? 0 : r.weightedValuation / baseValuation - 1,
    };
  };

  /**
   * Assign low/high by the RESULTING VALUATION, never by assuming which end of a
   * driver's range is favourable.
   *
   * Found the hard way: a LOWER VC hurdle raises that method's value, which can
   * take it past the threshold where it stops being excluded -- and since VC is
   * usually the lowest of the five, including it LOWERS the composite. So the
   * favourable end of the driver produced the adverse end of the answer. The same
   * inversion is possible for any driver that interacts with method exclusion.
   */
  const ends = (a: SensitivityPoint, b: SensitivityPoint) =>
    a.weightedValuation <= b.weightedValuation ? { low: a, high: b } : { low: b, high: a };

  const drivers: SensitivityDriver[] = [];

  // --- Discount rate, via the size premium -------------------------------
  // The size premium is the largest judgement in the rate and has two published
  // anchors: CRSP decile 10 (4.7%, what we use) and decile 10z (11.2%, which was
  // measured and rejected for overlapping the illiquidity discount). The band
  // above 4.7% is 3.0%, i.e. treating the company as one size class larger.
  {
    const buildUp = parameters.discount_rate_build_up;
    const basePremium = buildUp?.sizePremium ?? SIZE_PREMIUM_BANDS[SIZE_PREMIUM_BANDS.length - 1].premium;
    const capm = (buildUp?.riskFreeRate ?? 0) + (buildUp?.systematicRiskPremium ?? 0);
    const rateAt = (premium: number) => capm + premium;
    // Low premium -> low rate -> HIGH valuation, so the labels follow the
    // VALUATION not the driver.
    const lowPremium = 0.030;
    const highPremium = 0.112;

    const a = await at(lowPremium, (p) => {
      p.dcf_shared.discount_rate = rateAt(lowPremium);
      p.dcf_ltg.terminal_return_on_new_capital = rateAt(lowPremium);
    });
    const b = await at(highPremium, (p) => {
      p.dcf_shared.discount_rate = rateAt(highPremium);
      p.dcf_ltg.terminal_return_on_new_capital = rateAt(highPremium);
    });
    const { low: lo, high: hi } = ends(a, b);
    drivers.push({
      key: 'size_premium',
      label: 'Size premium in the discount rate',
      basis: 'sourced',
      source:
        'Kroll CRSP decile 10 (4.7%, used) against decile 10z (11.2%) at the adverse end, ' +
        'and the 3.0% band one size class larger at the favourable end.',
      low: lo,
      high: hi,
      impact: Math.max(Math.abs(lo.delta), Math.abs(hi.delta)),
      note: 'Only the two DCF methods read this rate.',
    });
  }

  // --- Sector multiples, via the small-company factor --------------------
  // 0.28 is calibrated on the SaaS cohort; 0.50 was documented and rejected as an
  // entry-multiple reading. Damodaran's unscaled aggregate is 1.0 and is not a
  // credible exit multiple for a company this size, so it is not the upper end.
  {
    const scaleBy = (k: number) => k / SMALL_COMPANY_MULTIPLE_FACTOR;
    const a = await at(0.50, (p) => {
      p.dcf_multiple.exit_multiple *= scaleBy(0.50);
      p.vc_method.industry_multiple *= scaleBy(0.50);
    });
    const b = await at(0.20, (p) => {
      p.dcf_multiple.exit_multiple *= scaleBy(0.20);
      p.vc_method.industry_multiple *= scaleBy(0.20);
    });
    const { low: lo, high: hi } = ends(a, b);
    drivers.push({
      key: 'small_company_multiple_factor',
      label: 'Small-company discount on sector multiples',
      basis: 'modelled',
      source:
        'SMALL_COMPANY_MULTIPLE_FACTOR 0.28, calibrated on the SaaS cohort, against 0.50 ' +
        '(the documented and rejected entry-multiple reading) and 0.20 at the adverse end.',
      low: lo,
      high: hi,
      impact: Math.max(Math.abs(lo.delta), Math.abs(hi.delta)),
    });
  }

  // --- VC required return -------------------------------------------------
  // Sahlman's published ranges, which is the one driver with a genuinely sourced
  // low and high for this company's own stage.
  {
    const RANGES: Record<keyof typeof VC_REQUIRED_ROI, [number, number]> = {
      idea: [0.50, 0.70], development: [0.40, 0.60], startup: [0.35, 0.50],
      expansion: [0.35, 0.50], growth: [0.30, 0.40], maturity: [0.25, 0.35],
    };
    const [rLo, rHi] = RANGES[parameters.stage];
    const a = await at(rLo, (p) => { p.vc_method.required_roi = rLo; });
    const b = await at(rHi, (p) => { p.vc_method.required_roi = rHi; });
    const { low: lo, high: hi } = ends(a, b);
    drivers.push({
      key: 'vc_required_roi',
      label: 'VC required annual return',
      basis: 'sourced',
      source: `Sahlman's published range for this stage, ${(rLo * 100).toFixed(0)}-${(rHi * 100).toFixed(0)}%.`,
      low: lo,
      high: hi,
      impact: Math.max(Math.abs(lo.delta), Math.abs(hi.delta)),
      note:
        'Can move the composite in the counter-intuitive direction: a LOWER hurdle raises ' +
        'the VC value, which can take it past the threshold where it stops being excluded, ' +
        'and including a below-average method lowers the composite.',
    });
  }

  // --- Terminal growth ----------------------------------------------------
  {
    const a = await at(LTG_GROWTH_RATE_MAX, (p) => { p.dcf_ltg.terminal_growth_rate = LTG_GROWTH_RATE_MAX; });
    const b = await at(LTG_GROWTH_RATE_MIN, (p) => { p.dcf_ltg.terminal_growth_rate = LTG_GROWTH_RATE_MIN; });
    const { low: lo, high: hi } = ends(a, b);
    drivers.push({
      key: 'terminal_growth_rate',
      label: 'Perpetual growth rate',
      basis: 'modelled',
      source: `LTG_GROWTH_RATE_MIN ${LTG_GROWTH_RATE_MIN} to LTG_GROWTH_RATE_MAX ${LTG_GROWTH_RATE_MAX}.`,
      low: lo,
      high: hi,
      impact: Math.max(Math.abs(lo.delta), Math.abs(hi.delta)),
      note: 'Narrow because the base already sits at the maximum.',
    });
  }

  // --- The benchmark, which cannot be varied yet --------------------------
  // Scorecard multiplies it and Checklist takes a fraction of a ceiling derived
  // from it, so it is the single largest driver at early stages -- and there is no
  // distribution to vary it over until the benchmark reference table lands
  // (ClickUp z8mad3quyr). Reported as a named gap rather than invented.
  const benchmarkWeight =
    (base.perMethod.find((m) => m.method === 'scorecard')?.effectiveWeight ?? 0) +
    (base.perMethod.find((m) => m.method === 'checklist')?.effectiveWeight ?? 0);

  drivers.push({
    key: 'benchmark_pre_money',
    label: 'Benchmark pre-money valuation',
    basis: 'unavailable',
    source:
      'No distribution exists: avg_seed_pre_money is a single figure per country, and it is a ' +
      'mean where the method requires a median. The p25/median/p75 that would drive this comes ' +
      'with the benchmark reference table (ClickUp z8mad3quyr).',
    low: null,
    high: null,
    impact: null,
    note: `Carries ${(benchmarkWeight * 100).toFixed(1)}% of the weight here via Scorecard and Checklist.`,
  });

  drivers.sort((a, b) => (b.impact ?? -1) - (a.impact ?? -1));

  const moved = drivers.filter((d) => d.impact !== null);
  const lowBound = Math.min(baseValuation, ...moved.map((d) => d.low!.weightedValuation));
  const highBound = Math.max(baseValuation, ...moved.map((d) => d.high!.weightedValuation));

  return {
    baseValuation,
    drivers,
    lowBound,
    highBound,
    coverage: Math.max(0, 1 - benchmarkWeight),
    understated: benchmarkWeight > 1e-9,
    gaps: drivers.filter((d) => d.basis === 'unavailable').map((d) => `${d.label}: ${d.source}`),
  };
}
