// The calculation path, shared by runAngelValuation, buildActions and simulate.
//
// It follows the engine app's /api/valuation/compute route step for step
// (route.ts: defaults, weights, comparables, the questionnaire enrichment,
// computeValuation, computeSensitivity, bounds), so a TheAngel run and a Raise HQ
// run of the same inputs give the same numbers.

import type { CompanyProfile, FinancialYear, UpdatedValuationParameters, ValuationReportOutput } from '../types';
import { buildDefaultParameters } from '../defaults';
import { computeValuation } from '../compute';
import { computeSensitivity, type SensitivityResult } from '../sensitivity';
import { mapIntakeToEngine, type MappedEngineInputs } from '../intake/mapIntakeToEngine';
import type { ValuationContext, ValuationOverride } from './context';

export interface AppliedOverride extends ValuationOverride {
  /** False when `parameter` names no numeric parameter; the override is then ignored. */
  applied: boolean;
  /** The value it replaced, or null when not applied. */
  previous: number | null;
}

export interface PipelineResult {
  mapped: MappedEngineInputs;
  profile: CompanyProfile;
  parameters: UpdatedValuationParameters;
  overridesApplied: AppliedOverride[];
  report: ValuationReportOutput;
  sensitivity: SensitivityResult | null;
}

/** Parameters are plain data, so a JSON round trip is a full deep copy. */
const cloneData = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

/** Set one numeric leaf by dotted path on a deep copy. Returns the previous value, or null if the path is not a number. */
function setNumericPath(target: Record<string, unknown>, path: string, value: number): number | null {
  const parts = path.split('.');
  let node: Record<string, unknown> = target;
  for (const part of parts.slice(0, -1)) {
    const next = node[part];
    if (!next || typeof next !== 'object' || Array.isArray(next)) return null;
    node = next as Record<string, unknown>;
  }
  const leaf = parts[parts.length - 1];
  const previous = node[leaf];
  if (typeof previous !== 'number' || !Number.isFinite(value)) return null;
  node[leaf] = value;
  return previous;
}

export function buildParameters(ctx: ValuationContext, mapped: MappedEngineInputs) {
  const profile: CompanyProfile = {
    name: mapped.company.name,
    country: mapped.company.country,
    industry: mapped.company.industry,
    stage: mapped.company.stage,
  };
  if (ctx.replayParameters) {
    return { profile, parameters: cloneData(ctx.replayParameters), overridesApplied: [] as AppliedOverride[] };
  }
  const defaults = buildDefaultParameters(profile, mapped.financials as FinancialYear[], mapped.balanceSheet);
  const parameters: UpdatedValuationParameters = cloneData({
    ...defaults,
    method_weights: (mapped.weights as UpdatedValuationParameters['method_weights']) || defaults.method_weights,
    comparables: (mapped.comparables || []).map((c) => ({
      name: c.companyName || '',
      metric: c.multiple || 0,
      multiple: c.multiple || 0,
      metricType: c.metricType || 'revenue',
    })),
  });
  const overridesApplied: AppliedOverride[] = ctx.overrides.map((o) => {
    const previous = setNumericPath(parameters as unknown as Record<string, unknown>, o.parameter, o.value);
    return { ...o, applied: previous !== null, previous };
  });
  return { profile, parameters, overridesApplied };
}

export async function runPipeline(ctx: ValuationContext): Promise<PipelineResult> {
  const mapped = mapIntakeToEngine(ctx.answers, ctx.financials, ctx.balance, ctx.opts);
  const { profile, parameters, overridesApplied } = buildParameters(ctx, mapped);
  const financials = mapped.financials as FinancialYear[];

  // The route's enrichment: last year's revenue for the funding-required criterion.
  const lastActualYear = financials.find((f) => f.yearOffset === -1);
  const questionnaire = {
    ...mapped.questionnaire,
    capital_needed: mapped.questionnaire.capital_needed,
    last_year_revenue: mapped.questionnaire.last_year_revenue ?? lastActualYear?.revenue,
  };

  const raw = await computeValuation(profile, financials, questionnaire, parameters);

  let sensitivity: SensitivityResult | null = null;
  try {
    sensitivity = await computeSensitivity({ profile, financials, questionnaire, parameters });
  } catch {
    sensitivity = null;
  }

  // `generatedAt` is the one non-deterministic field computeValuation returns.
  // Pinned to the run's as-of date so the same context always gives the same output.
  const report: ValuationReportOutput = {
    ...raw,
    generatedAt: ctx.opts.asOf,
    ...(sensitivity
      ? { lowBound: sensitivity.lowBound, highBound: sensitivity.highBound, boundsBasis: 'sensitivity' as const }
      : {}),
  } as ValuationReportOutput;

  return { mapped, profile, parameters, overridesApplied, report, sensitivity };
}
