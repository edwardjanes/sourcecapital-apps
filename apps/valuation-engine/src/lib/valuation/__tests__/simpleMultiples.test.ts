import { expect, it, describe } from "vitest";
import { computeSimpleMultiples, ComparableCompany } from "../simpleMultiples";

describe("Simple Multiples Method", () => {
  it("computes median multiple (odd count)", () => {
    const comparables: ComparableCompany[] = [
      { name: "A", metric: 1000000, multiple: 1.0, metricType: "revenue" },
      { name: "B", metric: 2000000, multiple: 1.5, metricType: "revenue" },
      { name: "C", metric: 3000000, multiple: 2.0, metricType: "revenue" },
    ];
    const result = computeSimpleMultiples(1000000, comparables);
    expect(result.medianMultiple).toBe(1.5);
    expect(result.valuation).toBe(1500000);
  });

  it("computes median multiple (even count)", () => {
    const comparables: ComparableCompany[] = [
      { name: "A", metric: 1000000, multiple: 1.0, metricType: "revenue" },
      { name: "B", metric: 2000000, multiple: 2.0, metricType: "revenue" },
    ];
    const result = computeSimpleMultiples(1000000, comparables);
    expect(result.medianMultiple).toBe(1.5);
    expect(result.valuation).toBe(1500000);
  });

  it("handles empty comparables list", () => {
    const result = computeSimpleMultiples(1000000, []);
    expect(result.medianMultiple).toBe(0);
    expect(result.valuation).toBe(0);
  });

  it("handles zero metric", () => {
    const comparables: ComparableCompany[] = [
      { name: "A", metric: 1000000, multiple: 2.0, metricType: "revenue" },
    ];
    const result = computeSimpleMultiples(0, comparables);
    expect(result.medianMultiple).toBe(2.0);
    expect(result.valuation).toBe(0);
  });

  it("sorts multiples before calculating median", () => {
    const comparables: ComparableCompany[] = [
      { name: "D", metric: 1000000, multiple: 4.0, metricType: "revenue" },
      { name: "A", metric: 1000000, multiple: 1.0, metricType: "revenue" },
      { name: "C", metric: 1000000, multiple: 3.0, metricType: "revenue" },
      { name: "B", metric: 1000000, multiple: 2.0, metricType: "revenue" },
    ];
    const result = computeSimpleMultiples(2000000, comparables);
    expect(result.medianMultiple).toBe(2.5);
    expect(result.valuation).toBe(5000000);
  });

  it("handles single comparable", () => {
    const comparables: ComparableCompany[] = [
      { name: "A", metric: 2000000, multiple: 1.75, metricType: "ebitda" },
    ];
    const result = computeSimpleMultiples(1000000, comparables);
    expect(result.medianMultiple).toBe(1.75);
    expect(result.valuation).toBe(1750000);
  });
});
