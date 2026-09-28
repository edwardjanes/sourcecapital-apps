import type { BenchmarkResolution } from './benchmarks';
export type CompanyStage = 'idea'|'development'|'startup'|'expansion'|'growth'|'maturity';
export type MetricType = 'revenue'|'ebitda';

export interface FinancialYear {
  yearOffset: number;
  yearNumber: number | null;
  isActual: boolean;
  revenue: number; cogs: number; salaries: number; otherOpex: number; totalDa: number;
  interest: number; taxes: number; receivables: number; inventory: number; payables: number;
  capex: number; debt: number; fundraisingPlan: number;
}

export interface FcfeYear {
  yearOffset: number;
  ebitda: number;
  ebit: number;
  ebt: number;
  netIncome: number;
  da: number;
  deltaWc: number;
  deltaDebt: number;
  fcfe: number;
}

// --- Scorecard ---
export type ScorecardCriterionKey =
  | 'team' | 'opportunity' | 'competitive_env' | 'product_ip' | 'partnerships' | 'funding_required' | 'other';

export interface ScorecardResult {
  criteria: { key: ScorecardCriterionKey; weight: number; score: number; contribution: number }[];
  sumWeightedScore: number;
  averagePreMoneyValuation: number;
  valuation: number;
  /** The composite multiplier actually applied, after clamping to the method's 0.50-1.50 band. */
  multiplier: number;
  /** True when the derived ratings fell outside that band and were clamped. */
  multiplierClamped: boolean;
}

// --- Checklist ---
export type ChecklistCriterionKey = 'team'|'idea'|'product_ip'|'relationships'|'operating_stage';

export interface ChecklistResult {
  criteria: { key: ChecklistCriterionKey; weight: number; score: number; achievedValue: number }[];
  maxValuation: number;
  valuation: number;
}

// --- VC Method ---
export interface VcMethodResult {
  exitValue: number;
  discountFactor: number;
  discountedExitValue: number;
  /** The new investment subtracted to reach pre-money. Zero until 27 Sep 2026. */
  capitalRaised: number;
  /** V_post - investment, UNCLAMPED. Negative means the raise does not clear. */
  preMoneyValuation: number;
  clearsHurdle: boolean;
  /** max(0, preMoneyValuation). */
  valuation: number;
}

/** Whether a method produced a usable answer, and if not, why not. */
export interface MethodApplicability {
  applicable: boolean;
  /** Plain-language reason for exclusion, for the report. Null when applicable. */
  reason: string | null;
}

// --- DCF ---
export interface DcfResult {
  discountedFcfSum: number;
  terminalValue: number;
  discountedTerminalValue: number;
  illiquidityAdjustedTerminalValue: number;
  nonOperatingCash: number;
  valuation: number;
}

/** How the discount rate was built, so the report can show it rather than assert it. */
export interface DiscountRateBuildUp {
  /** COUNTRIES[x].riskFree10Y */
  riskFreeRate: number;
  /** INDUSTRIES[x].beta */
  beta: number;
  /** COUNTRIES[x].equityRiskPremium */
  equityRiskPremium: number;
  /** beta x equityRiskPremium */
  systematicRiskPremium: number;
  /** Size premium from SIZE_PREMIUM_BANDS, keyed on last actual revenue. */
  sizePremium: number;
  /** Which band matched, and how well sourced it is. */
  sizePremiumBasis: 'sourced' | 'modelled';
  sizePremiumSource: string;
  sizeBandMinRevenue: number;
  /** The revenue the band was chosen on. */
  lastYearRevenue: number;
  /** riskFreeRate + systematicRiskPremium + sizePremium */
  discountRate: number;
}

/** Gordon-growth terminal value for DCF-LTG, with the spread guardrail's verdict. */
export interface LtgTerminalValue {
  terminalValue: number;
  /** Terminal growth rate as supplied in the parameters, before any clamping. */
  growthRateRequested: number;
  /** The rate actually used. Lower than requested when the spread floor bound. */
  growthRateUsed: number;
  /** The denominator actually used -- at least MIN_LTG_SPREAD. */
  spreadUsed: number;
  /** True when the guardrail changed the arithmetic. Report it when it does. */
  floored: boolean;
  /** (1 + g) / spread: the Gordon multiple, a property of the rate and growth alone. */
  impliedMultiple: number;

  /** Which form produced `terminalValue`. */
  basis: 'naive' | 'reinvestment';
  /**
   * FCFE_5 x (1 + g) / spread -- the naive form. Kept because the spec asks for
   * it as a cross-check: "If the two approaches disagree, the Year 6
   * reinvestment assumptions are inconsistent."
   */
  naiveTerminalValue: number;
  /**
   * NetIncome_6 x (1 - g/RONIC) / spread -- the reinvestment form the spec
   * prescribes. Null when no terminal net income was supplied.
   */
  reinvestmentTerminalValue: number | null;
  /** g / RONIC: the share of terminal earnings that must be reinvested to sustain g. */
  reinvestmentRate: number | null;
  /** The return on new capital the reinvestment rate was derived from. */
  returnOnNewCapital: number | null;
  /** reinvestment / naive - 1. The spec's own diagnostic; report it when large. */
  reinvestmentDisagreement: number | null;
}

// --- Simple Multiples ---
export interface SimpleMultiplesResult {
  comparables: Array<{ name: string; metric: number; multiple: number; metricType: MetricType; source?: string }>;
  medianMultiple: number;
  valuation: number;
}

// --- Weighting ---
export type ValuationMethodKey = 'scorecard'|'checklist'|'vc'|'dcf_ltg'|'dcf_multiple'|'multiples';
export type MethodWeightSet = Record<ValuationMethodKey, number>;

export interface ValuationParameters {
  methodWeights: MethodWeightSet;
  scorecard: {
    criteriaWeights: Record<ScorecardCriterionKey, number>;
    averagePreMoneyValuation: number;
    scores: Record<ScorecardCriterionKey, number>;
  };
  checklist: {
    criteriaWeights: Record<ChecklistCriterionKey, number>;
    maxValuation: number;
    scores: Record<ChecklistCriterionKey, number>;
  };
  vc: {
    exitMetricType: MetricType;
    industryMultiple: number;
    requiredRoi: number;
    capitalRaisedOverride: number | null;
  };
  dcfShared: {
    riskFreeRate: number;
    beta: number;
    marketRiskPremium: number;
    survivalRates: number[];
    illiquidityDiscount: number;
  };
  dcfLtg: {
    longTermGrowthRate: number;
  };
  dcfMultiple: {
    exitMetricType: MetricType;
    industryMultiple: number;
  };
  multiples: {
    enabled: boolean;
  };
}

export interface ValuationReportOutput {
  methodResults: {
    scorecard: ScorecardResult;
    checklist: ChecklistResult;
    vc: VcMethodResult;
    dcfLtg: DcfResult;
    dcfMultiple: DcfResult;
    multiples: SimpleMultiplesResult;
  };
  /** Stage weight belonging to excluded methods, redistributed across the rest. */
  redistributedWeight?: number;
  /** True when no method could be applied; the valuation is then 0. */
  allMethodsInapplicable?: boolean;
  /** Present only for DCF-LTG; carries whether the spread guardrail bound. */
  ltgTerminalValue?: LtgTerminalValue;
  /** The CAPM-plus-size-premium build-up behind `discountRate`. */
  discountRateBuildUp?: DiscountRateBuildUp;
  /** Which benchmark cell drove Scorecard and Checklist, and how specific it was. */
  benchmarkResolution?: BenchmarkResolution;
  weightedValuation: number;
  lowBound: number;
  highBound: number;
  /**
   * Where the bounds came from. `sensitivity` means they are the widest
   * single-driver move each way, measured from this company's own inputs.
   * `fixed` means the flat +/-9.6% fallback, used only when the sensitivity could
   * not be computed -- do not present it as a measured range.
   */
  boundsBasis?: 'sensitivity' | 'fixed';
  perMethod: {
    method: ValuationMethodKey;
    valuation: number;
    /** The stage weight, before any redistribution. */
    weight: number;
    /** The weight actually applied, after redistributing excluded methods. */
    effectiveWeight: number;
    applicable: boolean;
    inapplicableReason: string | null;
    weightedContribution: number
  }[];
  discountRate: number;
  fcfeByYear: FcfeYear[];
  generatedAt: string;
  // Currency this report's amounts are denominated in, resolved server-side
  // from company.country via getCurrencyForCountry() -- optional so historical
  // snapshots stored before this field existed still type-check (display paths
  // treat a missing/undefined value as the pre-existing implicit USD default).
  // See claude/track-11-currency-localization-scope.md.
  currency?: string;
}

// --- Company Profile ---
export interface CompanyProfile {
  name: string;
  country: string;
  industry: string;
  stage: CompanyStage;
  description?: string;
  founders_count?: number;
  employees_count?: number;
  website?: string;
  business_model?: string;
  scalable?: boolean;
}

// --- Questionnaire Answers ---
export interface QuestionnaireAnswers {
  // Team tab
  team_size?: number;
  team_has_cto?: boolean;
  team_has_business_lead?: boolean;
  team_prior_exits?: boolean;
  // Business Model tab
  business_model_type?: string;
  recurring_revenue?: boolean;
  competitors_count?: number;
  has_competitive_advantage?: boolean;
  partnerships_count?: number;
  has_strategic_investors?: boolean;
  // Product & Market tab
  tam_size?: number;
  market_growth_rate?: number;
  product_status?: 'idea' | 'mvp' | 'beta' | 'revenue_generating';
  has_customers?: boolean;
  product_market_fit?: boolean;
  // IP & Legal tab
  has_patents?: boolean;
  has_ip?: boolean;
  ip_protection_stage?: string;
  /**
   * Sustainably breakeven. The Checklist spec names the Operating Stage inputs
   * as "the company's development stage AND current profitability" -- this is the
   * second of those. Collected by the portal wizard since the method shipped and
   * read by nothing until now.
   */
  sustainably_breakeven?: boolean;
  legal_risks?: boolean;
  // Merged from external sources (snapshot/route.ts enrichment)
  capital_needed?: number;
  last_year_revenue?: number;
  [key: string]: unknown;
}

// --- Updated Parameter Types ---
export interface UpdatedValuationParameters extends Omit<ValuationParameters, 'methodWeights' | 'scorecard' | 'checklist' | 'vc' | 'dcfShared' | 'dcfLtg' | 'dcfMultiple' | 'multiples'> {
  stage: CompanyStage;
  method_weights: Record<ValuationMethodKey, number>;
  scorecard: { average_pre_money_valuation: number };
  checklist: { max_valuation: number };
  vc_method: {
    terminal_metric_value: number;
    industry_multiple: number;
    required_roi: number;
    projection_years: number;
    /**
     * New investment to subtract for pre-money, overriding the founder's stated
     * `capital_needed`. This is the live version of what `capitalRaisedOverride`
     * was declared for and never read.
     */
    capital_raised_override?: number;
  };
  dcf_shared: {
    discount_rate: number;
    illiquidity_discount: number;
    non_operating_cash: number;
  };
  dcf_ltg: {
    terminal_growth_rate: number;
    survival_rates: number[];
    /**
     * Return on new capital in the terminal period, used to derive the
     * reinvestment rate g/RONIC. Defaults to the discount rate (no excess
     * returns in perpetuity). Optional so a caller supplying its own parameters
     * falls back to that default rather than to the unnormalised form.
     */
    terminal_return_on_new_capital?: number;
  };
  dcf_multiple: {
    exit_multiple: number;
    survival_rates: number[];
  };
  simple_multiples: {
    last_year_metric: number;
    metric_type: MetricType;
  };
  comparables: Array<{ name: string; metric: number; multiple: number; metricType: MetricType }>;
  /**
   * How `dcf_shared.discount_rate` was arrived at. Set by buildDefaultParameters
   * and passed through to the output. Optional because a caller may supply its
   * own parameters wholesale, in which case there is no build-up to report and
   * the rate should be taken at face value.
   */
  discount_rate_build_up?: DiscountRateBuildUp;
  /** Which benchmark cell drove Scorecard and Checklist, and how specific it was. */
  benchmark_resolution?: BenchmarkResolution;
}
