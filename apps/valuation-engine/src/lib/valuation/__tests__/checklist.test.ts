import { expect, it } from "vitest";
import { computeChecklist } from "../checklist";

it("reproduces NovaCloud Checklist valuation: $4,555,423", () => {
  const criteria = {
    team: { weight: 0.30, score: 0.55 },
    idea: { weight: 0.20, score: 0.55 },
    product_ip: { weight: 0.15, score: 0.055556 },
    relationships: { weight: 0.15, score: 0.50 },
    operating_stage: { weight: 0.20, score: 0.05 },
  };
  const maxValuation = 12367664;

  const result = computeChecklist(criteria, maxValuation);
  
  expect(result.valuation).toBeCloseTo(4555423, -2); // Within $100
});
