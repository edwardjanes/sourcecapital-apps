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

// ---------------------------------------------------------------------------
// AUDIT-06 — Simple Multiples. Spec: "Simple Multiples Valuation Method.md" in
// raise-hq-portal's claude/valuation methods/. Last of the six.
//
// The 14 tests above all establish that the median arithmetic is correct. It is.
// These cover what the method does with that median, and what reaches it.
// ---------------------------------------------------------------------------

describe("Simple Multiples — enterprise value reported as equity value", () => {
  it("returns the raw product with no bridge of any kind", () => {
    // The spec's core equations are two steps, not one:
    //   EV      = Revenue x Median(EV/Revenue)
    //   Equity  = EV + Excess Cash + Nonoperating Assets - Debt - Preferred
    //             - Minority Interest - Other Senior Claims
    // and it devotes a whole section to the bridge. We stop at the first line
    // and label the result a valuation.
    //
    // This is less ambiguous than the DCF-multiple version of the same finding:
    // there is no cash-flow stream here to muddy which claim is being valued.
    // An EV/Revenue multiple produces enterprise value, full stop.
    const result = computeSimpleMultiples(900_000, [
      { name: "A", metric: 0, multiple: 6.5, metricType: "revenue" },
      { name: "B", metric: 0, multiple: 7.2, metricType: "revenue" },
    ]);
    expect(result.valuation).toBe(900_000 * 6.85);
    // Nothing in the signature can carry debt, cash or senior claims.
    expect(computeSimpleMultiples.length).toBe(2);
  });
});

describe("Simple Multiples — metricType is decoration", () => {
  it("produces an identical result whichever metric the comparables describe", () => {
    // `metricType` is captured on every comparable, echoed into the output, and
    // never read by the calculation -- only `multiple` is. So a set of EV/EBITDA
    // multiples and a set of EV/Revenue multiples with the same numbers give the
    // same answer against the same subject metric.
    const asRevenue = computeSimpleMultiples(900_000, [
      { name: "A", metric: 0, multiple: 8.0, metricType: "revenue" },
    ]);
    const asEbitda = computeSimpleMultiples(900_000, [
      { name: "A", metric: 0, multiple: 8.0, metricType: "ebitda" },
    ]);
    expect(asEbitda.valuation).toBe(asRevenue.valuation);
    expect(asEbitda.medianMultiple).toBe(asRevenue.medianMultiple);
  });

  it("will median a revenue multiple together with an EBITDA one", () => {
    // The spec: "Do not pair enterprise value with net income or market
    // capitalization with EBITDA. The numerator and denominator must represent
    // the same capital-provider claim", and "The same period and definition must
    // be used in both the peer multiple and subject metric."
    //
    // Nothing stops a mixed set. 6.5x revenue and 8.0x EBITDA average to 7.25x
    // and get applied to whatever the caller passed.
    const mixed = computeSimpleMultiples(900_000, [
      { name: "RevComp", metric: 0, multiple: 6.5, metricType: "revenue" },
      { name: "EbitdaComp", metric: 0, multiple: 8.0, metricType: "ebitda" },
    ]);
    expect(mixed.medianMultiple).toBe(7.25);
    expect(mixed.valuation).toBe(6_525_000);
  });

  it("is always fed revenue by the production caller, whatever the comparables say", async () => {
    // defaults.ts hardcodes both halves:
    //   last_year_metric: lastYearRevenue
    //   metric_type: 'revenue'
    // and `metric_type` is then never read by computeSimpleMultiples at all.
    // Meanwhile the compute route's own input type accepts
    // `metricType?: 'revenue' | 'ebitda'` and the standalone wizard's
    // ComparablesStep offers a dropdown with both. So an EBITDA multiple can be
    // entered, and it will be applied to revenue.
    const { buildDefaultParameters } = await import("../defaults");
    const f = await import("./fixtures/northwind");
    const d = buildDefaultParameters(
      f.NORTHWIND_COMPANY as never, f.NORTHWIND_FINANCIALS as never, f.NORTHWIND_BALANCE_SHEET as never
    );
    expect(d.simple_multiples.metric_type).toBe("revenue");
    expect(d.simple_multiples.last_year_metric).toBe(900_000); // last ACTUAL revenue
    // Northwind's year-5 EBITDA, for contrast -- what an EBITDA multiple wants.
    expect(8_200_000 - 1_804_000 - 2_950_000 - 1_380_000).toBe(2_066_000);
  });
});

describe("Simple Multiples — a median of one is not a median", () => {
  it("accepts a single comparable and calls it the median", () => {
    // No minimum peer count, no outlier handling, no range. The spec has
    // sections on Comparable Selection, a peer hierarchy, "When the median may
    // be wrong", "Better selection methods" and Sensitivity Analysis.
    //
    // MEASURED against production 27 Sep 2026: of the 11 snapshots carrying
    // comparables, 5 carry exactly ONE, all of them the same 5.2x.
    const one = computeSimpleMultiples(900_000, [
      { name: "Solo", metric: 0, multiple: 5.2, metricType: "revenue" },
    ]);
    expect(one.medianMultiple).toBe(5.2);
    expect(one.comparables.length).toBe(1);
    // And the output carries nothing to say the sample size was one.
    expect(Object.keys(one).sort()).toEqual(["comparables", "medianMultiple", "valuation"]);
  });

  it("returns a silent zero when the subject metric is zero", () => {
    // Not a hypothetical: 5 of the 11 production snapshots WITH comparables
    // still reported multiples = 0, because those companies' last actual revenue
    // was 0. A supplied peer set and a zero answer, with nothing distinguishing
    // that from "no comparables given".
    const noMetric = computeSimpleMultiples(0, [
      { name: "A", metric: 0, multiple: 5.2, metricType: "revenue" },
    ]);
    const noComps = computeSimpleMultiples(900_000, []);
    expect(noMetric.valuation).toBe(0);
    expect(noComps.valuation).toBe(0);
    // Only medianMultiple distinguishes them, and nothing downstream reads it.
    expect(noMetric.medianMultiple).toBe(5.2);
    expect(noComps.medianMultiple).toBe(0);
  });
});

describe("Simple Multiples — inert from the portal, and its own evidence against INDUSTRIES", () => {
  it("carries zero weight at every stage", async () => {
    const { STAGE_DEFAULT_WEIGHTS } = await import("../referenceData");
    // So by default the method cannot affect any valuation, whatever it returns.
    // One production snapshot overrode this to 0.1 via the route's `weights`
    // parameter, contributing 294,000 to a 4,984,544 result -- so the path is
    // live, just off by default.
    for (const stage of Object.keys(STAGE_DEFAULT_WEIGHTS) as Array<keyof typeof STAGE_DEFAULT_WEIGHTS>) {
      expect(STAGE_DEFAULT_WEIGHTS[stage].multiples).toBe(0);
    }
  });

  it("is doubly unreachable from the Raise HQ portal", () => {
    // Valuation.jsx sends `comparables: null` AND `weights: null`, so from the
    // actual client-facing product this method has no peers to median and no
    // weight to apply even if it did. It is fully built, has 14 tests and a UI
    // in the standalone app, and can never contribute a pound from the portal.
    //
    // Recorded as an assertion on the shape rather than the portal source, which
    // lives in the other repo: both nulls normalise to the inert case.
    expect(computeSimpleMultiples(900_000, []).valuation).toBe(0);
  });

  it("carried the evidence that INDUSTRIES.revenueMultiple was wrong, and it has been fixed", async () => {
    // The multiples users actually typed into the wizard, read from
    // valuation_snapshots on 27 Sep 2026 across all 11 snapshots with
    // comparables: median 6.0x revenue, against a table then saying 1.04x.
    const supplied = [4.1, 4.8, 5.2, 5.5, 6.0, 6.5, 7.2, 8.4, 10.9];
    const median = supplied[Math.floor(supplied.length / 2)];
    expect(median).toBe(6.0);

    const { INDUSTRIES } = await import("../referenceData");
    // Re-sourced the same day to 3.19x (Damodaran EV/Sales, January 2026, scaled
    // by the small-company factor). The gap to what users entered closes from
    // 5.8x to 1.9x, and is no longer a contradiction so much as the expected
    // difference between an ENTRY multiple for a growing company and an EXIT
    // multiple for that company five years further on -- which is exactly the
    // substitution the DCF-EM spec warns against making.
    expect(INDUSTRIES.SaaS.revenueMultiple).toBeCloseTo(3.19, 2);
    expect(median / INDUSTRIES.SaaS.revenueMultiple).toBeCloseTo(1.88, 2);

    // The lowest peer anyone entered used to be 3.9x the table's figure. Now it is
    // within 30%.
    expect(Math.min(...supplied) / INDUSTRIES.SaaS.revenueMultiple).toBeCloseTo(1.29, 2);
  });

  it("no longer contradicts this repo's own test comment about SaaS multiples", async () => {
    // A test in this very file says "Development-stage SaaS typically valued at
    // 4-8x revenue" while the table said 1.04x. 3.19x is below that band rather
    // than an order of magnitude away from it -- correctly, because that comment
    // describes development-stage ENTRY pricing and this is an exit multiple.
    const { INDUSTRIES } = await import("../referenceData");
    expect(INDUSTRIES.SaaS.revenueMultiple).toBeGreaterThan(1.04 * 2.5);
    expect(INDUSTRIES.SaaS.revenueMultiple).toBeLessThan(4);
  });
});
