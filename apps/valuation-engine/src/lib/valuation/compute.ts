import {
  CompanyProfile,
  FinancialYear,
  QuestionnaireAnswers,
  UpdatedValuationParameters,
  ValuationReportOutput,
  ValuationMethodKey,
  MethodApplicability,} from './types';
import { deriveFcfeByYear } from './fcf';
import { computeScorecard } from './scorecard';
import { computeChecklist } from './checklist';
import { computeVcMethod } from './vc';
import { computeDcfShared, computeLtgTerminalValue } from './dcf';
import { computeWeightedValuation } from './weights';
import { computeSimpleMultiples, ComparableCompany } from './simpleMultiples';
import { deriveScorecardCriteriaScores, deriveChecklistCriteriaScores } from './scoring';
import { buildDefaultParameters } from './defaults';
import { SCORECARD_CRITERIA_WEIGHTS, CHECKLIST_CRITERIA_WEIGHTS } from './referenceData';

export async function computeValuation(
  profile: CompanyProfile,
  financials: FinancialYear[],
  questionnaire: QuestionnaireAnswers | null,
  parameters: UpdatedValuationParameters
): Promise<ValuationReportOutput> {
  // Derive FCFE for all years
  const fcfeByYear = deriveFcfeByYear(financials);

  // Filter to forecast years only (yearOffset >= 1) for DCF calculations
  const forecastFcfeYears = fcfeByYear.filter((f) => f.yearOffset >= 1);

  // Discount rate from parameters
  const discountRate = parameters.dcf_shared.discount_rate;

  // Scorecard result
  const scorecardScores: Record<string, number> = questionnaire ? deriveScorecardCriteriaScores(questionnaire) : {};
  const scorecardCriteria: Record<string, { weight: number; score: number }> = Object.fromEntries(
    Object.entries(scorecardScores).map(([key, score]) => [
      key,
      { weight: SCORECARD_CRITERIA_WEIGHTS[key as keyof typeof SCORECARD_CRITERIA_WEIGHTS] || 0, score },
    ])
  );
  const scorecardResult = computeScorecard(
    scorecardCriteria,
    parameters.scorecard.average_pre_money_valuation
  );

  // Checklist result
  const checklistScores: Record<string, number> = questionnaire ? deriveChecklistCriteriaScores(questionnaire) : {};
  const checklistCriteria: Record<string, { weight: number; score: number }> = Object.fromEntries(
    Object.entries(checklistScores).map(([key, score]) => [
      key,
      { weight: CHECKLIST_CRITERIA_WEIGHTS[key as keyof typeof CHECKLIST_CRITERIA_WEIGHTS] || 0, score },
    ])
  );
  const checklistResult = computeChecklist(
    checklistCriteria,
    parameters.checklist.max_valuation
  );

  // VC Method result.
  //
  // `capitalRaised` was hardcoded to 0 until 27 Sep 2026, which meant
  // V_pre = V_post - 0: the engine reported POST-money value under a pre-money
  // label, for every company, at 16% of the weight. The input was in the payload
  // the whole time. An explicit override wins, otherwise the founder's own stated
  // round size; `capitalRaisedOverride` is the parameter that was declared for
  // this and never read.
  const capitalRaised =
    parameters.vc_method.capital_raised_override ??
    (typeof questionnaire?.capital_needed === 'number' ? questionnaire.capital_needed : 0);

  const vcResult = computeVcMethod(
    parameters.vc_method.terminal_metric_value,
    parameters.vc_method.industry_multiple,
    parameters.vc_method.required_roi,
    parameters.vc_method.projection_years,
    capitalRaised
  );

  // DCF LTG result
  const lastFcfeYear = forecastFcfeYears[forecastFcfeYears.length - 1];
  const survivalRateIndexLtg = lastFcfeYear ? lastFcfeYear.yearOffset - 1 : 0;
  const ltgTerminalValue = computeLtgTerminalValue(
    lastFcfeYear?.fcfe || 0,
    parameters.dcf_ltg.survival_rates[survivalRateIndexLtg] || 0,
    discountRate,
    parameters.dcf_ltg.terminal_growth_rate,
    lastFcfeYear?.netIncome,
    parameters.dcf_ltg.terminal_return_on_new_capital
  );

  const dcfLtgResult = computeDcfShared(
    forecastFcfeYears,
    ltgTerminalValue.terminalValue,
    discountRate,
    parameters.dcf_shared.illiquidity_discount,
    parameters.dcf_shared.non_operating_cash,
    parameters.dcf_ltg.survival_rates
  );

  // DCF Multiple result
  const lastForecastFinancial = financials.find((f) => f.yearOffset === lastFcfeYear?.yearOffset);
  const lastForecastRevenue = lastForecastFinancial?.revenue || 0;
  const survivalRateIndexMultiple = lastFcfeYear ? lastFcfeYear.yearOffset - 1 : 0;
  const terminalValueMultiple =
    lastForecastRevenue *
    parameters.dcf_multiple.exit_multiple *
    (parameters.dcf_multiple.survival_rates[survivalRateIndexMultiple] || 0);

  const dcfMultipleResult = computeDcfShared(
    forecastFcfeYears,
    terminalValueMultiple,
    discountRate,
    parameters.dcf_shared.illiquidity_discount,
    parameters.dcf_shared.non_operating_cash,
    parameters.dcf_multiple.survival_rates
  );

  // Simple Multiples result
  const comparables: ComparableCompany[] = (parameters.comparables || []).map((c: any) => ({
    name: c.name,
    metric: c.metric,
    multiple: c.multiple,
    metricType: c.metricType || 'revenue',
  }));

  const multiplesResult = computeSimpleMultiples(parameters.simple_multiples.last_year_metric, comparables);

  // Weighted valuation
  const methodResults = {
    scorecard: scorecardResult,
    checklist: checklistResult,
    vc: vcResult,
    dcfLtg: dcfLtgResult,
    dcfMultiple: dcfMultipleResult,
    multiples: multiplesResult,
  };

  // Which methods actually produced an answer. A method that cannot be applied
  // surrenders its weight rather than contributing a zero -- see
  // computeWeightedValuation for why.
  const applicability: Partial<Record<ValuationMethodKey, MethodApplicability>> = {};

  if (!vcResult.clearsHurdle) {
    const shortfall = Math.abs(vcResult.preMoneyValuation);
    applicability.vc = {
      applicable: false,
      reason:
        `At a ${(parameters.vc_method.required_roi * 100).toFixed(1)}% required annual return over ` +
        `${parameters.vc_method.projection_years} years, the discounted exit value of ` +
        `${Math.round(vcResult.discountedExitValue).toLocaleString('en-GB')} does not cover the ` +
        `${Math.round(vcResult.capitalRaised).toLocaleString('en-GB')} being raised -- a shortfall of ` +
        `${Math.round(shortfall).toLocaleString('en-GB')}. This says the round does not clear at that ` +
        `hurdle, not that the company is worth nothing, so the method is excluded rather than averaged in.`,
    };
  }

  if (parameters.benchmark_resolution && parameters.benchmark_resolution.rung === 'none') {
    const reason =
      `${parameters.benchmark_resolution.note} Both methods price a company as a fraction of, or a ` +
      `multiple against, that benchmark, so neither can be applied here. They are excluded rather ` +
      `than run against a figure nobody published.`;
    applicability.scorecard = { applicable: false, reason };
    applicability.checklist = { applicable: false, reason };
  }

  if (comparables.length === 0) {
    applicability.multiples = {
      applicable: false,
      reason: 'No comparable companies were supplied, so there is no median multiple to apply.',
    };
  }

  const weighted = computeWeightedValuation(
    {
      scorecard: scorecardResult.valuation,
      checklist: checklistResult.valuation,
      vc: vcResult.valuation,
      dcf_ltg: dcfLtgResult.valuation,
      dcf_multiple: dcfMultipleResult.valuation,
      multiples: multiplesResult.valuation,
    },
    parameters.method_weights,
    applicability
  );

  const perMethod: ValuationReportOutput['perMethod'] = weighted.perMethod;
  const weightedValuation = weighted.weightedValuation;

  // Bounds (±9.6% as per Equidam methodology)
  const lowBound = weightedValuation * 0.904;
  const highBound = weightedValuation * 1.096;

  return {
    methodResults,
    weightedValuation,
    lowBound,
    highBound,
    perMethod,
    redistributedWeight: weighted.redistributedWeight,
    allMethodsInapplicable: weighted.allMethodsInapplicable,
    ltgTerminalValue,
    discountRate,
    discountRateBuildUp: parameters.discount_rate_build_up,
    benchmarkResolution: parameters.benchmark_resolution,
    fcfeByYear,
    generatedAt: new Date().toISOString(),
  };
}
