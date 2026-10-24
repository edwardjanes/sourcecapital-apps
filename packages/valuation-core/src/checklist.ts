import { ChecklistCriterionKey, ChecklistResult } from "./types";

export function computeChecklist(
  criteria: Record<ChecklistCriterionKey, { weight: number; score: number }>,
  maxValuation: number
): ChecklistResult {
  const criteriaKeys: ChecklistCriterionKey[] = ['team', 'idea', 'product_ip', 'relationships', 'operating_stage'];

  const result: ChecklistResult["criteria"] = criteriaKeys.map((key) => {
    const criterion = criteria[key] || { weight: 0, score: 0 };
    const weight = criterion.weight;
    const score = criterion.score;
    const achievedValue = weight * score * maxValuation;

    return {
      key,
      weight,
      score,
      achievedValue,
    };
  });

  const valuation = result.reduce((sum, c) => sum + c.achievedValue, 0);

  return {
    criteria: result,
    maxValuation,
    valuation,
  };
}
