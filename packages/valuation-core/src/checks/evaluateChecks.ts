// Extended checks for TheAngel. validateWizardData and hasBlockingIssues are
// untouched (the Raise HQ portal relies on them through the compute route);
// evaluateChecks runs validateWizardData and adds the checks below to it.

import type { FinancialYear, ValuationReportOutput } from '../types';
import { validateWizardData } from '../validation';
import { deriveFcfeByYear } from '../fcf';
import { getCountryDataTier } from '../referenceData';
import { REFERENCE_DATA_AS_OF } from '../data-as-of';
import { mapIntakeToEngine, parseIntakeNumber as num } from '../intake/mapIntakeToEngine';
import { suggestStage, type ProductRollout } from '../intake/suggestStage';
import type { CompanyStage } from '../types';
import { gridSourceKey, sourceOf, type ValuationContext } from '../angel/context';
import { isBlank, requiredStatus } from './required';
import { hasStrongAnswers, QUALITATIVE_CRITERIA, QUALITATIVE_FLOOR_DELTA } from './qualitative';

export type CheckSeverity = 'blocking' | 'warning' | 'info';

/**
 * Where the founder fixes a check. Data, not a URL: TheAngel turns it into a route.
 * `step` is an intake step id and `fieldId` an intake field id (or grid row id).
 */
export type FieldRoute =
  | { kind: 'intake'; step: string; fieldId: string }
  | { kind: 'data_room' }
  | { kind: 'listing' }
  | { kind: 'none' };

export interface CheckResult {
  id: string;
  severity: CheckSeverity;
  /**
   * true: the condition is clear. false: the check fires (a blocking or warning
   * problem, or an info note that applies). null: not evaluated, because the
   * data the check needs does not exist yet (see `notEvaluatedReason`).
   */
  passed: boolean | null;
  title: string;
  why: string;
  fieldRoute: FieldRoute;
  fixLabel: string;
  notEvaluatedReason?: string;
}

/**
 * Forecast revenue-growth quartiles by stage and industry, for forecast_outlier
 * and growth_below_peers. NO SOURCED DATASET EXISTS IN THE PACKAGE, so this is
 * null and both checks return `not_evaluated`. Fill it from a published source
 * (and add its date to REFERENCE_DATA_AS_OF); never from memory.
 */
export const REVENUE_GROWTH_QUARTILES: null | Record<string, { p25: number; p50: number; p75: number }> = null;

/** Balance-sheet tolerance: assets may differ from liabilities plus equity by up to 1%. */
export const BALANCE_TOLERANCE = 0.01;
/** Use of funds may differ from the raise by up to 1%. */
export const USE_OF_FUNDS_TOLERANCE = 0.01;
/** Ownership may differ from 100% by up to half a percentage point (rounding). */
export const OWNERSHIP_TOLERANCE_PP = 0.5;
/** Reference data counts as stale beyond this many months before the run's as-of date. */
export const STALE_AFTER_MONTHS = 12;
/** ask_outside_range fires beyond this share above the high bound or below the low bound. */
export const ASK_RANGE_TOLERANCE = 0.2;

const OPTIONAL_BALANCE_ROWS = [
  'tangible_assets', 'intangible_assets', 'financial_assets', 'deferred_tax_assets',
  'short_term_liabilities', 'long_term_liabilities', 'equity',
] as const;

/** Plain names for REFERENCE_DATA_AS_OF keys, for check copy. */
export const REFERENCE_DATASET_LABELS: Record<string, string> = {
  riskFreeRates: 'government bond yields',
  countryEquityRiskPremiums: 'country risk premiums',
  damodaranIndustryRows: 'industry multiples and betas',
  pitchbookNvca: 'US round valuations',
  britishBusinessBank: 'UK round valuations',
  survivalCurves: 'start-up survival rates',
};

const DCF_LABEL = { dcf_ltg: 'DCF with long-term growth', dcf_multiple: 'DCF with exit multiple' } as const;

/** 'YYYY-MM' or 'YYYY-MM-DD' to a date; a month-only date counts from its first day. */
function parseAsOf(v: string): Date {
  return new Date(/^\d{4}-\d{2}$/.test(v) ? `${v}-01T00:00:00Z` : `${v.slice(0, 10)}T00:00:00Z`);
}

/** The oldest dated reference dataset, and the datasets with no date. */
export function referenceDataAge(asOf: string) {
  const dated = Object.entries(REFERENCE_DATA_AS_OF).filter(([, v]) => v !== null) as [string, string][];
  const undated = Object.entries(REFERENCE_DATA_AS_OF).filter(([, v]) => v === null).map(([k]) => k);
  const oldest = dated.reduce((a, b) => (parseAsOf(a[1]) <= parseAsOf(b[1]) ? a : b));
  const cutoff = parseAsOf(asOf);
  cutoff.setUTCMonth(cutoff.getUTCMonth() - STALE_AFTER_MONTHS);
  return { oldestDataset: oldest[0], oldestDate: oldest[1], stale: parseAsOf(oldest[1]) < cutoff, undated };
}

/** The stage suggestStage gives for this context, or null when an input it needs is missing. */
export function suggestedStageFor(ctx: ValuationContext): CompanyStage | null {
  const listingStage = ctx.facts.listingStage;
  const rollout = (ctx.answers as Record<string, unknown>).product_rollout_stage as ProductRollout | undefined;
  const base = ctx.financials[0] as Record<string, unknown> | undefined;
  const revenue = num(base?.revenue);
  if (!listingStage || !rollout || revenue === undefined) return null;
  const mapped = mapIntakeToEngine(ctx.answers, ctx.financials.slice(0, 1), {}, ctx.opts);
  const ebitda = deriveFcfeByYear(mapped.financials as FinancialYear[])[0]?.ebitda ?? null;
  return suggestStage({ listingStage, lastActualRevenue: revenue, lastActualEbitda: ebitda, productRollout: rollout });
}

const intake = (step: string, fieldId: string): FieldRoute => ({ kind: 'intake', step, fieldId });

export function evaluateChecks(ctx: ValuationContext, report: ValuationReportOutput): CheckResult[] {
  const a = ctx.answers as Record<string, unknown>;
  const bal = ctx.balance as Record<string, unknown>;
  const mapped = mapIntakeToEngine(ctx.answers, ctx.financials, ctx.balance, ctx.opts);
  const checks: CheckResult[] = [];

  // --- The engine's own validation, unchanged, first. ----------------------
  const issues = validateWizardData({
    profile: mapped.company,
    financials: mapped.financials,
    balanceSheet: mapped.balanceSheet,
    questionnaireAnswers: mapped.questionnaire,
  });
  for (const issue of issues) {
    checks.push({
      id: `engine_validation.${issue.field}`,
      severity: issue.severity === 'error' ? 'blocking' : 'warning',
      passed: false,
      title: issue.message,
      why:
        issue.severity === 'error'
          ? 'The valuation cannot be computed with this value.'
          : 'This value is allowed but unusual, so check it before you share the result.',
      fieldRoute: { kind: 'none' },
      fixLabel: 'Correct the value',
    });
  }

  // --- Blocking -------------------------------------------------------------
  const req = requiredStatus(ctx);
  const firstMissing = req.missing[0];
  checks.push({
    id: 'required_missing',
    severity: 'blocking',
    passed: req.missing.length === 0,
    title: req.missing.length === 0 ? 'All required answers are in' : `Answer the ${req.missing.length} required questions left`,
    why: 'The valuation needs every required answer before it can be shared.',
    fieldRoute: firstMissing ? intake(firstMissing.step, firstMissing.fieldId) : { kind: 'none' },
    fixLabel: 'Finish the intake',
  });

  const suggested = suggestedStageFor(ctx);
  const runStage = mapped.company.stage;
  checks.push({
    id: 'stage_mismatch',
    severity: 'blocking',
    passed: ctx.confirmed.stageConfirmed !== null && ctx.confirmed.stageConfirmed === runStage,
    title: 'Confirm your stage of development',
    why:
      suggested && suggested !== runStage
        ? `Your listing suggests the ${suggested} stage, and the stage sets how much each method counts.`
        : 'The stage sets how much each method counts, so it needs your confirmation.',
    fieldRoute: intake('company', 'stage_of_development'),
    fixLabel: 'Confirm stage',
  });

  const optionalEntered = OPTIONAL_BALANCE_ROWS.filter((k) => !isBlank(bal[k]));
  const v = (k: string) => num(bal[k]) ?? 0;
  // Non-operating cash is part of cash and equivalents, not a separate asset, so it is not added again.
  const assets = v('cash_and_equivalents') + v('tangible_assets') + v('intangible_assets') + v('financial_assets') + v('deferred_tax_assets');
  const claims = v('short_term_liabilities') + v('long_term_liabilities') + v('equity');
  const base = Math.max(Math.abs(assets), Math.abs(claims));
  checks.push({
    id: 'balance_sheet_unbalanced',
    severity: 'blocking',
    passed: optionalEntered.length === 0 || base === 0 || Math.abs(assets - claims) <= BALANCE_TOLERANCE * base,
    title: 'Make your balance sheet balance',
    why: 'Assets should equal liabilities plus equity, and investors check this first.',
    fieldRoute: intake('balance', optionalEntered[0] ?? 'equity'),
    fixLabel: 'Review balance sheet',
  });

  const cash0 = num(bal.cash_and_equivalents);
  let negativeCash: boolean | null = null;
  if (cash0 !== undefined) {
    let cash = cash0;
    negativeCash = false;
    for (const y of deriveFcfeByYear(mapped.financials as FinancialYear[]).filter((y) => y.yearOffset >= 1)) {
      const raise = mapped.financials.find((f) => f.yearOffset === y.yearOffset)?.fundraisingPlan ?? 0;
      cash += y.fcfe + raise;
      if (cash < 0) negativeCash = true;
    }
  }
  checks.push({
    id: 'negative_cash',
    severity: 'blocking',
    passed: negativeCash === null ? null : !negativeCash,
    title: 'Fund every year of your plan',
    why: 'In at least one forecast year your cash falls below zero, even after the raise you plan.',
    fieldRoute: intake('financials', 'fundraising_this_year'),
    fixLabel: 'Review funding',
    ...(negativeCash === null ? { notEvaluatedReason: 'Base-year cash and equivalents is not entered.' } : {}),
  });

  const raise = num(a.capital_needed_current_round) ?? 0;
  const uses = Array.isArray(a.use_of_funds) ? (a.use_of_funds as unknown[]).map((x) => num(x) ?? 0) : [];
  const usesTotal = uses.reduce((s, x) => s + x, 0);
  checks.push({
    id: 'use_of_funds_missing',
    severity: 'blocking',
    passed: raise <= 0 || (usesTotal > 0 && Math.abs(usesTotal - raise) <= USE_OF_FUNDS_TOLERANCE * raise),
    title: 'Show how you will use the money',
    why: 'Your use of funds should add up to the full amount you are raising.',
    fieldRoute: intake('funding', 'use_of_funds'),
    fixLabel: 'Add use of funds',
  });

  const ownershipRows = Array.isArray(a.current_ownership)
    ? (a.current_ownership as unknown[][]).filter((r) => Array.isArray(r) && !isBlank(r))
    : [];
  const ownershipTotal = ownershipRows.reduce((s, r) => s + (num(r[1]) ?? 0), 0);
  checks.push({
    id: 'ownership_not_100',
    severity: 'blocking',
    passed: ownershipRows.length === 0 || Math.abs(ownershipTotal - 100) <= OWNERSHIP_TOLERANCE_PP,
    title: 'Make your ownership add up to 100%',
    why: 'The cap table has to account for every share.',
    fieldRoute: intake('funding', 'current_ownership'),
    fixLabel: 'Review cap table',
  });

  // --- Warnings -------------------------------------------------------------
  const forecastCols = [1, 2, 3, 4, 5].filter((c) => !isBlank((ctx.financials[c] as Record<string, unknown> | undefined)?.revenue));
  const forecastFromFounder = forecastCols.some((c) => sourceOf(ctx, gridSourceKey('revenue', c)) === 'founder');
  checks.push({
    id: 'no_financial_model',
    severity: 'warning',
    passed: !(ctx.facts.hasFinancialModel !== true && forecastFromFounder),
    title: 'No financial model supports your forecast',
    why: 'Investors will ask for the model behind these figures.',
    fieldRoute: { kind: 'data_room' },
    fixLabel: 'Add to data room',
  });

  const noGrowthData = 'No sourced revenue-growth quartiles exist in the package yet (REVENUE_GROWTH_QUARTILES).';
  checks.push({
    id: 'forecast_outlier',
    severity: 'warning',
    // Not evaluated until REVENUE_GROWTH_QUARTILES holds a sourced table.
    passed: null,
    title: 'Support a forecast that grows faster than most peers',
    why: 'Your forecast grows faster than the top quarter of comparable companies for two years running.',
    fieldRoute: intake('financials', 'revenue'),
    fixLabel: 'Review forecast',
    notEvaluatedReason: noGrowthData,
  });
  checks.push({
    id: 'growth_below_peers',
    severity: 'warning',
    // Not evaluated until REVENUE_GROWTH_QUARTILES holds a sourced table.
    passed: null,
    title: 'Explain a forecast that grows slower than most peers',
    why: 'Your forecast grows slower than the bottom quarter of comparable companies.',
    fieldRoute: intake('financials', 'revenue'),
    fixLabel: 'Review forecast',
    notEvaluatedReason: noGrowthData,
  });

  const scorecard = report.methodResults.scorecard.criteria;
  const conflicted = QUALITATIVE_CRITERIA.find((c) => {
    const score = scorecard.find((s) => s.key === c.criterion)?.score;
    return score !== undefined && score <= QUALITATIVE_FLOOR_DELTA && hasStrongAnswers(c.criterion, ctx.answers);
  });
  checks.push({
    id: 'qualitative_conflict',
    severity: 'warning',
    passed: conflicted === undefined,
    title: 'Check answers the score does not reflect',
    why: 'One criterion scores near the bottom although your answers for it are strong.',
    fieldRoute: conflicted ? intake(conflicted.step, conflicted.fields[0]) : { kind: 'none' },
    fixLabel: 'Review answers',
  });

  const baseRevenueEntered = !isBlank((ctx.financials[0] as Record<string, unknown> | undefined)?.revenue);
  checks.push({
    id: 'unverified_revenue',
    severity: 'warning',
    passed: !(baseRevenueEntered && sourceOf(ctx, gridSourceKey('revenue', 0)) === 'founder'),
    title: 'Verify your base-year revenue',
    why: 'Revenue you have verified counts for more than revenue you have typed in.',
    fieldRoute: { kind: 'listing' },
    fixLabel: 'Verify traction',
  });

  const age = referenceDataAge(ctx.opts.asOf);
  checks.push({
    id: 'parameter_stale',
    severity: 'warning',
    passed: !age.stale,
    title: 'Some market data is over a year old',
    why: `The oldest dataset used here, ${REFERENCE_DATASET_LABELS[age.oldestDataset] ?? age.oldestDataset}, dates from ${age.oldestDate}.`,
    fieldRoute: { kind: 'none' },
    fixLabel: 'No action needed',
  });

  // --- Info -----------------------------------------------------------------
  checks.push({
    id: 'multiple_kind_fallback',
    severity: 'info',
    // The VC method has no revenue-multiple fallback today: with terminal EBITDA
    // at or below zero it fails its hurdle and is excluded instead. So this never
    // fires; it is kept so the id is stable if a fallback is ever added.
    passed: true,
    title: 'The VC method used a revenue multiple',
    why: 'Terminal-year EBITDA is zero or below, so revenue was used for the exit value instead.',
    fieldRoute: { kind: 'none' },
    fixLabel: 'No action needed',
  });

  const droppedDcf = report.perMethod.filter((m) => (m.method === 'dcf_ltg' || m.method === 'dcf_multiple') && !m.applicable);
  checks.push({
    id: 'dcf_excluded',
    severity: 'info',
    passed: droppedDcf.length === 0,
    title: droppedDcf.length === 2 ? 'Both DCF methods were left out' : 'One DCF method was left out',
    why:
      droppedDcf.length === 0
        ? 'Both DCF methods have a positive terminal year.'
        : droppedDcf
            .map((m) =>
              m.method === 'dcf_ltg'
                ? `${DCF_LABEL.dcf_ltg} was left out because terminal-year net income is zero or below.`
                : `${DCF_LABEL.dcf_multiple} was left out because terminal-year revenue is zero or below.`
            )
            .join(' ') + (droppedDcf.length === 2 ? ' Their weight went to the other methods.' : ' Its weight went to the other methods.'),
    fieldRoute: intake('financials', 'revenue'),
    fixLabel: 'Review forecast',
  });

  checks.push({
    id: 'override_present',
    severity: 'info',
    passed: ctx.overrides.length === 0,
    title: 'Some values were set by hand',
    why:
      ctx.overrides.length === 0
        ? 'No values were overridden.'
        : `Overridden: ${ctx.overrides.map((o) => `${o.parameter} (${o.source})`).join(', ')}.`,
    fieldRoute: { kind: 'none' },
    fixLabel: 'No action needed',
  });

  const tier = getCountryDataTier(mapped.company.country);
  checks.push({
    id: 'region_illustrative',
    severity: 'info',
    passed: tier !== 'illustrative',
    title: 'Market data for your country is illustrative',
    why: 'We hold no sourced market data for your country, so only benchmarks are shown.',
    fieldRoute: { kind: 'none' },
    fixLabel: 'No action needed',
  });

  // Minor units to major: every reporting currency the intake offers has two decimals.
  const ask = ctx.facts.askPreMoney == null ? null : ctx.facts.askPreMoney / 100;
  checks.push({
    id: 'ask_outside_range',
    severity: 'info',
    passed:
      ask === null ||
      (ask <= report.highBound * (1 + ASK_RANGE_TOLERANCE) && ask >= report.lowBound * (1 - ASK_RANGE_TOLERANCE)),
    title: 'Your ask sits outside the valuation range',
    why:
      ask !== null && ask > report.highBound * (1 + ASK_RANGE_TOLERANCE)
        ? 'Your pre-money ask is more than 20% above the top of the range.'
        : 'Your pre-money ask is more than 20% below the bottom of the range.',
    fieldRoute: { kind: 'listing' },
    fixLabel: 'Review your ask',
  });

  return checks;
}

/** True when any blocking check failed. not_evaluated (null) does not block. */
export function hasBlockingChecks(checks: CheckResult[]): boolean {
  return checks.some((c) => c.severity === 'blocking' && c.passed === false);
}
