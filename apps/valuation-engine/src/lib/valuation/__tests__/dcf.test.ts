import { expect, it, describe } from "vitest";
import { computeDcfShared } from "../dcf";
import { FcfeYear } from "../types";

describe("DCF Shared Framework", () => {
  const baselineYears: FcfeYear[] = [
    { yearOffset: 1, fcfe: 100000 },
    { yearOffset: 2, fcfe: 150000 },
    { yearOffset: 3, fcfe: 200000 },
  ];

  it("computes valuation with positive cash flows", () => {
    const result = computeDcfShared(baselineYears, 1000000, 0.15, 0.25);
    expect(result.valuation).toBeGreaterThan(0);
    expect(result.discountedFcfSum).toBeGreaterThan(0);
  });

  it("applies survival rates to forecast cash flows", () => {
    const survivalRates = [0.8869, 0.7945, 0.7164];
    const result = computeDcfShared(baselineYears, 1000000, 0.1, 0.0, 0, survivalRates);
    expect(result.discountedFcfSum).toBeLessThan(baselineYears.reduce((sum, y) => sum + y.fcfe, 0));
  });

  it("handles negative cash flows", () => {
    const negativeYears: FcfeYear[] = [
      { yearOffset: 1, fcfe: -100000 },
      { yearOffset: 2, fcfe: 300000 },
    ];
    const result = computeDcfShared(negativeYears, 2000000, 0.15, 0.25);
    expect(result.valuation).toBeGreaterThan(0);
  });

  it("clamps valuation to zero", () => {
    const result = computeDcfShared(baselineYears, 100000, 0.2, 0.5);
    expect(result.valuation).toBeGreaterThanOrEqual(0);
  });

  it("applies illiquidity discount", () => {
    const result1 = computeDcfShared(baselineYears, 1000000, 0.1, 0.0);
    const result2 = computeDcfShared(baselineYears, 1000000, 0.1, 0.25);
    expect(result2.valuation).toBeLessThan(result1.valuation);
  });

  it("includes non-operating cash", () => {
    const result1 = computeDcfShared(baselineYears, 1000000, 0.15, 0.25, 0);
    const result2 = computeDcfShared(baselineYears, 1000000, 0.15, 0.25, 500000);
    expect(result2.valuation).toBeGreaterThan(result1.valuation);
  });

  it("handles single year forecast", () => {
    const singleYear: FcfeYear[] = [{ yearOffset: 1, fcfe: 100000 }];
    const result = computeDcfShared(singleYear, 500000, 0.1, 0.2);
    expect(result.valuation).toBeGreaterThan(0);
  });
});
