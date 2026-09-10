import { expect, it, describe } from "vitest";
import { computeSimpleMultiples, ComparableCompany } from "../simpleMultiples";

describe("Simple Multiples Method", () => {
  it("computes median multiple from odd number of comparables", () => {
    const comparables: ComparableCompany[] = [
      { name: "CompA", metric: 1000000, multiple: 1.0, metricType: "revenue" },
      { name: "CompB", metric: 2000000, multiple: 1.5, metricType: "revenue" },
      { name: "CompC", metric: 3000000, multiple: 2.0, metricType: "revenue" },
    ];

    const result = computeSimpleMultiples(1000000, comparables);

    expect(result.medianMultiple).toBe(1.5); // Middle value
    expect(result.valuation).toBe(1500000); // 1000000 * 1.5
  });

  it("computes median multiple from even number of comparables", () => {
    const comparables: ComparableCompany[] = [
      { name: "CompA", metric: 1000000, multiple: 1.0, metricType: "revenue" },
      { name: "CompB", metric: 2000000, multiple: 2.0, metricType: "revenue" },
    ];

    const result = computeSimpleMultiples(1000000, comparables);

    expect(result.medianMultiple).toBe(1.5); // Average of 1.0 and 2.0
    expect(result.valuation).toBe(1500000);
  });

  it("preserves comparable company information in output", () => {
    const comparables: ComparableCompany[] = [
      {
        name: "PublicCorp",
        metric: 5000000,
        multiple: 2.5,
        metricType: "revenue",
        source: "SEC Filings",
      },
      {
        name: "PrivateCorp",
        metric: 3000000,
        multiple: 2.0,
        metricType: "revenue",
        source: "PitchBook",
      },
    ];

    const result = computeSimpleMultiples(1000000, comparables);

    expect(result.comparables).toHaveLength(2);
    expect(result.comparables[0].name).toBe("PublicCorp");
    expect(result.comparables[0].source).toBe("SEC Filings");
  });

  it("handles single comparable company", () => {
    const comparables: ComparableCompany[] = [
      { name: "OnlyComp", metric: 2000000, multiple: 1.75, metricType: "ebitda" },
    ];

    const result = computeSimpleMultiples(1000000, comparables);

    expect(result.medianMultiple).toBe(1.75);
    expect(result.valuation).toBe(1750000);
  });

  it("handles empty comparables list (returns zero valuation)", () => {
    const result = computeSimpleMultiples(1000000, []);

    expect(result.medianMultiple).toBe(0);
    expect(result.valuation).toBe(0);
    expect(result.comparables).toHaveLength(0);
  });

  it("handles zero last-year metric (zero valuation)", () => {
    const comparables: ComparableCompany[] = [
      { name: "CompA", metric: 1000000, multiple: 2.0, metricType: "revenue" },
    ];

    const result = computeSimpleMultiples(0, comparables);

    expect(result.medianMultiple).toBe(2.0);
    expect(result.valuation).toBe(0);
  });

  it("handles negative last-year metric gracefully", () => {
    const comparables: ComparableCompany[] = [
      { name: "CompA", metric: 1000000, multiple: 1.5, metricType: "revenue" },
    ];

    // Negative metric (e.g., negative revenue from acquisition) should still compute
    const result = computeSimpleMultiples(-500000, comparables);

    expect(result.medianMultiple).toBe(1.5);
    expect(result.valuation).toBe(-750000); // Negative valuation passes through
  });

  it("handles wide range of multiples (low to high outliers)", () => {
    const comparables: ComparableCompany[] = [
      { name: "LowMultiple", metric: 1000000, multiple: 0.5, metricType: "revenue" },
      { name: "HighMultiple", metric: 2000000, multiple: 5.0, metricType: "revenue" },
      { name: "MidMultiple", metric: 1500000, multiple: 1.5, metricType: "revenue" },
    ];

    const result = computeSimpleMultiples(1000000, comparables);

    expect(result.medianMultiple).toBe(1.5); // Median filters out outliers
    expect(result.valuation).toBe(1500000);
  });

  it("sorts multiples correctly before calculating median", () => {
    const comparables: ComparableCompany[] = [
      { name: "Unsorted4", metric: 1000000, multiple: 4.0, metricType: "revenue" },
      { name: "Unsorted1", metric: 1000000, multiple: 1.0, metricType: "revenue" },
      { name: "Unsorted3", metric: 1000000, multiple: 3.0, metricType: "revenue" },
      { name: "Unsorted2", metric: 1000000, multiple: 2.0, metricType: "revenue" },
    ];

    const result = computeSimpleMultiples(2000000, comparables);

    // After sorting: [1.0, 2.0, 3.0, 4.0] → median = (2.0 + 3.0) / 2 = 2.5
    expect(result.medianMultiple).toBe(2.5);
    expect(result.valuation).toBe(5000000); // 2000000 * 2.5
  });

  it("handles EBITDA-based comparables", () => {
    const comparables: ComparableCompany[] = [
      { name: "CompEBITDA1", metric: 500000, multiple: 8.0, metricType: "ebitda" },
      { name: "CompEBITDA2", metric: 750000, multiple: 9.0, metricType: "ebitda" },
      { name: "CompEBITDA3", metric: 600000, multiple: 7.0, metricType: "ebitda" },
    ];

    const result = computeSimpleMultiples(1000000, comparables); // 1M EBITDA

    expect(result.medianMultiple).toBe(8.0);
    expect(result.valuation).toBe(8000000);
  });

  it("applies NovaCloud reference data (median 1.74x revenue multiple)", () => {
    // From claude.md: NovaCloud comparables had median 1.74x
    const novaCloudComparables: ComparableCompany[] = [
      {
        name: "Soluciones Cuatroochenta S.L.",
        metric: 2000000,
        multiple: 1.74,
        metricType: "revenue",
        source: "Equidam Reference",
      },
    ];

    const novaCloudRevenue = 2000000; // Year 0 revenue
    const result = computeSimpleMultiples(novaCloudRevenue, novaCloudComparables);

    expect(result.medianMultiple).toBeCloseTo(1.74, 2);
    expect(result.valuation).toBeCloseTo(3480000, -2); // Should be ~$3.48M
  });

  it("produces realistic valuation for development-stage SaaS (multiple-based)", () => {
    // Development-stage SaaS typically valued at 4-8x revenue
    const saasComparables: ComparableCompany[] = [
      { name: "SaaS1", metric: 1000000, multiple: 5.0, metricType: "revenue" },
      { name: "SaaS2", metric: 1500000, multiple: 4.5, metricType: "revenue" },
      { name: "SaaS3", metric: 2000000, multiple: 6.0, metricType: "revenue" },
    ];

    const companyRevenue = 2000000;
    const result = computeSimpleMultiples(companyRevenue, saasComparables);

    expect(result.medianMultiple).toBe(5.0);
    expect(result.valuation).toBe(10000000);
    expect(result.valuation).toBeGreaterThan(0);
    expect(result.valuation).toBeLessThan(20000000); // Reasonable range
  });

  it("calculates correct median for 4-company set (even number)", () => {
    const comparables: ComparableCompany[] = [
      { name: "Comp1", metric: 1000000, multiple: 1.0, metricType: "revenue" },
      { name: "Comp2", metric: 1500000, multiple: 1.5, metricType: "revenue" },
      { name: "Comp3", metric: 2000000, multiple: 2.0, metricType: "revenue" },
      { name: "Comp4", metric: 2500000, multiple: 2.5, metricType: "revenue" },
    ];

    const result = computeSimpleMultiples(1000000, comparables);

    // Sorted: [1.0, 1.5, 2.0, 2.5] → median = (1.5 + 2.0) / 2 = 1.75
    expect(result.medianMultiple).toBe(1.75);
    expect(result.valuation).toBe(1750000);
  });

  it("handles large number of comparables efficiently", () => {
    // Create 100 comparables with varied multiples
    const comparables: ComparableCompany[] = Array.from({ length: 100 }, (_, i) => ({
      name: `Comp${i}`,
      metric: 1000000,
      multiple: 0.5 + (i * 0.05), // Multiples range from 0.5x to 5.5x
      metricType: "revenue" as const,
    }));

    const result = computeSimpleMultiples(1000000, comparables);

    // Median of 100 values: average of 50th and 51st values (when sorted)
    expect(result.medianMultiple).toBeGreaterThan(0);
    expect(result.valuation).toBeGreaterThan(0);
    expect(Number.isFinite(result.valuation)).toBe(true);
  });
});
