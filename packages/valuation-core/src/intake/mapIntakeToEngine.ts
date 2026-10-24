// Intake answers -> the engine's compute inputs.
//
// Ported from the Raise HQ portal's src/jsx/components/RaiseHQ/valuationPayload.js
// (edwardjanes/raise-hq-portal at d427ec7): buildFinancials, buildQuestionnaire,
// buildComputePayload, FINANCIAL_KEY_MAP, PRODUCT_STATUS_BY_ROLLOUT and
// IP_STAGE_BY_STATUS. Thresholds are the portal's. What the portal maps, this maps
// the same way, so a portal form run through here gives the body the portal posts
// to /api/valuation/compute today (see __tests__/mapIntakeToEngine.test.ts).
//
// This is an adapter. scoring.ts still scores QuestionnaireAnswers and does not
// read intake field ids.

import type { CompanyStage, FinancialYear, QuestionnaireAnswers } from '../types';
import { INTAKE_FORM_VERSION, type IntakeAnswers, type IntakeBalanceFieldId, type IntakeGridRowId } from './fields';

/** Financials grid: index 0 is the base (last actual) year, 1 to 5 the forecast years. */
export type IntakeFinancials = Array<Partial<Record<IntakeGridRowId, number | string | null>>>;
export type IntakeBalance = Partial<Record<IntakeBalanceFieldId, number | string | null>>;

/** `founder` for a typed cell, `not_entered` for a blank one that reaches the engine as 0. */
export const FINANCIAL_SOURCE_FOUNDER = 'founder';
export const FINANCIAL_SOURCE_NOT_ENTERED = 'not_entered';
export type FinancialSource = typeof FINANCIAL_SOURCE_FOUNDER | typeof FINANCIAL_SOURCE_NOT_ENTERED;

export interface MappedCompany {
  name: string;
  country: string;
  industry: string;
  stage: CompanyStage;
  founders_count?: number;
  employees_count?: number;
  business_model?: string;
  founders_committed_capital?: number;
  description?: string;
  incorporated_year?: number;
  scalable?: boolean;
}

export type MappedFinancialYear = FinancialYear & { sources: Record<string, FinancialSource> };

export interface MappedComparable {
  companyName?: string;
  multiple?: number;
  metricType?: 'revenue' | 'ebitda';
}

export interface MappedEngineInputs {
  /** The compute route's `company`. */
  company: MappedCompany;
  financials: MappedFinancialYear[];
  questionnaire: QuestionnaireAnswers;
  balanceSheet: Partial<Record<IntakeBalanceFieldId, number>>;
  comparables: MappedComparable[] | null;
  /** The compute route's `weights`; null when the advisor set none. */
  weights: Record<string, number> | null;
  /**
   * Run context. Not part of the compute route's contract and ignored by it:
   * the route resolves currency from company.country.
   */
  meta: { asOf: string; currency: string; intakeFormVersion: string };
}

// The engine's FinancialYear line items, in the portal's FINANCIAL_LINE_ITEMS order.
const FINANCIAL_LINE_ITEMS: readonly IntakeGridRowId[] = [
  'revenue', 'cogs', 'salaries', 'other_opex', 'depreciation_amortization', 'interest', 'taxes',
  'receivables', 'inventory', 'payables', 'capex', 'debt_outstanding_year_end', 'fundraising_this_year',
];

const BALANCE_SHEET_FIELDS: readonly IntakeBalanceFieldId[] = [
  'cash_and_equivalents', 'non_operating_cash', 'tangible_assets', 'intangible_assets', 'financial_assets',
  'deferred_tax_assets', 'short_term_liabilities', 'long_term_liabilities', 'equity',
];

/** Intake line-item id -> engine FinancialYear key. Anything not listed has the same name on both sides. */
export const FINANCIAL_KEY_MAP: Readonly<Partial<Record<IntakeGridRowId, keyof FinancialYear>>> = {
  other_opex: 'otherOpex',
  depreciation_amortization: 'totalDa',
  debt_outstanding_year_end: 'debt',
  fundraising_this_year: 'fundraisingPlan',
};

export const PRODUCT_STATUS_BY_ROLLOUT: Readonly<Record<string, NonNullable<QuestionnaireAnswers['product_status']>>> = {
  Planning: 'idea',
  Prototype: 'mvp',
  MVP: 'beta',
  Market: 'revenue_generating',
};

/**
 * IP protection status -> the engine's four graded values (scoring.ts scores
 * none 25, pending 50, granted 75, enforced 90).
 *
 * The first four keys are the portal's labels, unchanged. The last four are the
 * design pack's labels for the same question, which word the scale differently.
 * "Secured regionally" -> granted and "Secured internationally" -> enforced is
 * this package's reading of that scale, not the portal's.
 *
 * "None" maps to `none` on purpose: having no IP is a real answer worth 25, not
 * a missing one. A blank select stays unmapped so the criterion drops out.
 */
export const IP_STAGE_BY_STATUS: Readonly<Record<string, 'none' | 'pending' | 'granted' | 'enforced'>> = {
  'No IP protection': 'none',
  'Applications filed, pending': 'pending',
  Granted: 'granted',
  'Granted and enforced': 'enforced',
  None: 'none',
  'In progress': 'pending',
  'Secured regionally': 'granted',
  'Secured internationally': 'enforced',
};

/** Shareholder types that count as strategic investors. The portal says "Venture Capitalist", the design pack "Venture Capital". */
const STRATEGIC_SHAREHOLDER_TYPES = new Set(['Business Angel', 'Venture Capitalist', 'Venture Capital']);

/**
 * Engine stage ids are lower case; the design pack's pills are title case
 * ("Startup"). Anything that is not a stage passes through unchanged so the
 * engine's own validation reports it.
 */
const ENGINE_STAGES: readonly CompanyStage[] = ['idea', 'development', 'startup', 'expansion', 'growth', 'maturity'];
function toEngineStage(v: unknown): CompanyStage {
  const s = typeof v === 'string' ? v.trim().toLowerCase() : '';
  return (ENGINE_STAGES as readonly string[]).includes(s) ? (s as CompanyStage) : (v as CompanyStage);
}

// Form inputs hold strings; the engine does arithmetic on these. Blank or
// unparseable -> undefined, so "not answered" stays distinguishable from 0.
// Thousands separators and spaces are stripped ("180,000"), which the design
// pack's money fields use and the portal's never contain.
const num = (v: unknown): number | undefined => {
  if (v === '' || v === null || v === undefined) return undefined;
  const n = typeof v === 'number' ? v : Number(String(v).replace(/[,\s]/g, ''));
  return Number.isFinite(n) ? n : undefined;
};
const atLeast = (v: unknown, threshold: number): boolean | undefined => {
  const n = num(v);
  return n === undefined ? undefined : n >= threshold;
};
/** The design pack's bool fields hold true/false or 'Yes'/'No'. Anything else is unanswered. */
const yesNo = (v: unknown): boolean | undefined =>
  typeof v === 'boolean' ? v : v === 'Yes' ? true : v === 'No' ? false : undefined;

// "Base Year" is the last actual year (yearOffset -1, which the engine reads as
// last year's revenue); Year 1-5 are forecast years 1-5. A blank cell becomes a
// hard 0, as in the portal -- nothing substitutes a benchmark -- and `sources`
// records which cells were typed.
function buildFinancials(rows: IntakeFinancials): MappedFinancialYear[] {
  return rows.map((row, i) => {
    const out = { yearOffset: i === 0 ? -1 : i, yearNumber: null, isActual: i === 0 } as Record<string, unknown>;
    const sources: Record<string, FinancialSource> = {};
    for (const key of FINANCIAL_LINE_ITEMS) {
      const engineKey = FINANCIAL_KEY_MAP[key] || key;
      const entered = num(row[key]);
      out[engineKey] = entered ?? 0;
      sources[engineKey] = entered === undefined ? FINANCIAL_SOURCE_NOT_ENTERED : FINANCIAL_SOURCE_FOUNDER;
    }
    out.sources = sources;
    return out as unknown as MappedFinancialYear;
  });
}

const nonEmptyRows = (v: unknown): unknown[][] =>
  Array.isArray(v) ? v.filter((r) => (Array.isArray(r) ? r.some((c) => c !== null && c !== undefined && String(c).trim() !== '') : false)) : [];

/**
 * Answers mapped into `company` (or into `capital_needed`) rather than passed
 * through to the questionnaire. In the portal these live on form.company and
 * form.funding, not form.questionnaire, so they never reached its questionnaire.
 */
const NOT_PASSED_THROUGH = new Set<string>([
  'company_name', 'country', 'industry', 'stage_of_development', 'capital_needed_current_round',
  'comparables', 'advisor_overrides',
]);

function buildQuestionnaire(
  answers: IntakeAnswers,
  financials: MappedFinancialYear[],
  capitalNeeded: number | undefined
): QuestionnaireAnswers {
  const a = answers as Record<string, unknown>;
  const baseYearRevenue = financials[0]?.revenue;
  const growth = num(a.market_annual_growth_rate);
  const shareholders = Array.isArray(a.shareholder_types) ? (a.shareholder_types as string[]) : [];
  const founders = num(a.founders_count);
  const employees = num(a.employee_count);
  const competitors = Array.isArray(a.competitors) ? nonEmptyRows(a.competitors) : undefined;
  const partnerStrength = num(a.strategic_partner_relationship_strength);
  const ipTypes = Array.isArray(a.ip_protection_types) ? (a.ip_protection_types as string[]) : [];

  const mapped: Partial<QuestionnaireAnswers> = {
    // --- As the portal maps them ---
    team_size: founders === undefined && employees === undefined ? undefined : (founders || 0) + (employees || 0),
    team_has_cto: atLeast(a.core_technical_skills_in_house, 4),
    team_has_business_lead: atLeast(a.core_team_managerial_background, 3),
    team_prior_exits: a.founders_prior_experience ? a.founders_prior_experience === 'Sold a company' : undefined,
    business_model_type: (a.business_model as string) || undefined,
    has_competitive_advantage: atLeast(a.differentiation_vs_competitors, 4),
    has_strategic_investors: shareholders.length ? shareholders.some((s) => STRATEGIC_SHAREHOLDER_TYPES.has(s)) : undefined,
    tam_size: num(a.tam),
    // Entered as a percentage (15 = 15%); the engine compares against 0.05/0.1/0.2.
    market_growth_rate: growth === undefined ? undefined : growth / 100,
    product_status: PRODUCT_STATUS_BY_ROLLOUT[a.product_rollout_stage as string],
    ip_protection_stage: IP_STAGE_BY_STATUS[a.ip_protection_status as string],
    sustainably_breakeven: yesNo(a.sustainably_breakeven),
    has_customers: baseYearRevenue > 0 ? true : a.product_rollout_stage === 'Market' ? true : undefined,
    product_market_fit: a.demand_tested ? a.demand_tested === 'Extensively validated' : undefined,
    capital_needed: capitalNeeded,

    // --- New in this package: engine keys the portal never sends ---
    competitors_count: competitors && competitors.length ? competitors.length : undefined,
    partnerships_count: partnerStrength === undefined ? undefined : partnerStrength >= 4 ? 1 : 0,
    has_ip: ipTypes.length ? ipTypes.some((t) => t !== 'None applicable') : undefined,
    has_patents: ipTypes.length ? ipTypes.includes('Patent') : undefined,
  };

  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(a)) {
    if (!NOT_PASSED_THROUGH.has(k)) out[k] = v;
  }
  for (const [k, v] of Object.entries(mapped)) {
    if (v !== undefined) out[k] = v;
  }

  // sustainably_breakeven is the ONE mapped key whose name collides with an
  // intake key. The raw value survives the pass-through whenever the mapping
  // declines to set it (a blank select, ""). The engine types it as a boolean,
  // and a leaked "" would count as answered, so drop anything not boolean.
  if (typeof out.sustainably_breakeven !== 'boolean') delete out.sustainably_breakeven;

  return out as QuestionnaireAnswers;
}

/**
 * Maps intake answers to the inputs of computeValuation, shaped as the body of
 * POST /api/valuation/compute (`company`, `financials`, `questionnaire`,
 * `balanceSheet`, `comparables`, `weights`).
 *
 * Mapped as the portal's buildComputePayload maps them:
 * - company: company_name (trimmed), country, industry, stage_of_development
 *   (title case accepted), founders_count, employee_count (only when >= 1; the
 *   engine rejects 0), business_model, founders_capital_invested.
 * - financials: the six grid columns, base year at yearOffset -1, via
 *   FINANCIAL_KEY_MAP; blanks become 0 with `sources` saying so.
 * - questionnaire: team_size (founders + employees), team_has_cto
 *   (core_technical_skills_in_house >= 4), team_has_business_lead
 *   (core_team_managerial_background >= 3), team_prior_exits ("Sold a company"),
 *   business_model_type, has_competitive_advantage
 *   (differentiation_vs_competitors >= 4), has_strategic_investors (an angel or
 *   VC shareholder), tam_size, market_growth_rate (percent / 100),
 *   product_status (PRODUCT_STATUS_BY_ROLLOUT), ip_protection_stage
 *   (IP_STAGE_BY_STATUS), sustainably_breakeven, has_customers (base-year
 *   revenue > 0 or roll-out Market), product_market_fit ("Extensively
 *   validated"), capital_needed (capital_needed_current_round). Every other
 *   answer is passed through under its own id so it is kept on the snapshot.
 * - balanceSheet: the nine balance fields, numeric values only.
 *
 * New mappings, for engine keys the portal sends no value for:
 * - competitors_count: number of non-empty rows in `competitors`. An empty or
 *   missing list stays unanswered, since the field is optional and leaving it
 *   blank is not a claim of zero competitors.
 * - partnerships_count: strategic_partner_relationship_strength 4 or 5 gives 1,
 *   1 to 3 gives 0. Unanswered stays unanswered.
 * - has_ip: any ip_protection_types entry other than "None applicable".
 * - has_patents: ip_protection_types includes "Patent". (scoring.ts only reads
 *   has_ip / has_patents when ip_protection_stage is absent.)
 * - ip_protection_status also accepts the design pack's four labels.
 * - company.description (business_description), company.incorporated_year
 *   (incorporation_year) and company.scalable (is_scalable). None of these is
 *   read by the methods' maths.
 * - comparables (step 8) and weights (step 9, advisor_overrides), when set.
 *
 * Left unanswered because no intake field holds them: recurring_revenue and
 * legal_risks.
 */
export function mapIntakeToEngine(
  answers: IntakeAnswers,
  financials: IntakeFinancials,
  balance: IntakeBalance,
  opts: { asOf: string; currency: string }
): MappedEngineInputs {
  const a = answers as Record<string, unknown>;
  const mappedFinancials = buildFinancials(financials);
  const employees = num(a.employee_count);

  const balanceSheet: Partial<Record<IntakeBalanceFieldId, number>> = {};
  for (const key of BALANCE_SHEET_FIELDS) {
    const v = num(balance[key]);
    if (v !== undefined) balanceSheet[key] = v;
  }

  const company: MappedCompany = {
    name: String(a.company_name ?? '').trim(),
    country: a.country as string,
    industry: a.industry as string,
    stage: toEngineStage(a.stage_of_development),
    founders_count: num(a.founders_count),
    employees_count: employees !== undefined && employees >= 1 ? employees : undefined,
    business_model: (a.business_model as string) || undefined,
    founders_committed_capital: num(a.founders_capital_invested),
  };
  const description = typeof a.business_description === 'string' ? a.business_description.trim() : '';
  if (description) company.description = description;
  const incorporated = num(a.incorporation_year);
  if (incorporated !== undefined) company.incorporated_year = incorporated;
  const scalable = yesNo(a.is_scalable);
  if (scalable !== undefined) company.scalable = scalable;

  const comparables = Array.isArray(a.comparables) && a.comparables.length ? (a.comparables as MappedComparable[]) : null;
  const overrides = a.advisor_overrides;
  const weights =
    overrides && typeof overrides === 'object' && Object.keys(overrides).length ? (overrides as Record<string, number>) : null;

  return {
    company,
    financials: mappedFinancials,
    questionnaire: buildQuestionnaire(answers, mappedFinancials, num(a.capital_needed_current_round)),
    balanceSheet,
    comparables,
    weights,
    meta: { asOf: opts.asOf, currency: opts.currency, intakeFormVersion: INTAKE_FORM_VERSION },
  };
}
