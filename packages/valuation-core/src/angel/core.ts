// One full run without the optimiser: pipeline, checks, quality score, range.
// runAngelValuation adds the actions on top; buildActions and simulate re-run
// this on counterfactual contexts.

import { getCountryDataTier, resolveCountryCode } from '../referenceData';
import { evaluateChecks, hasBlockingChecks, type CheckResult } from '../checks/evaluateChecks';
import { applyRangeSpread, computeQualityScore, type QualityScore, type RangeResult } from '../quality/qualityScore';
import { runPipeline, type PipelineResult } from './pipeline';
import type { ValuationContext } from './context';

export type RunStatus = 'ready' | 'draft' | 'benchmark_only';

export interface CoreRun extends PipelineResult {
  checks: CheckResult[];
  quality: QualityScore;
  range: RangeResult;
  status: RunStatus;
}

/** benchmark_only: the country's data is illustrative, or the country has no row at all. */
export function isBenchmarkOnly(country: string): boolean {
  return resolveCountryCode(country) === 'default' || getCountryDataTier(country) === 'illustrative';
}

export async function runCore(ctx: ValuationContext): Promise<CoreRun> {
  const pipeline = await runPipeline(ctx);
  const checks = evaluateChecks(ctx, pipeline.report);
  const quality = computeQualityScore(ctx, checks);
  const range = applyRangeSpread(pipeline.report, pipeline.sensitivity, quality);
  const status: RunStatus = isBenchmarkOnly(pipeline.mapped.company.country)
    ? 'benchmark_only'
    : hasBlockingChecks(checks)
      ? 'draft'
      : 'ready';
  return { ...pipeline, checks, quality, range, status };
}
