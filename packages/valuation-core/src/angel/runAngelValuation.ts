// The one entry point TheAngel calls on a run.

import type { CompanyStage, UpdatedValuationParameters, ValuationMethodKey, ValuationReportOutput } from '../types';
import type { SensitivityResult } from '../sensitivity';
import { REFERENCE_DATA_AS_OF } from '../data-as-of';
import { ENGINE_VERSION } from '../version';
import type { CheckResult } from '../checks/evaluateChecks';
import type { QualityScore, RangeResult } from '../quality/qualityScore';
import { buildActions } from '../optimise/buildActions';
import { computeHeadroom, type CriterionHeadroom } from '../optimise/headroom';
import type { ActionItem } from '../optimise/types';
import { runCore, type RunStatus } from './core';
import type { AppliedOverride } from './pipeline';
import type { ValuationContext } from './context';

export interface ParameterValue {
  path: string;
  value: number | number[];
  /** As-of date of the dataset the value comes from, or null for values derived from the company's own inputs or fixed by the method. */
  asOf: string | null;
}

/** One currency conversion a run made, as stored. A replay uses these numbers, never the live FX table. */
export interface FxSnapshotEntry {
  /** What was converted: the benchmark pre-money, or last actual revenue for the size-premium band lookup. */
  applies: 'benchmark_pre_money' | 'size_band_revenue';
  from: string;
  to: string;
  rate: number;
  rateAsOf: string;
  source: string;
  kind: 'reference' | 'pegged';
  /** The amount before conversion, in `from`. */
  original: number;
  /** The amount after conversion, in `to`. */
  converted: number;
}

export interface ParametersSnapshot {
  /** Every parameter exactly as used. Pass back as `ctx.replayParameters` to recompute the run. */
  parameters: UpdatedValuationParameters;
  /** The numeric parameters flattened, each with its dataset's as-of date. */
  values: ParameterValue[];
  /** Every conversion the run made. Empty when every figure was already in the run's currency. */
  fx: FxSnapshotEntry[];
}

export interface AngelValuationResult {
  status: RunStatus;
  /** Null in benchmark_only: the engine shows no number where it holds no sourced market data. */
  point: number | null;
  low: number | null;
  high: number | null;
  currency: string;
  report: ValuationReportOutput | null;
  sensitivity: SensitivityResult | null;
  range: RangeResult | null;
  checks: CheckResult[];
  quality: QualityScore;
  actions: ActionItem[];
  headroom: CriterionHeadroom[] | null;
  overridesApplied: AppliedOverride[];
  stageNote: string;
  parametersSnapshot: ParametersSnapshot;
  engineVersion: string;
  asOf: string;
}

const STAGE_LABEL: Record<CompanyStage, string> = {
  idea: 'Idea', development: 'Development', startup: 'Startup', expansion: 'Expansion', growth: 'Growth', maturity: 'Maturity',
};

/** Method families as the note names them, with why each carries weight. Order breaks ties. */
const FAMILIES: readonly { methods: ValuationMethodKey[]; plural: string; singular: Partial<Record<ValuationMethodKey, string>>; because: string }[] = [
  { methods: ['dcf_ltg', 'dcf_multiple'], plural: 'the two DCF methods', singular: { dcf_ltg: 'the DCF with long-term growth method', dcf_multiple: 'the DCF with exit multiple method' }, because: 'there is revenue to project' },
  { methods: ['scorecard', 'checklist'], plural: 'the Scorecard and Checklist methods', singular: { scorecard: 'the Scorecard method', checklist: 'the Checklist method' }, because: 'there is little trading history yet, so the company is compared with funded peers' },
  { methods: ['vc'], plural: 'the VC method', singular: { vc: 'the VC method' }, because: 'the value at exit is the clearest guide' },
  { methods: ['multiples'], plural: 'the Simple Multiples method', singular: { multiples: 'the Simple Multiples method' }, because: 'comparable companies were supplied' },
];
const METHOD_NAME: Record<ValuationMethodKey, string> = {
  scorecard: 'Scorecard', checklist: 'Checklist', vc: 'VC', dcf_ltg: 'DCF with long-term growth', dcf_multiple: 'DCF with exit multiple', multiples: 'Simple Multiples',
};

/**
 * One sentence on why the weights are what they are, built only from the
 * stage weights (STAGE_DEFAULT_WEIGHTS, via the report) and the methods that
 * dropped out. Deterministic: the same report gives the same sentence.
 */
export function buildStageNote(stage: CompanyStage, report: ValuationReportOutput): string {
  const label = STAGE_LABEL[stage] ?? stage;
  if (report.allMethodsInapplicable) {
    return `At the ${label} stage no method could be applied to these inputs, so there is no valuation yet.`;
  }
  const eff = (m: ValuationMethodKey) => report.perMethod.find((p) => p.method === m)?.effectiveWeight ?? 0;
  const applicable = (m: ValuationMethodKey) => report.perMethod.find((p) => p.method === m)?.applicable !== false;

  const lead = FAMILIES.map((f) => ({ f, weight: f.methods.reduce((s, m) => s + eff(m), 0) })).reduce((a, b) =>
    b.weight > a.weight + 1e-9 ? b : a
  );
  const live = lead.f.methods.filter((m) => applicable(m) && eff(m) > 0);
  const name = live.length === 1 ? lead.f.singular[live[0]]! : lead.f.plural;
  const verb = live.length === 1 ? 'carries' : 'carry';
  const pct = Math.round(lead.weight * 100);

  const dropped = report.perMethod.filter((p) => !p.applicable && p.weight > 0).map((p) => METHOD_NAME[p.method]);
  const droppedClause =
    dropped.length === 0
      ? ''
      : `, after ${dropped.length === 1 ? `the ${dropped[0]} method` : `the ${dropped.slice(0, -1).join(', ')} and ${dropped[dropped.length - 1]} methods`} dropped out and ${dropped.length === 1 ? 'its' : 'their'} weight moved to the rest`;

  return `At the ${label} stage ${name} ${verb} ${pct}% of the weight because ${lead.f.because}${droppedClause}.`;
}

/** As-of date for a parameter path, from REFERENCE_DATA_AS_OF or the resolved benchmark cell. */
function asOfFor(path: string, parameters: UpdatedValuationParameters): string | null {
  if (path === 'discount_rate_build_up.riskFreeRate') return REFERENCE_DATA_AS_OF.riskFreeRates;
  if (path === 'discount_rate_build_up.equityRiskPremium') return REFERENCE_DATA_AS_OF.countryEquityRiskPremiums;
  if (['discount_rate_build_up.beta', 'dcf_multiple.exit_multiple', 'vc_method.industry_multiple'].includes(path)) {
    return REFERENCE_DATA_AS_OF.damodaranIndustryRows;
  }
  if (path === 'scorecard.average_pre_money_valuation' || path === 'checklist.max_valuation') {
    return parameters.benchmark_resolution?.benchmark?.asOf ?? null;
  }
  if (path === 'dcf_ltg.survival_rates' || path === 'dcf_multiple.survival_rates') return REFERENCE_DATA_AS_OF.survivalCurves;
  if (path === 'discount_rate_build_up.sizeBandFx.rate') return parameters.discount_rate_build_up?.sizeBandFx?.rateAsOf ?? null;
  return null;
}

/** The conversions recorded on the parameters, flattened for the snapshot. */
export function fxEntries(parameters: UpdatedValuationParameters): FxSnapshotEntry[] {
  const out: FxSnapshotEntry[] = [];
  const fx = parameters.benchmark_resolution?.converted ? parameters.benchmark_resolution.fx : undefined;
  if (fx) {
    out.push({
      applies: 'benchmark_pre_money',
      from: fx.from, to: fx.to, rate: fx.rate, rateAsOf: fx.rateAsOf, source: fx.source, kind: fx.kind,
      original: fx.originalMedian,
      converted: fx.convertedMedian,
    });
  }
  const band = parameters.discount_rate_build_up;
  if (band?.sizeBandFx) {
    const b = band.sizeBandFx;
    out.push({
      applies: 'size_band_revenue',
      from: b.from, to: b.to, rate: b.rate, rateAsOf: b.rateAsOf, source: b.source, kind: b.kind,
      original: band.lastYearRevenue,
      converted: band.sizeBandRevenue ?? band.lastYearRevenue,
    });
  }
  return out;
}

export function snapshotParameters(parameters: UpdatedValuationParameters): ParametersSnapshot {
  const values: ParameterValue[] = [];
  const walk = (node: unknown, path: string) => {
    if (typeof node === 'number') values.push({ path, value: node, asOf: asOfFor(path, parameters) });
    else if (Array.isArray(node) && node.length && node.every((x) => typeof x === 'number')) {
      values.push({ path, value: node as number[], asOf: asOfFor(path, parameters) });
    } else if (node && typeof node === 'object' && !Array.isArray(node)) {
      for (const [k, v] of Object.entries(node)) {
        // Resolution records describe where values came from; their numbers are not parameters.
        if (k === 'benchmark_resolution' || k === 'industry_resolution' || k === 'comparables') continue;
        walk(v, path ? `${path}.${k}` : k);
      }
    }
  };
  walk(parameters, '');
  return { parameters: JSON.parse(JSON.stringify(parameters)), values, fx: fxEntries(parameters) };
}

/**
 * Runs, in order: mapIntakeToEngine; buildDefaultParameters then the overrides
 * (or the replayed parameters); computeValuation then computeSensitivity;
 * evaluateChecks; computeQualityScore then applyRangeSpread; buildActions; the
 * stage note. Pure: the same context gives the same result.
 *
 * `draft` (a blocking check fails) still computes everything; the caller decides
 * what to show. `benchmark_only` (illustrative or unknown country) returns no
 * point, range, report or action effects, but still returns checks, quality and
 * actions.
 */
export async function runAngelValuation(ctx: ValuationContext): Promise<AngelValuationResult> {
  const run = await runCore(ctx);
  const actions = await buildActions(ctx, run.report, run.checks);
  const benchmarkOnly = run.status === 'benchmark_only';

  return {
    status: run.status,
    point: benchmarkOnly ? null : run.report.weightedValuation,
    low: benchmarkOnly ? null : run.range.low,
    high: benchmarkOnly ? null : run.range.high,
    currency: ctx.opts.currency,
    report: benchmarkOnly ? null : run.report,
    sensitivity: benchmarkOnly ? null : run.sensitivity,
    range: benchmarkOnly ? null : run.range,
    checks: run.checks,
    quality: run.quality,
    actions,
    headroom: benchmarkOnly ? null : computeHeadroom(run.report),
    overridesApplied: run.overridesApplied,
    stageNote: buildStageNote(run.profile.stage, run.report),
    parametersSnapshot: snapshotParameters(run.parameters),
    engineVersion: ENGINE_VERSION,
    asOf: ctx.opts.asOf,
  };
}
