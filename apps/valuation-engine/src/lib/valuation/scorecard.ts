import { ScorecardCriterionKey, ScorecardResult } from "./types";

export function computeScorecard(
  criteria: Record<ScorecardCriterionKey, { weight: number; score: number }>,
  averagePreMoneyValuation: number
): ScorecardResult {
  const criteriaKeys: ScorecardCriterionKey[] = ['team', 'opportunity', 'competitive_env', 'product_ip', 'partnerships', 'funding_required'];

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
  // Formula: Valuation = AvgPreMoneyValuation × (1 + Σ(weight_i × score_i))
  // score_i can be negative (below-average criterion), so clamp the result at 0 --
  // a valuation can't go negative even if every criterion scores at its floor.
  const valuation = Math.max(0, averagePreMoneyValuation * (1 + sumWeightedScore));

  return {
    criteria: result,
    sumWeightedScore,
    averagePreMoneyValuation,
    valuation,
  };
}
