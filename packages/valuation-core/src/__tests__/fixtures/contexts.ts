// Test contexts built on Northwind.

import type { ValuationContext } from '../../angel/context';
import { northwindContext, NORTHWIND_ANSWERS, NORTHWIND_GRID } from './northwindIntake';

/**
 * Northwind with every blocking check cleared, and the same point value:
 * - the nine missing required answers filled. Partner strength 4 maps to
 *   partnerships_count 1, which scores the same 50 as unanswered, and
 *   ip_protection_types only matters when ip_protection_stage is absent;
 * - equity 280,000 so assets (420k + 95k + 180k) equal liabilities plus equity;
 * - use of funds totalling the 2.5m raise, ownership totalling 100%;
 * - stage confirmed, and a Series A listing (which suggests `expansion`).
 */
export function readyNorthwind(overrides: Partial<ValuationContext> = {}): ValuationContext {
  const base = northwindContext();
  return {
    ...base,
    answers: {
      ...NORTHWIND_ANSWERS,
      valuation_as_of_date: '2026-10-24',
      reporting_currency: 'GBP',
      incorporation_year: 2021,
      legal_entity_incorporated: 'Yes',
      business_description: 'Analytics for mid-market retailers.',
      customer_feedback_received: 'Mainly positive',
      ip_protection_types: ['Patent'],
      strategic_partner_relationship_strength: 4,
      current_ownership: [['Founders', '78'], ['Angels', '22']],
      use_of_funds: ['1000000', '900000', '0', '600000', '0'],
    } as ValuationContext['answers'],
    balance: { ...base.balance, equity: 280000 },
    confirmed: { stageConfirmed: 'expansion', industryConfirmed: 'SaaS' },
    facts: { listingStage: 'series_a', hasFinancialModel: true, lastUpdateAgeDays: 20 },
    ...overrides,
  };
}

/**
 * Northwind with a terminal-year loss but positive terminal revenue: year 5
 * salaries raised by 2.5m, which takes year-5 net income below zero.
 */
export function lossMakingNorthwind(extraYear5Cost = 2_500_000): ValuationContext {
  const grid = NORTHWIND_GRID.map((row, i) => (i === 5 ? { ...row, salaries: (row.salaries as number) + extraYear5Cost } : row));
  return readyNorthwind({ financials: grid });
}

/** Northwind with a blank terminal year: no year-5 revenue or costs at all. */
export function emptyTerminalYearNorthwind(): ValuationContext {
  const grid = NORTHWIND_GRID.map((row, i) =>
    i === 5 ? Object.fromEntries(Object.keys(row).map((k) => [k, 0])) : row
  );
  return readyNorthwind({ financials: grid });
}
