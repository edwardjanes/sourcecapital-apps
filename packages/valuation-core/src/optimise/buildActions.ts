import type { ValuationReportOutput } from '../types';
import type { CheckResult } from '../checks/evaluateChecks';
import type { ValuationContext } from '../angel/context';
import { isBenchmarkOnly, runCore } from '../angel/core';
import { computeHeadroom, headroomFor } from './headroom';
import { OPTIMISE_RULES } from './rules';
import { EFFORT_POINTS, TIME_BAND_ORDER, type ActionItem, type ActionRule } from './types';

/**
 * Order:
 * 1. Fix actions that clear a failing blocking check, even with a negative effect.
 * 2. Value actions by estimated effect divided by effort points (S 1, M 3, L 8),
 *    then by time band, shortest first.
 * 3. Each quality-only action goes straight after the value actions of the same
 *    effort (or, if there are none, after the last value action of lower effort).
 * Ties keep rule-set order, so the result is deterministic.
 */
export function rankActions(items: ActionItem[]): ActionItem[] {
  const order = new Map(OPTIMISE_RULES.map((r, i) => [r.code, i]));
  const byRule = (a: ActionItem, b: ActionItem) => (order.get(a.code) ?? 0) - (order.get(b.code) ?? 0);

  const blocking = items.filter((i) => i.appliesToBlocking).sort(byRule);
  const rest = items.filter((i) => !i.appliesToBlocking);
  const value = rest
    .filter((i) => i.effectKind === 'value')
    .sort((a, b) => {
      const ra = (a.estimatedDeltaPoint ?? 0) / EFFORT_POINTS[a.effort];
      const rb = (b.estimatedDeltaPoint ?? 0) / EFFORT_POINTS[b.effort];
      return rb - ra || TIME_BAND_ORDER[a.timeBand] - TIME_BAND_ORDER[b.timeBand] || byRule(a, b);
    });
  const quality = rest
    .filter((i) => i.effectKind === 'quality')
    .sort((a, b) => EFFORT_POINTS[a.effort] - EFFORT_POINTS[b.effort] || byRule(a, b));

  const ranked = [...value];
  for (const q of quality) {
    let at = -1;
    ranked.forEach((item, idx) => {
      if (EFFORT_POINTS[item.effort] <= EFFORT_POINTS[q.effort]) at = idx;
    });
    ranked.splice(at + 1, 0, q);
  }
  return [...blocking, ...ranked];
}

/**
 * Every applicable rule as an action. For each value rule the counterfactual is
 * run through the full pipeline and the change in the point value reported; it
 * can be negative. In benchmark_only the engine shows no number, so neither the
 * effect nor the headroom is returned.
 */
export async function buildActions(
  ctx: ValuationContext,
  report: ValuationReportOutput,
  checks: CheckResult[]
): Promise<ActionItem[]> {
  const benchmarkOnly = isBenchmarkOnly(
    (ctx.answers as Record<string, unknown>).country as string
  );
  const headroom = computeHeadroom(report);
  const base = report.weightedValuation;
  const failingBlocking = new Set(checks.filter((c) => c.severity === 'blocking' && c.passed === false).map((c) => c.id));

  const items: ActionItem[] = [];
  for (const rule of OPTIMISE_RULES as readonly ActionRule[]) {
    if (!rule.applies(ctx, report, checks)) continue;
    let estimatedDeltaPoint: number | null = null;
    if (rule.effectKind === 'value' && !benchmarkOnly) {
      const run = await runCore(rule.counterfactual(ctx));
      estimatedDeltaPoint = run.report.weightedValuation - base;
    }
    items.push({
      code: rule.code,
      kind: rule.kind,
      effort: rule.effort,
      timeBand: rule.timeBand,
      title: rule.copy.title,
      why: rule.copy.why,
      proof: rule.copy.proof,
      effectKind: rule.effectKind,
      estimatedDeltaPoint,
      headroomUpTo: benchmarkOnly ? null : headroomFor(rule.factors, headroom),
      evidence: rule.evidence,
      appliesToBlocking: rule.kind === 'fix' && !!rule.fixesCheck && failingBlocking.has(rule.fixesCheck),
    });
  }
  return rankActions(items);
}
