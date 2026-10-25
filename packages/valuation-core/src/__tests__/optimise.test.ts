import { describe, it, expect, beforeAll } from 'vitest';
import { OPTIMISE_RULES, SPEC_RULE_CODES } from '../optimise/rules';
import { buildActions, rankActions } from '../optimise/buildActions';
import { computeHeadroom, headroomFor } from '../optimise/headroom';
import { applyCounterfactuals, simulate } from '../optimise/simulate';
import { EVIDENCE_KINDS, OPTIMISE_RULESET_VERSION, type ActionItem } from '../optimise/types';
import { evaluateChecks, type CheckResult } from '../checks/evaluateChecks';
import { buildParameters, runPipeline } from '../angel/pipeline';
import { runCore } from '../angel/core';
import { snapshotParameters } from '../angel/runAngelValuation';
import { mapIntakeToEngine } from '../intake/mapIntakeToEngine';
import type { ValuationReportOutput } from '../types';
import type { ValuationContext } from '../angel/context';
import { readyNorthwind } from './fixtures/contexts';

let report: ValuationReportOutput;
let checks: CheckResult[];
beforeAll(async () => {
  report = (await runPipeline(readyNorthwind())).report;
  checks = evaluateChecks(readyNorthwind(), report);
});

const rule = (code: string) => OPTIMISE_RULES.find((r) => r.code === code)!;
const ans = (changes: Record<string, unknown>, base = readyNorthwind()): ValuationContext => ({
  ...base,
  answers: { ...base.answers, ...changes } as ValuationContext['answers'],
});
const failing = (id: string): CheckResult[] => checks.map((c) => (c.id === id ? { ...c, passed: false } : c));
const teamScore = (score: number): ValuationReportOutput =>
  ({
    ...report,
    methodResults: {
      ...report.methodResults,
      scorecard: { ...report.methodResults.scorecard, criteria: report.methodResults.scorecard.criteria.map((c) => (c.key === 'team' ? { ...c, score } : c)) },
    },
  }) as ValuationReportOutput;

/**
 * For every rule: a context where it applies, and one where it does not.
 * `report` and `checks` default to the ready Northwind run.
 */
type Case = { ctx: ValuationContext; report?: () => ValuationReportOutput; checks?: () => CheckResult[] };
const CASES: Record<string, { yes: Case; no: Case }> = {
  confirm_stage: { yes: { ctx: readyNorthwind(), checks: () => failing('stage_mismatch') }, no: { ctx: readyNorthwind() } },
  balance_the_sheet: { yes: { ctx: readyNorthwind(), checks: () => failing('balance_sheet_unbalanced') }, no: { ctx: readyNorthwind() } },
  fund_the_plan: { yes: { ctx: readyNorthwind(), checks: () => failing('negative_cash') }, no: { ctx: readyNorthwind() } },
  add_use_of_funds: { yes: { ctx: readyNorthwind(), checks: () => failing('use_of_funds_missing') }, no: { ctx: readyNorthwind() } },
  support_the_forecast: { yes: { ctx: readyNorthwind(), checks: () => failing('forecast_outlier') }, no: { ctx: readyNorthwind() } },
  upload_financial_model: { yes: { ctx: readyNorthwind(), checks: () => failing('no_financial_model') }, no: { ctx: readyNorthwind() } },
  verify_revenue: { yes: { ctx: readyNorthwind() }, no: { ctx: { ...readyNorthwind(), sources: { 'grid.revenue.0': 'verified' } } } },
  verify_customers: {
    yes: { ctx: { ...readyNorthwind(), facts: { customersSource: 'founder' } } },
    no: { ctx: { ...readyNorthwind(), facts: { customersSource: 'verified' } } },
  },
  launch_beyond_prototype: { yes: { ctx: ans({ product_rollout_stage: 'MVP' }) }, no: { ctx: readyNorthwind() } },
  add_sector_advisor: { yes: { ctx: readyNorthwind(), report: () => teamScore(0) }, no: { ctx: readyNorthwind() } },
  hire_core_technical: { yes: { ctx: ans({ core_technical_skills_in_house: 2 }) }, no: { ctx: ans({ core_technical_skills_in_house: 3 }) } },
  sign_partner: { yes: { ctx: ans({ strategic_partner_relationship_strength: 2 }) }, no: { ctx: ans({ strategic_partner_relationship_strength: 3 }) } },
  show_retention: { yes: { ctx: ans({ customer_loyalty_retention: 2 }) }, no: { ctx: ans({ customer_loyalty_retention: 3 }) } },
  name_ip: {
    yes: { ctx: ans({ ip_protection_status: 'None', ip_protection_types: ['Trademark'] }) },
    no: { ctx: ans({ ip_protection_status: 'None', ip_protection_types: ['None applicable'] }) },
  },
  add_advisor_bios: {
    yes: { ctx: ans({ board_of_advisors: 'Informal advisors' }) },
    no: { ctx: { ...ans({ board_of_advisors: 'Informal advisors' }), facts: { advisorsHaveBios: true } } },
  },
  name_competitors: { yes: { ctx: readyNorthwind() }, no: { ctx: ans({ competitors: [['Contoso BI', 'contoso.com']] }) } },
  validate_demand: { yes: { ctx: ans({ demand_tested: 'Validated by competitors' }) }, no: { ctx: readyNorthwind() } },
  reach_breakeven: { yes: { ctx: readyNorthwind() }, no: { ctx: ans({ sustainably_breakeven: 'Yes' }) } },
  secure_ip: { yes: { ctx: ans({ ip_protection_status: 'In progress' }) }, no: { ctx: ans({ ip_protection_status: 'None' }) } },
  extend_ip_internationally: { yes: { ctx: ans({ ip_protection_status: 'Secured regionally' }) }, no: { ctx: ans({ ip_protection_status: 'Secured internationally' }) } },
  add_business_lead: { yes: { ctx: ans({ core_team_managerial_background: 2 }) }, no: { ctx: ans({ core_team_managerial_background: 3 }) } },
  sharpen_differentiation: {
    yes: { ctx: ans({ competitors: [['Contoso BI', '']], differentiation_vs_competitors: 3 }) },
    no: { ctx: ans({ competitors: [['Contoso BI', '']], differentiation_vs_competitors: 4 }) },
  },
  bring_in_strategic_investor: { yes: { ctx: ans({ shareholder_types: ['Friends and Family'] }) }, no: { ctx: readyNorthwind() } },
  grow_core_team: { yes: { ctx: ans({ founders_count: 2, employee_count: 1 }) }, no: { ctx: readyNorthwind() } },
};
const applies = (code: string, c: Case) => rule(code).applies(c.ctx, c.report ? c.report() : report, c.checks ? c.checks() : checks);

describe('rule set', () => {
  it('is angel-optimise-v1 with 24 rules: the spec\'s 16 in order, then 8 added', () => {
    expect(OPTIMISE_RULESET_VERSION).toBe('angel-optimise-v1');
    expect(OPTIMISE_RULES).toHaveLength(24);
    expect(OPTIMISE_RULES.slice(0, 16).map((r) => r.code)).toEqual([...SPEC_RULE_CODES]);
  });

  it('every rule has a case', () => {
    expect(Object.keys(CASES).sort()).toEqual(OPTIMISE_RULES.map((r) => r.code).sort());
  });

  it.each(Object.keys(CASES))('%s applies and does not apply', (code) => {
    expect(applies(code, CASES[code].yes)).toBe(true);
    expect(applies(code, CASES[code].no)).toBe(false);
  });

  it('a 1-5 counterfactual at the cap does not apply', () => {
    expect(rule('name_competitors').applies(ans({ differentiation_vs_competitors: 5 }), report, checks)).toBe(false);
    expect(rule('add_advisor_bios').applies(ans({ board_of_advisors: 'Informal advisors', core_team_managerial_background: 5 }), report, checks)).toBe(false);
  });

  it('1-5 counterfactuals are capped at 5', () => {
    const cf = rule('hire_core_technical').counterfactual(ans({ core_technical_skills_in_house: 4 }));
    expect((cf.answers as Record<string, unknown>).core_technical_skills_in_house).toBe(5);
  });

  it('counterfactuals are pure: the input context is not changed', () => {
    for (const code of Object.keys(CASES)) {
      const ctx = CASES[code].yes.ctx;
      const before = JSON.stringify(ctx);
      rule(code).counterfactual(ctx);
      expect(JSON.stringify(ctx), code).toBe(before);
    }
  });
});

describe('guardrails', () => {
  it('no counterfactual changes a market parameter, method weight, discount rate or multiple', () => {
    for (const code of Object.keys(CASES)) {
      if (code === 'confirm_stage') continue; // the stage IS the weights; see the next test
      const ctx = CASES[code].yes.ctx;
      const cf = rule(code).counterfactual(ctx);
      const params = (c: ValuationContext) => buildParameters(c, mapIntakeToEngine(c.answers, c.financials, c.balance, c.opts)).parameters;
      expect(params(cf), code).toEqual(params(ctx));
      // 1.2.0: the FX entries in the snapshot are identical before and after every counterfactual.
      expect(snapshotParameters(params(cf)).fx, code).toEqual(snapshotParameters(params(ctx)).fx);
    }
  });

  it('in a converted run (GB in USD) no counterfactual changes the FX entry or the converted benchmark', () => {
    const params = (c: ValuationContext) => buildParameters(c, mapIntakeToEngine(c.answers, c.financials, c.balance, c.opts)).parameters;
    for (const code of Object.keys(CASES)) {
      if (code === 'confirm_stage') continue;
      const ctx = { ...CASES[code].yes.ctx, opts: { ...CASES[code].yes.ctx.opts, currency: 'USD' } };
      const before = snapshotParameters(params(ctx));
      const after = snapshotParameters(params(rule(code).counterfactual(ctx)));
      expect(before.fx.map((f) => f.applies), code).toContain('benchmark_pre_money');
      expect(after.fx, code).toEqual(before.fx);
      expect(after.parameters.scorecard, code).toEqual(before.parameters.scorecard);
      expect(after.parameters.checklist, code).toEqual(before.parameters.checklist);
    }
  });

  it('confirm_stage changes only what the stage itself sets', () => {
    const ctx = { ...ans({ stage_of_development: 'startup' }), confirmed: { stageConfirmed: null, industryConfirmed: null } };
    const cf = rule('confirm_stage').counterfactual(ctx);
    const params = (c: ValuationContext) => buildParameters(c, mapIntakeToEngine(c.answers, c.financials, c.balance, c.opts)).parameters;
    const a = params(ctx) as unknown as Record<string, unknown>;
    const b = params(cf) as unknown as Record<string, unknown>;
    const changed = Object.keys(a).filter((k) => JSON.stringify(a[k]) !== JSON.stringify(b[k])).sort();
    // Startup and expansion share the seed benchmark cell (BENCHMARK_STAGE_BY_COMPANY_STAGE), so the
    // benchmark does not move here: only the weights, the stage and the VC hurdle do.
    expect(changed).toEqual(['method_weights', 'stage', 'vc_method']);
    expect((b.vc_method as Record<string, unknown>).required_roi).not.toBe((a.vc_method as Record<string, unknown>).required_roi);
    expect((b.vc_method as Record<string, unknown>).industry_multiple).toBe((a.vc_method as Record<string, unknown>).industry_multiple);
    expect(b.dcf_shared).toEqual(a.dcf_shared);
    expect(b.dcf_multiple).toEqual(a.dcf_multiple);
  });

  it('the forecast rule never raises a forecast, and no copy says to', () => {
    const ctx = readyNorthwind();
    expect(rule('support_the_forecast').counterfactual(ctx).financials).toEqual(ctx.financials);
    for (const r of OPTIMISE_RULES) {
      for (const text of Object.values(r.copy)) expect(text, r.code).not.toMatch(/raise your forecast/i);
    }
  });

  it('every Fix why ends with the due-diligence line, so a negative-effect Fix always carries it', () => {
    for (const r of OPTIMISE_RULES.filter((x) => x.kind === 'fix')) {
      expect(r.copy.why, r.code).toMatch(/Fixing this protects you in due diligence\.$/);
    }
  });

  it('copy lint: titles start with a verb; no em dash, exclamation mark or banned word anywhere', () => {
    const VERBS = ['Confirm', 'Balance', 'Fund', 'Add', 'Support', 'Upload', 'Verify', 'Launch', 'Hire', 'Sign', 'Show', 'Name', 'Record', 'Validate', 'Reach', 'Secure', 'Extend', 'Bring', 'Sharpen', 'Grow'];
    for (const r of OPTIMISE_RULES) {
      expect(VERBS, `${r.code}: "${r.copy.title}"`).toContain(r.copy.title.split(' ')[0]);
      for (const text of Object.values(r.copy)) {
        expect(text, r.code).not.toMatch(/[—!]/);
        expect(text, r.code).not.toMatch(/\b(advice|guaranteed|skyrocket)\b/i);
      }
    }
  });

  it('every code is unique and every evidence kind is from the closed list', () => {
    const codes = OPTIMISE_RULES.map((r) => r.code);
    expect(new Set(codes).size).toBe(codes.length);
    for (const r of OPTIMISE_RULES) expect(EVIDENCE_KINDS, r.code).toContain(r.evidence.kind);
  });

  it('is deterministic: the same context gives the same actions in the same order', async () => {
    const ctx = ans({ core_technical_skills_in_house: 2, ip_protection_status: 'In progress', demand_tested: 'Not yet' });
    const r = (await runPipeline(ctx)).report;
    const c = evaluateChecks(ctx, r);
    expect(await buildActions(ctx, r, c)).toEqual(await buildActions(ctx, r, c));
  });
});

describe('headroom', () => {
  it('matches hand-calculated values for two criteria', () => {
    const rows = computeHeadroom(report);
    const team = rows.find((h) => h.method === 'scorecard' && h.criterion === 'team')!;
    // Best team raw score: average(75, 65, 60, 85) = 71.25, delta 0.425. Current 0.25.
    // (0.425 - 0.25) x 0.30 x (6/84) x 3,200,000 = 12,000.
    expect(team.maximum).toBeCloseTo(0.425, 12);
    expect(team.headroom).toBeCloseTo(12_000, 6);
    const op = rows.find((h) => h.method === 'checklist' && h.criterion === 'operating_stage')!;
    // (1.0 - 0.7) x 0.20 x (6/84) x 6,896,000 = 29,554.29.
    expect(op.headroom).toBeCloseTo(29_554.2857, 3);
  });

  it('is zero for a criterion with no weight left, and a rule shows the sum over its factors', () => {
    const rows = computeHeadroom(report);
    expect(headroomFor(rule('hire_core_technical').factors, rows)).toBeCloseTo(
      rows.find((h) => h.method === 'scorecard' && h.criterion === 'team')!.headroom +
        rows.find((h) => h.method === 'checklist' && h.criterion === 'team')!.headroom,
      6
    );
    expect(headroomFor(rule('show_retention').factors, rows)).toBe(0);
  });
});

describe('buildActions and ranking', () => {
  it('pins a blocking Fix first even when its effect is negative', async () => {
    // Run at startup; the Series A listing suggests expansion, which values Northwind lower.
    const ctx = { ...ans({ stage_of_development: 'startup', core_technical_skills_in_house: 2 }), confirmed: { stageConfirmed: null, industryConfirmed: null } };
    const r = (await runPipeline(ctx)).report;
    const actions = await buildActions(ctx, r, evaluateChecks(ctx, r));
    expect(actions[0].code).toBe('confirm_stage');
    expect(actions[0].appliesToBlocking).toBe(true);
    expect(actions[0].estimatedDeltaPoint!).toBeLessThan(0);
  });

  it('reports each value effect as one full pipeline run on the counterfactual', async () => {
    const ctx = ans({ ip_protection_status: 'In progress' });
    const r = (await runPipeline(ctx)).report;
    const action = (await buildActions(ctx, r, evaluateChecks(ctx, r))).find((a) => a.code === 'secure_ip')!;
    const after = await runCore(rule('secure_ip').counterfactual(ctx));
    expect(action.estimatedDeltaPoint).toBe(after.report.weightedValuation - r.weightedValuation);
    expect(action.estimatedDeltaPoint!).toBeGreaterThan(0);
  });

  it('ranks value actions by effect per effort point, then time band; quality actions after value actions of the same effort', () => {
    const item = (code: string, effort: ActionItem['effort'], timeBand: ActionItem['timeBand'], delta: number | null, blocking = false): ActionItem => ({
      code, kind: blocking ? 'fix' : delta === null ? 'prove' : 'build', effort, timeBand, title: '', why: '', proof: '',
      effectKind: delta === null ? 'quality' : 'value', estimatedDeltaPoint: delta, headroomUpTo: 0,
      evidence: { kind: 'field_changed', description: '' }, appliesToBlocking: blocking,
    });
    const ranked = rankActions([
      item('hire_core_technical', 'L', 'longer', 80_000), // 10,000 per point
      item('secure_ip', 'M', '1_to_3_months', 60_000), // 20,000 per point
      item('name_ip', 'S', 'under_2_weeks', 20_000), // 20,000 per point, shorter band
      item('verify_revenue', 'S', 'under_2_weeks', null),
      item('upload_financial_model', 'S', 'under_2_weeks', null),
      item('confirm_stage', 'S', 'under_2_weeks', -5_000, true),
    ]);
    expect(ranked.map((a) => a.code)).toEqual([
      'confirm_stage', 'name_ip', 'upload_financial_model', 'verify_revenue', 'secure_ip', 'hire_core_technical',
    ]);
  });
});

describe('simulate', () => {
  const ctx = { ...ans({ stage_of_development: 'startup', core_technical_skills_in_house: 2, ip_protection_status: 'In progress' }), confirmed: { stageConfirmed: null, industryConfirmed: null } };

  it('equals one pipeline run on the context after the ticked counterfactuals', async () => {
    const ticks = ['hire_core_technical', 'secure_ip'];
    const sim = await simulate(ctx, ticks);
    const direct = await runCore(applyCounterfactuals(ctx, ticks));
    const base = await runCore(ctx);
    expect(sim.point).toBe(direct.report.weightedValuation);
    expect(sim.low).toBe(direct.range.low);
    expect(sim.high).toBe(direct.range.high);
    expect(sim.deltaPoint).toBe(direct.report.weightedValuation - base.report.weightedValuation);
  });

  it('the combined effect is not the sum of the single effects', async () => {
    // Confirming the stage moves the method weights, which rescales what the team change is worth.
    const single = await Promise.all([simulate(ctx, ['confirm_stage']), simulate(ctx, ['hire_core_technical'])]);
    const both = await simulate(ctx, ['confirm_stage', 'hire_core_technical']);
    const sum = single[0].deltaPoint + single[1].deltaPoint;
    expect(Math.abs(both.deltaPoint - sum)).toBeGreaterThan(1);
  });

  it('applies ticks in rule order, whatever order they are given in', async () => {
    expect(await simulate(ctx, ['secure_ip', 'confirm_stage'])).toEqual(await simulate(ctx, ['confirm_stage', 'secure_ip']));
  });
});
