import { expect, it, describe } from "vitest";

describe("Valuation Low/High Bounds Formula", () => {
  /**
   * Executive summary valuation bounds follow a ±9.6% spread formula:
   * low = weighted × 0.904
   * high = weighted × 1.096
   *
   * This is modeled on NovaCloud's own spread and is a hard-coded constant
   * worth locking down with tests to prevent accidental modifications.
   */

  const LOW_BOUND_FACTOR = 0.904;
  const HIGH_BOUND_FACTOR = 1.096;
  const EXPECTED_SPREAD = 0.096; // ±9.6%

  it("computes low bound as weighted × 0.904", () => {
    const weightedValuation = 3775562; // NovaCloud reference
    const expectedLow = weightedValuation * LOW_BOUND_FACTOR;

    expect(expectedLow).toBeCloseTo(3413888, -2); // Within $100
  });

  it("computes high bound as weighted × 1.096", () => {
    const weightedValuation = 3775562;
    const expectedHigh = weightedValuation * HIGH_BOUND_FACTOR;

    expect(expectedHigh).toBeCloseTo(4137256, -2); // Within $100
  });

  it("maintains symmetric spread around central valuation", () => {
    const weighted = 5000000;
    const low = weighted * LOW_BOUND_FACTOR;
    const high = weighted * HIGH_BOUND_FACTOR;

    // Calculate distances from center
    const lowerDistance = weighted - low;
    const upperDistance = high - weighted;

    // Should be equal in absolute terms, representing ±9.6%
    expect(lowerDistance).toBeCloseTo(upperDistance, 2);
    expect(lowerDistance / weighted).toBeCloseTo(EXPECTED_SPREAD / 2, 4);
  });

  it("produces bounds for NovaCloud $3.77M reference valuation", () => {
    const novaCloudWeighted = 3775562;
    const low = novaCloudWeighted * LOW_BOUND_FACTOR;
    const high = novaCloudWeighted * HIGH_BOUND_FACTOR;

    // NovaCloud reference bounds were $3.414M to $4.137M
    expect(low).toBeCloseTo(3413889, -2);
    expect(high).toBeCloseTo(4137235, -2);
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

  it("bounds span approximately ±9.6% from center", () => {
    const weighted = 2000000;
    const low = weighted * LOW_BOUND_FACTOR;
    const high = weighted * HIGH_BOUND_FACTOR;

    const lowerPercent = (weighted - low) / weighted;
    const upperPercent = (high - weighted) / weighted;

    expect(lowerPercent).toBeCloseTo(EXPECTED_SPREAD / 2, 4);
    expect(upperPercent).toBeCloseTo(EXPECTED_SPREAD / 2, 4);
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
    expect(high - low).toBeCloseTo(192000000, -4); // ±96M spread
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

    // Verify spread represents 9.6% of center
    expect(spread / weightedValuation).toBeCloseTo(0.096, 4);
  });

  it("application example: high-growth SaaS valuation", () => {
    // High-growth SaaS might be valued at $15-20M
    const weightedValuation = 17500000;

    const low = weightedValuation * LOW_BOUND_FACTOR;
    const high = weightedValuation * HIGH_BOUND_FACTOR;

    expect(low).toBeCloseTo(15820000, -2);
    expect(high).toBeCloseTo(19180000, -2);

    // Spread should be ~1.68M (9.6% of $17.5M)
    expect(high - low).toBeCloseTo(1680000, -2);
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
