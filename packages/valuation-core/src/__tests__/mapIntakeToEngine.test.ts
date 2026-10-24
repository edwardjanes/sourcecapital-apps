import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { buildComputePayload } from './fixtures/portal/valuationPayload.js';
import { mapIntakeToEngine, type IntakeFinancials } from '../intake/mapIntakeToEngine';
import { INTAKE_FIELDS, INTAKE_REQUIRED_COUNT, INTAKE_STEPS, type IntakeAnswers } from '../intake/fields';
import { computeValuation } from '../compute';
import { buildDefaultParameters } from '../defaults';

/**
 * The portal's own buildComputePayload (vendored at d427ec7) is the source of
 * truth: a portal wizard form run through it is what the portal posts to
 * /api/valuation/compute today. The same answers, keyed by intake field id, must
 * come out of mapIntakeToEngine as the same body, key by key -- except for the
 * engine keys the portal never sends, which are listed exactly.
 */

// A full portal form for Northwind Analytics: every questionnaire key the
// portal maps is answered, in the portal's own option vocabulary.
const PORTAL_FORM = {
  company: { name: '  Northwind Analytics Ltd ', country: 'United Kingdom', industry: 'SaaS', stage: 'expansion' },
  questionnaire: {
    founders_count: '2',
    employee_count: '14',
    founders_capital_invested: '150000',
    core_technical_skills_in_house: '4',
    core_team_managerial_background: '3',
    founders_prior_experience: 'Founded a company before',
    business_model: 'B2B',
    differentiation_vs_competitors: '4',
    shareholder_types: ['Business Angel', 'Friends and Family'],
    tam: '4200000000',
    market_annual_growth_rate: '18',
    product_rollout_stage: 'Market',
    ip_protection_status: 'Applications filed, pending',
    sustainably_breakeven: 'No',
    demand_tested: 'Extensively validated',
    // Collected and passed through, not mapped by the portal:
    founders_time_commitment: '5',
    barriers_to_entry: '3',
    // Keys only this package maps:
    strategic_partner_relationship_strength: '4',
    ip_protection_types: ['Trademark', 'Patent'],
    competitors: [['Contoso BI', 'contoso.com'], ['Fabrikam Insight', '']],
  },
  financials: [
    { revenue: '900000', cogs: '198000', salaries: '520000', other_opex: '260000', depreciation_amortization: '12000', interest: '0', taxes: '0', receivables: '75000', inventory: '0', payables: '41000', capex: '15000', debt_outstanding_year_end: '0', fundraising_this_year: '0' },
    { revenue: '1800000', cogs: '360000', salaries: '900000', other_opex: '420000', depreciation_amortization: '15000', capex: '30000', debt_outstanding_year_end: '0', fundraising_this_year: '2500000' },
    { revenue: '3200000', cogs: '608000', salaries: '1400000', other_opex: '640000', depreciation_amortization: '20000', capex: '40000', debt_outstanding_year_end: '0', fundraising_this_year: '0' },
    { revenue: '5100000', cogs: '918000', salaries: '2000000', other_opex: '900000', depreciation_amortization: '25000', capex: '50000', debt_outstanding_year_end: '0', fundraising_this_year: '0' },
    { revenue: '7300000', cogs: '1241000', salaries: '2600000', other_opex: '1200000', depreciation_amortization: '30000', capex: '60000', debt_outstanding_year_end: '0', fundraising_this_year: '0' },
    { revenue: '9500000', cogs: '1520000', salaries: '3100000', other_opex: '1500000', depreciation_amortization: '35000', capex: '70000', debt_outstanding_year_end: '0', fundraising_this_year: '0' },
  ],
  balanceSheet: { cash_and_equivalents: '640000', non_operating_cash: '0', equity: '', tangible_assets: '30000' },
  funding: { capital_needed_current_round: '2500000' },
};

/** The same form keyed by intake field id, as TheAngel's intake will hold it. */
function intakeFromPortalForm(form: typeof PORTAL_FORM) {
  const answers = {
    ...form.questionnaire,
    company_name: form.company.name,
    country: form.company.country,
    industry: form.company.industry,
    stage_of_development: form.company.stage,
    capital_needed_current_round: form.funding.capital_needed_current_round,
  } as unknown as IntakeAnswers;
  return { answers, financials: form.financials as IntakeFinancials, balance: form.balanceSheet };
}

const OPTS = { asOf: '2026-10-24', currency: 'GBP' };
const NEW_QUESTIONNAIRE_KEYS = ['competitors_count', 'partnerships_count', 'has_ip', 'has_patents'];

describe('mapIntakeToEngine -- round trip against the portal', () => {
  const expected = buildComputePayload(PORTAL_FORM);
  const { answers, financials, balance } = intakeFromPortalForm(PORTAL_FORM);
  const actual = mapIntakeToEngine(answers, financials, balance, OPTS);

  it('company matches key by key', () => {
    expect(actual.company).toEqual(expected.company);
  });

  it('financials match key by key, sources included', () => {
    expect(actual.financials).toEqual(expected.financials);
  });

  it('balanceSheet matches key by key', () => {
    expect(actual.balanceSheet).toEqual(expected.balanceSheet);
  });

  it('every questionnaire key the portal sends has the same value', () => {
    for (const [key, value] of Object.entries(expected.questionnaire)) {
      expect({ key, value: (actual.questionnaire as Record<string, unknown>)[key] }).toEqual({ key, value });
    }
  });

  it('the only extra questionnaire keys are the four new mappings', () => {
    const extra = Object.keys(actual.questionnaire).filter((k) => !(k in expected.questionnaire));
    expect(extra.sort()).toEqual([...NEW_QUESTIONNAIRE_KEYS].sort());
    expect(actual.questionnaire.partnerships_count).toBe(1);
    expect(actual.questionnaire.has_ip).toBe(true);
    expect(actual.questionnaire.has_patents).toBe(true);
    expect(actual.questionnaire.competitors_count).toBe(2);
  });

  it('without the package-only answers, the questionnaire is identical', () => {
    const { strategic_partner_relationship_strength: _s, ip_protection_types: _i, competitors: _c, ...q } = PORTAL_FORM.questionnaire;
    const form = { ...PORTAL_FORM, questionnaire: q };
    const portal = buildComputePayload(form as typeof PORTAL_FORM);
    const ours = intakeFromPortalForm(form as typeof PORTAL_FORM);
    const mapped = mapIntakeToEngine(ours.answers, ours.financials, ours.balance, OPTS);
    expect(mapped.questionnaire).toEqual(portal.questionnaire);
  });

  it('the body the route sees computes the same valuation as the portal body', async () => {
    const run = async (body: { company: any; financials: any; questionnaire: any; balanceSheet: any }) => {
      const p = { name: body.company.name, country: body.company.country, industry: body.company.industry, stage: body.company.stage };
      const params = buildDefaultParameters(p, body.financials, body.balanceSheet);
      return computeValuation(p, body.financials, body.questionnaire, { ...params, comparables: [] });
    };
    // Strip the package-only answers so the two bodies are the same input.
    const { strategic_partner_relationship_strength: _s, ip_protection_types: _i, competitors: _c, ...q } = PORTAL_FORM.questionnaire;
    const form = { ...PORTAL_FORM, questionnaire: q } as typeof PORTAL_FORM;
    const ours = intakeFromPortalForm(form);
    const a = await run(buildComputePayload(form));
    const b = await run(mapIntakeToEngine(ours.answers, ours.financials, ours.balance, OPTS));
    expect(b.weightedValuation).toBe(a.weightedValuation);
  });

  it('meta carries the run context and is outside the route contract', () => {
    expect(actual.meta).toEqual({ asOf: '2026-10-24', currency: 'GBP', intakeFormVersion: '1.0.0' });
    expect(actual.comparables).toBeNull();
    expect(actual.weights).toBeNull();
  });
});

describe('mapIntakeToEngine -- new mappings', () => {
  const base = { company_name: 'X', country: 'United States', industry: 'SaaS', stage_of_development: 'Startup' } as IntakeAnswers;
  const run = (extra: Record<string, unknown>) =>
    mapIntakeToEngine({ ...base, ...extra } as IntakeAnswers, [{ revenue: '0' }], {}, OPTS);

  it('accepts the design pack title-case stage', () => {
    expect(run({}).company.stage).toBe('startup');
  });

  it('competitors_count counts non-empty rows; an empty list stays unanswered', () => {
    expect(run({ competitors: [['Carely Health', 'carely.com'], ['ClinicOS', ''], ['', '']] }).questionnaire.competitors_count).toBe(2);
    expect(run({ competitors: [] }).questionnaire.competitors_count).toBeUndefined();
    expect(run({}).questionnaire.competitors_count).toBeUndefined();
  });

  it('partnerships_count: 4 or 5 gives 1, 1 to 3 gives 0, blank stays unanswered', () => {
    for (const [v, want] of [[5, 1], [4, 1], [3, 0], [1, 0], ['', undefined]] as const) {
      expect(run({ strategic_partner_relationship_strength: v }).questionnaire.partnerships_count).toBe(want);
    }
  });

  it('has_ip and has_patents come from ip_protection_types', () => {
    expect(run({ ip_protection_types: ['Patent'] }).questionnaire).toMatchObject({ has_ip: true, has_patents: true });
    expect(run({ ip_protection_types: ['Trademark'] }).questionnaire).toMatchObject({ has_ip: true, has_patents: false });
    expect(run({ ip_protection_types: ['None applicable'] }).questionnaire).toMatchObject({ has_ip: false, has_patents: false });
    expect('has_ip' in run({}).questionnaire).toBe(false);
  });

  it('maps the design pack IP status labels onto the engine scale', () => {
    const stage = (s: string) => run({ ip_protection_status: s }).questionnaire.ip_protection_stage;
    expect(stage('None')).toBe('none');
    expect(stage('In progress')).toBe('pending');
    expect(stage('Secured regionally')).toBe('granted');
    expect(stage('Secured internationally')).toBe('enforced');
    expect(stage('Patents pending in GB')).toBeUndefined();
  });

  it('counts the design pack "Venture Capital" as a strategic investor', () => {
    expect(run({ shareholder_types: ['Venture Capital'] }).questionnaire.has_strategic_investors).toBe(true);
    expect(run({ shareholder_types: ['Crowdfunding'] }).questionnaire.has_strategic_investors).toBe(false);
  });

  it('reads design pack booleans and money with thousands separators', () => {
    const m = run({ sustainably_breakeven: true, founders_capital_invested: '180,000', is_scalable: 'Yes', incorporation_year: '2023' });
    expect(m.questionnaire.sustainably_breakeven).toBe(true);
    expect(m.company).toMatchObject({ founders_committed_capital: 180000, scalable: true, incorporated_year: 2023 });
  });

  it('never leaks an unanswered sustainably_breakeven', () => {
    expect('sustainably_breakeven' in run({ sustainably_breakeven: '' }).questionnaire).toBe(false);
  });

  it('passes comparables and advisor overrides through as comparables and weights', () => {
    const m = run({
      comparables: [{ companyName: 'Acme', multiple: 4.2, metricType: 'revenue' }],
      advisor_overrides: { scorecard: 0.5, checklist: 0.5 },
    });
    expect(m.comparables).toEqual([{ companyName: 'Acme', multiple: 4.2, metricType: 'revenue' }]);
    expect(m.weights).toEqual({ scorecard: 0.5, checklist: 0.5 });
    expect('comparables' in m.questionnaire).toBe(false);
    expect('advisor_overrides' in m.questionnaire).toBe(false);
  });
});

describe('intake fields -- against the design pack', () => {
  // The design pack is committed in this repo; it is the spec these definitions port.
  const packPath = new URL('../../../../docs/design/valuation/valuation-intake-data.js', import.meta.url);
  const pack = existsSync(packPath)
    ? (() => {
        const window: Record<string, any> = { dispatchEvent: () => {} };
        runInNewContext(readFileSync(packPath, 'utf8'), { window, Event: class {} });
        return window.VI as { steps: any[]; fieldState: (s: any, f: any, mode: string) => { value: unknown } };
      })()
    : null;

  it('has 59 founder fields and 63 required answers, plus 2 advisor-only fields (61 in all)', () => {
    const founderSteps = new Set<string>(INTAKE_STEPS.filter((s) => s.founderVisible).map((s) => s.id));
    const founderFields = INTAKE_FIELDS.filter((f) => founderSteps.has(f.step));
    expect(founderFields).toHaveLength(59);
    expect(INTAKE_REQUIRED_COUNT).toBe(63);
    expect(INTAKE_FIELDS).toHaveLength(61);
    expect(INTAKE_FIELDS.filter((f) => !founderSteps.has(f.step)).map((f) => f.id)).toEqual(['comparables', 'advisor_overrides']);
    // The two grid fields are the revenue and equity fundraising rows.
    expect(founderFields.filter((f) => f.type === 'grid').map((f) => f.id)).toEqual(['revenue', 'fundraising_this_year']);
    expect(INTAKE_STEPS.map((s) => s.id)).toEqual([
      'company', 'team', 'business', 'product', 'financials', 'balance', 'funding', 'comparables', 'advisor_overrides',
    ]);
  });

  it.runIf(pack)("INTAKE_REQUIRED_COUNT equals the design pack's own summarize() count", () => {
    const summarize = (pack as unknown as { summarize: (mode: string) => { total: { req: number } } }).summarize;
    expect(summarize('new').total.req).toBe(INTAKE_REQUIRED_COUNT);
    expect(summarize('complete').total.req).toBe(INTAKE_REQUIRED_COUNT);
  });

  it('grid fields are not passed through to the questionnaire', () => {
    const m = mapIntakeToEngine(
      { company_name: 'X', country: 'United States', industry: 'SaaS', stage_of_development: 'startup', revenue: ['1', '2'], fundraising_this_year: ['0'] } as IntakeAnswers,
      [{ revenue: '1' }], {}, { asOf: '2026-10-24', currency: 'USD' }
    );
    expect('revenue' in m.questionnaire).toBe(false);
    expect('fundraising_this_year' in m.questionnaire).toBe(false);
  });

  it.runIf(pack)('every design pack field is defined with the same step, type, required flag and options', () => {
    const ours = new Map(INTAKE_FIELDS.map((f) => [f.id, f]));
    let count = 0;
    for (const step of pack!.steps) {
      for (const f of step.fields ?? []) {
        count += 1;
        const o = ours.get(f.id);
        expect(o, f.id).toBeDefined();
        expect({ id: f.id, step: o!.step, type: o!.type, required: o!.required }).toEqual({
          id: f.id, step: step.id, type: f.type, required: !!f.req,
        });
        if (o!.optionsFrom) continue; // the pack lists one MediSync-specific option here
        expect({ id: f.id, options: o!.options }).toEqual({ id: f.id, options: f.opts });
        expect({ id: f.id, anchors: o!.anchors, columns: o!.columns, when: o!.when }).toEqual({
          id: f.id, anchors: f.anch, columns: f.cols, when: f.when,
        });
        expect({ id: f.id, source: o!.source, confirm: o!.confirm, locked: o!.locked }).toEqual({
          id: f.id, source: f.src, confirm: f.confirm, locked: f.locked,
        });
      }
    }
    // Founder-visible fields only; steps 8 and 9 are not in the pack.
    expect(count).toBe(57);
  });

  it.runIf(pack)('the financials grid rows match the design pack', () => {
    const packGrid = pack!.steps.find((s) => s.grid);
    const ours = INTAKE_STEPS.find((s) => s.id === 'financials')!.grid!;
    expect(ours.columns).toBe(packGrid.cols.length);
    expect(ours.rows.map((r) => [r.id, r.required])).toEqual(packGrid.rows.map((r: any) => [r.id, !!r.req]));
  });

  it.runIf(pack)("maps the design pack's own complete MediSync intake without dropping a mapped key", () => {
    const answers: Record<string, unknown> = {};
    for (const step of pack!.steps) {
      for (const f of step.fields ?? []) answers[f.id] = pack!.fieldState(step, f, 'complete').value;
    }
    const grid = pack!.steps.find((s) => s.grid);
    const financials = grid.cols.map((_: string, i: number) =>
      Object.fromEntries(grid.rows.map((r: any) => [r.id, (r.pre && r.pre[i]) ?? (r.ans && r.ans[i]) ?? null]))
    );
    const m = mapIntakeToEngine(answers as IntakeAnswers, financials, answers as any, { asOf: '2026-11-15', currency: 'USD' });
    expect(m.company).toMatchObject({ name: 'MediSync', country: 'United States', stage: 'startup', founders_count: 3, employees_count: 9, business_model: 'B2B', founders_committed_capital: 180000, incorporated_year: 2023, scalable: true });
    expect(m.financials[0]).toMatchObject({ yearOffset: -1, isActual: true, revenue: 310000 });
    expect(m.financials[1]).toMatchObject({ yearOffset: 1, revenue: 620000, fundraisingPlan: 3000000 });
    expect(m.questionnaire).toMatchObject({
      team_size: 12, team_has_cto: true, team_has_business_lead: true, team_prior_exits: false,
      business_model_type: 'B2B', has_competitive_advantage: true, has_strategic_investors: true,
      tam_size: 12_400_000_000, market_growth_rate: 0.14, product_status: 'beta', ip_protection_stage: 'pending',
      sustainably_breakeven: false, has_customers: true, product_market_fit: false, capital_needed: 3_000_000,
      competitors_count: 2, partnerships_count: 0, has_ip: true, has_patents: false,
    });
    expect(m.balanceSheet).toEqual({ cash_and_equivalents: 410000, non_operating_cash: 0 });
  });
});
