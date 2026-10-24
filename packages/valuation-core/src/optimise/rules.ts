// The optimiser rule set, angel-optimise-v1.
//
// Rules 1-16 are the development spec's (section 10), as written. Rules 17-24
// are Build and Present rules added for the Scorecard and Checklist criteria the
// first 16 leave with headroom; each acts only through an intake answer that
// scoring.ts actually reads.
//
// No counterfactual touches a market parameter, a method weight, a discount rate
// or a multiple: they change intake answers, sources or confirmations only. The
// one rule whose answer moves the method weights is confirm_stage, because the
// stage IS what sets them (see the guardrail test).

import { parseIntakeNumber as num } from '../intake/mapIntakeToEngine';
import { mapIntakeToEngine } from '../intake/mapIntakeToEngine';
import type { CheckResult } from '../checks/evaluateChecks';
import { suggestedStageFor, REVENUE_GROWTH_QUARTILES } from '../checks/evaluateChecks';
import { isBlank } from '../checks/required';
import { gridSourceKey, sourceOf, type ValuationContext } from '../angel/context';
import type { ActionRule } from './types';

const SCALE_MAX = 5;

/** A copy of the context with one answer changed. */
function withAnswers(ctx: ValuationContext, changes: Record<string, unknown>): ValuationContext {
  return { ...ctx, answers: { ...ctx.answers, ...changes } as ValuationContext['answers'] };
}
const answer = (ctx: ValuationContext, id: string) => (ctx.answers as Record<string, unknown>)[id];
const scale = (ctx: ValuationContext, id: string) => num(answer(ctx, id));
const failed = (checks: CheckResult[], id: string) => checks.some((c) => c.id === id && c.passed === false);
/** Raise a 1-5 answer by `by`, capped at 5. */
const bump = (ctx: ValuationContext, id: string, by: number) =>
  withAnswers(ctx, { [id]: Math.min(SCALE_MAX, (scale(ctx, id) ?? 0) + by) });

const ROLLOUT_STEPS = ['Planning', 'Prototype', 'MVP', 'Market'] as const;
const IP_NONE = ['None', 'No IP protection'];
const IP_IN_PROGRESS = ['In progress', 'Applications filed, pending'];
const IP_REGIONAL = ['Secured regionally', 'Granted'];
const STRATEGIC = ['Business Angel', 'Venture Capital', 'Venture Capitalist'];
const DD = 'Fixing this protects you in due diligence.';

const teamSize = (ctx: ValuationContext) => {
  const f = scale(ctx, 'founders_count');
  const e = scale(ctx, 'employee_count');
  return f === undefined && e === undefined ? undefined : (f ?? 0) + (e ?? 0);
};
const competitorRows = (ctx: ValuationContext) =>
  Array.isArray(answer(ctx, 'competitors')) ? (answer(ctx, 'competitors') as unknown[][]).filter((r) => !isBlank(r)) : [];

export const OPTIMISE_RULES: readonly ActionRule[] = [
  // --- Fix --------------------------------------------------------------
  {
    code: 'confirm_stage', kind: 'fix', effort: 'S', timeBand: 'under_2_weeks', factors: [], fixesCheck: 'stage_mismatch',
    applies: (_c, _r, checks) => failed(checks, 'stage_mismatch'),
    counterfactual: (ctx) => {
      const stage = suggestedStageFor(ctx) ?? mapIntakeToEngine(ctx.answers, ctx.financials, ctx.balance, ctx.opts).company.stage;
      return { ...withAnswers(ctx, { stage_of_development: stage }), confirmed: { ...ctx.confirmed, stageConfirmed: stage } };
    },
    evidence: { kind: 'stage_confirmed', description: 'Stage of development confirmed in the intake.' },
    effectKind: 'value',
    copy: {
      title: 'Confirm your stage of development',
      why: `The stage decides how much each valuation method counts. ${DD}`,
      proof: 'Stage confirmed in the intake.',
    },
  },
  {
    code: 'balance_the_sheet', kind: 'fix', effort: 'S', timeBand: 'under_2_weeks', factors: [], fixesCheck: 'balance_sheet_unbalanced',
    applies: (_c, _r, checks) => failed(checks, 'balance_sheet_unbalanced'),
    counterfactual: (ctx) => ctx,
    evidence: { kind: 'balance_sheet_balances', params: { tolerance: 0.01 }, description: 'Assets equal liabilities plus equity within 1%.' },
    effectKind: 'quality',
    copy: {
      title: 'Balance your balance sheet',
      why: `Investors check that assets equal liabilities plus equity before anything else. ${DD}`,
      proof: 'The balance sheet balances within 1%.',
    },
  },
  {
    code: 'fund_the_plan', kind: 'fix', effort: 'M', timeBand: '1_to_3_months', factors: [], fixesCheck: 'negative_cash',
    applies: (_c, _r, checks) => failed(checks, 'negative_cash'),
    counterfactual: (ctx) => ctx,
    evidence: { kind: 'cash_never_negative', description: 'No forecast year ends with cash below zero.' },
    effectKind: 'quality',
    copy: {
      title: 'Fund every year of your plan',
      why: `A plan that runs out of cash raises questions about the whole forecast. ${DD}`,
      proof: 'No forecast year ends with cash below zero.',
    },
  },
  {
    code: 'add_use_of_funds', kind: 'fix', effort: 'S', timeBand: 'under_2_weeks', factors: [], fixesCheck: 'use_of_funds_missing',
    applies: (_c, _r, checks) => failed(checks, 'use_of_funds_missing'),
    counterfactual: (ctx) => ctx,
    evidence: { kind: 'use_of_funds_totals', description: 'Use of funds totals the full raise.' },
    effectKind: 'quality',
    copy: {
      title: 'Add your use of funds',
      why: `Investors want to see where every part of the raise goes. ${DD}`,
      proof: 'Use of funds adds up to the full raise.',
    },
  },
  {
    code: 'support_the_forecast', kind: 'fix', effort: 'M', timeBand: '1_to_3_months',
    factors: [], fixesCheck: 'forecast_outlier',
    applies: (_c, _r, checks) => failed(checks, 'forecast_outlier'),
    // Meant to move forecast growth DOWN to the peer top quartile, never above it.
    // REVENUE_GROWTH_QUARTILES is null (no sourced table), so there is no quartile
    // to move to: this is the identity, and forecast_outlier (not_evaluated)
    // never fails, so the rule never applies. Implement the move with the table.
    counterfactual: (ctx) => {
      void REVENUE_GROWTH_QUARTILES;
      return ctx;
    },
    evidence: { kind: 'model_or_revised_forecast', description: 'A financial model in the data room, or a revised forecast.' },
    effectKind: 'value',
    copy: {
      title: 'Support your forecast with a model',
      why: `Growth above most peers needs evidence behind it. ${DD}`,
      proof: 'A financial model in the data room, or a revised forecast.',
    },
  },

  // --- Prove ------------------------------------------------------------
  {
    code: 'upload_financial_model', kind: 'prove', effort: 'S', timeBand: 'under_2_weeks', factors: [],
    applies: (_c, _r, checks) => failed(checks, 'no_financial_model'),
    counterfactual: (ctx) => ctx,
    evidence: { kind: 'data_room_file', params: { category: 'financial_model' }, description: 'A data-room file with category financial_model.' },
    effectKind: 'quality',
    copy: {
      title: 'Upload your financial model',
      why: 'A model in the data room lets investors test the forecast themselves.',
      proof: 'A financial model file in the data room.',
    },
  },
  {
    code: 'verify_revenue', kind: 'prove', effort: 'S', timeBand: 'under_2_weeks', factors: [],
    applies: (ctx) =>
      !isBlank((ctx.financials[0] as Record<string, unknown> | undefined)?.revenue) &&
      sourceOf(ctx, gridSourceKey('revenue', 0)) === 'founder',
    counterfactual: (ctx) => ({ ...ctx, sources: { ...ctx.sources, [gridSourceKey('revenue', 0)]: 'verified' } }),
    evidence: { kind: 'traction_verified', params: { metric: 'revenue' }, description: 'Revenue traction metric verified.' },
    effectKind: 'quality',
    copy: {
      title: 'Verify your revenue',
      why: 'Verified revenue carries more weight with investors than a typed figure.',
      proof: 'A verified revenue metric in traction.',
    },
  },
  {
    code: 'verify_customers', kind: 'prove', effort: 'S', timeBand: 'under_2_weeks', factors: [],
    applies: (ctx) => ctx.facts.customersSource === 'founder',
    counterfactual: (ctx) => ({ ...ctx, facts: { ...ctx.facts, customersSource: 'verified' } }),
    evidence: { kind: 'traction_verified', params: { metric: 'customers' }, description: 'Customer-count traction metric verified.' },
    effectKind: 'quality',
    copy: {
      title: 'Verify your customer count',
      why: 'A verified customer count is stronger evidence than a stated one.',
      proof: 'A verified customer metric in traction.',
    },
  },

  // --- Build ------------------------------------------------------------
  {
    code: 'launch_beyond_prototype', kind: 'build', effort: 'L', timeBand: 'longer',
    factors: [{ method: 'scorecard', criterion: 'product_ip' }, { method: 'checklist', criterion: 'product_ip' }, { method: 'checklist', criterion: 'operating_stage' }],
    applies: (ctx) => {
      const i = ROLLOUT_STEPS.indexOf(answer(ctx, 'product_rollout_stage') as (typeof ROLLOUT_STEPS)[number]);
      return i >= 0 && i < ROLLOUT_STEPS.length - 1;
    },
    counterfactual: (ctx) => {
      const i = ROLLOUT_STEPS.indexOf(answer(ctx, 'product_rollout_stage') as (typeof ROLLOUT_STEPS)[number]);
      return withAnswers(ctx, { product_rollout_stage: ROLLOUT_STEPS[Math.min(i + 1, ROLLOUT_STEPS.length - 1)] });
    },
    evidence: { kind: 'rollout_and_paying_customers', description: 'Roll-out field changed and traction shows paying customers.' },
    effectKind: 'value',
    copy: {
      title: 'Launch beyond your current stage',
      why: 'Each step towards a product in market makes the product case stronger.',
      proof: 'Roll-out stage changed and traction shows paying customers.',
    },
  },
  {
    code: 'add_sector_advisor', kind: 'build', effort: 'M', timeBand: '1_to_3_months',
    factors: [{ method: 'scorecard', criterion: 'team' }, { method: 'checklist', criterion: 'team' }],
    // "Team criterion below 0.25" read on the Scorecard delta scale (-1 to +1),
    // the only scale on which the team criterion can reach that low.
    applies: (_c, report) => (report.methodResults.scorecard.criteria.find((c) => c.key === 'team')?.score ?? 0) < 0.25,
    counterfactual: (ctx) => {
      const board = answer(ctx, 'board_of_advisors');
      return withAnswers(ctx, {
        board_of_advisors: board === 'Yes, formal board' ? board : 'Informal advisors',
        advisor_count: (scale(ctx, 'advisor_count') ?? 0) + 1,
      });
    },
    evidence: { kind: 'listing_team_member', params: { role: 'advisor' }, description: 'An advisor named on the listing team.' },
    effectKind: 'value',
    copy: {
      title: 'Add an advisor from your sector',
      why: 'A named advisor with sector experience strengthens the team case.',
      proof: 'An advisor named on the listing team.',
    },
  },
  {
    code: 'hire_core_technical', kind: 'build', effort: 'L', timeBand: 'longer',
    factors: [{ method: 'scorecard', criterion: 'team' }, { method: 'checklist', criterion: 'team' }],
    applies: (ctx) => {
      const s = scale(ctx, 'core_technical_skills_in_house');
      return s !== undefined && s <= 2;
    },
    counterfactual: (ctx) => bump(ctx, 'core_technical_skills_in_house', 2),
    evidence: { kind: 'listing_team_member', params: { role: 'technical' }, description: 'A team member added with a technical role.' },
    effectKind: 'value',
    copy: {
      title: 'Hire core technical skills in-house',
      why: 'Building the product in-house lowers delivery risk for investors.',
      proof: 'A team member added with a technical role.',
    },
  },
  {
    code: 'sign_partner', kind: 'build', effort: 'M', timeBand: '1_to_3_months',
    factors: [{ method: 'scorecard', criterion: 'partnerships' }, { method: 'checklist', criterion: 'relationships' }],
    applies: (ctx) => {
      const s = scale(ctx, 'strategic_partner_relationship_strength');
      return s !== undefined && s < 3;
    },
    counterfactual: (ctx) => bump(ctx, 'strategic_partner_relationship_strength', 2),
    evidence: { kind: 'partner_named', description: 'A partner named in a Timeline milestone or a data-room contract.' },
    effectKind: 'value',
    copy: {
      title: 'Sign a strategic partner',
      why: 'A signed partner shows the market wants what you sell.',
      proof: 'A partner named in a Timeline milestone or a data-room contract.',
    },
  },
  {
    code: 'show_retention', kind: 'build', effort: 'M', timeBand: '1_to_3_months',
    // Customer loyalty is collected but scoring.ts does not read it, so this
    // rule has no criterion to act on and no value effect today.
    factors: [],
    applies: (ctx) => {
      const s = scale(ctx, 'customer_loyalty_retention');
      return s !== undefined && s <= 2;
    },
    counterfactual: (ctx) => bump(ctx, 'customer_loyalty_retention', 2),
    evidence: { kind: 'traction_metric', params: { metric: 'retention' }, description: 'A retention metric in traction.' },
    effectKind: 'value',
    copy: {
      title: 'Show how well you keep customers',
      why: 'Retention is the clearest sign that customers value the product.',
      proof: 'A retention metric in traction.',
    },
  },

  // --- Present ----------------------------------------------------------
  {
    code: 'name_ip', kind: 'present', effort: 'S', timeBand: 'under_2_weeks',
    factors: [{ method: 'scorecard', criterion: 'product_ip' }, { method: 'checklist', criterion: 'product_ip' }],
    applies: (ctx) => {
      const types = Array.isArray(answer(ctx, 'ip_protection_types')) ? (answer(ctx, 'ip_protection_types') as string[]) : [];
      return IP_NONE.includes(answer(ctx, 'ip_protection_status') as string) && types.some((t) => t !== 'None applicable');
    },
    counterfactual: (ctx) => withAnswers(ctx, { ip_protection_status: 'In progress' }),
    evidence: { kind: 'field_changed', params: { fieldId: 'ip_protection_status' }, description: 'IP protection status changed.' },
    effectKind: 'value',
    copy: {
      title: 'Record the IP protection you have started',
      why: 'You selected types of IP protection but marked the status as none.',
      proof: 'IP protection status updated in the intake.',
    },
  },
  {
    code: 'add_advisor_bios', kind: 'present', effort: 'S', timeBand: 'under_2_weeks',
    factors: [{ method: 'scorecard', criterion: 'team' }, { method: 'checklist', criterion: 'team' }],
    applies: (ctx) => {
      const board = answer(ctx, 'board_of_advisors');
      const s = scale(ctx, 'core_team_managerial_background');
      return (board === 'Yes, formal board' || board === 'Informal advisors') && ctx.facts.advisorsHaveBios !== true && s !== undefined && s < SCALE_MAX;
    },
    counterfactual: (ctx) => bump(ctx, 'core_team_managerial_background', 1),
    evidence: { kind: 'listing_team_bios', description: 'Bios for every advisor in the team section.' },
    effectKind: 'value',
    copy: {
      title: 'Add bios for your advisors',
      why: 'Investors judge advisors by what they have done, so show it.',
      proof: 'Bios on the listing team section.',
    },
  },
  {
    code: 'name_competitors', kind: 'present', effort: 'S', timeBand: 'under_2_weeks',
    factors: [{ method: 'scorecard', criterion: 'competitive_env' }],
    applies: (ctx) => {
      const s = scale(ctx, 'differentiation_vs_competitors');
      return competitorRows(ctx).length === 0 && s !== undefined && s < SCALE_MAX;
    },
    counterfactual: (ctx) => bump(ctx, 'differentiation_vs_competitors', 1),
    evidence: { kind: 'competitors_entered', params: { min: 2 }, description: 'Two or more competitors entered.' },
    effectKind: 'value',
    copy: {
      title: 'Name your competitors',
      why: 'Naming competitors shows you know the market and where you stand in it.',
      proof: 'Two or more competitors entered in the intake.',
    },
  },

  // --- Added: Build and Present rules for the remaining headroom ----------
  {
    code: 'validate_demand', kind: 'build', effort: 'M', timeBand: '1_to_3_months',
    factors: [{ method: 'scorecard', criterion: 'opportunity' }, { method: 'checklist', criterion: 'idea' }],
    applies: (ctx) => !isBlank(answer(ctx, 'demand_tested')) && answer(ctx, 'demand_tested') !== 'Extensively validated',
    counterfactual: (ctx) => withAnswers(ctx, { demand_tested: 'Extensively validated' }),
    evidence: { kind: 'field_changed', params: { fieldId: 'demand_tested' }, description: 'Demand testing answer changed, with results in the data room.' },
    effectKind: 'value',
    copy: {
      title: 'Validate demand with customers',
      why: 'Evidence that customers want the product is the core of the opportunity case.',
      proof: 'Demand testing results in the data room.',
    },
  },
  {
    code: 'reach_breakeven', kind: 'build', effort: 'L', timeBand: 'longer',
    factors: [{ method: 'checklist', criterion: 'operating_stage' }],
    applies: (ctx) => {
      const v = answer(ctx, 'sustainably_breakeven');
      return v === false || v === 'No';
    },
    counterfactual: (ctx) => withAnswers(ctx, { sustainably_breakeven: 'Yes' }),
    evidence: { kind: 'update_metric', params: { metric: 'net_burn', condition: 'at_or_below_zero' }, description: 'A company update showing net burn at or below zero.' },
    effectKind: 'value',
    copy: {
      title: 'Reach sustainable breakeven',
      why: 'A business that covers its costs carries less risk for investors.',
      proof: 'A company update showing net burn at or below zero.',
    },
  },
  {
    code: 'secure_ip', kind: 'build', effort: 'M', timeBand: '1_to_3_months',
    factors: [{ method: 'scorecard', criterion: 'product_ip' }, { method: 'checklist', criterion: 'product_ip' }],
    applies: (ctx) => IP_IN_PROGRESS.includes(answer(ctx, 'ip_protection_status') as string),
    counterfactual: (ctx) => withAnswers(ctx, { ip_protection_status: 'Secured regionally' }),
    evidence: { kind: 'field_changed', params: { fieldId: 'ip_protection_status' }, description: 'IP protection status changed, with the grant in the data room.' },
    effectKind: 'value',
    copy: {
      title: 'Secure the IP protection you applied for',
      why: 'Granted protection is worth more to investors than a pending application.',
      proof: 'The grant document in the data room.',
    },
  },
  {
    code: 'extend_ip_internationally', kind: 'build', effort: 'L', timeBand: 'longer',
    factors: [{ method: 'scorecard', criterion: 'product_ip' }, { method: 'checklist', criterion: 'product_ip' }],
    applies: (ctx) => IP_REGIONAL.includes(answer(ctx, 'ip_protection_status') as string),
    counterfactual: (ctx) => withAnswers(ctx, { ip_protection_status: 'Secured internationally' }),
    evidence: { kind: 'field_changed', params: { fieldId: 'ip_protection_status' }, description: 'IP protection status changed, with the international grants in the data room.' },
    effectKind: 'value',
    copy: {
      title: 'Extend your IP protection to other markets',
      why: 'Protection in every market you sell to keeps competitors out of them.',
      proof: 'International grant documents in the data room.',
    },
  },
  {
    code: 'add_business_lead', kind: 'build', effort: 'M', timeBand: '1_to_3_months',
    factors: [{ method: 'scorecard', criterion: 'team' }, { method: 'checklist', criterion: 'team' }],
    applies: (ctx) => {
      const s = scale(ctx, 'core_team_managerial_background');
      return s !== undefined && s <= 2;
    },
    counterfactual: (ctx) => bump(ctx, 'core_team_managerial_background', 2),
    evidence: { kind: 'listing_team_member', params: { role: 'business' }, description: 'A team member added with a commercial or operating lead role.' },
    effectKind: 'value',
    copy: {
      title: 'Bring in an experienced business lead',
      why: 'Investors look for someone who has run the commercial side before.',
      proof: 'A team member added with a commercial or operating role.',
    },
  },
  {
    code: 'sharpen_differentiation', kind: 'build', effort: 'M', timeBand: '1_to_3_months',
    factors: [{ method: 'scorecard', criterion: 'competitive_env' }],
    applies: (ctx) => {
      const s = scale(ctx, 'differentiation_vs_competitors');
      return competitorRows(ctx).length > 0 && s !== undefined && s <= 3;
    },
    counterfactual: (ctx) => bump(ctx, 'differentiation_vs_competitors', 1),
    evidence: { kind: 'field_changed', params: { fieldId: 'differentiation_vs_competitors' }, description: 'Differentiation answer changed, with the comparison in the data room.' },
    effectKind: 'value',
    copy: {
      title: 'Sharpen what sets you apart from competitors',
      why: 'A clear edge over named competitors is what investors test first.',
      proof: 'A competitor comparison in the data room.',
    },
  },
  {
    code: 'bring_in_strategic_investor', kind: 'build', effort: 'L', timeBand: 'longer',
    factors: [{ method: 'scorecard', criterion: 'partnerships' }, { method: 'checklist', criterion: 'relationships' }],
    applies: (ctx) => {
      const types = Array.isArray(answer(ctx, 'shareholder_types')) ? (answer(ctx, 'shareholder_types') as string[]) : [];
      return types.length > 0 && !types.some((t) => STRATEGIC.includes(t));
    },
    counterfactual: (ctx) =>
      withAnswers(ctx, { shareholder_types: [...((answer(ctx, 'shareholder_types') as string[]) ?? []), 'Business Angel'] }),
    evidence: { kind: 'cap_table_investor', params: { type: 'angel_or_vc' }, description: 'An angel or VC shareholder on the cap table.' },
    effectKind: 'value',
    copy: {
      title: 'Bring in an angel or venture investor',
      why: 'A professional investor on the cap table is a signal other investors follow.',
      proof: 'An angel or VC shareholder on the cap table.',
    },
  },
  {
    code: 'grow_core_team', kind: 'build', effort: 'M', timeBand: '1_to_3_months',
    factors: [{ method: 'scorecard', criterion: 'team' }, { method: 'checklist', criterion: 'team' }],
    applies: (ctx) => {
      const size = teamSize(ctx);
      return size !== undefined && size < 5;
    },
    counterfactual: (ctx) =>
      withAnswers(ctx, { employee_count: (scale(ctx, 'employee_count') ?? 0) + (5 - (teamSize(ctx) ?? 0)) }),
    evidence: { kind: 'listing_team_member', params: { role: 'any', minTeamSize: 5 }, description: 'A listing team of five or more people.' },
    effectKind: 'value',
    copy: {
      title: 'Grow the core team to five people',
      why: 'A team of five or more can cover product, sales and operations.',
      proof: 'Five or more people on the listing team.',
    },
  },
];

/** The 16 rules the spec defines, in its order. The rest are this package's additions. */
export const SPEC_RULE_CODES = [
  'confirm_stage', 'balance_the_sheet', 'fund_the_plan', 'add_use_of_funds', 'support_the_forecast',
  'upload_financial_model', 'verify_revenue', 'verify_customers', 'launch_beyond_prototype', 'add_sector_advisor',
  'hire_core_technical', 'sign_partner', 'show_retention', 'name_ip', 'add_advisor_bios', 'name_competitors',
] as const;
