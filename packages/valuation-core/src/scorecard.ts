import { ScorecardCriterionKey, ScorecardResult } from "./types";
import { SCORECARD_MULTIPLIER_MIN, SCORECARD_MULTIPLIER_MAX } from "./referenceData";

export function computeScorecard(
  criteria: Record<ScorecardCriterionKey, { weight: number; score: number }>,
  averagePreMoneyValuation: number
): ScorecardResult {
  const criteriaKeys: ScorecardCriterionKey[] = ['team', 'opportunity', 'competitive_env', 'product_ip', 'partnerships', 'funding_required', 'other'];

  const result: ScorecardResult["criteria"] = criteriaKeys.map((key) => {
    const criterion = criteria[key] || { weight: 0, score: 0 };
    const weight = criterion.weight;
    const score = criterion.score;
    const contribution = weight * score;

    return {
      key,
      weight,
      score,
      contribution,
    };
  });

  const sumWeightedScore = result.reduce((sum, c) => sum + c.contribution, 0);

  // Valuation = benchmark x composite multiplier, where the multiplier is
  // 1 + Sum(weight_i x delta_i). That is the spec's benchmark x Sum(weight x
  // rating) restated: with weights summing to 1 and delta = rating - 1,
  // Sum(w(1+delta)) = 1 + Sum(w.delta).
  //
  // Clamped to the method's own rating scale. Payne's ratings run 0.50 (materially
  // below the comparable average) to 1.50 (materially above), so with weights
  // summing to 1 the composite cannot legitimately fall outside that band. The
  // derived deltas span -0.98..+1.00, which would allow 0.02 to 2.00 -- a ceiling
  // a third more generous than the method permits, and a floor that would value a
  // company at 2% of the comparable average. Math.max(0, ...) only stopped it
  // going negative.
  const rawMultiplier = 1 + sumWeightedScore;
  const multiplier = Math.min(
    SCORECARD_MULTIPLIER_MAX,
    Math.max(SCORECARD_MULTIPLIER_MIN, rawMultiplier)
  );
  const valuation = averagePreMoneyValuation * multiplier;

  return {
    criteria: result,
    sumWeightedScore,
    averagePreMoneyValuation,
    valuation,
    // Surfaced so a report can say the rating hit the method's limit rather
    // than presenting a clamped figure as if it were the computed one.
    multiplier,
    multiplierClamped: rawMultiplier !== multiplier,
  };
}
