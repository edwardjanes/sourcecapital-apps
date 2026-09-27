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
  valuation: number;
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
  /** (1 + g) / spread: terminal value per unit of terminal-year cash flow. */
  impliedMultiple: number;
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
  /** Present only for DCF-LTG; carries whether the spread guardrail bound. */
  ltgTerminalValue?: LtgTerminalValue;
  /** The CAPM-plus-size-premium build-up behind `discountRate`. */
  discountRateBuildUp?: DiscountRateBuildUp;
  weightedValuation: number;
  lowBound: number;
  highBound: number;
  perMethod: {
    method: ValuationMethodKey;
    valuation: number;
    weight: number;
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
  };
  dcf_shared: {
    discount_rate: number;
    illiquidity_discount: number;
    non_operating_cash: number;
  };
  dcf_ltg: {
    terminal_growth_rate: number;
    survival_rates: number[];
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
}
