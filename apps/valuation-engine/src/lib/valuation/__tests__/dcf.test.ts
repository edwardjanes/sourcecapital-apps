import { expect, it, describe } from "vitest";
import { computeDcfShared } from "../dcf";
import { FcfeYear } from "../types";

// computeDcfShared only reads yearOffset and fcfe; the other FcfeYear fields are zero-filled so the
// fixtures satisfy the type without implying any particular P&L breakdown
const fy = (yearOffset: number, fcfe: number): FcfeYear => ({
  yearOffset,
  fcfe,
  ebitda: 0,
  ebit: 0,
  ebt: 0,
  netIncome: 0,
  da: 0,
  deltaWc: 0,
  deltaDebt: 0,
});

describe("DCF Shared Framework", () => {
  const baselineYears: FcfeYear[] = [fy(1, 100000), fy(2, 150000), fy(3, 200000)];

  const defaultSurvivalRates = [0.8869, 0.7945, 0.7164, 0.6487, 0.5891, 0.5357];

  it("computes valuation with positive cash flows", () => {
    const result = computeDcfShared(
      baselineYears,
      1000000, // terminal value
      0.15, // discount rate
      0.25 // illiquidity discount
    );

    expect(result.valuation).toBeGreaterThan(0);
    expect(result.discountedFcfSum).toBeGreaterThan(0);
    expect(result.discountedTerminalValue).toBeGreaterThan(0);
    expect(Number.isFinite(result.valuation)).toBe(true);
  });

  it("applies survival rates to forecast cash flows", () => {
    const result = computeDcfShared(
      baselineYears,
      1000000,
      0.1,
      0.0, // No illiquidity discount for this test
      0,
      defaultSurvivalRates
    );

    // With survival rates and discount, the sum should be significantly less than raw cash flows
    const rawSum = baselineYears.reduce((sum, y) => sum + y.fcfe, 0);
    expect(result.discountedFcfSum).toBeLessThan(rawSum);
  });

  it("handles negative cash flows (J-curve growth)", () => {
    const negativeYears: FcfeYear[] = [
      fy(1, -100000), // Investment year
      fy(2, 50000),
      fy(3, 300000), // Strong recovery
    ];

    const result = computeDcfShared(
      negativeYears,
      2000000,
      0.15,
      0.25
    );

    expect(result.valuation).toBeGreaterThan(0);
    expect(Number.isFinite(result.valuation)).toBe(true);
  });

  it("clamps valuation to zero when all flows are negative", () => {
    const negativeYears: FcfeYear[] = [fy(1, -100000), fy(2, -50000)];

    const result = computeDcfShared(
      negativeYears,
      100000, // Small terminal value
      0.2, // High discount rate
      0.5 // High illiquidity discount
    );

    expect(result.valuation).toBeGreaterThanOrEqual(0);
  });

  it("applies illiquidity discount correctly", () => {
    const terminalValue = 1000000;
    const discountRate = 0.1;

    const resultNoDiscount = computeDcfShared(
      baselineYears,
      terminalValue,
      discountRate,
      0.0
    );

    const resultWithDiscount = computeDcfShared(
      baselineYears,
      terminalValue,
      discountRate,
      0.25 // 25% illiquidity discount
    );

    expect(resultWithDiscount.valuation).toBeLessThan(resultNoDiscount.valuation);
    expect(resultWithDiscount.valuation).toBeCloseTo(
      resultNoDiscount.valuation * (1 - 0.25),
      2
    );
  });

  it("adds non-operating cash after the illiquidity discount", () => {
    const nonOpCash = 500000;

    const resultWithoutNonOp = computeDcfShared(
      baselineYears,
      1000000,
      0.15,
      0.25,
      0
    );

    const resultWithNonOp = computeDcfShared(
      baselineYears,
      1000000,
      0.15,
      0.25,
      nonOpCash
    );

    // Value = (ΣFCF + TV) × (1 − illiquidity) + NonOperatingCash -- cash on the balance sheet isn't
    // illiquid, so it's added in full rather than discounted with the operating value
    expect(resultWithNonOp.nonOperatingCash).toBe(nonOpCash);
    expect(resultWithNonOp.valuation - resultWithoutNonOp.valuation).toBeCloseTo(nonOpCash, 2);
  });

  it("handles edge case: single year forecast", () => {
    const singleYear: FcfeYear[] = [fy(1, 100000)];

    const result = computeDcfShared(
      singleYear,
      500000,
      0.1,
      0.2
    );

    expect(result.valuation).toBeGreaterThan(0);
    expect(Number.isFinite(result.valuation)).toBe(true);
  });

  it("handles edge case: zero discount rate", () => {
    const result = computeDcfShared(
      baselineYears,
      1000000,
      0.0, // No discounting
      0.25
    );

    // Without discounting, the sum is just the survival-weighted cash flows (default survival rates apply)
    const survivalWeightedSum = baselineYears.reduce(
      (sum, y) => sum + y.fcfe * defaultSurvivalRates[y.yearOffset - 1],
      0
    );
    expect(result.discountedFcfSum).toBeCloseTo(survivalWeightedSum, 2);
    expect(result.discountedTerminalValue).toBe(1000000);
  });

  it("handles edge case: zero terminal value", () => {
    const result = computeDcfShared(
      baselineYears,
      0, // Terminal value is zero
      0.15,
      0.25
    );

    expect(result.terminalValue).toBe(0);
    expect(result.discountedTerminalValue).toBe(0);
    expect(result.valuation).toBeGreaterThan(0); // From forecast cash flows only
  });

  it("handles edge case: very high discount rate", () => {
    const result = computeDcfShared(
      baselineYears,
      5000000,
      2.0, // 200% discount rate (extreme)
      0.25
    );

    // Terminal value is discounted over 3 years at 200%: 5M / 3^3
    expect(result.discountedTerminalValue).toBeCloseTo(5000000 / 27, 2);
    // The same 5M terminal value undiscounted (0% rate) must be worth far more
    const undiscounted = computeDcfShared(baselineYears, 5000000, 0.0, 0.25);
    expect(result.valuation).toBeLessThan(undiscounted.valuation * 0.05);
    expect(result.valuation).toBeCloseTo(
      (result.discountedFcfSum + result.discountedTerminalValue) * (1 - 0.25),
      2
    );
  });

  it("uses survival rates when provided", () => {
    const customSurvivalRates = [0.9, 0.9, 0.9]; // Higher survival rates

    const resultDefault = computeDcfShared(
      baselineYears,
      1000000,
      0.1,
      0.2
    );

    const resultCustom = computeDcfShared(
      baselineYears,
      1000000,
      0.1,
      0.2,
      0,
      customSurvivalRates
    );

    // Higher survival rates should produce higher valuations
    expect(resultCustom.valuation).toBeGreaterThan(resultDefault.valuation);
  });

  it("falls back to last survival rate for years beyond array length", () => {
    const shortSurvivalRates = [0.85, 0.75]; // Only 2 years

    const multiYearForecast: FcfeYear[] = [
      fy(1, 100000),
      fy(2, 100000),
      fy(3, 100000),
      fy(4, 100000),
      fy(5, 100000),
    ];

    const result = computeDcfShared(
      multiYearForecast,
      1000000,
      0.1,
      0.2,
      0,
      shortSurvivalRates
    );

    expect(result.valuation).toBeGreaterThan(0);
    expect(Number.isFinite(result.valuation)).toBe(true);
  });

  it("produces realistic valuation for NovaCloud-like development stage company", () => {
    // Based on NovaCloud Systems scenario
    const forecastYears: FcfeYear[] = [
      fy(1, 250000), // Year 1 FCFE
      fy(2, 800000), // Year 2 FCFE (growth)
      fy(3, 1200000), // Year 3 FCFE
    ];

    const terminalValue = 3000000; // Terminal value estimate
    const discountRate = 0.15; // 15% discount rate
    const illiquidityDiscount = 0.25; // 25% illiquidity discount
    const germanyRates = [0.8869, 0.7945, 0.7164]; // Per-country survival rates

    const result = computeDcfShared(
      forecastYears,
      terminalValue,
      discountRate,
      illiquidityDiscount,
      0,
      germanyRates
    );

    expect(result.valuation).toBeGreaterThan(500000);
    expect(result.valuation).toBeLessThan(5000000); // Reasonable range
  });

  it("computes terminal value discount factor correctly", () => {
    const fcfeYears: FcfeYear[] = [
      fy(1, 100000),
      fy(3, 200000), // Non-sequential offset
    ];

    const result = computeDcfShared(
      fcfeYears,
      1000000,
      0.1,
      0.0
    );

    // Final year offset is 3, so discount factor = (1.1)^3
    const expectedDiscountFactor = Math.pow(1.1, 3);
    expect(result.discountedTerminalValue).toBeCloseTo(
      1000000 / expectedDiscountFactor,
      2
    );
  });
});

// ---------------------------------------------------------------------------
// AUDIT-04. The 15 tests above all exercise computeDcfShared, which receives
// `terminalValue` already computed and has no idea what produced it. The
// Gordon-growth formula -- the riskiest arithmetic in the method -- lives
// inline in compute.ts:72-76 and had no test surface of any kind:
//
//   terminalValueLtg = fcfe_5 x survivalRate x (1 + g) / (discountRate - g)
//
// These tests give it one, through the real pipeline rather than by
// reimplementing it. Spec: "DCF with Long-Term Growth Valuation.md" in
// raise-hq-portal's claude/valuation methods/.
// ---------------------------------------------------------------------------

describe("DCF-LTG — the Gordon-growth spread", () => {
  const run = async (country: string, industry: string) => {
    const { computeValuation } = await import("../compute");
    const { buildDefaultParameters } = await import("../defaults");
    const f = await import("./fixtures/northwind");
    const company = { ...f.NORTHWIND_COMPANY, country, industry };
    const defaults = buildDefaultParameters(
      company as never, f.NORTHWIND_FINANCIALS as never, f.NORTHWIND_BALANCE_SHEET as never
    );
    const parameters = { ...defaults, comparables: [] };
    const r = await computeValuation(
      company as never, f.NORTHWIND_FINANCIALS as never,
      { ...f.NORTHWIND_QUESTIONNAIRE } as never, parameters as never
    );
    return {
      discountRate: parameters.dcf_shared.discount_rate,
      g: parameters.dcf_ltg.terminal_growth_rate,
      ltg: Math.round(r.perMethod.find((m: { method: string }) => m.method === "dcf_ltg")?.valuation ?? 0),
      weighted: Math.round(r.weightedValuation),
      floored: r.ltgTerminalValue?.floored,
      impliedMultiple: r.ltgTerminalValue?.impliedMultiple ?? 0,
    };
  };

  it("protected a bare-CAPM rate that fell below g, on the beta that caused it", async () => {
    // WAS THE BUG. Swiss Cleantech resolved to r = 2.346% against a requested g of
    // 2.5%: the denominator went negative, the terminal value with it, and
    // Math.max(0, ...) handed back a clean zero at 36% of the weight.
    //
    // Asserted on the HISTORICAL beta of 0.46, because the beta re-sourcing of
    // 28 Sep 2026 removed that input: Cleantech is now 0.86 and bare CAPM gives
    // 4.038%. That is the point of the next test -- two independent data defects
    // were feeding one symptom.
    const { computeLtgTerminalValue } = await import("../dcf");
    const { COUNTRIES } = await import("../referenceData");
    const HISTORICAL_CLEANTECH_BETA = 0.46;
    const bare = COUNTRIES.CH.riskFree10Y + HISTORICAL_CLEANTECH_BETA * COUNTRIES.CH.equityRiskPremium;
    expect(bare).toBeCloseTo(0.023458, 6);
    expect(bare).toBeLessThan(0.025);

    const t = computeLtgTerminalValue(1_289_000, 0.384, bare, 0.025);
    expect(t.floored).toBe(true);
    expect(t.terminalValue).toBeGreaterThan(0);
    expect(t.growthRateUsed).toBeGreaterThan(0);
  });

  it("would no longer need the guardrail on bare CAPM alone, but only just", async () => {
    // The beta re-sourcing alone removed the CATASTROPHIC half of the original
    // defect: across all 442 combinations, ZERO now fall below g under bare CAPM,
    // where two did. It did NOT remove the absurd half -- the narrowest bare
    // spread is still 1.20% (CH/EdTech), which is a ~84x terminal multiple.
    //
    // So the two fixes are not redundant. The size premium is what takes the
    // narrowest spread to 5.90%; the betas are what stop it going negative.
    const { COUNTRIES, INDUSTRIES, resolveSizePremium } = await import("../referenceData");
    const g = 0.025;
    const bareSpreads = Object.values(COUNTRIES).flatMap((c) =>
      Object.values(INDUSTRIES).map((i) => c.riskFree10Y + i.beta * c.equityRiskPremium - g)
    );
    expect(bareSpreads.length).toBe(442);
    expect(bareSpreads.filter((x) => x <= 0).length).toBe(0);
    expect(Math.min(...bareSpreads)).toBeCloseTo(0.0120, 4);

    // With the premium on top.
    const premium = resolveSizePremium(900_000).premium;
    expect(Math.min(...bareSpreads) + premium).toBeCloseTo(0.0590, 4);
  });

  it("no longer needs to fire for any real company, which is the premium's job", async () => {
    // With the size premium the same Swiss Cleantech company resolves to 7.05%,
    // a 4.55% spread, and the guardrail does not bind. Across all 442 country x
    // industry combinations at a sub-5m revenue band, ZERO now floor -- asserted
    // in full below. MIN_LTG_SPREAD is defence in depth; the cause is fixed.
    const ch = await run("Switzerland", "Cleantech");
    expect(ch.discountRate).toBeCloseTo(0.087378, 6);
    expect(ch.floored).toBe(false);
    expect(ch.ltg).toBeGreaterThan(0);
    // And no longer 126m either, at the other end.
    const pt = await run("Switzerland", "PropTech");
    expect(pt.floored).toBe(false);
    expect(pt.ltg).toBeLessThan(10_000_000);
  });

  it("no combination floors once the size premium is applied", async () => {
    const { computeLtgTerminalValue, MIN_LTG_SPREAD } = await import("../dcf");
    const { COUNTRIES, INDUSTRIES, LTG_GROWTH_RATE_DEFAULT, resolveSizePremium } =
      await import("../referenceData");
    const premium = resolveSizePremium(900_000).premium; // Northwind's band
    const all = Object.entries(COUNTRIES).flatMap(([, c]) =>
      Object.entries(INDUSTRIES).map(([, i]) =>
        computeLtgTerminalValue(
          1_289_000, 0.384,
          c.riskFree10Y + i.beta * c.equityRiskPremium + premium,
          LTG_GROWTH_RATE_DEFAULT
        )
      )
    );
    expect(all.length).toBe(442);
    expect(all.filter((t) => t.floored).length).toBe(0);
    // Narrowest spread is CH/Cleantech at 4.55%, comfortably over the 3pp floor.
    expect(Math.min(...all.map((t) => t.spreadUsed))).toBeGreaterThan(MIN_LTG_SPREAD);
    expect(Math.min(...all.map((t) => t.spreadUsed))).toBeCloseTo(0.058994, 5);
  });

  it("carries the UK SaaS baseline, so the above is not a harness artefact", async () => {
    const gb = await run("United Kingdom", "SaaS");
    expect(gb.discountRate).toBeCloseTo(0.162128, 6);
    expect(gb.g).toBe(0.025);
    expect(gb.weighted).toBe(3_896_345);
  });
});

describe("DCF-LTG — terminal value dominance and the steady state", () => {
  // Northwind's own numbers, decomposed. The baseline valuation of 3,169,409
  // is reproduced from these below, so none of this is a parallel model.
  const R = 0.112623, G = 0.025, ILLIQ = 0.25, NON_OP = 60_000;
  const SURV_GB = [0.91, 0.75, 0.63, 0.50, 0.384, 0.2949];
  // Derived by deriveFcfeByYear from the fixture; asserted against it below.
  const FCFE = [65_000, 44_000, 302_000, 741_000, 1_289_000];

  const pv = () => {
    let sum = 0;
    FCFE.forEach((f, i) => { sum += (f * SURV_GB[i]) / Math.pow(1 + R, i + 1); });
    const tv = FCFE[4] * SURV_GB[4] * (1 + G) / (R - G);
    const dtv = tv / Math.pow(1 + R, 5);
    return { sum, tv, dtv, valuation: (sum + dtv) * (1 - ILLIQ) + NON_OP };
  };

  it("reproduces the locked baseline from first principles", async () => {
    const f = await import("./fixtures/northwind");
    const { deriveFcfeByYear } = await import("../fcf");
    // The hand-written FCFE array above is the engine's own output.
    const derived = deriveFcfeByYear(f.NORTHWIND_FINANCIALS as never)
      .filter((y) => y.yearOffset >= 1).map((y) => y.fcfe);
    expect(derived).toEqual(FCFE);
    expect(Math.round(pv().valuation)).toBe(3_169_409);
  });

  it("is 81.9% terminal value, which the report never says", () => {
    // The spec names this as a limitation in its own right: "Terminal value can
    // represent most of enterprise value, meaning a large portion of the result
    // depends on WACC, g, and one normalized cash-flow estimate."
    const { sum, dtv } = pv();
    expect(dtv / (sum + dtv)).toBeCloseTo(0.819, 3);
    // Five years of explicitly forecast, survival-weighted cash flow contribute
    // GBP 750k of a GBP 4.1m gross present value.
    expect(Math.round(sum)).toBe(750_019);
  });

  it("applies the terminal formula to a year that fails the steady-state test", () => {
    // Revenue grows 36.7% in the final forecast year and is then assumed to grow
    // at 2.5% forever. The spec: "If a startup is still scaling rapidly in Year
    // 5, applying a perpetual growth rate immediately creates an unrealistic
    // cliff from hypergrowth to steady state" -- and, in Common Errors,
    // "Abruptly moving from startup growth to perpetual growth after Year 5."
    expect(8_200_000 / 6_000_000 - 1).toBeCloseTo(0.3667, 4);
    expect(G).toBe(0.025);

    // Two specific items inside FCFE_5 that cannot hold in perpetuity:
    //   delta debt  -50,000  -- repaying debt of 250,000 forever
    //   delta WC   -154,000  -- working capital growing with 36.7% revenue,
    //                          not with 2.5%
    // At g = 2.5% the working-capital draw would be 574,000 x 0.025 = 14,350.
    const wcAtSteadyState = (1_230_000 - 656_000) * G;
    expect(wcAtSteadyState).toBeCloseTo(14_350, 6);
    expect(154_000 / wcAtSteadyState).toBeGreaterThan(10);
  });

  it("understates the terminal value by ~22% as a result", () => {
    // Normalising year 6 the way the spec's procedure requires -- maintenance
    // capex equal to D&A, working capital growing at g, no perpetual debt
    // repayment -- against what the engine actually grows.
    const netIncome6 = 1_591_000 * (1 + G);
    const normalisedFcfe6 = netIncome6 - (1_230_000 - 656_000) * G;
    const enginesFcfe6 = FCFE[4] * (1 + G);
    expect(normalisedFcfe6 / enginesFcfe6).toBeCloseTo(1.223, 3);

    // Note the DIRECTION. The textbook failure of this method is overstating
    // terminal value by growing without reinvesting; here the opposite happens,
    // because a growth year's reinvestment burden is carried into perpetuity.
    expect(normalisedFcfe6).toBeGreaterThan(enginesFcfe6);
  });

  it("now tests g = RR x RONIC, which this test previously asserted was absent", async () => {
    // This test used to assert the ABSENCE of any reinvestment check, and said:
    // "If a reinvestment consistency check is ever added, this test fails and
    // should be replaced with one that exercises it." It was, on 27 Sep 2026, so
    // this is that replacement.
    //
    // The spec: "growth is not free" -- g = RR x RONIC, so RR = g / RONIC, and
    // the simple formula "remains valid only if FCFF already reflects the
    // required reinvestment".
    const { computeLtgTerminalValue } = await import("../dcf");
    const r = 0.159623, g = 0.025;
    const t = computeLtgTerminalValue(1_289_000, 0.384, r, g, 1_591_000);

    expect(t.basis).toBe("reinvestment");
    expect(t.returnOnNewCapital).toBeCloseTo(r, 12); // defaults to the discount rate
    expect(t.reinvestmentRate).toBeCloseTo(g / r, 12);
    expect(t.reinvestmentRate).toBeCloseTo(0.15662, 5);

    // Both forms are reported, because the spec wants the naive one as a
    // cross-check: "If the two approaches disagree, the Year 6 reinvestment
    // assumptions are inconsistent."
    expect(Math.round(t.naiveTerminalValue)).toBe(3_768_675);
    expect(Math.round(t.reinvestmentTerminalValue!)).toBe(3_923_104);
    expect(t.reinvestmentDisagreement).toBeCloseTo(0.041, 3);
    expect(t.terminalValue).toBe(t.reinvestmentTerminalValue);
  });

  it("falls back to the naive form when no terminal net income is available", async () => {
    const { computeLtgTerminalValue } = await import("../dcf");
    const t = computeLtgTerminalValue(1_289_000, 0.384, 0.159623, 0.025);
    expect(t.basis).toBe("naive");
    expect(t.reinvestmentTerminalValue).toBeNull();
    expect(t.reinvestmentRate).toBeNull();
    expect(t.reinvestmentDisagreement).toBeNull();
    expect(t.terminalValue).toBe(t.naiveTerminalValue);
  });

  it("cannot produce a reinvestment rate at or above 1, because of the spread floor", async () => {
    // RR = g/RONIC, and RONIC defaults to the discount rate. MIN_LTG_SPREAD
    // guarantees r >= g + 0.03, so RR < 1 always and terminal cash flow cannot
    // be driven negative by reinvestment. The two fixes protect each other.
    const { computeLtgTerminalValue } = await import("../dcf");
    const { COUNTRIES, INDUSTRIES, resolveSizePremium } = await import("../referenceData");
    const premium = resolveSizePremium(900_000).premium;
    const all = Object.entries(COUNTRIES).flatMap(([, c]) =>
      Object.entries(INDUSTRIES).map(([, i]) =>
        computeLtgTerminalValue(
          1_289_000, 0.384, c.riskFree10Y + i.beta * c.equityRiskPremium + premium, 0.025, 1_591_000
        )
      )
    );
    expect(all.length).toBe(442);
    expect(all.every((t) => (t.reinvestmentRate as number) < 1)).toBe(true);
    expect(all.every((t) => t.terminalValue > 0)).toBe(true);
    expect(Math.max(...all.map((t) => t.reinvestmentRate as number))).toBeLessThan(0.56);
  });

  it("makes the terminal value independent of year-5 financing decisions", async () => {
    // The whole point. The naive form carries whatever working-capital draw, debt
    // movement and growth capex happened to land in the final forecast year and
    // grows all of it in perpetuity; the reinvestment form keys on net income.
    //
    // Measured by varying ONLY year-5 line items on the Northwind fixture:
    //   as supplied                    naive 3,768,675   reinvest 3,923,104    +4.1%
    //   repays 250k of debt            naive 3,183,931   reinvest 3,923,104   +23.2%
    //   receivables 1.23m -> 2.05m     naive 1,371,225   reinvest 3,923,104  +186.1%
    //   capex 180k -> 900k             naive 1,663,597   reinvest 3,923,104  +135.8%
    //   DRAWS 550k of new debt         naive 5,376,722   reinvest 3,923,104   -27.0%
    //
    // The naive terminal value swings by a factor of four and can overstate as
    // easily as understate.
    const { computeValuation } = await import("../compute");
    const { buildDefaultParameters } = await import("../defaults");
    const f = await import("./fixtures/northwind");
    const at = async (mutate: Record<string, number>) => {
      const fin = f.NORTHWIND_FINANCIALS.map((y) => (y.yearOffset === 5 ? { ...y, ...mutate } : { ...y }));
      const d = buildDefaultParameters(f.NORTHWIND_COMPANY as never, fin as never, f.NORTHWIND_BALANCE_SHEET as never);
      const r = await computeValuation(
        f.NORTHWIND_COMPANY as never, fin as never,
        { ...f.NORTHWIND_QUESTIONNAIRE } as never, { ...d, comparables: [] } as never
      );
      return r.ltgTerminalValue!;
    };
    const base = await at({});
    const bigWc = await at({ receivables: 2_050_000 });
    const drawsDebt = await at({ debt: 800_000 });

    // Net income is untouched by all three, so the reinvestment value is identical.
    expect(Math.round(bigWc.reinvestmentTerminalValue!)).toBe(Math.round(base.reinvestmentTerminalValue!));
    expect(Math.round(drawsDebt.reinvestmentTerminalValue!)).toBe(Math.round(base.reinvestmentTerminalValue!));

    // While the naive value swings hard in BOTH directions.
    expect(bigWc.naiveTerminalValue / base.naiveTerminalValue).toBeLessThan(0.4);
    expect(drawsDebt.naiveTerminalValue / base.naiveTerminalValue).toBeGreaterThan(1.4);
  });
});

describe("DCF-LTG — what the spec asks for and we already do", () => {
  it("uses year-6 cash flow in the numerator, not year 5", () => {
    // First entry in the spec's Common Errors list. compute.ts multiplies by
    // (1 + g) before dividing, which is FCFE_6. Asserted at the ratio, so a
    // future edit that dropped the growth-up would fail here.
    const r = 0.112623, g = 0.025, fcfe5 = 1_289_000, surv = 0.384;
    const tv = fcfe5 * surv * (1 + g) / (r - g);
    const wrong = fcfe5 * surv / (r - g);
    expect(tv / wrong).toBeCloseTo(1 + g, 10);
    expect(Math.round(tv)).toBe(5_790_151);
  });

  it("discounts the terminal value back to the present", () => {
    // Second entry in Common Errors. computeDcfShared divides by (1+r)^n using
    // the LAST forecast year's offset, which is the correct exponent.
    const years: FcfeYear[] = [fy(1, 0), fy(2, 0), fy(3, 0), fy(4, 0), fy(5, 0)];
    const res = computeDcfShared(years, 5_790_151, 0.112623, 0, 0);
    expect(res.discountedTerminalValue).toBeCloseTo(5_790_151 / Math.pow(1.112623, 5), 6);
    expect(Math.round(res.discountedTerminalValue)).toBe(3_395_860);
  });

  it("pairs FCFE with a cost of equity, which is one of the two valid forms", () => {
    // Worth asserting because the spec focuses on FCFF/WACC and warns: "A model
    // must not discount FCFF at the cost of equity or FCFE at WACC." We do
    // neither. deriveFcfeByYear produces FCFE (net income, +D&A, -capex, -dWC,
    // +dDebt) and defaults.ts discounts at CAPM cost of equity, which is the
    // spec's own second row -- so there is no enterprise-to-equity bridge to
    // omit, and its absence is correct rather than a gap.
    const riskFreeGB = 0.051, betaSaaS = 1.23, erpGB = 0.0501;
    expect(riskFreeGB + betaSaaS * erpGB).toBeCloseTo(0.112623, 6);
  });

  it("probability-weights survival against a market discount rate, not a loaded one", async () => {
    // The spec's recommended transparent treatment, and it explicitly warns
    // against "Counting failure in both probability-weighted cash flow and an
    // unchanged high risk premium". 11.26% is an ordinary CAPM cost of equity,
    // not a venture hurdle, so the survival weighting is not double counting.
    // Contrast the VC method, which carries 48.6% for the same company at the
    // same stage -- a hurdle that DOES carry the failure load, which is why VC
    // correctly applies no survival curve and this method correctly does.
    const { VC_REQUIRED_ROI } = await import("../referenceData");
    const dcfRate = 0.051 + 1.23 * 0.0501; // GB / SaaS CAPM cost of equity
    expect(VC_REQUIRED_ROI.expansion).toBeGreaterThan(dcfRate * 4);
    expect(dcfRate).toBeLessThan(0.15);
  });
});

describe("DCF-LTG — divergences that are not arithmetic", () => {
  it("applies a 25% illiquidity discount the spec never mentions", async () => {
    // Not wrong -- a marketability discount is standard for private companies
    // and Equidam applies one -- but it appears nowhere in the supplied method,
    // it is a flat constant for every company, and it is the third-largest
    // single lever in the model after the spread and the survival curve.
    // The spec lives in the sibling raise-hq-portal repo, so the check is
    // skipped rather than failed when only this repo is checked out (CI).
    const { readFileSync, existsSync } = await import("node:fs");
    const specPath = new URL(
      "../../../../../../../raise-hq-portal/claude/valuation methods/" +
        "DCF with Long-Term Growth Valuation.md",
      import.meta.url
    );
    if (existsSync(specPath)) {
      expect(readFileSync(specPath, "utf8")).not.toMatch(/illiquid|marketability/i);
    }

    const { ILLIQUIDITY_DISCOUNT_DEFAULT } = await import("../referenceData");
    expect(ILLIQUIDITY_DISCOUNT_DEFAULT).toBe(0.25);
    // Worth GBP 1,036,460 on Northwind's gross present value of 4,145,879.
    expect(Math.round(4_145_879 * 0.25)).toBe(1_036_470);
  });

  it("averages the two terminal-value approaches without reconciling them", () => {
    // Last entry in the spec's Common Errors: "Averaging perpetual-growth and
    // exit-multiple values without reconciling assumptions", and its own
    // section says "Large differences should trigger a review of growth,
    // margins, reinvestment, WACC, and comparable selection."
    //
    // Northwind at expansion stage: dcf_ltg 36% and dcf_multiple 36% of the
    // weight, disagreeing by 54%, averaged silently.
    const ltg = 3_169_409, multiple = 2_062_969;
    expect(ltg / multiple).toBeCloseTo(1.536, 3);
    expect(0.36 * ltg + 0.36 * multiple).toBeCloseTo(1_883_656, 0);
  });

  it("discounts at year end with no mid-year convention", () => {
    // The spec offers it as "often more accurate" where cash flows arrive
    // evenly, and requires consistent treatment of the terminal value if used.
    // End-year is a defensible default; recorded because it is systematically
    // conservative by roughly half a year of discounting.
    expect(Math.sqrt(1.112623) - 1).toBeCloseTo(0.0548, 4);
  });
});

describe("DCF-LTG — the spread guardrail (shipped 27 Sep 2026)", () => {
  it("leaves a healthy spread completely alone", async () => {
    const { computeLtgTerminalValue } = await import("../dcf");
    // UK / SaaS: r 11.2623%, g 2.5%, spread 8.7623%. Nothing should move.
    const t = computeLtgTerminalValue(1_289_000, 0.384, 0.112623, 0.025);
    expect(t.floored).toBe(false);
    expect(t.growthRateUsed).toBe(0.025);
    expect(t.spreadUsed).toBeCloseTo(0.087623, 10);
    expect(Math.round(t.terminalValue)).toBe(5_790_151); // the pre-fix value
    expect(t.impliedMultiple).toBeCloseTo(11.7, 1);
  });

  it("opens the spread when the discount rate is close to g", async () => {
    const { computeLtgTerminalValue } = await import("../dcf");
    // CH / PropTech: r 2.853%, so g cannot be 2.5%.
    const t = computeLtgTerminalValue(1_289_000, 0.384, 0.02853, 0.025);
    expect(t.floored).toBe(true);
    expect(t.growthRateRequested).toBe(0.025);
    expect(t.growthRateUsed).toBe(0.001); // LTG_GROWTH_RATE_MIN, not negative
    expect(t.spreadUsed).toBe(0.03);
  });

  it("never lets g go negative, which clamping alone would do", async () => {
    const { computeLtgTerminalValue } = await import("../dcf");
    // r - minSpread is NEGATIVE here (2.346% - 3% = -0.654%), so a naive
    // `g = min(g, r - floor)` would hand a scaling SaaS company a shrinking
    // perpetuity. These cases come from too low a discount rate, not from any
    // view about the company.
    const t = computeLtgTerminalValue(1_289_000, 0.384, 0.02346, 0.025);
    expect(0.02346 - 0.03).toBeLessThan(0);
    expect(t.growthRateUsed).toBeGreaterThan(0);
    expect(t.spreadUsed).toBe(0.03); // the denominator backstop, not the clamp
    expect(t.terminalValue).toBeGreaterThan(0);
  });

  it("holds for every country x industry combination, not just the samples", async () => {
    const { computeLtgTerminalValue, MIN_LTG_SPREAD } = await import("../dcf");
    const { COUNTRIES, INDUSTRIES, LTG_GROWTH_RATE_DEFAULT } = await import("../referenceData");

    const all = Object.entries(COUNTRIES).flatMap(([, c]) =>
      Object.entries(INDUSTRIES).map(([, i]) =>
        computeLtgTerminalValue(
          1_289_000, 0.384, c.riskFree10Y + i.beta * c.equityRiskPremium, LTG_GROWTH_RATE_DEFAULT
        )
      )
    );
    expect(all.length).toBe(442);

    // The three guarantees. Before the fix: 2 combinations produced a negative
    // terminal value (then a silent valuation of 0) and 11 produced a multiple
    // above 51x, peaking at 290x.
    expect(all.every((t) => Number.isFinite(t.terminalValue) && t.terminalValue > 0)).toBe(true);
    expect(Math.max(...all.map((t) => t.impliedMultiple))).toBeLessThan(35);
    expect(all.every((t) => t.spreadUsed >= MIN_LTG_SPREAD)).toBe(true);
    expect(all.every((t) => t.growthRateUsed > 0)).toBe(true);

    // And it is a guardrail, not a rewrite: g is untouched wherever the spread
    // was already adequate, which is 411 of the 442.
    const untouched = all.filter((t) => !t.floored);
    expect(untouched.length).toBe(431);
    expect(untouched.every((t) => t.growthRateUsed === LTG_GROWTH_RATE_DEFAULT)).toBe(true);
    // 31 floored before the beta re-sourcing of 28 Sep 2026, 11 after: plausible
    // betas raise the rate, so fewer combinations need the guardrail at all.
    expect(all.filter((t) => t.floored).length).toBe(11);
  });

  it("reports when it bound, so the report can say so", async () => {
    // The whole point of returning `floored` rather than silently adjusting: a
    // founder whose terminal growth was overridden should be told, and the
    // value is capped rather than correct. The underlying cause -- a 2.35% cost
    // of equity for a startup -- is ClickUp z8mad3qv19.
    const { computeLtgTerminalValue } = await import("../dcf");
    const ok = computeLtgTerminalValue(1_289_000, 0.384, 0.112623, 0.025);
    const bound = computeLtgTerminalValue(1_289_000, 0.384, 0.02346, 0.025);
    expect(ok.floored).toBe(false);
    expect(bound.floored).toBe(true);
    expect(bound.growthRateUsed).not.toBe(bound.growthRateRequested);
  });

  it("surfaces the verdict on the computeValuation output", async () => {
    const { computeValuation } = await import("../compute");
    const { buildDefaultParameters } = await import("../defaults");
    const f = await import("./fixtures/northwind");
    const d = buildDefaultParameters(
      f.NORTHWIND_COMPANY as never, f.NORTHWIND_FINANCIALS as never, f.NORTHWIND_BALANCE_SHEET as never
    );
    const r = await computeValuation(
      f.NORTHWIND_COMPANY as never, f.NORTHWIND_FINANCIALS as never,
      { ...f.NORTHWIND_QUESTIONNAIRE } as never, { ...d, comparables: [] } as never
    );
    expect(r.ltgTerminalValue?.floored).toBe(false);
    expect(r.ltgTerminalValue?.growthRateUsed).toBe(0.025);
    // The locked baseline, which the guardrail itself never moved -- it changed
    // only when the size premium and the terminal normalisation landed.
    expect(Math.round(r.weightedValuation)).toBe(3_896_345);
  });
});

// ---------------------------------------------------------------------------
// AUDIT-05 — DCF with Exit Multiple. Spec: "DCF with Exit Multiple Valuation
// Method.md" in raise-hq-portal's claude/valuation methods/.
//
// Shares the 36% weight at expansion with DCF-LTG, the same FCFE stream, the
// same survival curve and the same illiquidity discount. Only the terminal
// value differs: year-5 revenue x an industry revenue multiple.
// ---------------------------------------------------------------------------

describe("DCF-multiple — the claims mismatch", () => {
  it("pairs equity cash flows with an enterprise multiple, which the spec names as an error", async () => {
    // The spec is explicit: "An equity DCF may instead discount FCFE at the cost
    // of equity and use an EQUITY terminal multiple, such as P/E. Combining FCFF
    // with a P/E multiple, or FCFE with EV/EBITDA, mismatches the claims
    // represented by the cash flows and valuation multiple." Its Common Errors
    // list "Mixing EV multiples with equity metrics" and "Failing to subtract
    // debt-like claims".
    //
    // We discount FCFE at a cost of equity -- correct, and the same pairing that
    // makes DCF-LTG consistent -- and then add a terminal value built from an
    // EV/Revenue multiple, with no enterprise-to-equity bridge. So the SAME
    // choice that is right in DCF-LTG is wrong here, because there the terminal
    // value comes off the FCFE stream itself and here it does not.
    const { INDUSTRIES } = await import("../referenceData");
    // revenueMultiple and ebitdaMultiple are both ENTERPRISE multiples -- EV/Sales
    // and EV/EBITDA from Damodaran's tables. There is no equity multiple (P/E,
    // price-to-book) anywhere in the reference table, so this cannot be fixed by
    // choosing a different column.
    expect(Object.keys(INDUSTRIES.SaaS).sort()).toEqual(
      ["beta", "ebitdaMultiple", "impliedMatureMargin", "revenueMultiple", "source", "unleveredBeta"]
    );
    expect(INDUSTRIES.SaaS.source).toMatch(/EV\/|Damodaran/);
  });

  it("subtracts no debt, so Northwind's year-5 borrowings are never bridged", async () => {
    const f = await import("./fixtures/northwind");
    const year5 = f.NORTHWIND_FINANCIALS.find((y) => y.yearOffset === 5);
    expect(year5?.debt).toBe(250_000);
    // Nothing in the DCF-multiple path reads it. The only balance-sheet item
    // that reaches the valuation is non_operating_cash, added at the end.
    expect(f.NORTHWIND_BALANCE_SHEET.non_operating_cash).toBe(60_000);
    expect(f.NORTHWIND_BALANCE_SHEET.long_term_liabilities).toBe(150_000);
  });
});

describe("DCF-multiple — the reference table now agrees with itself", () => {
  // WAS A DIVERGENCE, fixed 27 Sep 2026. The table carried ebitdaMultiple and
  // revenueMultiple as two independent constants with no provenance, and they
  // contradicted each other: SaaS held 6.77x EBITDA and 1.04x revenue, an implied
  // mature margin of 15.4%, while the sign of the disagreement flipped by sector
  // (SaaS and Marketplace understated the revenue multiple against their own
  // EBITDA multiple; Cleantech, PropTech and default overstated it).
  //
  // Both columns now derive from one source pair -- Damodaran's EV/Sales and
  // EV/EBITDA, January 2026 -- scaled by a single small-company factor, which
  // leaves the source's own implied margin untouched.

  it("keeps every sector's two multiples consistent at its stated mature margin", async () => {
    const { INDUSTRIES } = await import("../referenceData");
    // The spec's identity: EV/Revenue = EV/EBITDA x EBITDA margin. This is the
    // assertion that makes the old 15.4%-vs-46.6% defect unrepeatable rather than
    // merely fixed -- any future hand-edit to one column alone fails here.
    for (const [key, v] of Object.entries(INDUSTRIES)) {
      expect(v.revenueMultiple / v.ebitdaMultiple, key).toBeCloseTo(v.impliedMatureMargin, 2);
    }
  });

  it("scales both columns by the same factor, so consistency survives it", async () => {
    const { INDUSTRIES, SMALL_COMPANY_MULTIPLE_FACTOR } = await import("../referenceData");
    // Damodaran Software (System & Application), January 2026: EV/Sales 11.41,
    // EV/EBITDA 24.48, across 309 firms.
    expect(SMALL_COMPANY_MULTIPLE_FACTOR).toBe(0.28);
    expect(INDUSTRIES.SaaS.revenueMultiple).toBeCloseTo(11.41 * 0.28, 2);
    expect(INDUSTRIES.SaaS.ebitdaMultiple).toBeCloseTo(24.48 * 0.28, 2);
    expect(INDUSTRIES.SaaS.impliedMatureMargin).toBeCloseTo(11.41 / 24.48, 6);
  });

  it("moved the revenue multiple by 3x and the EBITDA multiple barely at all", async () => {
    const { INDUSTRIES } = await import("../referenceData");
    // The asymmetry IS the finding: the EBITDA multiple was approximately right
    // all along and the revenue multiple was wrong by a factor of three.
    expect(INDUSTRIES.SaaS.revenueMultiple / 1.04).toBeCloseTo(3.07, 2); // was 1.04
    expect(INDUSTRIES.SaaS.ebitdaMultiple / 6.77).toBeCloseTo(1.01, 2);  // was 6.77
  });

  it("no longer gives four sectors one identical pair by accident", async () => {
    const { INDUSTRIES } = await import("../referenceData");
    // SaaS, Fintech, AI/ML and MobileApp still share a pair, but now BY STATED
    // MAPPING -- all four map to Damodaran's "Software (System & Application)",
    // recorded in each row's `source`. That is a documented choice rather than
    // the unexplained coincidence AUDIT-05 flagged.
    for (const k of ["Fintech", "AI_ML", "MobileApp"] as const) {
      expect(INDUSTRIES[k].revenueMultiple).toBe(INDUSTRIES.SaaS.revenueMultiple);
      expect(INDUSTRIES[k].source).toMatch(/Software \(System & Application\)/);
    }
    // And the sectors that previously shared a pair with no reason no longer do.
    expect(INDUSTRIES.Ecommerce.revenueMultiple).not.toBe(INDUSTRIES.Marketplace.revenueMultiple);
  });

  it("makes the fallback conservative rather than the most generous row", async () => {
    const { INDUSTRIES } = await import("../referenceData");
    // WAS THE DEFECT (z8mad3qv1e): `default` held 3.00x revenue and 9.00x EBITDA,
    // richer than SaaS on every axis, so leaving `industry` blank paid +36.8% on
    // the composite across 7 of 23 production snapshots. It is now the
    // whole-market figure (Total Market without financials, 4,822 firms).
    expect(INDUSTRIES.default.revenueMultiple).toBeLessThan(INDUSTRIES.SaaS.revenueMultiple);
    expect(INDUSTRIES.default.ebitdaMultiple).toBeLessThan(INDUSTRIES.SaaS.ebitdaMultiple);
    expect(INDUSTRIES.default.source).toMatch(/Total Market/);
    // Below the median named sector, not above it.
    const named = Object.entries(INDUSTRIES).filter(([k]) => k !== "default").map(([, v]) => v.revenueMultiple).sort((a, b) => a - b);
    const median = named[Math.floor(named.length / 2)];
    expect(INDUSTRIES.default.revenueMultiple).toBeLessThan(median);
  });
});

describe("DCF-multiple — leaving the industry blank now costs", () => {
  const runIndustry = async (industry: string) => {
    const { computeValuation } = await import("../compute");
    const { buildDefaultParameters } = await import("../defaults");
    const f = await import("./fixtures/northwind");
    const company = { ...f.NORTHWIND_COMPANY, industry };
    const d = buildDefaultParameters(
      company as never, f.NORTHWIND_FINANCIALS as never, f.NORTHWIND_BALANCE_SHEET as never
    );
    const r = await computeValuation(
      company as never, f.NORTHWIND_FINANCIALS as never,
      { ...f.NORTHWIND_QUESTIONNAIRE } as never, { ...d, comparables: [] } as never
    );
    const m = (k: string) =>
      Math.round(r.perMethod.find((x: { method: string }) => x.method === k)?.valuation ?? 0);
    return { multiple: m("dcf_multiple"), vc: m("vc"), ltg: m("dcf_ltg"), weighted: Math.round(r.weightedValuation) };
  };

  it("costs 23.4% on the composite, where it used to pay 36.8%", async () => {
    // MEASURED against production 27 Sep 2026: 7 of the 23 snapshots in
    // valuation_snapshots belong to companies with a BLANK industry (4 distinct
    // companies), which resolves to INDUSTRIES.default. The other 16 are "SaaS".
    //
    // Before the multiple re-sourcing `default` was 3.00x revenue / 9.00x EBITDA
    // with a beta of 1.05 -- richer than SaaS on every axis -- so a blank field
    // was worth +36.8%. It is now the whole-market figure, and the same omission
    // costs -25.4%.
    const saas = await runIndustry("SaaS");
    const blank = await runIndustry("");

    expect(saas.weighted).toBe(3_896_345);
    expect(blank.weighted).toBe(2_986_122);
    expect(blank.weighted / saas.weighted - 1).toBeCloseTo(-0.234, 3);

    // The penalty weakened slightly when the betas were re-sourced: `default`
    // moved 1.05 -> 0.99, BELOW the median named sector of 1.11, so a blank
    // industry now gets a slightly lower discount rate. It offsets the multiples
    // penalty without reversing it, so the honest whole-market figure was kept
    // rather than inflated to protect a margin.

    // dcf_multiple falls on the lower multiple. vc reads 0 in both, because since
    // the pre-money decision it is excluded for not clearing its hurdle either
    // way -- and the blank fallback makes the shortfall WORSE, from -546,889 to
    // -1,145,653, because a lower EBITDA multiple shrinks the exit value.
    expect(blank.multiple).toBeLessThan(saas.multiple * 0.5);
    expect(blank.vc).toBe(0);
    expect(saas.vc).toBe(0);
    // dcf_ltg still RISES, because `default` carries a lower beta (0.99 vs 1.28)
    // and so a lower discount rate -- now from re-sourced figures rather than
    // unsourced ones.
    expect(blank.ltg).toBeGreaterThan(saas.ltg);
  });

  it("matches an unknown industry string to the same fallback", async () => {
    // The matcher normalises case, underscores and spaces, so anything it does
    // not recognise -- "Software", "B2B SaaS", "Enterprise Software" -- lands on
    // `default` rather than on the nearest sector.
    const software = await runIndustry("Software");
    const blank = await runIndustry("");
    expect(software.weighted).toBe(blank.weighted);
  });
});

describe("DCF-multiple — the remaining divergences", () => {
  it("applies today's multiple to year 5 with no fade toward a mature profile", async () => {
    const { buildDefaultParameters } = await import("../defaults");
    const { INDUSTRIES } = await import("../referenceData");
    const f = await import("./fixtures/northwind");
    const d = buildDefaultParameters(
      f.NORTHWIND_COMPANY as never, f.NORTHWIND_FINANCIALS as never, f.NORTHWIND_BALANCE_SHEET as never
    );
    // exit_multiple IS the current industry multiple, unmodified.
    expect(d.dcf_multiple.exit_multiple).toBe(INDUSTRIES.SaaS.revenueMultiple);

    // The spec: "A Year 5 business growing 15% should not automatically receive
    // the same revenue multiple as a current peer growing 70%", and in Common
    // Errors, "Applying a current high-growth multiple to a slower-growing
    // terminal business." Northwind grows 36.7% into year 5 -- so the terminal
    // profile is not a mature one either, which cuts both ways and is exactly
    // why the spec wants the multiple chosen FOR the terminal date.
    expect(8_200_000 / 6_000_000 - 1).toBeCloseTo(0.3667, 4);
  });

  it("is 71.9% terminal value, and is never cross-checked against DCF-LTG", () => {
    // Same decomposition as the LTG block above, same FCFE stream.
    const R = 0.112623, ILLIQ = 0.25, NON_OP = 60_000, SURV5 = 0.384;
    const sum = 750_019;
    const tv = 8_200_000 * 1.04 * SURV5;
    const dtv = tv / Math.pow(1 + R, 5);
    expect(Math.round((sum + dtv) * (1 - ILLIQ) + NON_OP)).toBe(2_062_969); // the baseline
    expect(dtv / (sum + dtv)).toBeCloseTo(0.719, 3);

    // The spec has a whole section titled "Cross-Check Against Perpetual
    // Growth", and its Common Errors close with "Averaging exit-multiple and
    // perpetual-growth outputs without reconciling them". At expansion the two
    // carry 36% each, disagree by 54%, and nothing reconciles them.
    expect(3_169_409 / 2_062_969).toBeCloseTo(1.536, 3);
  });

  it("derives the terminal metric from an unnormalised final forecast year", async () => {
    // The spec has a section "Normalizing the Terminal Year". Revenue is a more
    // robust terminal metric than FCFE -- it cannot be distorted by working
    // capital or debt repayment the way DCF-LTG's is -- so this is milder here
    // than divergence 3 of AUDIT-04. But the year is still a 36.7%-growth year,
    // and the multiple applied to it is a current-market one.
    const f = await import("./fixtures/northwind");
    const last = f.NORTHWIND_FINANCIALS.reduce((a, b) => (b.yearOffset > a.yearOffset ? b : a));

    // The metric is that year's revenue taken as-is, with no adjustment.
    expect(last.yearOffset).toBe(5);
    expect(last.revenue).toBe(8_200_000);
    const terminalValue = last.revenue * 1.04 * 0.384;
    expect(Math.round(terminalValue)).toBe(3_274_752);

    // And the margin that revenue multiple is implicitly priced against.
    const ebitda = last.revenue - last.cogs - last.salaries - last.otherOpex;
    expect(ebitda / last.revenue).toBeCloseTo(0.252, 3);
  });
});
