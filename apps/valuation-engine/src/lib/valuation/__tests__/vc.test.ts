import { expect, it, describe } from "vitest";
import { computeVcMethod } from "../vc";

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
    const capitalRaised = 1500000; // Prior funding

    const result = computeVcMethod(
      terminalYearMetricValue,
      industryMultiple,
      requiredRoi,
      projectionYears,
      capitalRaised
    );

    expect(result.valuation).toBeGreaterThan(0);
    expect(result.valuation).toBeLessThan(10000000); // Reasonable range
  });
});
