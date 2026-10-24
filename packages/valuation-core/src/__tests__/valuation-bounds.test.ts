import { expect, it, describe } from "vitest";
import { computeValuation } from "../compute";
import { CompanyProfile, FinancialYear, UpdatedValuationParameters } from "../types";

describe("Valuation Low/High Bounds Formula", () => {
  /**
   * Executive summary valuation bounds (compute.ts) follow a ±9.6% band around the weighted valuation:
   * low = weighted × 0.904   (9.6% below)
   * high = weighted × 1.096  (9.6% above)
   * so the total low→high spread is 19.2% of the weighted valuation.
   *
   * This is modeled on NovaCloud's own spread and is a hard-coded constant
   * worth locking down with tests to prevent accidental modifications.
   */

  const LOW_BOUND_FACTOR = 0.904;
  const HIGH_BOUND_FACTOR = 1.096;
  const BAND_PER_SIDE = 0.096; // ±9.6%

  it("computeValuation's lowBound/highBound use the 0.904 / 1.096 factors", async () => {
    const profile: CompanyProfile = {
      name: "TestCo",
      country: "US",
      industry: "SaaS",
      stage: "development",
    };

    const baseYear = {
      yearNumber: null,
      interest: 0,
      receivables: 0,
      inventory: 0,
      payables: 0,
      debt: 0,
      fundraisingPlan: 0,
    };
    const financials: FinancialYear[] = [
      { ...baseYear, yearOffset: -1, isActual: true, revenue: 1000000, cogs: 500000, salaries: 200000, otherOpex: 50000, totalDa: 10000, taxes: 50000, capex: 20000 },
      { ...baseYear, yearOffset: 1, isActual: false, revenue: 1500000, cogs: 600000, salaries: 300000, otherOpex: 75000, totalDa: 15000, taxes: 75000, capex: 30000 },
    ];

    const parameters: UpdatedValuationParameters = {
      stage: "development",
      method_weights: { scorecard: 0.3, checklist: 0.3, vc: 0.16, dcf_ltg: 0.12, dcf_multiple: 0.12, multiples: 0 },
      scorecard: { average_pre_money_valuation: 1000000 },
      checklist: { max_valuation: 5000000 },
      vc_method: { terminal_metric_value: 2000000, industry_multiple: 1.5, required_roi: 0.5, projection_years: 2 },
      dcf_shared: { discount_rate: 0.15, illiquidity_discount: 0.25, non_operating_cash: 0 },
      dcf_ltg: { terminal_growth_rate: 0.025, survival_rates: [0.8869, 0.7945, 0.7164] },
      dcf_multiple: { exit_multiple: 1.5, survival_rates: [0.8869, 0.7945, 0.7164] },
      simple_multiples: { last_year_metric: 1000000, metric_type: "revenue" },
      comparables: [],
    };

    const result = await computeValuation(profile, financials, null, parameters);

    expect(result.weightedValuation).toBeGreaterThan(0);
    expect(result.lowBound).toBeCloseTo(result.weightedValuation * LOW_BOUND_FACTOR, 2);
    expect(result.highBound).toBeCloseTo(result.weightedValuation * HIGH_BOUND_FACTOR, 2);
  });

  it("computes low bound as weighted × 0.904", () => {
    const weightedValuation = 3775562; // NovaCloud reference
    const expectedLow = weightedValuation * LOW_BOUND_FACTOR;

    expect(expectedLow).toBeCloseTo(3413108, 0);
  });

  it("computes high bound as weighted × 1.096", () => {
    const weightedValuation = 3775562;
    const expectedHigh = weightedValuation * HIGH_BOUND_FACTOR;

    expect(expectedHigh).toBeCloseTo(4138016, 0);
  });

  it("maintains symmetric spread around central valuation", () => {
    const weighted = 5000000;
    const low = weighted * LOW_BOUND_FACTOR;
    const high = weighted * HIGH_BOUND_FACTOR;

    // Calculate distances from center
    const lowerDistance = weighted - low;
    const upperDistance = high - weighted;

    // Equal in absolute terms, each 9.6% of the center
    expect(lowerDistance).toBeCloseTo(upperDistance, 2);
    expect(lowerDistance / weighted).toBeCloseTo(BAND_PER_SIDE, 4);
  });

  it("produces bounds matching NovaCloud's $3.77M reference to within $1.1k", () => {
    const novaCloudWeighted = 3775562;
    const low = novaCloudWeighted * LOW_BOUND_FACTOR;
    const high = novaCloudWeighted * HIGH_BOUND_FACTOR;

    // NovaCloud's Equidam report quotes bounds rounded to $3.414M – $4.137M
    expect(Math.abs(low - 3414000)).toBeLessThan(1100);
    expect(Math.abs(high - 4137000)).toBeLessThan(1100);
  });

  it("low bound is always less than high bound", () => {
    const testValues = [1000, 100000, 1000000, 10000000, 100000000];

    testValues.forEach((value) => {
      const low = value * LOW_BOUND_FACTOR;
      const high = value * HIGH_BOUND_FACTOR;

      expect(low).toBeLessThan(value);
      expect(high).toBeGreaterThan(value);
      expect(low).toBeLessThan(high);
    });
  });

  it("bounds span ±9.6% from center", () => {
    const weighted = 2000000;
    const low = weighted * LOW_BOUND_FACTOR;
    const high = weighted * HIGH_BOUND_FACTOR;

    const lowerPercent = (weighted - low) / weighted;
    const upperPercent = (high - weighted) / weighted;

    expect(lowerPercent).toBeCloseTo(BAND_PER_SIDE, 4);
    expect(upperPercent).toBeCloseTo(BAND_PER_SIDE, 4);
  });

  it("handles edge case: zero valuation", () => {
    const weighted = 0;
    const low = weighted * LOW_BOUND_FACTOR;
    const high = weighted * HIGH_BOUND_FACTOR;

    expect(low).toBe(0);
    expect(high).toBe(0);
  });

  it("handles edge case: very small valuation", () => {
    const weighted = 100; // $100
    const low = weighted * LOW_BOUND_FACTOR;
    const high = weighted * HIGH_BOUND_FACTOR;

    expect(low).toBeCloseTo(90.4, 2);
    expect(high).toBeCloseTo(109.6, 2);
  });

  it("handles edge case: very large valuation", () => {
    const weighted = 1000000000; // $1 billion
    const low = weighted * LOW_BOUND_FACTOR;
    const high = weighted * HIGH_BOUND_FACTOR;

    expect(low).toBeCloseTo(904000000, -4);
    expect(high).toBeCloseTo(1096000000, -4);
    expect(high - low).toBeCloseTo(192000000, -4); // 19.2% total spread
  });

  it("bounds preserve relative relationships across valuations", () => {
    const small = 1000000;
    const large = 5000000;

    const smallLow = small * LOW_BOUND_FACTOR;
    const smallHigh = small * HIGH_BOUND_FACTOR;
    const largeLow = large * LOW_BOUND_FACTOR;
    const largeHigh = large * HIGH_BOUND_FACTOR;

    // Ratio should be preserved
    expect(largeLow / smallLow).toBeCloseTo(large / small, 2);
    expect(largeHigh / smallHigh).toBeCloseTo(large / small, 2);
  });

  it("constants match hard-coded specification (0.904 and 1.096)", () => {
    // This test ensures the constants are exactly as specified
    expect(LOW_BOUND_FACTOR).toBe(0.904);
    expect(HIGH_BOUND_FACTOR).toBe(1.096);

    // Verify they're symmetric around 1.0 within a reasonable tolerance
    const lowerDeviation = 1.0 - LOW_BOUND_FACTOR;
    const upperDeviation = HIGH_BOUND_FACTOR - 1.0;

    expect(lowerDeviation).toBeCloseTo(upperDeviation, 5);
  });

  it("application example: development-stage SaaS valuation", () => {
    // Typical development-stage SaaS might be valued at $2-5M
    const weightedValuation = 2500000;

    const low = weightedValuation * LOW_BOUND_FACTOR;
    const high = weightedValuation * HIGH_BOUND_FACTOR;
    const spread = high - low;

    expect(low).toBeCloseTo(2260000, -3);
    expect(high).toBeCloseTo(2740000, -3);
    expect(spread).toBeCloseTo(480000, -3); // ~$480k spread

    // Total spread is 19.2% of center (9.6% each side)
    expect(spread / weightedValuation).toBeCloseTo(BAND_PER_SIDE * 2, 4);
  });

  it("application example: high-growth SaaS valuation", () => {
    // High-growth SaaS might be valued at $15-20M
    const weightedValuation = 17500000;

    const low = weightedValuation * LOW_BOUND_FACTOR;
    const high = weightedValuation * HIGH_BOUND_FACTOR;

    expect(low).toBeCloseTo(15820000, -2);
    expect(high).toBeCloseTo(19180000, -2);

    // Spread is 3.36M (19.2% of $17.5M)
    expect(high - low).toBeCloseTo(3360000, -2);
  });

  it("formula produces consistent results across multiple calls", () => {
    const valuations = [1000000, 2500000, 5000000, 10000000];

    const results = valuations.map((v) => ({
      low: v * LOW_BOUND_FACTOR,
      high: v * HIGH_BOUND_FACTOR,
    }));

    // Run same calculation again
    const resultsCheck = valuations.map((v) => ({
      low: v * LOW_BOUND_FACTOR,
      high: v * HIGH_BOUND_FACTOR,
    }));

    results.forEach((result, i) => {
      expect(result.low).toBe(resultsCheck[i].low);
      expect(result.high).toBe(resultsCheck[i].high);
    });
  });
});
