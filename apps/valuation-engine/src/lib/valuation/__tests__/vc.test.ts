import { expect, it, describe } from "vitest";
import { computeVcMethod } from "../vc";

describe("VC Method", () => {
  it("computes exit value with discount factor", () => {
    const terminalMetric = 2000000;
    const multiple = 1.5;
    const roi = 0.5;
    const years = 5;
    const result = computeVcMethod(terminalMetric, multiple, roi, years);

    expect(result.exitValue).toBe(3000000);
    expect(result.discountFactor).toBeCloseTo(1 / Math.pow(1.5, 5), 6);
    expect(result.valuation).toBeGreaterThan(0);
  });

  it("clamps negative valuations to zero", () => {
    const result = computeVcMethod(100000, 0.5, 2.0, 10);
    expect(result.valuation).toBeGreaterThanOrEqual(0);
  });

  it("accounts for capital raised", () => {
    const result = computeVcMethod(5000000, 2.0, 0.4, 3, 1000000);
    expect(result.valuation).toBeLessThanOrEqual(result.discountedExitValue);
  });

  it("handles zero terminal value", () => {
    const result = computeVcMethod(0, 2.0, 0.5, 5);
    expect(result.exitValue).toBe(0);
    expect(result.valuation).toBe(0);
  });
});
