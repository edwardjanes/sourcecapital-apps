import { expect, it, describe } from "vitest";
import { computeScorecard } from "../scorecard";
import {
  SCORECARD_CRITERIA_WEIGHTS,
  SCORECARD_MULTIPLIER_MIN,
  SCORECARD_MULTIPLIER_MAX,
} from "../referenceData";

const zeros = (): Record<string, { weight: number; score: number }> =>
  Object.fromEntries(
    Object.entries(SCORECARD_CRITERIA_WEIGHTS).map(([k, w]) => [k, { weight: w, score: 0 }])
  );

describe("Scorecard", () => {
  it("reproduces NovaCloud Scorecard valuation: $5,310,193", () => {
    // The one external reference point this method has: a real Equidam sample
    // report. It passes its own weights rather than reading
    // SCORECARD_CRITERIA_WEIGHTS, which matters now that the two differ --
    // Equidam runs six criteria with funding_required at 10%, while Payne's
    // published method has seven with funding at 5% and "other" at 5%. This test
    // therefore validates the FORMULA against Equidam, and is deliberately
    // insulated from the production weight table. `other` is present at weight 0
    // so the six-criterion shape is preserved exactly.
    const criteria = {
      team: { weight: 0.30, score: 0.0 },
      opportunity: { weight: 0.25, score: 0.5 },
      competitive_env: { weight: 0.10, score: 0.25 },
      product_ip: { weight: 0.15, score: 0.25 },
      partnerships: { weight: 0.10, score: 0.375 },
      funding_required: { weight: 0.10, score: 0.5 },
      other: { weight: 0, score: 0 },
    };

    const result = computeScorecard(criteria, 4164857);

    expect(result.valuation).toBeCloseTo(5310193, -2); // Within $100
    // 1.275 -- inside the method's band, so the clamp does not touch it.
    expect(result.multiplier).toBeCloseTo(1.275, 6);
    expect(result.multiplierClamped).toBe(false);
  });

  it("carries all seven of Payne's factors, weighted as published", () => {
    expect(SCORECARD_CRITERIA_WEIGHTS).toEqual({
      team: 0.30,
      opportunity: 0.25,
      product_ip: 0.15,
      competitive_env: 0.10,
      partnerships: 0.10,
      funding_required: 0.05,
      other: 0.05,
    });
  });

  it("has weights summing to exactly 1, which the formula depends on", () => {
    // benchmark x Sum(w x rating) only equals benchmark x (1 + Sum(w x delta))
    // when the weights sum to 1. If that ever drifts the two forms diverge
    // silently, so it is asserted rather than assumed.
    const total = Object.values(SCORECARD_CRITERIA_WEIGHTS).reduce((a, b) => a + b, 0);
    expect(total).toBeCloseTo(1, 10);
  });

  it("returns the benchmark unchanged when every factor is average", () => {
    const r = computeScorecard(zeros() as never, 7_100_000);
    expect(r.multiplier).toBe(1);
    expect(r.valuation).toBe(7_100_000);
    expect(r.multiplierClamped).toBe(false);
  });

  it("clamps a composite above the method's ceiling", () => {
    // Every factor at the top of the derived delta range (+1.0) would give a
    // multiplier of 2.00 -- a third above what Payne's 1.50 rating permits.
    const all = Object.fromEntries(
      Object.entries(SCORECARD_CRITERIA_WEIGHTS).map(([k, w]) => [k, { weight: w, score: 1 }])
    );
    const r = computeScorecard(all as never, 7_100_000);
    expect(r.multiplier).toBe(SCORECARD_MULTIPLIER_MAX);
    expect(r.multiplierClamped).toBe(true);
    expect(r.valuation).toBe(7_100_000 * 1.5);
  });

  it("clamps a composite below the method's floor rather than near zero", () => {
    // The derived floor is -0.98, which would value a company at 2% of the
    // comparable average. Math.max(0, ...) only stopped it going negative.
    const all = Object.fromEntries(
      Object.entries(SCORECARD_CRITERIA_WEIGHTS).map(([k, w]) => [k, { weight: w, score: -0.98 }])
    );
    const r = computeScorecard(all as never, 7_100_000);
    expect(r.multiplier).toBe(SCORECARD_MULTIPLIER_MIN);
    expect(r.multiplierClamped).toBe(true);
    expect(r.valuation).toBe(7_100_000 * 0.5);
    // And never negative, whatever the input.
    expect(r.valuation).toBeGreaterThan(0);
  });

  it("never returns a negative valuation even at the extreme floor", () => {
    const all = Object.fromEntries(
      Object.entries(SCORECARD_CRITERIA_WEIGHTS).map(([k, w]) => [k, { weight: w, score: -50 }])
    );
    const r = computeScorecard(all as never, 7_100_000);
    expect(r.valuation).toBe(7_100_000 * 0.5);
  });

  it("reports the multiplier it actually applied, not the raw one", () => {
    const all = Object.fromEntries(
      Object.entries(SCORECARD_CRITERIA_WEIGHTS).map(([k, w]) => [k, { weight: w, score: 1 }])
    );
    const r = computeScorecard(all as never, 1_000_000);
    // sumWeightedScore still records the raw signal for transparency...
    expect(r.sumWeightedScore).toBeCloseTo(1, 10);
    // ...while multiplier and valuation reflect the clamp.
    expect(r.multiplier).toBe(1.5);
    expect(r.valuation).toBe(1_500_000);
  });

  it("scales linearly with the benchmark, which is the method's whole premise", () => {
    const c = zeros();
    c.team.score = 0.5;
    const a = computeScorecard(c as never, 4_000_000);
    const b = computeScorecard(c as never, 8_000_000);
    expect(b.valuation).toBeCloseTo(a.valuation * 2, 6);
  });

  it("survives a zero benchmark without producing NaN", () => {
    const r = computeScorecard(zeros() as never, 0);
    expect(r.valuation).toBe(0);
    expect(Number.isFinite(r.valuation)).toBe(true);
  });
});
