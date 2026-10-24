import { describe, it, expect } from "vitest";
import { computeSensitivity } from "../sensitivity";
import { buildDefaultParameters } from "../defaults";
import {
  NORTHWIND_COMPANY,
  NORTHWIND_FINANCIALS,
  NORTHWIND_BALANCE_SHEET,
  NORTHWIND_QUESTIONNAIRE,
} from "./fixtures/northwind";

/**
 * Sensitivity ranges, shipped 28 Sep 2026. Closes the one gap all six audits
 * shared: every method spec asks for a range and the engine reported a point
 * estimate with a fixed +/-9.6% band.
 */

const run = async (stage = "expansion") => {
  const profile = { ...NORTHWIND_COMPANY, stage };
  const d = buildDefaultParameters(
    profile as never, NORTHWIND_FINANCIALS as never, NORTHWIND_BALANCE_SHEET as never
  );
  return computeSensitivity({
    profile: profile as never,
    financials: NORTHWIND_FINANCIALS as never,
    questionnaire: { ...NORTHWIND_QUESTIONNAIRE } as never,
    parameters: { ...d, comparables: [] } as never,
  });
};

describe("Sensitivity — the drivers", () => {
  it("reproduces the locked baseline as its base case", async () => {
    const s = await run();
    expect(Math.round(s.baseValuation)).toBe(3_166_356);
  });

  it("sorts drivers by impact, so the report leads with what matters", async () => {
    const s = await run();
    const moved = s.drivers.filter((d) => d.impact !== null).map((d) => d.impact as number);
    expect(moved.length).toBeGreaterThanOrEqual(4);
    for (let i = 1; i < moved.length; i++) expect(moved[i]).toBeLessThanOrEqual(moved[i - 1]);
    // At expansion the discount rate leads, at 18.1%.
    expect(s.drivers[0].key).toBe("size_premium");
    expect(s.drivers[0].impact).toBeCloseTo(0.223, 3);
  });

  it("labels each range by where it came from", async () => {
    const s = await run();
    const byKey = Object.fromEntries(s.drivers.map((d) => [d.key, d]));
    // Two are genuinely sourced: Kroll's decile figures and Sahlman's stage ranges.
    expect(byKey.size_premium.basis).toBe("sourced");
    expect(byKey.size_premium.source).toMatch(/Kroll/);
    expect(byKey.vc_required_roi.basis).toBe("sourced");
    expect(byKey.vc_required_roi.source).toMatch(/Sahlman/);
    // Two are the engine's own documented positions, not observations.
    expect(byKey.small_company_multiple_factor.basis).toBe("modelled");
    expect(byKey.terminal_growth_rate.basis).toBe("modelled");
  });

  it("assigns low and high by the RESULT, never by assuming a direction", async () => {
    // The bug this guards against, found while building it. At expansion the VC
    // hurdle's FAVOURABLE end (35%, the bottom of Sahlman's range) raises the VC
    // value enough to clear its hurdle -- so the method stops being excluded, and
    // since VC is the lowest of the five, INCLUDING it lowers the composite. The
    // favourable driver end produced the adverse answer.
    const s = await run();
    const vc = s.drivers.find((d) => d.key === "vc_required_roi")!;
    expect(vc.low!.weightedValuation).toBeLessThan(vc.high!.weightedValuation);
    // The low end of the ANSWER comes from the low end of the DRIVER here.
    expect(vc.low!.value).toBeCloseTo(0.35, 10);
    expect(Math.round(vc.low!.weightedValuation)).toBe(2_764_717);
    // And the high end is simply the base, because a higher hurdle leaves the
    // method excluded and changes nothing.
    expect(Math.round(vc.high!.weightedValuation)).toBe(Math.round(s.baseValuation));

    // Every driver must satisfy low <= high by construction.
    for (const d of s.drivers.filter((x) => x.impact !== null)) {
      expect(d.low!.weightedValuation, d.key).toBeLessThanOrEqual(d.high!.weightedValuation);
    }
  });

  it("produces a range wider than the arbitrary band it replaces, at expansion", async () => {
    const s = await run();
    expect(Math.round(s.lowBound)).toBe(2_459_856);
    expect(Math.round(s.highBound)).toBe(3_843_405);
    // -22.3% / +20.7%, against a fixed -9.6% / +9.6%.
    expect(s.lowBound / s.baseValuation - 1).toBeCloseTo(-0.223, 3);
    expect(s.highBound / s.baseValuation - 1).toBeCloseTo(0.214, 3);
    expect(s.lowBound).toBeLessThan(s.baseValuation * 0.904);
    expect(s.highBound).toBeGreaterThan(s.baseValuation * 1.096);
  });

  it("bounds the base case, so the range always contains the answer", async () => {
    const s = await run();
    expect(s.lowBound).toBeLessThanOrEqual(s.baseValuation);
    expect(s.highBound).toBeGreaterThanOrEqual(s.baseValuation);
  });
});

describe("Sensitivity — the gap that has now been closed", () => {
  it("varies the benchmark, which it could not do before the reference table", async () => {
    const s = await run();
    const bm = s.drivers.find((d) => d.key === "benchmark_pre_money")!;
    // Was `unavailable` with null endpoints: no source published quartiles, so
    // there was nothing to move. The quartiles are now derived from the one cell
    // that publishes both a median and a mean -- honestly `modelled`, not sourced.
    expect(bm.basis).toBe("modelled");
    expect(bm.low).not.toBeNull();
    expect(bm.high).not.toBeNull();
    expect(bm.source).toMatch(/lognormal|derived/i);
  });

  it("reports full coverage and drops the understated flag", async () => {
    const s = await run();
    expect(s.coverage).toBe(1);
    expect(s.understated).toBe(false);
    expect(s.gaps).toHaveLength(0);
  });

  it("makes the benchmark the top driver at development, where it carries 60%", async () => {
    // It inverts the expansion ordering. At development Scorecard and Checklist
    // carry 30% each, so the benchmark dominates everything else by a distance;
    // at expansion they are 6% each and the discount rate leads instead.
    const s = await run("development");
    expect(s.drivers[0].key).toBe("benchmark_pre_money");
    expect(s.drivers[0].impact).toBeCloseTo(0.879, 3);
    expect(s.coverage).toBe(1);
  });

  it("is honestly wide at development rather than reassuringly narrow", async () => {
    // -41.3% / +87.9% against the flat +/-9.6% it replaces. That is not a
    // regression: 60% of a development-stage valuation rests on a benchmark whose
    // interquartile range spans 4.5x, and saying so is the point.
    const s = await run("development");
    expect(s.lowBound / s.baseValuation - 1).toBeCloseTo(-0.413, 3);
    expect(s.highBound / s.baseValuation - 1).toBeCloseTo(0.879, 3);
    expect(s.lowBound).toBeLessThan(s.baseValuation * 0.904);
    expect(s.highBound).toBeGreaterThan(s.baseValuation * 1.096);
  });

  it("still reports the benchmark as unavailable where it carries no weight", async () => {
    // At growth and maturity Scorecard and Checklist are weighted zero, so the
    // benchmark genuinely does not affect the answer and is reported that way
    // rather than being varied pointlessly.
    const s = await run("growth");
    const bm = s.drivers.find((d) => d.key === "benchmark_pre_money")!;
    expect(bm.basis).toBe("unavailable");
    expect(bm.impact).toBeNull();
    // And that is not an understatement, because it moves nothing.
    expect(s.understated).toBe(false);
  });
});
