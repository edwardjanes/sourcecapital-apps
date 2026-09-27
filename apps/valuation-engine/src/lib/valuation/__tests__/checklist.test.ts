import { expect, it, describe } from "vitest";
import { computeChecklist } from "../checklist";
import { CHECKLIST_CRITERIA_WEIGHTS, STAGE_DEFAULT_WEIGHTS } from "../referenceData";

const withScores = (s: Record<string, number>) =>
  Object.fromEntries(
    Object.entries(CHECKLIST_CRITERIA_WEIGHTS).map(([k, w]) => [k, { weight: w, score: s[k] ?? 0 }])
  );

describe("Checklist", () => {
  it("reproduces NovaCloud Checklist valuation: $4,555,423", () => {
    const criteria = {
      team: { weight: 0.30, score: 0.55 },
      idea: { weight: 0.20, score: 0.55 },
      product_ip: { weight: 0.15, score: 0.055556 },
      relationships: { weight: 0.15, score: 0.50 },
      operating_stage: { weight: 0.20, score: 0.05 },
    };

    const result = computeChecklist(criteria, 12367664);

    expect(result.valuation).toBeCloseTo(4555423, -2); // Within $100
  });

  // The two published worked examples from the method spec
  // (claude/valuation methods/The Startup Checklist Valuation Method.md in
  // raise-hq-portal). Neither was covered before, and both exercise the
  // production weight table rather than passing their own -- which is the point:
  // they validate that our weights ARE the method's weights, not just that the
  // arithmetic multiplies correctly.

  it("reproduces the spec's primary worked example: $8.0M ceiling -> $4.84M", () => {
    const result = computeChecklist(
      withScores({ team: 0.80, idea: 0.65, product_ip: 0.40, relationships: 0.50, operating_stage: 0.50 }) as never,
      8_000_000
    );

    // Composite achievement factor 0.605, stated explicitly in the spec.
    expect(result.valuation / 8_000_000).toBeCloseTo(0.605, 10);
    expect(result.valuation).toBeCloseTo(4_840_000, 6);

    // And the per-criterion values the spec tabulates.
    const v = Object.fromEntries(result.criteria.map((c) => [c.key, c.achievedValue]));
    expect(v.team).toBeCloseTo(1_920_000, 6);
    expect(v.idea).toBeCloseTo(1_040_000, 6);
    expect(v.product_ip).toBeCloseTo(480_000, 6);
    expect(v.relationships).toBeCloseTo(600_000, 6);
    expect(v.operating_stage).toBeCloseTo(800_000, 6);
  });

  it("reproduces the spec's alternative example: EUR 4.5M ceiling -> EUR 2,358,000", () => {
    const result = computeChecklist(
      withScores({ team: 0.58, idea: 0.40, product_ip: 0.60, relationships: 0.80, operating_stage: 0.30 }) as never,
      4_500_000
    );

    expect(result.valuation).toBeCloseTo(2_358_000, 6);
    const v = Object.fromEntries(result.criteria.map((c) => [c.key, c.achievedValue]));
    expect(v.team).toBeCloseTo(783_000, 6);
    expect(v.idea).toBeCloseTo(360_000, 6);
    expect(v.product_ip).toBeCloseTo(405_000, 6);
    expect(v.relationships).toBeCloseTo(540_000, 6);
    expect(v.operating_stage).toBeCloseTo(270_000, 6);
  });

  it("carries the five weighted criteria exactly as the method defines them", () => {
    expect(CHECKLIST_CRITERIA_WEIGHTS).toEqual({
      team: 0.30,
      idea: 0.20,
      product_ip: 0.15,
      relationships: 0.15,
      operating_stage: 0.20,
    });
  });

  it("has weights summing to 1, which is what makes the ceiling a ceiling", () => {
    const total = Object.values(CHECKLIST_CRITERIA_WEIGHTS).reduce((a, b) => a + b, 0);
    expect(total).toBeCloseTo(1, 10);
  });

  it("cannot exceed the ceiling, however high the scores", () => {
    // The spec: "The method cannot generate a valuation above that ceiling
    // unless the analyst explicitly revises the ceiling or framework." With
    // weights summing to 1 and scores capped at 1 that is structural, so a
    // perfect company lands exactly ON the ceiling.
    const perfect = computeChecklist(
      withScores({ team: 1, idea: 1, product_ip: 1, relationships: 1, operating_stage: 1 }) as never,
      15_300_000
    );
    expect(perfect.valuation).toBeCloseTo(15_300_000, 6);
  });

  it("returns zero when nothing has been achieved, not a negative", () => {
    const none = computeChecklist(withScores({}) as never, 15_300_000);
    expect(none.valuation).toBe(0);
  });

  it("scales linearly with the ceiling, which is why the ceiling is the whole ballgame", () => {
    const s = { team: 0.5, idea: 0.5, product_ip: 0.5, relationships: 0.5, operating_stage: 0.5 };
    const a = computeChecklist(withScores(s) as never, 4_000_000);
    const b = computeChecklist(withScores(s) as never, 8_000_000);
    expect(b.valuation).toBeCloseTo(a.valuation * 2, 6);
    // Half marks everywhere earns half the ceiling.
    expect(a.valuation).toBeCloseTo(2_000_000, 6);
  });

  it("survives a zero ceiling without producing NaN", () => {
    const r = computeChecklist(withScores({ team: 1 }) as never, 0);
    expect(r.valuation).toBe(0);
    expect(Number.isFinite(r.valuation)).toBe(true);
  });

  it("matches the method's published stage weighting", () => {
    // The spec states Equidam's default blend gives Checklist 38% at idea, 30%
    // at development, 15% at startup, 6% at expansion and zero beyond. Asserted
    // because 16 of 19 companies sit at development, where this is 30%.
    expect(STAGE_DEFAULT_WEIGHTS.idea.checklist).toBeCloseTo(0.38, 10);
    expect(STAGE_DEFAULT_WEIGHTS.development.checklist).toBeCloseTo(0.30, 10);
    expect(STAGE_DEFAULT_WEIGHTS.startup.checklist).toBeCloseTo(0.15, 10);
    expect(STAGE_DEFAULT_WEIGHTS.expansion.checklist).toBeCloseTo(0.06, 10);
    expect(STAGE_DEFAULT_WEIGHTS.growth.checklist).toBe(0);
    expect(STAGE_DEFAULT_WEIGHTS.maturity.checklist).toBe(0);
  });
});
