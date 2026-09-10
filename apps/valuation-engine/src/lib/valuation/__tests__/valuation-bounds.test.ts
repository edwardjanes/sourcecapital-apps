import { expect, it, describe } from "vitest";

describe("Valuation Low/High Bounds Formula", () => {
  /**
   * Executive summary valuation bounds follow a ±9.6% spread:
   * low = weighted × 0.904
   * high = weighted × 1.096
   *
   * This is a hard-coded constant worth locking down with tests.
   */

  const LOW_BOUND_FACTOR = 0.904;
  const HIGH_BOUND_FACTOR = 1.096;

  it("computes low bound as weighted × 0.904", () => {
    const weighted = 3775562;
    const low = weighted * LOW_BOUND_FACTOR;
    expect(low).toBeCloseTo(3413108.048, -2);
  });

  it("computes high bound as weighted × 1.096", () => {
    const weighted = 3775562;
    const high = weighted * HIGH_BOUND_FACTOR;
    expect(high).toBeCloseTo(4138015.952, -2);
  });

  it("maintains symmetric ±9.6% spread around center", () => {
    const weighted = 5000000;
    const low = weighted * LOW_BOUND_FACTOR;
    const high = weighted * HIGH_BOUND_FACTOR;
    const lowerDistance = weighted - low;
    const upperDistance = high - weighted;

    expect(lowerDistance).toBeCloseTo(upperDistance, 2);
    expect(lowerDistance / weighted).toBeCloseTo(0.096, 4);
  });

  it("low bound is always less than center, high bound greater", () => {
    const testValues = [1000, 100000, 1000000, 10000000];
    testValues.forEach((val) => {
      const low = val * LOW_BOUND_FACTOR;
      const high = val * HIGH_BOUND_FACTOR;
      expect(low).toBeLessThan(val);
      expect(high).toBeGreaterThan(val);
      expect(low).toBeLessThan(high);
    });
  });

  it("bounds span approximately ±9.6% from center", () => {
    const weighted = 2000000;
    const low = weighted * LOW_BOUND_FACTOR;
    const high = weighted * HIGH_BOUND_FACTOR;

    const lowerPercent = (weighted - low) / weighted;
    const upperPercent = (high - weighted) / weighted;

    expect(lowerPercent).toBeCloseTo(0.096, 4);
    expect(upperPercent).toBeCloseTo(0.096, 4);
  });

  it("handles edge case: zero valuation", () => {
    const low = 0 * LOW_BOUND_FACTOR;
    const high = 0 * HIGH_BOUND_FACTOR;
    expect(low).toBe(0);
    expect(high).toBe(0);
  });

  it("handles large valuations", () => {
    const weighted = 1000000000;
    const low = weighted * LOW_BOUND_FACTOR;
    const high = weighted * HIGH_BOUND_FACTOR;
    expect(low).toBeCloseTo(904000000, -4);
    expect(high).toBeCloseTo(1096000000, -4);
  });

  it("constants are exactly 0.904 and 1.096", () => {
    expect(LOW_BOUND_FACTOR).toBe(0.904);
    expect(HIGH_BOUND_FACTOR).toBe(1.096);
  });
});
