// Data-quality score (0 to 100) and the range-spread rule.

import type { ValuationReportOutput } from '../types';
import type { SensitivityResult } from '../sensitivity';
import { INTAKE_FIELDS, INTAKE_STEPS, type IntakeStepDef } from '../intake/fields';
import { gridSourceKey, sourceOf, type ValuationContext } from '../angel/context';
import { isBlank, optionalFinancialRowsEntered, requiredStatus } from '../checks/required';
import { referenceDataAge, type CheckResult } from '../checks/evaluateChecks';

export type QualityLabel = 'Low' | 'Fair' | 'Good' | 'Strong';

export interface QualityBlock {
  key: 'completeness' | 'evidence' | 'consistency' | 'freshness';
  points: number;
  max: number;
}

export interface QualityScore {
  score: number;
  label: QualityLabel;
  blocks: QualityBlock[];
}

export const QUALITY_MAX = { completeness: 40, evidence: 30, consistency: 20, freshness: 10 } as const;
/** Points each optional financials row adds to completeness, when any of its cells is entered. */
export const OPTIONAL_ROW_POINTS = 0.5;
/** Consistency points lost per failed warning check. */
export const WARNING_PENALTY = 5;
/** A company update counts as fresh under this many days old. */
export const UPDATE_FRESH_DAYS = 90;

export function qualityLabel(score: number): QualityLabel {
  return score >= 80 ? 'Strong' : score >= 60 ? 'Good' : score >= 40 ? 'Fair' : 'Low';
}

/** Money inputs and their weights: every entered grid cell, and every answered currency field. Base-year revenue weighs double. */
export function moneyInputs(ctx: ValuationContext): { key: string; weight: number }[] {
  const out: { key: string; weight: number }[] = [];
  const grid = (INTAKE_STEPS as readonly IntakeStepDef[]).find((s) => s.grid)!.grid!;
  for (const row of grid.rows) {
    for (let col = 0; col < grid.columns; col++) {
      if (isBlank((ctx.financials[col] as Record<string, unknown> | undefined)?.[row.id])) continue;
      out.push({ key: gridSourceKey(row.id, col), weight: row.id === 'revenue' && col === 0 ? 2 : 1 });
    }
  }
  for (const f of INTAKE_FIELDS) {
    if (f.type !== 'currency') continue;
    const value = f.step === 'balance' ? (ctx.balance as Record<string, unknown>)[f.id] : (ctx.answers as Record<string, unknown>)[f.id];
    if (!isBlank(value)) out.push({ key: f.id, weight: 1 });
  }
  return out;
}

export function computeQualityScore(ctx: ValuationContext, checks: CheckResult[]): QualityScore {
  const req = requiredStatus(ctx);
  const completeness = Math.min(
    QUALITY_MAX.completeness,
    (req.required ? (req.answered / req.required) * QUALITY_MAX.completeness : 0) +
      optionalFinancialRowsEntered(ctx).length * OPTIONAL_ROW_POINTS
  );

  const inputs = moneyInputs(ctx);
  const totalWeight = inputs.reduce((s, i) => s + i.weight, 0);
  const evidencedWeight = inputs
    .filter((i) => {
      const src = sourceOf(ctx, i.key);
      return src === 'verified' || src === 'dataroom';
    })
    .reduce((s, i) => s + i.weight, 0);
  const evidence = totalWeight ? (evidencedWeight / totalWeight) * QUALITY_MAX.evidence : 0;

  // not_evaluated warnings (passed: null) cost nothing: they are gaps in the package, not in the founder's data.
  const failedWarnings = checks.filter((c) => c.severity === 'warning' && c.passed === false).length;
  const consistency = Math.max(0, QUALITY_MAX.consistency - WARNING_PENALTY * failedWarnings);

  const referenceFresh = !referenceDataAge(ctx.opts.asOf).stale;
  const days = ctx.facts.lastUpdateAgeDays;
  const updateFresh = typeof days === 'number' && days < UPDATE_FRESH_DAYS;
  const freshness = referenceFresh && updateFresh ? 10 : referenceFresh || updateFresh ? 5 : 0;

  const blocks: QualityBlock[] = [
    { key: 'completeness', points: completeness, max: QUALITY_MAX.completeness },
    { key: 'evidence', points: evidence, max: QUALITY_MAX.evidence },
    { key: 'consistency', points: consistency, max: QUALITY_MAX.consistency },
    { key: 'freshness', points: freshness, max: QUALITY_MAX.freshness },
  ];
  // Rounded to a whole point for display and labelling; the blocks keep their exact values.
  const score = Math.round(blocks.reduce((s, b) => s + b.points, 0));
  return { score, label: qualityLabel(score), blocks };
}

/** Half-width of the range around the point, by quality label, when the sensitivity understates. */
export const RANGE_SPREAD_BY_LABEL: Record<QualityLabel, number> = { Strong: 0.1, Good: 0.2, Fair: 0.3, Low: 0.3 };

export interface RangeResult {
  low: number;
  high: number;
  /**
   * `sensitivity`: the measured single-driver bounds. `spread`: widened because
   * the sensitivity could not vary the benchmark (its `understated` flag).
   * `fixed`: no sensitivity ran, so the engine's flat fallback.
   */
  basis: 'sensitivity' | 'spread' | 'fixed';
  /** The half-width applied when basis is `spread`, else null. */
  spread: number | null;
}

/**
 * The range comes from the sensitivity bounds. When the sensitivity could not
 * vary the benchmark (`understated`), the range is widened around the point to
 * the label's spread. Widened only: a measured bound already wider is kept.
 */
export function applyRangeSpread(
  report: ValuationReportOutput,
  sensitivity: SensitivityResult | null,
  quality: QualityScore
): RangeResult {
  const point = report.weightedValuation;
  if (!sensitivity) return { low: report.lowBound, high: report.highBound, basis: 'fixed', spread: null };
  if (!sensitivity.understated) {
    return { low: sensitivity.lowBound, high: sensitivity.highBound, basis: 'sensitivity', spread: null };
  }
  const spread = RANGE_SPREAD_BY_LABEL[quality.label];
  return {
    low: Math.min(sensitivity.lowBound, point * (1 - spread)),
    high: Math.max(sensitivity.highBound, point * (1 + spread)),
    basis: 'spread',
    spread,
  };
}
