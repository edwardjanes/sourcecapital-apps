import { expect, it, describe } from "vitest";
import { computeVcMethod } from "../vc";
import { STAGE_DEFAULT_WEIGHTS } from "../referenceData";

describe("VC Method", () => {
  it("computes standard exit value with discount factor", () => {
    const terminalYearMetricValue = 2000000; // EBITDA or similar
    const industryMultiple = 1.5;
    const requiredRoi = 0.5; // 50% ROI per year
    const projectionYears = 5;

    const result = computeVcMethod(
      terminalYearMetricValue,
      industryMultiple,
      requiredRoi,
      projectionYears
    );

    // Exit value = terminal metric × industry multiple
    expect(result.exitValue).toBe(3000000);
    expect(result.discountFactor).toBeCloseTo(1 / Math.pow(1.5, 5), 6);
    expect(result.valuation).toBeGreaterThan(0);
    expect(result.valuation).toBeLessThan(3000000);
  });

  it("returns max(0, discounted_exit_value) to prevent negative valuations", () => {
    const terminalYearMetricValue = 100000;
    const industryMultiple = 0.5;
    const requiredRoi = 2.0; // 200% required return = high discount
    const projectionYears = 10; // Very distant

    const result = computeVcMethod(
      terminalYearMetricValue,
      industryMultiple,
      requiredRoi,
      projectionYears
    );

    // Even with extreme discounting, should return non-negative value
    expect(result.valuation).toBeGreaterThanOrEqual(0);
  });

  it("accounts for capital raised in VC method", () => {
    const terminalYearMetricValue = 5000000;
    const industryMultiple = 2.0;
    const requiredRoi = 0.4;
    const projectionYears = 3;
    const capitalRaised = 1000000;

    const result = computeVcMethod(
      terminalYearMetricValue,
      industryMultiple,
      requiredRoi,
      projectionYears,
      capitalRaised
    );

    const expectedExitValue = 10000000;
    expect(result.exitValue).toBe(expectedExitValue);
    expect(result.discountedExitValue).toBeLessThan(expectedExitValue);
    // Valuation = discountedExitValue - capitalRaised, then max(0, ...)
    expect(result.valuation).toBeLessThanOrEqual(result.discountedExitValue);
  });

  it("handles edge case: zero terminal value", () => {
    const result = computeVcMethod(0, 2.0, 0.5, 5);

    expect(result.exitValue).toBe(0);
    expect(result.valuation).toBe(0);
  });

  it("handles edge case: zero industry multiple", () => {
    const result = computeVcMethod(2000000, 0, 0.5, 5);

    expect(result.exitValue).toBe(0);
    expect(result.valuation).toBe(0);
  });

  it("handles edge case: zero projection years (immediate exit)", () => {
    const terminalYearMetricValue = 2000000;
    const industryMultiple = 1.5;
    const requiredRoi = 0.5;

    const result = computeVcMethod(
      terminalYearMetricValue,
      industryMultiple,
      requiredRoi,
      0
    );

    // Discount factor = 1 / (1 + 0.5)^0 = 1
    expect(result.discountFactor).toBe(1);
    expect(result.discountedExitValue).toBe(result.exitValue);
  });

  it("handles high required ROI (high discount)", () => {
    const terminalYearMetricValue = 2000000;
    const industryMultiple = 1.5;
    const requiredRoi = 5.0; // 500% annual return
    const projectionYears = 5;

    const result = computeVcMethod(
      terminalYearMetricValue,
      industryMultiple,
      requiredRoi,
      projectionYears
    );

    expect(result.discountFactor).toBeLessThan(0.001); // Heavily discounted
    expect(result.valuation).toBeLessThan(1000); // Minimal value
  });

  it("produces realistic valuation for development-stage startup", () => {
    // NovaCloud-like scenario
    const terminalYearMetricValue = 2400000; // Year 3 EBITDA estimate
    const industryMultiple = 2.0; // SaaS multiple
    const requiredRoi = 0.6; // 60% IRR target
    const projectionYears = 5;
    const capitalRaised = 250000; // Prior funding

    const result = computeVcMethod(
      terminalYearMetricValue,
      industryMultiple,
      requiredRoi,
      projectionYears,
      capitalRaised
    );

    // Exit 4.8M discounted over 5 years at 60% ≈ 457,764, less 250k raised
    const expected = (2400000 * 2.0) / Math.pow(1.6, 5) - capitalRaised;
    expect(result.valuation).toBeCloseTo(expected, 2);
    expect(result.valuation).toBeGreaterThan(0);
    expect(result.valuation).toBeLessThan(10000000); // Reasonable range
  });

  it("clamps to zero when capital raised exceeds the discounted exit value", () => {
    // Same scenario but with 1.5M raised: 457,764 − 1,500,000 < 0
    const result = computeVcMethod(2400000, 2.0, 0.6, 5, 1500000);

    expect(result.discountedExitValue).toBeLessThan(1500000);
    expect(result.valuation).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// The published worked examples from the method spec
// (claude/valuation methods/The Venture Capital Valuation Method.md in
// raise-hq-portal). None was covered before. Added 27 Sep 2026 during the VC
// audit, for the same reason as the Checklist ones: the nine tests above all
// assert that the arithmetic is self-consistent, and none asserts that the
// arithmetic is the METHOD's.
// ---------------------------------------------------------------------------

describe("VC Method — the spec's worked example", () => {
  // $3.0M new investment, exit in 5 years, exit revenue $30.0M at 4.0x
  // EV/Revenue, zero exit net debt, 40% required annual return, no dilution.
  const EXIT_REVENUE = 30_000_000;
  const EXIT_MULTIPLE = 4.0;
  const HURDLE = 0.40;
  const YEARS = 5;
  const INVESTMENT = 3_000_000;

  it("reproduces every step of the chain", () => {
    const r = computeVcMethod(EXIT_REVENUE, EXIT_MULTIPLE, HURDLE, YEARS, INVESTMENT);

    // EV_exit = 30.0M x 4.0 = 120.0M. With zero net debt this is also exit equity.
    expect(r.exitValue).toBe(120_000_000);

    // M = (1 + 0.40)^5 = 5.37824
    expect(1 / r.discountFactor).toBeCloseTo(5.37824, 5);

    // V_post = 120.0M / 5.37824 = 22.31M
    expect(r.discountedExitValue / 1e6).toBeCloseTo(22.31, 2);

    // V_pre = V_post - investment = 19.31M. This is the line the method is FOR:
    // everything above it is intermediate, and it is the only figure a founder
    // should be shown as their valuation.
    expect(r.valuation / 1e6).toBeCloseTo(19.31, 2);
  });

  it("agrees with the ownership route to the same answer", () => {
    // The spec states the same result follows from required ownership:
    // f_entry = investment / V_post = 13.45%.
    const r = computeVcMethod(EXIT_REVENUE, EXIT_MULTIPLE, HURDLE, YEARS, INVESTMENT);
    const fEntry = INVESTMENT / r.discountedExitValue;
    expect(fEntry).toBeCloseTo(0.1345, 4);

    // ...and required exit proceeds of ~$16.13M against a $120M exit.
    expect(fEntry * r.exitValue / 1e6).toBeCloseTo(16.13, 2);
  });

  it("reproduces all nine cells of the spec's sensitivity table", () => {
    // Exit multiple x hurdle, present POST-money, $30M exit revenue over 5 years.
    // Asserted in full because sensitivity to these two inputs is the method's
    // central documented limitation, and this is the cheapest possible guard on
    // the discounting arithmetic.
    const table: Array<[number, number, number]> = [
      // [multiple, hurdle, expected V_post in $M]
      [3.0, 0.30, 24.23], [3.0, 0.40, 16.73], [3.0, 0.50, 11.85],
      [4.0, 0.30, 32.31], [4.0, 0.40, 22.31], [4.0, 0.50, 15.80],
      [5.0, 0.30, 40.39], [5.0, 0.40, 27.89], [5.0, 0.50, 19.75],
    ];
    for (const [multiple, hurdle, expected] of table) {
      const r = computeVcMethod(EXIT_REVENUE, multiple, hurdle, YEARS, 0);
      expect(r.discountedExitValue / 1e6).toBeCloseTo(expected, 1);
    }
  });

  it("uses the annual hurdle once, not a hurdle and an equivalent MOIC", () => {
    // The spec: "A stated annual hurdle should not then be applied again as an
    // additional MOIC; that double discounts the outcome." These are the
    // equivalences it gives, so a future change that stacked both would fail
    // the first assertion rather than silently halving every valuation.
    const r = computeVcMethod(EXIT_REVENUE, EXIT_MULTIPLE, HURDLE, YEARS, 0);
    expect(1 / r.discountFactor).toBeCloseTo(Math.pow(1.4, 5), 10); // 5.378x, not 5.378^2
    expect(Math.pow(5, 1 / 5) - 1).toBeCloseTo(0.380, 3);  // 5.0x over 5yr -> 38.0% IRR
    expect(Math.pow(5, 1 / 8) - 1).toBeCloseTo(0.223, 3);  // 5.0x over 8yr -> 22.3% IRR
    expect(Math.pow(1.4, 8)).toBeCloseTo(14.758, 3);        // 40% over 8yr -> 14.76x
  });

  it("cannot express the spec's dilution-adjusted example at all", () => {
    // Two later rounds diluting 15% and 20% give a retention ratio q = 0.68, and
    // the spec's dilution-adjusted answers are V_post 15.17M / V_pre 12.17M
    // against the 22.31M / 19.31M above -- a 37% reduction on the same company.
    //
    // computeVcMethod has no retention parameter, so this is asserted as
    // arithmetic rather than through the function. It is here to record the
    // size of the gap, not to test anything we ship: the spec calls ignoring
    // follow-on financing a "central limitation of the unadjusted method".
    const q = (1 - 0.15) * (1 - 0.20);
    expect(q).toBeCloseTo(0.68, 10);

    const r = computeVcMethod(EXIT_REVENUE, EXIT_MULTIPLE, HURDLE, YEARS, INVESTMENT);
    const postDiluted = (r.exitValue * q) * r.discountFactor;
    expect(postDiluted / 1e6).toBeCloseTo(15.17, 2);
    expect((postDiluted - INVESTMENT) / 1e6).toBeCloseTo(12.17, 2);

    // The undiluted figure the engine would report is 59% higher.
    expect(r.valuation / (postDiluted - INVESTMENT)).toBeCloseTo(1.587, 3);
  });

  it("treats an enterprise-value multiple as equity, with no net-debt bridge", () => {
    // The spec opens its Enterprise and Equity Value section with: "A common
    // modeling error is applying an enterprise-value multiple and treating the
    // result as equity proceeds", and requires
    //   EqV_exit = EV_exit + Cash_exit - Debt_exit - senior claims.
    //
    // The signature has nowhere to put cash, debt or senior claims, so
    // exitValue IS the equity value by construction. Asserted so the omission
    // is visible in the suite rather than only in the audit.
    const r = computeVcMethod(2_000_000, 6.77, 0.486, 5, 0);
    expect(r.exitValue).toBeCloseTo(2_000_000 * 6.77, 6);
    // Four required parameters, a defaulted fifth (capitalRaised) and no sixth.
    // The default is how the pre-money subtraction came to be skippable at all.
    expect(computeVcMethod.length).toBe(4);
  });
});

describe("VC Method — what the shipped pipeline actually passes", () => {
  // AUDIT-03 headline. compute.ts calls computeVcMethod(..., 0), hardcoding
  // capitalRaised, so the pre-money subtraction the method is defined by never
  // runs and the engine reports V_post under a pre-money label.
  //
  // The nine unit tests above could not catch this, and two of them exercise
  // capitalRaised directly -- the function is right, the wiring is dead. Same
  // shape as `4. Send Approved Outreach`: the parts work, the thing does not.
  // These assertions are at the call site's own numbers, which is where the
  // defect lives.

  const EBITDA_Y5 = 8_200_000 - 1_804_000 - 2_950_000 - 1_380_000; // 2,066,000
  const MULTIPLE = 6.77;   // INDUSTRIES.SaaS.ebitdaMultiple
  const ROI = 0.4860;      // VC_REQUIRED_ROI.expansion
  const YEARS = 5;
  const CAPITAL_NEEDED = 2_500_000; // Northwind's own answer, in the payload

  it("reports the post-money figure Northwind's live snapshot recorded", () => {
    const shipped = computeVcMethod(EBITDA_Y5, MULTIPLE, ROI, YEARS, 0);

    // 1,930,301 is the value in valuation_snapshots for 6cdd8d1d, reproduced
    // here to the pound -- which is the proof that production passes zero,
    // since any non-zero capitalRaised gives a different (lower) number.
    expect(Math.round(shipped.valuation)).toBe(1_930_301);
    expect(shipped.valuation).toBeCloseTo(shipped.discountedExitValue, 6);
  });

  it("would return zero for Northwind if the spec were followed", () => {
    // V_pre = V_post - investment = 1,930,301 - 2,500,000 = -569,699, clamped.
    const spec = computeVcMethod(EBITDA_Y5, MULTIPLE, ROI, YEARS, CAPITAL_NEEDED);
    expect(spec.discountedExitValue - CAPITAL_NEEDED).toBeLessThan(0);
    expect(spec.valuation).toBe(0);

    // That zero is a real finding, not a rounding artefact: at a 48.6% hurdle
    // Northwind's own projections do not support a GBP 2.5m round. But a zero
    // averaged in at VC's 16% weight is a statement about the company rather
    // than about the method's applicability, which is why this is a decision
    // and not a one-line fix. Sized: the composite moves 3,308,842 -> 2,999,994.
    const composite = 3_308_841.7249949267;
    const afterFix = composite - 0.16 * 1_930_301 + 0.16 * spec.valuation;
    expect(Math.round(afterFix)).toBe(2_999_994);
    expect(afterFix / composite - 1).toBeCloseTo(-0.0933, 4);
  });

  it("carries a 16% weight at every stage from idea to expansion", () => {
    // Why this method matters more than its audit order suggests: Scorecard and
    // Checklist decay from 38% to 0 across the stages, and VC does not. It is
    // the only method with a material, near-constant weight throughout.
    expect(STAGE_DEFAULT_WEIGHTS.idea.vc).toBeCloseTo(0.16, 10);
    expect(STAGE_DEFAULT_WEIGHTS.development.vc).toBeCloseTo(0.16, 10);
    expect(STAGE_DEFAULT_WEIGHTS.startup.vc).toBeCloseTo(0.16, 10);
    expect(STAGE_DEFAULT_WEIGHTS.expansion.vc).toBeCloseTo(0.16, 10);
    expect(STAGE_DEFAULT_WEIGHTS.growth.vc).toBeCloseTo(0.20, 10);
    expect(STAGE_DEFAULT_WEIGHTS.maturity.vc).toBe(0);
  });

  it("applies no failure probability, unlike both DCF methods", () => {
    // Defensible in isolation -- classic VCM loads failure risk into the hurdle,
    // and the spec warns against ALSO probability-weighting it. Recorded because
    // the two DCFs apply the GB survival curve (38.4% at year 5) AND a discount
    // rate AND a 25% illiquidity discount to the same company, so the engine
    // treats the same risk three different ways across methods it then averages.
    const withSurvival = computeVcMethod(EBITDA_Y5 * 0.384, MULTIPLE, ROI, YEARS, 0);
    const asShipped = computeVcMethod(EBITDA_Y5, MULTIPLE, ROI, YEARS, 0);
    expect(withSurvival.valuation / asShipped.valuation).toBeCloseTo(0.384, 10);
  });
});

describe("VC Method — resilience of the terminal metric", () => {
  // defaults.ts sets terminal_metric_value to the year-5 EBITDA with no floor
  // (`terminalFcfeYear?.ebitda ?? 0`), so anything at or below zero there
  // collapses the whole method to zero via Math.max(0, ...), with nothing
  // recorded to say why.
  //
  // MEASURED against production, 27 Sep 2026, not hypothesised: 13 of the 23
  // snapshots in valuation_snapshots report vc = 0, and in every one of them the
  // TERMINAL year carries no data even though earlier years do. All 13 are demo
  // rows ("New Company", "Vantage Metrics Ltd"), so no real client is affected
  // today -- but a 16%-weighted method silently contributing nothing, and the
  // composite absorbing that zero rather than redistributing the weight, is a
  // live failure mode the moment a founder leaves the last column blank.
  //
  // The negative-EBITDA case below is latent rather than observed: no snapshot
  // has a negative terminal EBITDA, though several are loss-making in earlier
  // years, and a development-stage company projecting a year-5 loss is ordinary.

  it("returns zero, not a negative, when year-5 EBITDA is a loss", () => {
    const r = computeVcMethod(-400_000, 6.77, 1.1147, 5, 0);
    expect(r.exitValue).toBeLessThan(0);
    expect(r.discountedExitValue).toBeLessThan(0);
    expect(r.valuation).toBe(0);
  });

  it("gives no way to tell that zero apart from a genuine zero", () => {
    // Both of these return valuation 0 and the result object carries no flag,
    // so a loss-making projection and a company with no forecast at all are
    // indistinguishable downstream -- including to the report and the composite.
    const lossMaking = computeVcMethod(-400_000, 6.77, 1.1147, 5, 0);
    const noForecast = computeVcMethod(0, 6.77, 1.1147, 5, 0);
    expect(lossMaking.valuation).toBe(noForecast.valuation);
    expect(Object.keys(lossMaking).sort()).toEqual(
      ["discountFactor", "discountedExitValue", "exitValue", "valuation"]
    );
  });

  it("is heavily suppressed anyway at an early-stage hurdle", () => {
    // development's required ROI is 111.47%, so M = (2.1147)^5 = 42.3x. Even a
    // healthy GBP 1m year-5 EBITDA at 6.77x discounts to ~GBP 160k. The hurdle,
    // not the projection, is what decides this method's contribution early on.
    const r = computeVcMethod(1_000_000, 6.77, 1.1147, 5, 0);
    expect(1 / r.discountFactor).toBeCloseTo(42.29, 1);
    expect(r.valuation).toBeLessThan(200_000);

    // At a 60% hurdle -- the top of the range the spec actually cites for any
    // stage -- the same company is worth 4x more by this method.
    const at60 = computeVcMethod(1_000_000, 6.77, 0.60, 5, 0);
    expect(at60.valuation / r.valuation).toBeCloseTo(4.03, 2);
  });
});
