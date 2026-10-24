import {
  ScorecardCriterionKey,
  ChecklistCriterionKey,
  QuestionnaireAnswers,
} from './types';

// ---------------------------------------------------------------------------
// Sub-trait scoring: every raw* function below returns a score on a 1-100
// scale, where 50 means "average" for that sub-trait -- neither a strength
// nor a weakness. A genuinely weak answer scores below 50; a genuinely
// strong one scores above it. There is no floor at "average or better".
//
// The two consumers below read these raw scores differently:
//   - Scorecard needs a signed DELTA from average. Equidam's formula is
//     valuation = avgPreMoneyValuation x (1 + Sum(weight x delta)), where
//     delta is negative for below-average traits, positive for above --
//     e.g. NovaCloud's own report scores its team exactly 0.000 (average).
//     toScorecardDelta() maps 1-100 onto roughly -1..+1, with 50 -> 0.
//   - Checklist needs a 0-100% "how close to the ideal" score. Equidam's
//     formula is Sum(weight x percent x maxValuation) -- there's no
//     negative side, a weak company just earns less of the maximum.
//     toChecklistPercent() maps 1-100 onto 0.01..1.0 directly.
//
// NOTE: This rubric is ILLUSTRATIVE and an assumption -- Equidam's exact
// sub-trait weighting and thresholds are proprietary and unpublished.
// Users can override the resulting criterion scores directly in the UI.
// ---------------------------------------------------------------------------

function toScorecardDelta(raw: number): number {
  const clamped = Math.max(1, Math.min(100, raw));
  return (clamped - 50) / 50;
}

function toChecklistPercent(raw: number): number {
  const clamped = Math.max(1, Math.min(100, raw));
  return clamped / 100;
}

export function deriveScorecardCriteriaScores(
  answers: QuestionnaireAnswers
): Record<ScorecardCriterionKey, number> {
  return {
    team: toScorecardDelta(rawTeamStrength(answers)),
    opportunity: toScorecardDelta(rawOpportunitySize(answers)),
    competitive_env: toScorecardDelta(rawCompetitiveEnvironment(answers)),
    product_ip: toScorecardDelta(rawProductStrength(answers)),
    partnerships: toScorecardDelta(rawStrategicPartnerships(answers)),
    funding_required: toScorecardDelta(rawFundingRequired(answers)),
    // Payne's seventh factor, 5%: regulatory exposure, legal, customer
    // concentration, exceptional assets. None of it is collected yet, so this is
    // explicitly neutral rather than guessed. Restoring the weight now fixes the
    // funding_required double-count; the rubric follows when the inputs exist.
    other: 0,
  };
}

export function deriveChecklistCriteriaScores(
  answers: QuestionnaireAnswers
): Record<ChecklistCriterionKey, number> {
  return {
    team: toChecklistPercent(rawTeamStrength(answers)),
    idea: toChecklistPercent(rawOpportunitySize(answers)),
    product_ip: toChecklistPercent(rawProductStrength(answers)),
    relationships: toChecklistPercent(rawStrategicPartnerships(answers)),
    operating_stage: scoreOperatingStage(answers),
  };
}

// --- Raw (1-100, 50 = average) sub-trait scorers --------------------------

function average(scores: number[]): number {
  return scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 50;
}

/**
 * Score one sub-trait, or 50 if it was not answered.
 *
 * This is the whole of Scorecard audit finding 0. Previously an unanswered
 * sub-trait was omitted from the array, so `average()` ran over only the
 * answers that happened to exist -- and a factor with one supplied sub-trait
 * was decided entirely by it. Northwind's `partnerships` came out at
 * `average([70])` = 70, delta +0.40, on the strength of a single boolean,
 * because the portal never sends `partnerships_count`.
 *
 * Absence is not evidence of strength. The spec's own default for a factor with
 * no supporting evidence is 1.00, "broadly consistent with funded peers", so an
 * unanswered sub-trait now pulls its factor toward average instead of letting
 * the answered ones carry it. A factor with nothing answered still lands on 50,
 * exactly as `average([])` already did.
 */
function subTrait<T>(value: T | undefined | null, score: (v: T) => number): number {
  return value === undefined || value === null ? 50 : score(value);
}

function rawTeamStrength(answers: QuestionnaireAnswers): number {
  const scores: number[] = [
    subTrait(answers.team_size, (n) => (n >= 5 ? 75 : n >= 3 ? 45 : 25)),
    subTrait(answers.team_has_cto, (v) => (v ? 65 : 35)),
    subTrait(answers.team_has_business_lead, (v) => (v ? 60 : 40)),
    // No prior exits is the common case for first-time founders -- neutral, not a red flag.
    subTrait(answers.team_prior_exits, (v) => (v ? 85 : 50)),
  ];

  return average(scores);
}

function rawOpportunitySize(answers: QuestionnaireAnswers): number {
  const scores: number[] = [
    subTrait(answers.tam_size, (tam) =>
      tam > 10_000_000_000 ? 85 : tam > 1_000_000_000 ? 65 : tam > 100_000_000 ? 50 : 30
    ),
    subTrait(answers.market_growth_rate, (g) => (g > 0.2 ? 85 : g > 0.1 ? 65 : g > 0.05 ? 50 : 30)),
    subTrait(answers.recurring_revenue, (v) => (v ? 65 : 40)),
    subTrait(answers.has_customers, (v) => (v ? 65 : 30)),
    subTrait(answers.product_market_fit, (v) => (v ? 80 : 30)),
  ];

  return average(scores);
}

function rawCompetitiveEnvironment(answers: QuestionnaireAnswers): number {
  const scores: number[] = [
    subTrait(answers.competitors_count, (n) => (n <= 3 ? 60 : n <= 10 ? 50 : 35)),
    subTrait(answers.has_competitive_advantage, (v) => (v ? 65 : 30)),
  ];

  return average(scores);
}

/**
 * IP protection as one sub-trait.
 *
 * Precedence is unchanged: the graded stage wins, then the has_patents/has_ip
 * booleans. What changed is the fall-through -- with neither answered this now
 * returns a neutral 50 rather than dropping out of the average and letting
 * product_status decide the whole factor on its own.
 *
 * The '' check is load-bearing: the wizard initialises the dropdown to an empty
 * string rather than undefined, so treating '' as answered would stop the
 * boolean fallback ever running for anyone who left it untouched.
 */
function ipSubTrait(answers: QuestionnaireAnswers): number {
  if (answers.ip_protection_stage) {
    const ipScore = { none: 25, pending: 50, granted: 75, enforced: 90 }[
      answers.ip_protection_stage as string
    ];
    if (ipScore !== undefined) return ipScore;
  }
  if (answers.has_patents !== undefined || answers.has_ip !== undefined) {
    return answers.has_patents || answers.has_ip ? 60 : 35;
  }
  return 50;
}

function rawProductStrength(answers: QuestionnaireAnswers): number {
  const scores: number[] = [
    subTrait(answers.product_status, (status) =>
      status === 'revenue_generating' ? 85 : status === 'beta' ? 55 : status === 'mvp' ? 35 : 15
    ),
    ipSubTrait(answers),
  ];

  let raw = average(scores);
  // Legal risk is a penalty applied on top of the averaged sub-signals, not a separate criterion.
  if (answers.legal_risks) {
    raw -= 15;
  }
  // Note: business_model_type is collected by the UI but intentionally not scored --
  // no defensible ranking exists (SaaS vs Marketplace, etc).

  return Math.max(1, Math.min(100, raw));
}

function rawStrategicPartnerships(answers: QuestionnaireAnswers): number {
  const scores: number[] = [
    subTrait(answers.partnerships_count, (n) => (n >= 3 ? 65 : n >= 1 ? 50 : 35)),
    subTrait(answers.has_strategic_investors, (v) => (v ? 70 : 40)),
  ];

  return average(scores);
}

function rawFundingRequired(answers: QuestionnaireAnswers): number {
  if (answers.capital_needed === undefined) return 50;

  const capital = answers.capital_needed;
  const revenue = answers.last_year_revenue || 100_000;
  const ratio = capital / revenue;

  return ratio < 0.5 ? 65 : ratio < 1.0 ? 50 : 35;
}

/**
 * Checklist-only criterion (no Scorecard counterpart) -- already a direct 0-1
 * "% of ideal", which is the correct unit for Checklist, so it is untouched by
 * the rescale above.
 *
 * The spec names TWO inputs for Operating Stage: "the company's development
 * stage and current profitability". Only the first was read. `sustainably_breakeven`
 * has been collected by the wizard since this method shipped and fed nothing, so
 * a revenue-generating but loss-making company scored the maximum on a criterion
 * that is meant to measure what it has demonstrably achieved.
 *
 * Not breakeven scores 0.4 rather than 0: for an early-stage company it is the
 * normal state, not a failure, and the spec lists "progress toward break-even" as
 * evidence rather than breakeven itself as a gate.
 *
 * The all-absent case still returns 0, unchanged. That is the zero-vs-neutral
 * inconsistency in AUDIT-02 divergence 2 -- the other four criteria treat absence
 * as average -- and it is deliberately left alone here because it is Ed's
 * decision, not something to change while adding an input.
 */
function scoreOperatingStage(answers: QuestionnaireAnswers): number {
  const signals: number[] = [];

  if (answers.product_status) {
    const status = answers.product_status;
    signals.push(
      status === 'revenue_generating' ? 1.0 : status === 'beta' ? 0.5 : status === 'mvp' ? 0.25 : 0
    );
  }
  // Only a real boolean counts. The portal maps "Yes"/"No" before sending, but
  // the compute route is callable by n8n with any payload, and a leaked string
  // would be truthy -- "No" would score as profitable. Belt and braces for a
  // defect the portal's own test caught once already.
  if (typeof answers.sustainably_breakeven === 'boolean') {
    signals.push(answers.sustainably_breakeven ? 1.0 : 0.4);
  }

  if (signals.length === 0) return 0;
  return signals.reduce((a, b) => a + b, 0) / signals.length;
}
