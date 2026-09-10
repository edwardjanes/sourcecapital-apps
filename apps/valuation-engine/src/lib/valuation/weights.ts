import { CompanyStage, MethodWeightSet, ValuationMethodKey, ValuationReportOutput } from "./types";
import { STAGE_DEFAULT_WEIGHTS } from "./referenceData";

export function getDefaultWeightsForStage(stage: CompanyStage): MethodWeightSet {
  return { ...STAGE_DEFAULT_WEIGHTS[stage] };
}

export function computeWeightedValuation(
  methodResults: Record<ValuationMethodKey, number>,
  weights: MethodWeightSet
): { weighted: number; perMethod: { method: ValuationMethodKey; valuation: number; weight: number; contribution: number }[] } {
  const perMethod = (Object.keys(weights) as ValuationMethodKey[]).map((method) => {
    const valuation = methodResults[method] || 0;
    const weight = weights[method] || 0;
    const contribution = valuation * weight;
    return { method, valuation, weight, contribution };
  });

  const totalWeighted = perMethod.reduce((sum, m) => sum + m.contribution, 0);

  return {
    weighted: totalWeighted,
    perMethod,
  };
}
