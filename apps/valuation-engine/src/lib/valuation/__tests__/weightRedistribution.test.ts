import { describe, it, expect } from "vitest";
import { computeWeightedValuation } from "../weights";
import { computeVcMethod } from "../vc";
import { computeValuation } from "../compute";
import { buildDefaultParameters } from "../defaults";
import {
  NORTHWIND_COMPANY,
  NORTHWIND_FINANCIALS,
  NORTHWIND_BALANCE_SHEET,
  NORTHWIND_QUESTIONNAIRE,
} from "./fixtures/northwind";
import type { MethodWeightSet, ValuationMethodKey } from "../types";

/**
 * The VC pre-money decision (AUDIT-03 divergence 1, option b) and the weight
 * redistribution it required. Shipped 27 Sep 2026.
 */

const WEIGHTS: MethodWeightSet = {
  scorecard: 0.06, checklist: 0.06, vc: 0.16,
  dcf_ltg: 0.36, dcf_multiple: 0.36, multiples: 0,
};
const VALUES: Record<ValuationMethodKey, number> = {
  scorecard: 8_679_750, checklist: 9_925_875, vc: 0,
  dcf_ltg: 1_942_032, dcf_multiple: 4_131_506, multiples: 0,
};

describe("Weight redistribution", () => {
  it("changes nothing when every method applies", () => {
    const r = computeWeightedValuation(VALUES, WEIGHTS);
    expect(r.redistributedWeight).toBe(0);
    expect(r.allMethodsInapplicable).toBe(false);
    for (const m of r.perMethod) expect(m.effectiveWeight).toBeCloseTo(m.weight, 12);
    // Plain sum(valuation x weight), as before.
    expect(r.weightedValuation).toBeCloseTo(
      Object.entries(VALUES).reduce((s, [k, v]) => s + v * WEIGHTS[k as ValuationMethodKey], 0), 6
    );
  });

  it("shares an excluded method's weight pro-rata, preserving the total", () => {
    const r = computeWeightedValuation(VALUES, WEIGHTS, {
      vc: { applicable: false, reason: "does not clear the hurdle" },
    });
    expect(r.redistributedWeight).toBeCloseTo(0.16, 10);

    // 0.84 retained, scaled up to 1.
    const scale = 1 / 0.84;
    expect(r.perMethod.find((m) => m.method === "scorecard")!.effectiveWeight).toBeCloseTo(0.06 * scale, 10);
    expect(r.perMethod.find((m) => m.method === "dcf_ltg")!.effectiveWeight).toBeCloseTo(0.36 * scale, 10);
    expect(r.perMethod.find((m) => m.method === "vc")!.effectiveWeight).toBe(0);

    // The effective weights still sum to the caller's original total.
    const total = r.perMethod.reduce((s, m) => s + m.effectiveWeight, 0);
    expect(total).toBeCloseTo(1, 10);
  });

  it("carries the reason through for the report", () => {
    const r = computeWeightedValuation(VALUES, WEIGHTS, {
      vc: { applicable: false, reason: "does not clear the hurdle" },
    });
    const vc = r.perMethod.find((m) => m.method === "vc")!;
    expect(vc.applicable).toBe(false);
    expect(vc.inapplicableReason).toBe("does not clear the hurdle");
    // And applicable methods say nothing rather than an empty string.
    expect(r.perMethod.find((m) => m.method === "dcf_ltg")!.inapplicableReason).toBeNull();
  });

  it("preserves a caller's own normalisation rather than forcing 1", () => {
    // A caller supplying weights that sum to 0.5 gets effective weights summing to
    // 0.5, not silently renormalised to 1.
    const half: MethodWeightSet = { ...WEIGHTS, dcf_ltg: 0.11, dcf_multiple: 0.11, vc: 0.16, scorecard: 0.03, checklist: 0.03, multiples: 0 };
    const total = Object.values(half).reduce((a, b) => a + b, 0);
    const r = computeWeightedValuation(VALUES, half, { vc: { applicable: false, reason: "x" } });
    expect(r.perMethod.reduce((s, m) => s + m.effectiveWeight, 0)).toBeCloseTo(total, 10);
  });

  it("returns zero and says so when nothing is applicable, rather than dividing by zero", () => {
    const r = computeWeightedValuation(VALUES, WEIGHTS, {
      scorecard: { applicable: false, reason: "x" },
      checklist: { applicable: false, reason: "x" },
      vc: { applicable: false, reason: "x" },
      dcf_ltg: { applicable: false, reason: "x" },
      dcf_multiple: { applicable: false, reason: "x" },
    });
    expect(r.allMethodsInapplicable).toBe(true);
    expect(r.weightedValuation).toBe(0);
    expect(Number.isFinite(r.weightedValuation)).toBe(true);
    // Deliberately NOT falling back to the excluded methods' own weights: summing
    // valuations from methods that do not apply would be worse than a loud zero.
    for (const m of r.perMethod) expect(m.effectiveWeight).toBe(0);
  });

  it("does not exclude a method merely for valuing at zero", () => {
    // Only an explicit applicability verdict excludes. A genuine zero valuation
    // from an applicable method still carries its weight.
    const r = computeWeightedValuation({ ...VALUES, dcf_ltg: 0 }, WEIGHTS);
    expect(r.perMethod.find((m) => m.method === "dcf_ltg")!.applicable).toBe(true);
    expect(r.perMethod.find((m) => m.method === "dcf_ltg")!.effectiveWeight).toBeCloseTo(0.36, 10);
    expect(r.redistributedWeight).toBe(0);
  });
});

describe("VC pre-money — capitalRaised is finally wired", () => {
  it("subtracts the founder's stated round size", async () => {
    const d = buildDefaultParameters(
      NORTHWIND_COMPANY as never, NORTHWIND_FINANCIALS as never, NORTHWIND_BALANCE_SHEET as never
    );
    const r = await computeValuation(
      NORTHWIND_COMPANY as never, NORTHWIND_FINANCIALS as never,
      { ...NORTHWIND_QUESTIONNAIRE } as never, { ...d, comparables: [] } as never
    );
    const vc = r.methodResults.vc;

    // Was hardcoded 0 until 27 Sep 2026, so V_pre was V_post.
    expect(vc.capitalRaised).toBe(2_500_000);
    expect(NORTHWIND_QUESTIONNAIRE.capital_needed).toBe(2_500_000);
    expect(Math.round(vc.discountedExitValue)).toBe(1_953_111);
    expect(Math.round(vc.preMoneyValuation)).toBe(-546_889);
    expect(vc.clearsHurdle).toBe(false);
    // The clamp still applies to the figure used in the average.
    expect(vc.valuation).toBe(0);
  });

  it("honours an explicit override ahead of the questionnaire", async () => {
    const d = buildDefaultParameters(
      NORTHWIND_COMPANY as never, NORTHWIND_FINANCIALS as never, NORTHWIND_BALANCE_SHEET as never
    );
    const params = { ...d, comparables: [], vc_method: { ...d.vc_method, capital_raised_override: 500_000 } };
    const r = await computeValuation(
      NORTHWIND_COMPANY as never, NORTHWIND_FINANCIALS as never,
      { ...NORTHWIND_QUESTIONNAIRE } as never, params as never
    );
    expect(r.methodResults.vc.capitalRaised).toBe(500_000);
    // A 500k round DOES clear, so the method is applied and carries its weight.
    expect(r.methodResults.vc.clearsHurdle).toBe(true);
    expect(r.perMethod.find((m: { method: string }) => m.method === "vc")!.applicable).toBe(true);
    expect(Math.round(r.methodResults.vc.valuation)).toBe(1_453_111);
  });

  it("excludes the method and redistributes, rather than averaging in a zero", async () => {
    const d = buildDefaultParameters(
      NORTHWIND_COMPANY as never, NORTHWIND_FINANCIALS as never, NORTHWIND_BALANCE_SHEET as never
    );
    const r = await computeValuation(
      NORTHWIND_COMPANY as never, NORTHWIND_FINANCIALS as never,
      { ...NORTHWIND_QUESTIONNAIRE } as never, { ...d, comparables: [] } as never
    );
    const vc = r.perMethod.find((m: { method: string }) => m.method === "vc")!;
    expect(vc.applicable).toBe(false);
    expect(vc.weight).toBeCloseTo(0.16, 10);
    expect(vc.effectiveWeight).toBe(0);
    expect(vc.inapplicableReason).toMatch(/does not clear at that hurdle/);
    expect(vc.inapplicableReason).toMatch(/48\.6% required annual return/);

    expect(r.redistributedWeight).toBeCloseTo(0.16, 10);
    expect(Math.round(r.weightedValuation)).toBe(3_931_918);

    // Option (a) -- pass capital_needed and average the zero in at 16% -- would
    // have LOWERED the composite instead. The whole difference between the two
    // options is what a zero does inside a weighted average.
    const optionA = r.perMethod.reduce(
      (s: number, m: { valuation: number; weight: number }) => s + m.valuation * m.weight, 0
    );
    expect(Math.round(optionA)).toBe(3_302_811);
    expect(r.weightedValuation).toBeGreaterThan(optionA);
  });

  it("also excludes Simple Multiples when no comparables were supplied", async () => {
    // The mechanism is general, not a VC special case. Multiples carries 0% weight
    // at every stage so nothing moves here, but a caller overriding that weight no
    // longer drags the composite toward zero.
    const d = buildDefaultParameters(
      NORTHWIND_COMPANY as never, NORTHWIND_FINANCIALS as never, NORTHWIND_BALANCE_SHEET as never
    );
    const r = await computeValuation(
      NORTHWIND_COMPANY as never, NORTHWIND_FINANCIALS as never,
      { ...NORTHWIND_QUESTIONNAIRE } as never, { ...d, comparables: [] } as never
    );
    const m = r.perMethod.find((x: { method: string }) => x.method === "multiples")!;
    expect(m.applicable).toBe(false);
    expect(m.inapplicableReason).toMatch(/No comparable companies/);
    expect(m.weight).toBe(0);
  });

  it("keeps the method when the raise does clear", () => {
    // Nothing about this is specific to failing: a company whose discounted exit
    // value comfortably covers its round gets a positive pre-money value and is
    // included as before.
    const clears = computeVcMethod(2_066_000, 6.77, 0.486, 5, 500_000);
    expect(clears.clearsHurdle).toBe(true);
    expect(clears.preMoneyValuation).toBeGreaterThan(0);
    expect(clears.valuation).toBe(clears.preMoneyValuation);
  });
});
