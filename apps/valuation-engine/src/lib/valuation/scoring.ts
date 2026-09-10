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

function rawTeamStrength(answers: QuestionnaireAnswers): number {
  const scores: number[] = [];

  if (answers.team_size !== undefined) {
    scores.push(answers.team_size >= 5 ? 75 : answers.team_size >= 3 ? 45 : 25);
  }
  if (answers.team_has_cto !== undefined) {
    scores.push(answers.team_has_cto ? 65 : 35);
  }
  if (answers.team_has_business_lead !== undefined) {
    scores.push(answers.team_has_business_lead ? 60 : 40);
  }
  if (answers.team_prior_exits !== undefined) {
    // No prior exits is the common case for first-time founders -- neutral, not a red flag.
    scores.push(answers.team_prior_exits ? 85 : 50);
  }

  return average(scores);
}

function rawOpportunitySize(answers: QuestionnaireAnswers): number {
  const scores: number[] = [];

  if (answers.tam_size !== undefined) {
    const tam = answers.tam_size;
    scores.push(tam > 10_000_000_000 ? 85 : tam > 1_000_000_000 ? 65 : tam > 100_000_000 ? 50 : 30);
  }
  if (answers.market_growth_rate !== undefined) {
    const growth = answers.market_growth_rate;
    scores.push(growth > 0.2 ? 85 : growth > 0.1 ? 65 : growth > 0.05 ? 50 : 30);
  }
  if (answers.recurring_revenue !== undefined) {
    scores.push(answers.recurring_revenue ? 65 : 40);
  }
  if (answers.has_customers !== undefined) {
    scores.push(answers.has_customers ? 65 : 30);
  }
  if (answers.product_market_fit !== undefined) {
    scores.push(answers.product_market_fit ? 80 : 30);
  }

  return average(scores);
}

function rawCompetitiveEnvironment(answers: QuestionnaireAnswers): number {
  const scores: number[] = [];

  if (answers.competitors_count !== undefined) {
    scores.push(answers.competitors_count <= 3 ? 60 : answers.competitors_count <= 10 ? 50 : 35);
  }
  if (answers.has_competitive_advantage !== undefined) {
    scores.push(answers.has_competitive_advantage ? 65 : 30);
  }

  return average(scores);
}

function rawProductStrength(answers: QuestionnaireAnswers): number {
  const scores: number[] = [];

  if (answers.product_status !== undefined) {
    const status = answers.product_status;
    scores.push(
      status === 'revenue_generating' ? 85 : status === 'beta' ? 55 : status === 'mvp' ? 35 : 15
    );
  }
  // Prefer the graded IP protection stage when present; fall back to the has_patents/has_ip booleans.
  // NOTE: the wizard initializes this field to '' (not undefined) until the user picks a dropdown
  // option, so we must treat '' the same as "not answered" -- otherwise the has_patents/has_ip
  // fallback below can never run for anyone who leaves the dropdown untouched.
  if (answers.ip_protection_stage) {
    const ipScore = { none: 25, pending: 50, granted: 75, enforced: 90 }[answers.ip_protection_stage as string];
    if (ipScore !== undefined) scores.push(ipScore);
  } else if (answers.has_patents !== undefined || answers.has_ip !== undefined) {
    scores.push(answers.has_patents || answers.has_ip ? 60 : 35);
  }

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
  const scores: number[] = [];

  if (answers.partnerships_count !== undefined) {
    scores.push(answers.partnerships_count >= 3 ? 65 : answers.partnerships_count >= 1 ? 50 : 35);
  }
  if (answers.has_strategic_investors !== undefined) {
    scores.push(answers.has_strategic_investors ? 70 : 40);
  }

  return average(scores);
}

function rawFundingRequired(answers: QuestionnaireAnswers): number {
  if (answers.capital_needed === undefined) return 50;

  const capital = answers.capital_needed;
  const revenue = answers.last_year_revenue || 100_000;
  const ratio = capital / revenue;

  return ratio < 0.5 ? 65 : ratio < 1.0 ? 50 : 35;
}

// Checklist-only criterion (no Scorecard counterpart) -- already a direct 0-1 "% of ideal",
// which is the correct unit for Checklist, so it's untouched by the rescale above.
function scoreOperatingStage(answers: QuestionnaireAnswers): number {
  if (answers.product_status) {
    const status = answers.product_status;
    return status === 'revenue_generating' ? 1.0 : status === 'beta' ? 0.5 : status === 'mvp' ? 0.25 : 0;
  }
  return 0;
}
