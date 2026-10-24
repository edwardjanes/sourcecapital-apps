import { expect, it } from "vitest";
import { computeValuation } from "../compute";
import { CompanyProfile, FinancialYear, QuestionnaireAnswers, UpdatedValuationParameters } from "../types";

it("orchestrator produces non-NaN Scorecard/Checklist when fed real questionnaire answers", async () => {
  const profile: CompanyProfile = {
    name: "TestCo",
    country: "US",
    industry: "SaaS",
    stage: "development",
  };

  const financials: FinancialYear[] = [
    {
      yearOffset: -1,
      yearNumber: null,
      isActual: true,
      revenue: 1000000,
      cogs: 500000,
      salaries: 200000,
      otherOpex: 50000,
      totalDa: 10000,
      interest: 0,
      taxes: 50000,
      receivables: 100000,
      inventory: 50000,
      payables: 75000,
      capex: 20000,
      debt: 0,
      fundraisingPlan: 0,
    },
    {
      yearOffset: 1,
      yearNumber: null,
      isActual: false,
      revenue: 1500000,
      cogs: 600000,
      salaries: 300000,
      otherOpex: 75000,
      totalDa: 15000,
      interest: 0,
      taxes: 75000,
      receivables: 150000,
      inventory: 75000,
      payables: 100000,
      capex: 30000,
      debt: 0,
      fundraisingPlan: 500000,
    },
  ];

  const questionnaire: QuestionnaireAnswers = {
    team_size: 5,
    team_has_cto: true,
    team_has_business_lead: true,
    team_prior_exits: false,
    tam_size: 5_000_000_000,
    market_growth_rate: 0.15,
    competitors_count: 5,
    has_competitive_advantage: true,
    product_status: "mvp",
    has_patents: false,
    has_ip: true,
    partnerships_count: 2,
    has_strategic_investors: false,
    capital_needed: 500000,
    last_year_revenue: 1000000,
  };

  const parameters: UpdatedValuationParameters = {
    stage: "development",
    method_weights: {
      scorecard: 0.30,
      checklist: 0.30,
      vc: 0.16,
      dcf_ltg: 0.12,
      dcf_multiple: 0.12,
      multiples: 0,
    },
    scorecard: { average_pre_money_valuation: 1000000 },
    checklist: { max_valuation: 5000000 },
    vc_method: {
      terminal_metric_value: 2000000,
      industry_multiple: 1.5,
      required_roi: 0.5,
      projection_years: 2,
    },
    dcf_shared: {
      discount_rate: 0.15,
      illiquidity_discount: 0.25,
      non_operating_cash: 0,
    },
    dcf_ltg: {
      terminal_growth_rate: 0.025,
      survival_rates: [0.8869, 0.7945, 0.7164],
    },
    dcf_multiple: {
      exit_multiple: 1.5,
      survival_rates: [0.8869, 0.7945, 0.7164],
    },
    simple_multiples: {
      last_year_metric: 1000000,
      metric_type: "revenue",
    },
    comparables: [],
  };

  const result = await computeValuation(profile, financials, questionnaire, parameters);

  // Core check: both Scorecard and Checklist should produce real numbers, not NaN
  expect(result.methodResults.scorecard.valuation).toBeDefined();
  expect(result.methodResults.scorecard.valuation).not.toBeNaN();
  expect(Number.isFinite(result.methodResults.scorecard.valuation)).toBe(true);
  expect(result.methodResults.scorecard.valuation).toBeGreaterThan(0);

  expect(result.methodResults.checklist.valuation).toBeDefined();
  expect(result.methodResults.checklist.valuation).not.toBeNaN();
  expect(Number.isFinite(result.methodResults.checklist.valuation)).toBe(true);
  expect(result.methodResults.checklist.valuation).toBeGreaterThan(0);

  // Weighted valuation should also be finite
  expect(result.weightedValuation).not.toBeNaN();
  expect(Number.isFinite(result.weightedValuation)).toBe(true);
  expect(result.weightedValuation).toBeGreaterThan(0);
});
