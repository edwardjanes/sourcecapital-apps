// Northwind Analytics as a ValuationContext, rebuilt from the engine fixture
// (northwind.ts) so the intake path and the fixture cannot drift apart.
//
// The answers are the fixture questionnaire's raw wizard keys (the engine keys
// are dropped: mapIntakeToEngine derives them). One answer is left out on
// purpose: strategic_partner_relationship_strength '3'. E1 maps it to
// partnerships_count 0, a key the fixture predates, and with it the intake path
// would score partnerships lower than the fixture does. Without it the intake
// path reproduces the fixture to the cent.

import { FINANCIAL_KEY_MAP } from '../../intake/mapIntakeToEngine';
import type { IntakeAnswers } from '../../intake/fields';
import type { ValuationContext } from '../../angel/context';
import { NORTHWIND_BALANCE_SHEET, NORTHWIND_COMPANY, NORTHWIND_FINANCIALS, NORTHWIND_QUESTIONNAIRE } from './northwind';

const ENGINE_ONLY_KEYS = [
  'tam_size', 'team_size', 'team_has_cto', 'has_customers', 'capital_needed', 'product_status', 'team_prior_exits',
  'last_year_revenue', 'market_growth_rate', 'product_market_fit', 'business_model_type', 'ip_protection_stage',
  'team_has_business_lead', 'has_strategic_investors', 'has_competitive_advantage', 'sustainably_breakeven',
];

const raw = Object.fromEntries(
  Object.entries(NORTHWIND_QUESTIONNAIRE).filter(
    ([k]) => !ENGINE_ONLY_KEYS.includes(k) && k !== 'strategic_partner_relationship_strength'
  )
);

export const NORTHWIND_ANSWERS = {
  ...raw,
  sustainably_breakeven: 'No',
  company_name: NORTHWIND_COMPANY.name,
  country: NORTHWIND_COMPANY.country,
  industry: NORTHWIND_COMPANY.industry,
  stage_of_development: NORTHWIND_COMPANY.stage,
  capital_needed_current_round: NORTHWIND_QUESTIONNAIRE.capital_needed,
} as unknown as IntakeAnswers;

const ENGINE_TO_INTAKE = Object.fromEntries(Object.entries(FINANCIAL_KEY_MAP).map(([intake, engine]) => [engine, intake]));
const LINE_ITEMS = ['revenue', 'cogs', 'salaries', 'otherOpex', 'totalDa', 'interest', 'taxes', 'receivables', 'inventory', 'payables', 'capex', 'debt', 'fundraisingPlan'];

export const NORTHWIND_GRID = [...NORTHWIND_FINANCIALS]
  .sort((a, b) => a.yearOffset - b.yearOffset)
  .map((year) =>
    Object.fromEntries(LINE_ITEMS.map((k) => [ENGINE_TO_INTAKE[k] ?? k, (year as Record<string, unknown>)[k] as number]))
  );

export function northwindContext(overrides: Partial<ValuationContext> = {}): ValuationContext {
  return {
    answers: NORTHWIND_ANSWERS,
    financials: NORTHWIND_GRID,
    balance: { ...NORTHWIND_BALANCE_SHEET },
    opts: { asOf: '2026-10-24', currency: 'GBP' },
    sources: {},
    confirmed: { stageConfirmed: null, industryConfirmed: null },
    facts: {},
    overrides: [],
    ...overrides,
  };
}
