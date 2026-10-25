import { describe, it, expect, beforeAll } from 'vitest';
import { evaluateChecks, hasBlockingChecks, referenceDataAge, type CheckResult } from '../checks/evaluateChecks';
import { hasStrongAnswers, QUALITATIVE_FLOOR_DELTA } from '../checks/qualitative';
import { requiredStatus } from '../checks/required';
import { runPipeline } from '../angel/pipeline';
import { INTAKE_REQUIRED_COUNT, type IntakeAnswers } from '../intake/fields';
import type { ValuationReportOutput } from '../types';
import type { ValuationContext } from '../angel/context';
import { readyNorthwind } from './fixtures/contexts';
import { northwindContext, NORTHWIND_GRID } from './fixtures/northwindIntake';
import { FX_RATES, FX_STALE_DAYS } from '../fx';

let report: ValuationReportOutput;
beforeAll(async () => {
  report = (await runPipeline(readyNorthwind())).report;
});

const check = (ctx: ValuationContext, id: string, r: ValuationReportOutput = report): CheckResult =>
  evaluateChecks(ctx, r).find((c) => c.id === id)!;
const withAnswers = (changes: Record<string, unknown>, base = readyNorthwind()): ValuationContext => ({
  ...base,
  answers: { ...base.answers, ...changes } as IntakeAnswers,
});

describe('evaluateChecks', () => {
  it('a ready Northwind passes every blocking check', () => {
    const checks = evaluateChecks(readyNorthwind(), report);
    expect(checks.filter((c) => c.severity === 'blocking' && c.passed !== true)).toEqual([]);
    expect(hasBlockingChecks(checks)).toBe(false);
  });

  describe('required_missing', () => {
    it('passes when every required answer is given', () => {
      expect(check(readyNorthwind(), 'required_missing').passed).toBe(true);
    });
    it('fails, and routes to the first missing field, when answers are missing', () => {
      const c = check(northwindContext(), 'required_missing');
      expect(c.passed).toBe(false);
      expect(c.title).toBe('Answer the 9 required questions left');
      expect(c.fieldRoute).toEqual({ kind: 'intake', step: 'company', fieldId: 'valuation_as_of_date' });
    });
    it('counts a blank required grid cell', () => {
      const grid = NORTHWIND_GRID.map((r, i) => (i === 3 ? { ...r, debt_outstanding_year_end: '' } : r));
      const s = requiredStatus({ ...readyNorthwind(), financials: grid });
      expect(s.missing).toEqual([{ step: 'financials', fieldId: 'debt_outstanding_year_end', column: 3 }]);
    });
    it('counts 63 required answers when the conditional advisor count is shown', () => {
      const s = requiredStatus(withAnswers({ board_of_advisors: 'Informal advisors', advisor_count: 2 }));
      expect(s.required).toBe(INTAKE_REQUIRED_COUNT);
      expect(s.missing).toEqual([]);
    });
  });

  describe('stage_mismatch', () => {
    it('passes when the run\'s stage is confirmed', () => {
      expect(check(readyNorthwind(), 'stage_mismatch').passed).toBe(true);
    });
    it('fails when the stage is not confirmed', () => {
      expect(check({ ...readyNorthwind(), confirmed: { stageConfirmed: null, industryConfirmed: null } }, 'stage_mismatch').passed).toBe(false);
    });
    it('fails when the confirmed stage is not the one the run uses, and names the suggestion', () => {
      const ctx = { ...readyNorthwind(), confirmed: { stageConfirmed: 'growth' as const, industryConfirmed: null }, facts: { listingStage: 'seed' as const } };
      const c = check(ctx, 'stage_mismatch');
      expect(c.passed).toBe(false);
      // Seed with revenue suggests startup; the run is at expansion.
      expect(c.why).toBe('Your listing suggests the startup stage, and the stage sets how much each method counts.');
    });
  });

  describe('balance_sheet_unbalanced', () => {
    it('passes when assets equal liabilities plus equity', () => {
      expect(check(readyNorthwind(), 'balance_sheet_unbalanced').passed).toBe(true);
    });
    it('fails on the Northwind fixture as stored (695,000 against 830,000)', () => {
      expect(check(northwindContext(), 'balance_sheet_unbalanced').passed).toBe(false);
    });
    it('passes within 1% and fails just beyond it', () => {
      const at = (equity: number) => check({ ...readyNorthwind(), balance: { ...readyNorthwind().balance, equity } }, 'balance_sheet_unbalanced').passed;
      expect(at(280000 + 6950)).toBe(true); // exactly 1% of 695,000
      expect(at(280000 + 7100)).toBe(false);
    });
    it('passes when no optional row is entered', () => {
      const ctx = { ...readyNorthwind(), balance: { cash_and_equivalents: 420000, non_operating_cash: 0 } };
      expect(check(ctx, 'balance_sheet_unbalanced').passed).toBe(true);
    });
  });

  describe('negative_cash', () => {
    it('passes when every year ends with cash at or above zero', () => {
      expect(check(readyNorthwind(), 'negative_cash').passed).toBe(true);
    });
    it('fails when a forecast year runs out of cash after the planned raise', () => {
      const grid = NORTHWIND_GRID.map((r, i) => (i === 1 ? { ...r, salaries: (r.salaries as number) + 5_000_000 } : r));
      expect(check({ ...readyNorthwind(), financials: grid }, 'negative_cash').passed).toBe(false);
    });
    it('is not evaluated without base-year cash', () => {
      const c = check({ ...readyNorthwind(), balance: { non_operating_cash: 0 } }, 'negative_cash');
      expect(c.passed).toBeNull();
      expect(c.notEvaluatedReason).toBeDefined();
    });
  });

  describe('use_of_funds_missing', () => {
    it('passes when use of funds totals the raise', () => {
      expect(check(readyNorthwind(), 'use_of_funds_missing').passed).toBe(true);
    });
    it('fails when it is empty', () => {
      expect(check(withAnswers({ use_of_funds: [] }), 'use_of_funds_missing').passed).toBe(false);
    });
    it('fails when it does not total the raise', () => {
      expect(check(withAnswers({ use_of_funds: ['1000000', '0', '0', '0', '0'] }), 'use_of_funds_missing').passed).toBe(false);
    });
    it('passes when no raise is planned', () => {
      expect(check(withAnswers({ capital_needed_current_round: 0, use_of_funds: [] }), 'use_of_funds_missing').passed).toBe(true);
    });
  });

  describe('ownership_not_100', () => {
    it('passes at 100%', () => {
      expect(check(readyNorthwind(), 'ownership_not_100').passed).toBe(true);
    });
    it('fails at 90%', () => {
      expect(check(withAnswers({ current_ownership: [['Founders', '70'], ['Angels', '20']] }), 'ownership_not_100').passed).toBe(false);
    });
    it('passes when ownership is not entered (required_missing covers it)', () => {
      expect(check(withAnswers({ current_ownership: [] }), 'ownership_not_100').passed).toBe(true);
    });
  });

  describe('no_financial_model', () => {
    it('passes with a model', () => {
      expect(check(readyNorthwind(), 'no_financial_model').passed).toBe(true);
    });
    it('fails with no model and a founder-sourced forecast, with the copy the spec fixes', () => {
      const c = check({ ...readyNorthwind(), facts: {} }, 'no_financial_model');
      expect(c.passed).toBe(false);
      expect([c.title, c.why, c.fixLabel]).toEqual([
        'No financial model supports your forecast', 'Investors will ask for the model behind these figures.', 'Add to data room',
      ]);
    });
    it('passes with no model flag when the forecast came from a confirmed model parse', () => {
      const sources = Object.fromEntries([1, 2, 3, 4, 5].map((c) => [`grid.revenue.${c}`, 'dataroom' as const]));
      expect(check({ ...readyNorthwind(), facts: {}, sources }, 'no_financial_model').passed).toBe(true);
    });
  });

  it('forecast_outlier and growth_below_peers are not evaluated: no sourced growth quartiles exist', () => {
    for (const id of ['forecast_outlier', 'growth_below_peers']) {
      const c = check(readyNorthwind(), id);
      expect(c.passed).toBeNull();
      expect(c.notEvaluatedReason).toMatch(/REVENUE_GROWTH_QUARTILES/);
    }
  });

  describe('qualitative_conflict', () => {
    it('defines strong answers: every given 1-5 answer is 4 or 5, and at least half are given', () => {
      expect(hasStrongAnswers('team', { core_technical_skills_in_house: 5, core_team_managerial_background: 4 } as IntakeAnswers)).toBe(true);
      expect(hasStrongAnswers('team', { core_technical_skills_in_house: 5, core_team_managerial_background: 3 } as IntakeAnswers)).toBe(false);
      expect(hasStrongAnswers('team', { core_technical_skills_in_house: 5 } as IntakeAnswers)).toBe(false); // 1 of 3 given
      expect(hasStrongAnswers('partnerships', { strategic_partner_relationship_strength: '4' } as IntakeAnswers)).toBe(true);
      expect(hasStrongAnswers('opportunity', {} as IntakeAnswers)).toBe(false); // no 1-5 answers listed
    });
    it('passes when strong answers lift the criterion', () => {
      expect(check(readyNorthwind(), 'qualitative_conflict').passed).toBe(true);
    });
    it('fails when a criterion sits near the bottom although its answers are strong', () => {
      const low = {
        ...report,
        methodResults: {
          ...report.methodResults,
          scorecard: {
            ...report.methodResults.scorecard,
            criteria: report.methodResults.scorecard.criteria.map((c) => (c.key === 'team' ? { ...c, score: QUALITATIVE_FLOOR_DELTA } : c)),
          },
        },
      } as ValuationReportOutput;
      const c = check(readyNorthwind(), 'qualitative_conflict', low);
      expect(c.passed).toBe(false);
      expect(c.fieldRoute).toEqual({ kind: 'intake', step: 'team', fieldId: 'core_technical_skills_in_house' });
    });
  });

  describe('unverified_revenue', () => {
    it('fails when base-year revenue is founder-sourced (the default)', () => {
      expect(check(readyNorthwind(), 'unverified_revenue').passed).toBe(false);
    });
    it('passes when it is verified', () => {
      expect(check({ ...readyNorthwind(), sources: { 'grid.revenue.0': 'verified' } }, 'unverified_revenue').passed).toBe(true);
    });
  });

  describe('parameter_stale', () => {
    // Since 1.2.0 the check judges only the datasets the run used. Northwind is at
    // expansion, where Scorecard and Checklist carry 6% each, so its benchmark counts.
    const runIn = async (country: string, currency: string, asOf = '2026-10-24') => {
      const ctx = withAnswers({ country }, { ...readyNorthwind(), opts: { asOf, currency } });
      return { ctx, report: (await runPipeline(ctx)).report };
    };

    it('a US run names PitchBook-NVCA (30 September 2025) and fails', async () => {
      const { ctx, report: r } = await runIn('United States', 'USD');
      expect(referenceDataAge(ctx.opts.asOf, r).named).toMatchObject({ key: 'benchmark', name: 'PitchBook-NVCA Venture Monitor', asOf: '2025-09-30', stale: true });
      const c = check(ctx, 'parameter_stale', r);
      expect(c.passed).toBe(false);
      expect(c.why).toBe('The oldest dataset used here, the PitchBook-NVCA Venture Monitor, dates from 30 September 2025.');
    });

    it('a UK run names the British Business Bank figure, not the US one, and passes', async () => {
      const { ctx, report: r } = await runIn('United Kingdom', 'GBP');
      const c = check(ctx, 'parameter_stale', r);
      expect(c.passed).toBe(true);
      expect(c.why).toBe('The oldest dataset used here, the British Business Bank Small Business Equity Tracker, dates from 31 December 2025.');
      expect(referenceDataAge(ctx.opts.asOf, r).datasets.map((d) => d.key)).not.toContain('pitchbookNvca');
    });

    it('a German run passes and names the oldest dataset it used', async () => {
      const { ctx, report: r } = await runIn('Germany', 'EUR');
      const c = check(ctx, 'parameter_stale', r);
      expect(c.passed).toBe(true);
      expect(c.why).toBe('The oldest dataset used here, the Damodaran country risk premiums, dates from January 2026.');
    });

    it('a converted run includes the FX table, judged on FX_STALE_DAYS', async () => {
      const saved = FX_RATES.asOf;
      try {
        const fresh = await runIn('United Kingdom', 'USD');
        const fx = referenceDataAge(fresh.ctx.opts.asOf, fresh.report).datasets.find((d) => d.key === 'fxRates')!;
        expect(fx).toMatchObject({ asOf: saved, rule: 'fx_days', stale: false });

        // An FX table more than 180 days before the run, everything else in date.
        (FX_RATES as { asOf: string }).asOf = '2026-04-26';
        const old = await runIn('United Kingdom', 'USD');
        const c = check(old.ctx, 'parameter_stale', old.report);
        expect(c.passed).toBe(false);
        expect(c.title).toBe(`The exchange rates used here are over ${FX_STALE_DAYS} days old`);
        expect(c.why).toBe('The exchange rates used here, the ECB euro reference exchange rates, date from 26 April 2026.');
      } finally {
        (FX_RATES as { asOf: string }).asOf = saved;
      }
    });

    it('passes up to exactly 12 months, fails the day after (UK: BBB, 31 December 2025)', async () => {
      const onTheDay = await runIn('United Kingdom', 'GBP', '2026-12-31');
      expect(check(onTheDay.ctx, 'parameter_stale', onTheDay.report).passed).toBe(true);
      const after = await runIn('United Kingdom', 'GBP', '2027-01-01');
      expect(check(after.ctx, 'parameter_stale', after.report).passed).toBe(false);
    });

    it('without a report it still scans every dated dataset, as 1.1.0 did', () => {
      expect(referenceDataAge('2026-10-24')).toMatchObject({ oldestDataset: 'pitchbookNvca', oldestDate: '2025-09-30', stale: true });
    });

    it('ignores datasets with no date, and lists them', () => {
      expect(referenceDataAge('2026-10-24').undated).toEqual(['survivalCurves']);
    });
  });

  it('multiple_kind_fallback never fires: the VC method has no revenue-multiple fallback', () => {
    expect(check(readyNorthwind(), 'multiple_kind_fallback').passed).toBe(true);
  });

  describe('override_present', () => {
    it('passes with no overrides', () => {
      expect(check(readyNorthwind(), 'override_present').passed).toBe(true);
    });
    it('fails, listing each override with its source', () => {
      const ctx = { ...readyNorthwind(), overrides: [{ parameter: 'dcf_shared.discount_rate', value: 0.3, source: 'advisor' as const, reason: 'Stage risk' }] };
      const c = check(ctx, 'override_present');
      expect(c.passed).toBe(false);
      expect(c.why).toBe('Overridden: dcf_shared.discount_rate (advisor).');
    });
  });

  describe('region_illustrative', () => {
    it('passes for the UK', () => {
      expect(check(readyNorthwind(), 'region_illustrative').passed).toBe(true);
    });
    it('fails for the UAE', () => {
      expect(check(withAnswers({ country: 'United Arab Emirates' }), 'region_illustrative').passed).toBe(false);
    });
  });

  describe('ask_outside_range', () => {
    const ask = (major: number | null) => check({ ...readyNorthwind(), facts: { ...readyNorthwind().facts, askPreMoney: major === null ? null : major * 100 } }, 'ask_outside_range');
    it('passes with no ask, or an ask inside the tolerance', () => {
      expect(ask(null).passed).toBe(true);
      expect(ask(report.highBound * 1.2).passed).toBe(true);
      expect(ask(report.lowBound * 0.8).passed).toBe(true);
    });
    it('fails more than 20% above the high bound, or 20% below the low bound', () => {
      expect(ask(report.highBound * 1.21).why).toMatch(/above the top/);
      expect(ask(report.highBound * 1.21).passed).toBe(false);
      expect(ask(report.lowBound * 0.79).passed).toBe(false);
      expect(ask(report.lowBound * 0.79).why).toMatch(/below the bottom/);
    });
  });

  it('carries validateWizardData issues through as blocking checks', () => {
    const c = evaluateChecks(withAnswers({ company_name: '' }), report).find((x) => x.id.startsWith('engine_validation.'));
    expect(c).toMatchObject({ severity: 'blocking', passed: false });
  });

  it('copy: one plain sentence each, no em dash, no exclamation mark, no banned words', () => {
    const contexts = [readyNorthwind(), northwindContext(), withAnswers({ country: 'United Arab Emirates', use_of_funds: [] })];
    for (const ctx of contexts) {
      for (const c of evaluateChecks(ctx, report)) {
        for (const text of [c.title, c.why]) {
          expect(text, c.id).not.toMatch(/[—!]/);
          expect(text, c.id).not.toMatch(/\b(advice|guaranteed|skyrocket)\b/i);
        }
        expect(c.title.endsWith('.'), c.id).toBe(false);
      }
    }
  });
});
