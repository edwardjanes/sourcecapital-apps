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
    expect(Math.round(s.baseValuation)).toBe(3_896_345);
  });

  it("sorts drivers by impact, so the report leads with what matters", async () => {
    const s = await run();
    const moved = s.drivers.filter((d) => d.impact !== null).map((d) => d.impact as number);
    expect(moved.length).toBeGreaterThanOrEqual(4);
    for (let i = 1; i < moved.length; i++) expect(moved[i]).toBeLessThanOrEqual(moved[i - 1]);
    // At expansion the discount rate leads, at 18.1%.
    expect(s.drivers[0].key).toBe("size_premium");
    expect(s.drivers[0].impact).toBeCloseTo(0.181, 3);
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
    expect(Math.round(vc.low!.weightedValuation)).toBe(3_377_907);
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
    expect(Math.round(s.lowBound)).toBe(3_189_845);
    expect(Math.round(s.highBound)).toBe(4_436_258);
    // -18.1% / +13.9%, against a fixed -9.6% / +9.6%.
    expect(s.lowBound / s.baseValuation - 1).toBeCloseTo(-0.181, 3);
    expect(s.highBound / s.baseValuation - 1).toBeCloseTo(0.139, 3);
    expect(s.lowBound).toBeLessThan(s.baseValuation * 0.904);
    expect(s.highBound).toBeGreaterThan(s.baseValuation * 1.096);
  });

  it("bounds the base case, so the range always contains the answer", async () => {
    const s = await run();
    expect(s.lowBound).toBeLessThanOrEqual(s.baseValuation);
    expect(s.highBound).toBeGreaterThanOrEqual(s.baseValuation);
  });
});

describe("Sensitivity — the gap it must not hide", () => {
  it("reports the benchmark as unavailable rather than inventing a range", async () => {
    const s = await run();
    const bm = s.drivers.find((d) => d.key === "benchmark_pre_money")!;
    expect(bm.basis).toBe("unavailable");
    expect(bm.low).toBeNull();
    expect(bm.high).toBeNull();
    expect(bm.impact).toBeNull();
    // Scorecard multiplies it and Checklist takes a fraction of a ceiling derived
    // from it. There is no distribution until the benchmark reference table lands.
    expect(bm.source).toMatch(/z8mad3quyr/);
    expect(s.gaps.length).toBe(1);
  });

  it("flags the band as understated, because a partial range is worse than none", async () => {
    const s = await run();
    expect(s.understated).toBe(true);
    // At expansion the benchmark drives only 14.3% of the weight, so the band is
    // most of the story.
    expect(s.coverage).toBeCloseTo(0.857, 3);
  });

  it("goes NARROWER than the arbitrary band at development, which is the trap", async () => {
    // The reason `understated` exists. At development, Scorecard and Checklist
    // carry ~71% of the weight between them and the benchmark cannot be varied at
    // all, so coverage collapses and the computed band is mostly silence.
    const s = await run("development");
    expect(s.coverage).toBeCloseTo(0.286, 3);
    expect(s.understated).toBe(true);

    // The high side comes out at +5.3%, NARROWER than the +9.6% it replaces.
    // Rendering that as "the range" would be more misleading than the arbitrary
    // band, not less -- which is why the flag is not a formality.
    expect(s.highBound / s.baseValuation - 1).toBeCloseTo(0.053, 3);
    expect(s.highBound).toBeLessThan(s.baseValuation * 1.096);
  });

  it("puts the VC hurdle top of the table at development, not the discount rate", async () => {
    // Worth asserting because it inverts the expansion ordering: at development the
    // DCFs carry 12% each against 36%, so the rate matters far less, while VC's
    // 16% is unchanged.
    const s = await run("development");
    expect(s.drivers[0].key).toBe("vc_required_roi");
    expect(s.drivers.find((d) => d.key === "size_premium")!.impact).toBeLessThan(0.05);
  });
});
