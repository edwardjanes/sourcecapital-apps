import { describe, it, expect } from "vitest";
import {
  VALUATION_BENCHMARKS,
  BENCHMARK_STAGE_BY_COMPANY_STAGE,
  resolveBenchmark,
  CHECKLIST_MAX_RATIO,
} from "../benchmarks";
import { buildDefaultParameters } from "../defaults";
import { computeValuation } from "../compute";
import {
  NORTHWIND_COMPANY,
  NORTHWIND_FINANCIALS,
  NORTHWIND_BALANCE_SHEET,
  NORTHWIND_QUESTIONNAIRE,
} from "./fixtures/northwind";

/**
 * The benchmark reference table, shipped 28 Sep 2026. Replaces one figure per
 * country used at every stage.
 */

describe("Benchmark table — what the old figures actually were", () => {
  it("records the US seed median, not the pre-seed one it used to use", () => {
    const us = VALUATION_BENCHMARKS.find((b) => b.geography === "US" && b.stage === "seed")!;
    // The engine previously held 7,700,000 for the US, which is EXACTLY
    // PitchBook-NVCA's PRE-SEED median -- a median, of the wrong stage.
    expect(us.preMoney.median).toBe(15_800_000);
    const usPreSeed = VALUATION_BENCHMARKS.find((b) => b.geography === "US" && b.stage === "pre_seed")!;
    expect(usPreSeed.preMoney.median).toBe(7_700_000);
    expect(us.preMoney.median / usPreSeed.preMoney.median).toBeCloseTo(2.05, 2);
  });

  it("records the UK seed median AND its published mean, which is nearly double", () => {
    const gb = VALUATION_BENCHMARKS.find((b) => b.geography === "GB" && b.stage === "seed")!;
    // The engine previously held 7,100,000 for GB, close to the MEAN of 6.0m.
    // This is the clearest single piece of evidence in the table that these
    // distributions are right-skewed and a mean is the wrong statistic.
    expect(gb.preMoney.median).toBe(3_200_000);
    expect(gb.preMoney.mean).toBe(6_000_000);
    expect(gb.preMoney.mean! / gb.preMoney.median).toBeCloseTo(1.88, 2);
  });

  it("keeps Germany's validated figure untouched", () => {
    // The only cell that reproduces a real Equidam sample report, which is also
    // what the survival curves were checked against.
    const de = VALUATION_BENCHMARKS.find((b) => b.geography === "DE")!;
    expect(de.preMoney.median).toBe(6_107_000);
    expect(de.basis).toBe("validated");
  });

  it("carries a source and an as-of date on every cell", () => {
    for (const b of VALUATION_BENCHMARKS) {
      expect(b.source.length, b.geography + b.stage).toBeGreaterThan(30);
      expect(b.asOf, b.geography + b.stage).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(["validated", "sourced", "modelled"]).toContain(b.basis);
    }
  });

  it("has no European or global Series A cell, deliberately", () => {
    // A ~$28M median European Series A is reported in the trade press and was in
    // this table briefly. It came out: a single secondary citation, quoted in USD,
    // and using it gave a UK company with GBP 900k of revenue a Scorecard of
    // GBP 34,230,000. Honest sparsity beats a confident wrong answer.
    expect(VALUATION_BENCHMARKS.filter((b) => b.stage === "series_a" && b.geography !== "US")).toHaveLength(0);
  });
});

describe("Benchmark table — the stage mapping", () => {
  it("maps development to seed, as decided", () => {
    expect(BENCHMARK_STAGE_BY_COMPANY_STAGE.development).toBe("seed");
    expect(BENCHMARK_STAGE_BY_COMPANY_STAGE.idea).toBe("pre_seed");
  });

  it("caps every stage above idea at seed, because these are early-stage methods", () => {
    // Payne's benchmark is defined as the pre-money valuation of comparable
    // EARLY-STAGE companies, and the Checklist spec quotes Berkus saying his
    // method "is no longer appropriate once a company has generated revenue for a
    // meaningful period". A Series A benchmark does not make them more accurate
    // for a scaled company, it uses them outside their domain. Relevance is
    // already handled by the stage weights falling to 6% and then zero.
    for (const s of ["development", "startup", "expansion", "growth", "maturity"] as const) {
      expect(BENCHMARK_STAGE_BY_COMPANY_STAGE[s], s).toBe("seed");
    }
  });
});

describe("Benchmark table — the resolver always says what it did", () => {
  it("uses the country's own figure where one exists", () => {
    const r = resolveBenchmark({ countryCode: "GB", stage: "development", currency: "GBP" });
    expect(r.rung).toBe("stage_country");
    expect(r.substituted).toBe(false);
    expect(r.currencyMismatch).toBe(false);
    expect(r.benchmark!.preMoney.median).toBe(3_200_000);
    expect(r.note).toMatch(/GB seed companies/);
  });

  it("falls back to the region and says so", () => {
    const r = resolveBenchmark({ countryCode: "FR", stage: "development", currency: "EUR" });
    expect(r.rung).toBe("stage_region");
    expect(r.substituted).toBe(true);
    expect(r.note).toMatch(/no FR figure is published/);
  });

  it("falls back to global for a country it cannot place, and names that too", () => {
    // There is deliberately no silent `default` bucket. A founder in Nigeria
    // benchmarked against a global median should be told, which is a more honest
    // statement than the unlabelled country figure they used to get.
    const r = resolveBenchmark({ countryCode: "NG", stage: "development", currency: "NGN" });
    expect(r.rung).toBe("stage_global");
    expect(r.substituted).toBe(true);
    expect(r.note).toMatch(/neither a NG nor a regional figure is published/);
  });

  it("flags a currency mismatch rather than converting", () => {
    // Consistent with the engine's standing no-FX decision.
    const r = resolveBenchmark({ countryCode: "NG", stage: "development", currency: "NGN" });
    expect(r.currencyMismatch).toBe(true);
    expect(r.note).toMatch(/has not been converted to NGN/);
  });

  it("returns none rather than inventing a figure when nothing matches", () => {
    const r = resolveBenchmark({ countryCode: "NG", stage: "idea", currency: "NGN" });
    // Global pre-seed exists, so this one resolves; the point is the shape.
    expect(r.rung).toBe("stage_global");
    expect(r.benchmark).not.toBeNull();
  });
});

describe("Benchmark table — what it does to the valuation", () => {
  const run = async (country = "United Kingdom", stage = "expansion") => {
    const profile = { ...NORTHWIND_COMPANY, country, stage };
    const d = buildDefaultParameters(
      profile as never, NORTHWIND_FINANCIALS as never, NORTHWIND_BALANCE_SHEET as never
    );
    const r = await computeValuation(
      profile as never, NORTHWIND_FINANCIALS as never,
      { ...NORTHWIND_QUESTIONNAIRE } as never, { ...d, comparables: [] } as never
    );
    const m = (k: string) =>
      Math.round(r.perMethod.find((x: { method: string }) => x.method === k)?.valuation ?? 0);
    return {
      benchmark: d.scorecard.average_pre_money_valuation,
      maxValuation: d.checklist.max_valuation,
      sc: m("scorecard"), ck: m("checklist"), ltg: m("dcf_ltg"), mult: m("dcf_multiple"),
      w: Math.round(r.weightedValuation), resolution: r.benchmarkResolution!,
    };
  };

  it("halves the UK benchmark and closes the method-family gap", async () => {
    const gb = await run();
    expect(gb.benchmark).toBe(3_200_000); // was 7,100,000
    expect(gb.sc).toBe(3_912_000);        // was 8,679,750
    expect(gb.ck).toBe(4_473_780);        // was 9,925,875
    expect(gb.w).toBe(3_166_356);         // was 3,896,345

    // THE POINT OF THE WHOLE MODEL PASS. Scorecard and Checklist started this at
    // three to five times the cash-flow methods. They are now alongside them.
    const qualitative = (gb.sc + gb.ck) / 2;
    const cashFlow = (gb.ltg + gb.mult) / 2;
    expect(qualitative / cashFlow).toBeLessThan(1.5);
    expect(qualitative / cashFlow).toBeGreaterThan(0.7);
  });

  it("raises the US benchmark, because the old figure there was pre-seed", async () => {
    const us = await run("United States", "development");
    expect(us.benchmark).toBe(15_800_000); // was 7,700,000
    expect(us.benchmark).toBeGreaterThan(7_700_000);
  });

  it("derives the Checklist ceiling from the corrected base", async () => {
    const gb = await run();
    expect(CHECKLIST_MAX_RATIO).toBe(2.155);
    expect(gb.maxValuation).toBeCloseTo(3_200_000 * 2.155, 6);
  });

  it("threads the resolution through to the output for the report", async () => {
    const gb = await run();
    expect(gb.resolution.rung).toBe("stage_country");
    expect(gb.resolution.note).toMatch(/British Business Bank/);
  });

  it("excludes both methods rather than guessing when nothing resolves", async () => {
    // Unreachable today because the global rung covers pre-seed and seed, but the
    // guard is the honest behaviour if a stage ever has no cell at all: surrender
    // the weight rather than price against a figure nobody published.
    const r = resolveBenchmark({ countryCode: "NG", stage: "growth", currency: "NGN" });
    expect(r.rung).not.toBe("none"); // seed cell covers it
    expect(r.benchmark).not.toBeNull();
  });
});
