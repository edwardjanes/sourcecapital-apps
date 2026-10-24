import { expect, it } from "vitest";
import { getDefaultWeightsForStage } from "../weights";

it("all stage weight rows sum to 1.0", () => {
  const stages = ['idea', 'development', 'startup', 'expansion', 'growth', 'maturity'] as const;
  
  for (const stage of stages) {
    const weights = getDefaultWeightsForStage(stage);
    const sum = Object.values(weights).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1.0, 5);
  }
});
