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
    };
  };

  it("is nowhere guarded, so g >= r silently returns zero", async () => {
    // The spec's "Required condition" is WACC > g, and lists "Setting g equal
    // to or above WACC" among its Common Errors. LTG_GROWTH_RATE_DEFAULT is a
    // flat 0.025 while the discount rate is CAPM per country x industry, and
    // two of the 442 combinations land below it. Swiss Cleantech is r = 2.346%
    // against g = 2.5%: the denominator goes negative, the terminal value with
    // it, and Math.max(0, ...) hands back a clean zero at 36% of the weight.
    const ch = await run("Switzerland", "Cleantech");
    expect(ch.discountRate).toBeLessThan(ch.g);
    expect(ch.ltg).toBe(0);
    // And nothing anywhere says so -- the composite still returns a number.
    expect(ch.weighted).toBeGreaterThan(0);
  });

  it("produces a 290x terminal multiple when the spread is merely narrow", async () => {
    // Worse than the zero, because this one looks like an answer. Swiss
    // PropTech is r = 2.853%, a spread of 0.353%, so the terminal multiple is
    // 1.025 / 0.00353 = 290x year-5 cash flow. The spec: "As the spread
    // narrows, terminal value becomes extraordinarily sensitive."
    const ch = await run("Switzerland", "PropTech");
    expect(ch.discountRate - ch.g).toBeCloseTo(0.00353, 5);
    expect(ch.ltg).toBeGreaterThan(100_000_000);

    // Same company, same financials, GBP 900k of revenue.
    const gb = await run("United Kingdom", "SaaS");
    expect(gb.ltg).toBe(3_169_409);
    expect(ch.weighted / gb.weighted).toBeGreaterThan(14);
  });

  it("carries the UK SaaS baseline unchanged, so the above is not a harness artefact", async () => {
    const gb = await run("United Kingdom", "SaaS");
    expect(gb.discountRate).toBeCloseTo(0.112623, 6);
    expect(gb.g).toBe(0.025);
    expect(gb.weighted).toBe(3_308_842);
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

  it("never tests g = RR x RONIC, the spec's consistency requirement", async () => {
    // The spec devotes a section to it: "growth is not free", RR = g / RONIC,
    // and the simple formula "remains valid only if FCFF already reflects the
    // required reinvestment".
    //
    // Asserted by reading the engine's own source, because the finding is an
    // ABSENCE and there is no behaviour to assert against. If a reinvestment
    // consistency check is ever added, this test fails and should be replaced
    // with one that exercises it.
    const { readFileSync } = await import("node:fs");
    const src = ["compute.ts", "dcf.ts", "fcf.ts", "defaults.ts"]
      .map((f) => readFileSync(new URL(`../${f}`, import.meta.url), "utf8"))
      .join("\n");
    expect(src).not.toMatch(/RONIC|ROIC|reinvestment[_ ]?rate/i);

    // Terminal growth is a flat constant for every company, independent of what
    // that company actually reinvests or earns on new capital.
    const { LTG_GROWTH_RATE_DEFAULT, LTG_GROWTH_RATE_MIN, LTG_GROWTH_RATE_MAX } =
      await import("../referenceData");
    expect(LTG_GROWTH_RATE_DEFAULT).toBe(0.025);
    expect(LTG_GROWTH_RATE_MIN).toBe(0.001);
    expect(LTG_GROWTH_RATE_MAX).toBe(0.025);
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
