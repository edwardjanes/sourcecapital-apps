import type { ValuationContext } from '../angel/context';
import { runCore } from '../angel/core';
import { OPTIMISE_RULES } from './rules';

export interface SimulationResult {
  point: number;
  low: number;
  high: number;
  deltaPoint: number;
  deltaLow: number;
  deltaHigh: number;
}

/** The context after every ticked counterfactual, applied in rule-set order. Unknown codes are ignored. */
export function applyCounterfactuals(ctx: ValuationContext, tickedCodes: readonly string[]): ValuationContext {
  const ticked = new Set(tickedCodes);
  return OPTIMISE_RULES.filter((r) => ticked.has(r.code)).reduce((acc, rule) => rule.counterfactual(acc), ctx);
}

/**
 * One pipeline run on the context after the ticked counterfactuals, against the
 * run with none. The combined effect is never the sum of single effects: the
 * methods interact (the stage moves the weights, clamps and hurdles bind).
 */
export async function simulate(ctx: ValuationContext, tickedCodes: readonly string[]): Promise<SimulationResult> {
  const [base, after] = await Promise.all([runCore(ctx), runCore(applyCounterfactuals(ctx, tickedCodes))]);
  const point = after.report.weightedValuation;
  return {
    point,
    low: after.range.low,
    high: after.range.high,
    deltaPoint: point - base.report.weightedValuation,
    deltaLow: after.range.low - base.range.low,
    deltaHigh: after.range.high - base.range.high,
  };
}
