// Valuation intake field definitions, ported from the design pack's
// docs/design/valuation/valuation-intake-data.js (valuation_intake v1.0.0).
//
// Ported: step ids and order, field ids, labels, types, options, required flags,
// scale anchors, repeat/group columns, `when` conditions, and the prefill
// metadata (src, confirm, locked). The financials step keeps its grid rows.
//
// Not ported: the MediSync sample values (`pre`, `ans`, `preSrc`), the MediSync
// hints, the source colours, and the counting helpers (summariseIntake is a
// later slice). Where the design pack lists a single MediSync-specific option
// (country, industry), the field instead names the reference table its options
// come from (`optionsFrom`).
//
// Steps 8 (comparables) and 9 (advisor_overrides) are not in the design pack,
// which only defines the founder-visible steps. They are defined here from the
// compute route's `comparables` and `weights` contract, one field each, and are
// marked founderVisible: false.

export const INTAKE_FORM_VERSION = '1.0.0';

/** Where a prefilled value comes from. Mirrors the design pack's SOURCES keys. */
export type IntakeSource = 'listing' | 'deck' | 'traction' | 'update' | 'dataroom' | 'system';

export type IntakeFieldType =
  | 'text'
  | 'long'
  | 'date'
  | 'select'
  | 'pills'
  | 'multi'
  | 'bool'
  | 'integer'
  | 'currency'
  | 'percent'
  | 'scale5'
  | 'repeat'
  | 'group'
  | 'comparables'
  | 'weights'
  /** A financials grid row listed as a field: one value per grid column. */
  | 'grid';

export interface IntakeFieldDef {
  readonly id: string;
  readonly label: string;
  readonly type: IntakeFieldType;
  readonly required: boolean;
  readonly options?: readonly string[];
  /** Options come from a package reference table rather than a fixed list. */
  readonly optionsFrom?: 'countries' | 'industries';
  /** Low and high anchor labels of a 1-5 scale. */
  readonly anchors?: readonly [string, string];
  /** Column labels of a repeat or group field. */
  readonly columns?: readonly string[];
  readonly maxLength?: number;
  /** Shown only when the named field holds one of the listed values. */
  readonly when?: readonly [string, readonly string[]];
  readonly source?: IntakeSource;
  /** A prefill from `source` needs one founder Confirm before it counts. */
  readonly confirm?: boolean;
  /** Reviewed listing field: changed on the Listing, not in the intake. */
  readonly locked?: boolean;
}

export interface IntakeGridRowDef {
  readonly id: string;
  readonly label: string;
  readonly required: boolean;
  /** Design pack `note`, e.g. "Enter 0 if none". */
  readonly note?: string;
  /** Design pack `def`: what a blank row falls back to. */
  readonly defaultsTo?: string;
}

export interface IntakeStepDef {
  readonly id: string;
  readonly title: string;
  readonly short: string;
  readonly minutes: number;
  readonly founderVisible: boolean;
  readonly fields: readonly IntakeFieldDef[];
  /** Financials only: rows of the base-year + five-forecast-year grid. */
  readonly grid?: { readonly columns: number; readonly rows: readonly IntakeGridRowDef[] };
}

const SCALE5 = 'scale5' as const;

export const INTAKE_STEPS = [
  {
    id: 'company', title: 'Company and classification', short: 'Company', minutes: 3, founderVisible: true,
    fields: [
      { id: 'company_name', label: 'Company name', type: 'text', required: true, source: 'listing', locked: true },
      { id: 'valuation_as_of_date', label: 'Valuation as-of date', type: 'date', required: true, source: 'system' },
      { id: 'reporting_currency', label: 'Reporting currency', type: 'select', required: true, options: ['USD', 'GBP', 'EUR', 'AED', 'CAD', 'AUD', 'CHF', 'SEK', 'Other'], source: 'listing' },
      { id: 'country', label: 'Country', type: 'select', required: true, optionsFrom: 'countries', source: 'listing', locked: true },
      { id: 'industry', label: 'Industry', type: 'select', required: true, optionsFrom: 'industries', source: 'listing', confirm: true },
      { id: 'stage_of_development', label: 'Stage of development', type: 'pills', required: true, options: ['Idea', 'Development', 'Startup', 'Expansion', 'Growth', 'Maturity'], source: 'listing', confirm: true },
      { id: 'incorporation_year', label: 'Year of incorporation', type: 'integer', required: true, source: 'listing', locked: true },
      { id: 'legal_entity_incorporated', label: 'Is a legal entity incorporated?', type: 'bool', required: true, source: 'listing' },
      { id: 'external_legal_counsel', label: 'Do you use external legal counsel?', type: 'bool', required: false },
      { id: 'business_description', label: 'Business description', type: 'long', required: true, maxLength: 2000, source: 'listing' },
      { id: 'company_address', label: 'Company address', type: 'text', required: false },
      { id: 'competitors', label: 'Competitors', type: 'repeat', required: false, columns: ['Name', 'Website'], source: 'deck', confirm: true },
    ],
  },
  {
    id: 'team', title: 'Team', short: 'Team', minutes: 3, founderVisible: true,
    fields: [
      { id: 'founders_count', label: 'Number of founders', type: 'integer', required: true, source: 'listing' },
      { id: 'founders_capital_invested', label: "Founders' collective capital invested to date", type: 'currency', required: true },
      { id: 'founders_time_commitment', label: "Founders' time commitment", type: SCALE5, required: true, anchors: ['Side project', 'Full time'] },
      { id: 'founders_avg_age', label: 'Average age of founders', type: 'pills', required: true, options: ['Under 25', '25 to 34', '35 to 45', 'Over 45'] },
      { id: 'founders_prior_experience', label: 'Prior entrepreneurial experience', type: 'pills', required: true, options: ['None', 'Founded a company before', 'Sold a company'], source: 'deck', confirm: true },
      { id: 'employee_count', label: 'Number of employees', type: 'integer', required: true, source: 'update', confirm: true },
      { id: 'core_team_tenure', label: 'How long has the core team worked together?', type: 'pills', required: true, options: ['Under 1 year', '1 to 2 years', '3 to 5 years', 'Over 5 years'] },
      { id: 'core_team_industry_experience_years', label: "Core team's combined years of relevant industry experience", type: 'integer', required: true, source: 'deck', confirm: true },
      { id: 'core_team_managerial_background', label: 'Managerial background of the core team', type: SCALE5, required: true, anchors: ['None', 'Top-tier management'] },
      { id: 'core_technical_skills_in_house', label: 'Are core technical skills in-house?', type: SCALE5, required: true, anchors: ['None', 'Fully in-house'] },
    ],
  },
  {
    id: 'business', title: 'Business model and stage', short: 'Business model', minutes: 2, founderVisible: true,
    fields: [
      { id: 'is_scalable', label: 'Is the business scalable?', type: 'bool', required: true },
      { id: 'business_model', label: 'Business model', type: 'pills', required: true, options: ['B2B', 'B2C'], source: 'listing' },
      { id: 'sustainably_breakeven', label: 'Is the business sustainably breakeven?', type: 'bool', required: true, source: 'update', confirm: true },
      { id: 'board_of_advisors', label: 'Board of advisors', type: 'pills', required: true, options: ['Yes, formal board', 'Informal advisors', 'No'], source: 'deck', confirm: true },
      { id: 'advisor_count', label: 'Number of advisors', type: 'integer', required: true, source: 'deck', confirm: true, when: ['board_of_advisors', ['Yes, formal board', 'Informal advisors']] },
      { id: 'shareholder_types', label: 'Current shareholder types', type: 'multi', required: true, options: ['Friends and Family', 'Crowdfunding', 'Incubator or Accelerator', 'Business Angel', 'Venture Capital'], source: 'deck', confirm: true },
      { id: 'exit_strategy_readiness', label: 'Exit strategy readiness', type: SCALE5, required: true, anchors: ['No thought given', 'Acquirers already committed'] },
    ],
  },
  {
    id: 'product', title: 'Product and market', short: 'Product and market', minutes: 5, founderVisible: true,
    fields: [
      { id: 'product_rollout_stage', label: 'Product or service roll-out stage', type: 'pills', required: true, options: ['Planning', 'Prototype', 'MVP', 'Market'], source: 'listing', confirm: true },
      { id: 'demand_tested', label: 'Has demand been tested?', type: 'pills', required: true, options: ['Not yet', 'Validated by competitors', 'Extensively validated'] },
      { id: 'tam', label: 'Total addressable market', type: 'currency', required: true, source: 'deck', confirm: true },
      { id: 'market_annual_growth_rate', label: 'Annual growth rate of the market', type: 'percent', required: true, source: 'deck', confirm: true },
      { id: 'barriers_to_entry', label: 'Barriers to entry', type: SCALE5, required: true, anchors: ['Very low', 'Very high'] },
      { id: 'competition_level', label: 'Level of competition', type: SCALE5, required: true, anchors: ['Dominated by one player', 'Blue ocean'] },
      { id: 'competitor_product_quality', label: 'Quality of existing competitive products', type: 'pills', required: true, options: ['Excellent', 'Good', 'Weak'] },
      { id: 'differentiation_vs_competitors', label: 'Differentiation versus competitors', type: SCALE5, required: true, anchors: ['Comparable solution', 'Non-comparable solution'] },
      { id: 'international_competition_status', label: 'International competition', type: 'pills', required: true, options: ['Established abroad', 'Growing', 'Not yet developed'] },
      { id: 'international_expansion_plans', label: 'International expansion plans', type: SCALE5, required: true, anchors: ['Locally focused', 'Global focus already'] },
      { id: 'customer_feedback_received', label: 'Customer feedback from early adopters or industry experts', type: 'pills', required: true, options: ['None yet', 'Mixed', 'Mainly positive', 'Overwhelmingly positive'] },
      { id: 'customer_loyalty_retention', label: 'Degree of customer loyalty and retention', type: SCALE5, required: true, anchors: ['Low retention', 'Excellent retention'] },
      { id: 'ip_protection_types', label: 'Type of IP protection that applies', type: 'multi', required: true, options: ['Patent', 'Trademark', 'Copyright', 'Domain names', 'Trade secret', 'None applicable'] },
      { id: 'ip_protection_status', label: 'IP protection status', type: 'pills', required: true, options: ['None', 'In progress', 'Secured regionally', 'Secured internationally'] },
      { id: 'strategic_partner_relationship_strength', label: 'Strength of relationships with key strategic partners', type: SCALE5, required: true, anchors: ['None', 'Contracts signed'] },
    ],
  },
  {
    id: 'financials', title: 'Financial projections', short: 'Financials', minutes: 6, founderVisible: true,
    // Revenue and equity fundraising are also listed as fields, so they count
    // among the 59 founder fields. Their values are entered in the grid below.
    fields: [
      { id: 'revenue', label: 'Revenue', type: 'grid', required: true },
      { id: 'fundraising_this_year', label: 'Equity fundraising in the year', type: 'grid', required: true },
    ],
    grid: {
      // Base year (last actual) plus five forecast years.
      columns: 6,
      rows: [
        { id: 'revenue', label: 'Revenue', required: true },
        { id: 'debt_outstanding_year_end', label: 'Debt outstanding, year end', required: true, note: 'Enter 0 if none' },
        { id: 'fundraising_this_year', label: 'Equity fundraising in the year', required: true, note: 'Enter 0 if none' },
        { id: 'cogs', label: 'Cost of goods sold', required: false },
        { id: 'salaries', label: 'Salaries', required: false },
        { id: 'other_opex', label: 'Other operating expenses', required: false },
        { id: 'depreciation_amortization', label: 'Depreciation and amortisation', required: false },
        { id: 'capex', label: 'Capital expenditure', required: false },
        { id: 'receivables', label: 'Receivables', required: false },
        { id: 'inventory', label: 'Inventory', required: false },
        { id: 'payables', label: 'Payables', required: false },
        { id: 'interest', label: 'Interest', required: false, defaultsTo: 'From debt' },
        { id: 'taxes', label: 'Taxes', required: false, defaultsTo: 'Country tax rate' },
      ],
    },
  },
  {
    id: 'balance', title: 'Base-year balance sheet', short: 'Balance sheet', minutes: 2, founderVisible: true,
    fields: [
      { id: 'cash_and_equivalents', label: 'Cash and cash equivalents', type: 'currency', required: true },
      { id: 'non_operating_cash', label: 'Non-operating cash', type: 'currency', required: true },
      { id: 'tangible_assets', label: 'Tangible assets', type: 'currency', required: false },
      { id: 'intangible_assets', label: 'Intangible assets', type: 'currency', required: false },
      { id: 'financial_assets', label: 'Financial assets', type: 'currency', required: false },
      { id: 'deferred_tax_assets', label: 'Deferred tax assets', type: 'currency', required: false },
      { id: 'short_term_liabilities', label: 'Short-term liabilities', type: 'currency', required: false },
      { id: 'long_term_liabilities', label: 'Long-term liabilities', type: 'currency', required: false },
      { id: 'equity', label: 'Equity', type: 'currency', required: false },
    ],
  },
  {
    id: 'funding', title: 'Funding and cap table', short: 'Funding', minutes: 3, founderVisible: true,
    fields: [
      { id: 'capital_needed_current_round', label: 'Capital needed in the current round', type: 'currency', required: true, source: 'listing', locked: true },
      { id: 'funding_round_history', label: 'Funding round history', type: 'repeat', required: false, columns: ['Round', 'Closed', 'Valuation or cap', 'Invested', 'Equity sold'], source: 'deck', confirm: true },
      { id: 'current_ownership', label: 'Current ownership', type: 'repeat', required: true, columns: ['Shareholder category', 'Ownership %'] },
      { id: 'use_of_funds', label: 'Use of funds', type: 'group', required: false, columns: ['Product and R&D', 'Sales and marketing', 'Inventory', 'Operations', 'Capex'], source: 'deck', confirm: true },
    ],
  },
  {
    // Advisor only. Not in the design pack; shaped on the compute route's `comparables`.
    id: 'comparables', title: 'Comparable companies', short: 'Comparables', minutes: 0, founderVisible: false,
    fields: [
      { id: 'comparables', label: 'Comparable companies', type: 'comparables', required: false, columns: ['Company name', 'Multiple', 'Metric'] },
    ],
  },
  {
    // Advisor only. Not in the design pack; shaped on the compute route's `weights`.
    id: 'advisor_overrides', title: 'Advisor overrides', short: 'Overrides', minutes: 0, founderVisible: false,
    fields: [
      { id: 'advisor_overrides', label: 'Method weight overrides', type: 'weights', required: false },
    ],
  },
] as const satisfies readonly IntakeStepDef[];

/** Every non-grid field, in step order, with its step id. */
export const INTAKE_FIELDS: readonly (IntakeFieldDef & { readonly step: IntakeStepId })[] = INTAKE_STEPS.flatMap((s) =>
  (s.fields as readonly IntakeFieldDef[]).map((f) => ({ ...f, step: s.id }))
);

/**
 * Required answers a founder must give, counted as the design pack's summarize()
 * counts them: each required non-grid field once, and each required grid row
 * once per column (revenue, debt_outstanding_year_end and fundraising_this_year,
 * six years each). Advisor-only steps are not counted. 63 for v1.0.0.
 */
export const INTAKE_REQUIRED_COUNT: number = (INTAKE_STEPS as readonly IntakeStepDef[])
  .filter((s) => s.founderVisible)
  .reduce(
    (n, s) =>
      n +
      s.fields.filter((f) => f.required && f.type !== 'grid').length +
      (s.grid ? s.grid.rows.filter((r) => r.required).length * s.grid.columns : 0),
    0
  );

export type IntakeStepId = (typeof INTAKE_STEPS)[number]['id'];
type AnyField = (typeof INTAKE_STEPS)[number]['fields'][number];
export type IntakeFieldId = AnyField['id'];
export type IntakeGridRowId = (typeof INTAKE_STEPS)[4]['grid']['rows'][number]['id'];
type BalanceStep = Extract<(typeof INTAKE_STEPS)[number], { id: 'balance' }>;
export type IntakeBalanceFieldId = BalanceStep['fields'][number]['id'];

/** Money and counts arrive from forms as strings ("180,000") or numbers. */
type NumericInput = number | string;

interface ValueByType {
  text: string;
  long: string;
  date: string;
  select: string;
  pills: string;
  multi: string[];
  /** Booleans, or the design pack's 'Yes' / 'No'. */
  bool: boolean | 'Yes' | 'No' | '';
  integer: NumericInput;
  currency: NumericInput;
  /** Entered as a percentage: 14 means 14%. */
  percent: NumericInput;
  /** 1 to 5. */
  scale5: NumericInput;
  /** One array of cells per row, in `columns` order. */
  repeat: string[][];
  /** One cell per column. */
  group: NumericInput[];
  comparables: { companyName?: string; multiple?: number; metricType?: 'revenue' | 'ebitda' }[];
  weights: Record<string, number>;
  /** One cell per grid column. mapIntakeToEngine reads the grid from its `financials` argument, not from here. */
  grid: (NumericInput | null)[];
}

/** Intake field id to its value. Every field is optional: an unanswered field is absent. */
export type IntakeAnswers = {
  [F in AnyField as F['id']]?: ValueByType[F['type']] | null;
};
