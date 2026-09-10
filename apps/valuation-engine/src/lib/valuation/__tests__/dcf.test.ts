import { expect, it, describe } from "vitest";
import { computeDcfShared } from "../dcf";
import { FcfeYear } from "../types";

describe("DCF Shared Framework", () => {
  const baselineYears: FcfeYear[] = [
    { yearOffset: 1, fcfe: 100000 },
    { yearOffset: 2, fcfe: 150000 },
    { yearOffset: 3, fcfe: 200000 },
  ];

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
      { yearOffset: 1, fcfe: -100000 }, // Investment year
      { yearOffset: 2, fcfe: 50000 },
      { yearOffset: 3, fcfe: 300000 }, // Strong recovery
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
    const negativeYears: FcfeYear[] = [
      { yearOffset: 1, fcfe: -100000 },
      { yearOffset: 2, fcfe: -50000 },
    ];

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

  it("includes non-operating cash in final valuation", () => {
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

    expect(resultWithNonOp.nonOperatingCash).toBe(nonOpCash);
    expect(resultWithNonOp.valuation).toBeGreaterThan(resultWithoutNonOp.valuation);
    expect(resultWithNonOp.valuation - resultWithoutNonOp.valuation).toBeCloseTo(
      nonOpCash * (1 - 0.25),
      2
    );
  });

  it("handles edge case: single year forecast", () => {
    const singleYear: FcfeYear[] = [{ yearOffset: 1, fcfe: 100000 }];

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

    // Without discounting, cash flows should be sum of actual values
    const rawSum = baselineYears.reduce((sum, y) => sum + y.fcfe, 0);
    expect(result.discountedFcfSum).toBeCloseTo(rawSum, 1);
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

    // With such high discounting, most value should be zeroed
    expect(result.valuation).toBeGreaterThanOrEqual(0);
    expect(result.valuation).toBeLessThan(100000);
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
      { yearOffset: 1, fcfe: 100000 },
      { yearOffset: 2, fcfe: 100000 },
      { yearOffset: 3, fcfe: 100000 },
      { yearOffset: 4, fcfe: 100000 },
      { yearOffset: 5, fcfe: 100000 },
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
      { yearOffset: 1, fcfe: 250000 }, // Year 1 FCFE
      { yearOffset: 2, fcfe: 800000 }, // Year 2 FCFE (growth)
      { yearOffset: 3, fcfe: 1200000 }, // Year 3 FCFE
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
      { yearOffset: 1, fcfe: 100000 },
      { yearOffset: 3, fcfe: 200000 }, // Non-sequential offset
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
