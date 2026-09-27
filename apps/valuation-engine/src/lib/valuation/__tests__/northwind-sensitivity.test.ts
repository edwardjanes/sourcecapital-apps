import { describe, it, expect } from 'vitest';
import { computeValuation } from '../compute';
import { buildDefaultParameters } from '../defaults';
import {
  NORTHWIND_COMPANY,
  NORTHWIND_FINANCIALS,
  NORTHWIND_BALANCE_SHEET,
  NORTHWIND_QUESTIONNAIRE,
  NORTHWIND_BASELINE,
} from './fixtures/northwind';

/**
 * Sensitivity report for the model pass. Prints a table; asserts only the
 * directional claims that the write-up depends on.
 *
 * Purpose: three of the four model-pass findings are decisions, not bugs, and
 * each needs a size before it can be decided. This measures each one in
 * isolation against the locked Northwind baseline (snapshot 6cdd8d1d) so the
 * argument is about numbers rather than about which change feels bigger.
 *
 * It changes nothing in the engine. Every scenario is produced by overriding the
 * parameters or inputs handed to computeValuation, exactly as the compute route
 * would if the underlying data were different.
 *
 * Run it on its own to read the table:
 *   npx vitest run src/lib/valuation/__tests__/northwind-sensitivity.test.ts
 */

type Params = ReturnType<typeof buildDefaultParameters>;

async function run(opts: {
  questionnaire?: Record<string, unknown>;
  financials?: typeof NORTHWIND_FINANCIALS;
  tweak?: (p: Params) => Params;
} = {}) {
  const financials = opts.financials ?? NORTHWIND_FINANCIALS;
  const defaults = buildDefaultParameters(
    NORTHWIND_COMPANY as never,
    financials as never,
    NORTHWIND_BALANCE_SHEET as never
  );
  const base = { ...defaults, method_weights: defaults.method_weights, comparables: [] } as Params;
  const parameters = opts.tweak ? opts.tweak(base) : base;

  const lastActual = financials.find((f) => f.yearOffset === -1);
  const q = { ...NORTHWIND_QUESTIONNAIRE, ...(opts.questionnaire || {}) };
  const enriched = {
    ...q,
    capital_needed: q.capital_needed,
    last_year_revenue: q.last_year_revenue ?? lastActual?.revenue,
  };

  const r = await computeValuation(
    NORTHWIND_COMPANY as never,
    financials as never,
    enriched as never,
    parameters as never
  );
  const by = (k: string) =>
    Math.round(r.perMethod.find((m: { method: string }) => m.method === k)?.valuation ?? 0);
  return {
    weighted: Math.round(r.weightedValuation),
    scorecard: by('scorecard'),
    checklist: by('checklist'),
    vc: by('vc'),
    dcfLtg: by('dcf_ltg'),
    dcfMultiple: by('dcf_multiple'),
    multiples: by('multiples'),
  };
}

const gbp = (n: number) => n.toLocaleString('en-GB');
const pct = (a: number, b: number) => `${b === 0 ? '—' : (((a / b) - 1) * 100).toFixed(1)}%`;

describe('Northwind sensitivity — sizing the model-pass decisions', () => {
  it('measures each finding in isolation', async () => {
    const baseline = await run();

    // --- z8mad3qurk: sector multiples at researched market levels -----------
    // INDUSTRIES.SaaS holds revenueMultiple 1.04 / ebitdaMultiple 6.77, which
    // defaults.ts feeds to dcf_multiple.exit_multiple and
    // vc_method.industry_multiple. Two scenarios, because the right figure for a
    // private sub-£1m-revenue company is not the public median:
    //   public  — public SaaS medians: 3.2x revenue, 12.7x EBITDA
    //   private — private sub-$1m-ARR range midpoint: 3.5x revenue, 22.4x EBITDA
    const multiplesPublic = await run({
      tweak: (p) => ({
        ...p,
        dcf_multiple: { ...p.dcf_multiple, exit_multiple: 3.2 },
        vc_method: { ...p.vc_method, industry_multiple: 12.7 },
      }),
    });
    const multiplesPrivate = await run({
      tweak: (p) => ({
        ...p,
        dcf_multiple: { ...p.dcf_multiple, exit_multiple: 3.5 },
        vc_method: { ...p.vc_method, industry_multiple: 22.4 },
      }),
    });

    // --- z8mad3qup6: the seven engine inputs the portal never supplies ------
    // Answered from what the founder already told the wizard, which is the point
    // of the ticket: the data exists and is dropped.
    //   competitors_count      <- competition_level 3 of 5, a mid market
    //   partnerships_count     <- strategic_partner_relationship_strength 3
    //   has_ip / has_patents   <- ip_protection_status "Applications filed"
    //   recurring_revenue      <- B2B SaaS with customers
    //   legal_risks            <- nothing suggests any
    const withSevenInputs = await run({
      questionnaire: {
        competitors_count: 8,
        partnerships_count: 3,
        has_ip: true,
        has_patents: true,
        recurring_revenue: true,
        legal_risks: false,
      },
    });

    // --- z8mad3quq9: blank cells sent as zero ------------------------------
    // Northwind's only blank cell is inventory, whose benchmark is also 0% of
    // revenue for SaaS — so this fixture CANNOT show the defect. To size the
    // risk, blank COGS instead, which is what a founder skipping a cost line
    // actually does: 78% gross margin becomes 100%.
    const blankCogs = await run({
      financials: NORTHWIND_FINANCIALS.map((f) => ({ ...f, cogs: 0 })),
    });

    const rows: Array<[string, Awaited<ReturnType<typeof run>>]> = [
      ['baseline (as shipped)', baseline],
      ['multiples @ public (3.2x / 12.7x)', multiplesPublic],
      ['multiples @ private (3.5x / 22.4x)', multiplesPrivate],
      ['+ seven questionnaire inputs', withSevenInputs],
      ['blank COGS (risk of z8mad3quq9)', blankCogs],
    ];

    const pad = (s: string, n: number) => s.padEnd(n);
    const num = (n: number, w = 11) => gbp(n).padStart(w);
    console.log('');
    console.log(
      pad('scenario', 36) + num('weighted'.length ? 0 : 0, 0) +
        ['weighted', 'vs base', 'vc', 'dcf_mult', 'dcf_ltg', 'scorecard', 'checklist']
          .map((h) => h.padStart(12))
          .join('')
    );
    console.log('-'.repeat(36 + 12 * 7));
    for (const [label, r] of rows) {
      console.log(
        pad(label, 36) +
          num(r.weighted, 12) +
          pct(r.weighted, baseline.weighted).padStart(12) +
          num(r.vc, 12) +
          num(r.dcfMultiple, 12) +
          num(r.dcfLtg, 12) +
          num(r.scorecard, 12) +
          num(r.checklist, 12)
      );
    }
    console.log('');

    // --- the claims the write-up rests on ---------------------------------
    // Baseline still matches the locked snapshot.
    expect(baseline.weighted).toBe(Math.round(NORTHWIND_BASELINE.weightedValuation));

    // Raising the sector multiples raises exactly the two methods that use them
    // and leaves the other three untouched. That is the evidence that these two
    // figures, not the cash flows, are holding those methods down.
    expect(multiplesPublic.vc).toBeGreaterThan(baseline.vc);
    expect(multiplesPublic.dcfMultiple).toBeGreaterThan(baseline.dcfMultiple);
    expect(multiplesPublic.dcfLtg).toBe(baseline.dcfLtg);
    expect(multiplesPublic.scorecard).toBe(baseline.scorecard);
    expect(multiplesPublic.checklist).toBe(baseline.checklist);

    // Private-level multiples move it further than public-level, as they must.
    expect(multiplesPrivate.weighted).toBeGreaterThan(multiplesPublic.weighted);

    // The seven inputs touch only the qualitative methods, which is where
    // scoring.ts reads them.
    expect(withSevenInputs.dcfLtg).toBe(baseline.dcfLtg);
    expect(withSevenInputs.vc).toBe(baseline.vc);

    // Blanking a cost line RAISES the valuation. That is the whole danger of
    // z8mad3quq9: the failure mode flatters the company.
    expect(blankCogs.weighted).toBeGreaterThan(baseline.weighted);
  });
});
