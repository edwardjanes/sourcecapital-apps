import { CompanyStage, MethodApplicability, MethodWeightSet, ValuationMethodKey } from "./types";
import { STAGE_DEFAULT_WEIGHTS } from "./referenceData";

export function getDefaultWeightsForStage(stage: CompanyStage): MethodWeightSet {
  return { ...STAGE_DEFAULT_WEIGHTS[stage] };
}

export interface WeightedMethod {
  method: ValuationMethodKey;
  valuation: number;
  /** The stage weight, before redistribution. */
  weight: number;
  /** The weight actually applied. Equals `weight` when nothing was excluded. */
  effectiveWeight: number;
  applicable: boolean;
  inapplicableReason: string | null;
  weightedContribution: number;
}

export interface WeightedValuation {
  weightedValuation: number;
  perMethod: WeightedMethod[];
  /** Total stage weight belonging to excluded methods, before redistribution. */
  redistributedWeight: number;
  /** True when nothing was left to carry the weight -- the valuation is then 0. */
  allMethodsInapplicable: boolean;
}

/**
 * Combine the methods into one valuation, redistributing the weight of any method
 * that could not produce an answer.
 *
 * WHY REDISTRIBUTION RATHER THAN A ZERO. Before 27 Sep 2026 this was a plain
 * `sum(valuation * weight)` computed inline in compute.ts, so a method that could
 * not be applied contributed a zero at full weight -- which reads as "the company
 * is worth nothing by this method" when the truth is "this method does not apply
 * here". The VC method made that concrete: with `capitalRaised` finally wired,
 * Northwind's pre-money value is negative, because at a 48.6% required return the
 * GBP 2.5m raise does not clear. That is real information about the RAISE, not a
 * valuation of the company, and averaging it in at 16% understated the result.
 *
 * Note this is the general mechanism the audits kept asking for in four separate
 * places -- VC's negative pre-money, DCF-LTG's floored spread, Simple Multiples'
 * empty comparable set, and a blank industry. It is applied to VC and Multiples
 * today; extending it to the DCFs is a further decision, not an oversight.
 *
 * The scale factor preserves the caller's total weight rather than assuming it
 * sums to 1, so a caller supplying custom weights keeps its own normalisation.
 */
export function computeWeightedValuation(
  valuations: Record<ValuationMethodKey, number>,
  weights: MethodWeightSet,
  applicability: Partial<Record<ValuationMethodKey, MethodApplicability>> = {}
): WeightedValuation {
  const keys = Object.keys(weights) as ValuationMethodKey[];

  const total = keys.reduce((sum, k) => sum + (weights[k] || 0), 0);
  const retained = keys.reduce(
    (sum, k) => sum + (applicability[k]?.applicable === false ? 0 : weights[k] || 0),
    0
  );
  const redistributedWeight = total - retained;

  // Nothing applicable carries any weight: do not divide by zero, and do not
  // quietly fall back to the excluded methods either. Report a zero and say so.
  const allMethodsInapplicable = retained <= 0 && total > 0;
  const scale = retained > 0 ? total / retained : 0;

  const perMethod: WeightedMethod[] = keys.map((method) => {
    const valuation = valuations[method] || 0;
    const weight = weights[method] || 0;
    const applicable = applicability[method]?.applicable !== false;
    const effectiveWeight = applicable ? weight * scale : 0;
    return {
      method,
      valuation,
      weight,
      effectiveWeight,
      applicable,
      inapplicableReason: applicable ? null : applicability[method]?.reason ?? null,
      weightedContribution: valuation * effectiveWeight,
    };
  });

  return {
    weightedValuation: perMethod.reduce((sum, m) => sum + m.weightedContribution, 0),
    perMethod,
    redistributedWeight,
    allMethodsInapplicable,
  };
}
