import { expect, it } from "vitest";
import { computeScorecard } from "../scorecard";

it("reproduces NovaCloud Scorecard valuation: $5,310,193", () => {
  const criteria = {
    team: { weight: 0.30, score: 0.0 },
    opportunity: { weight: 0.25, score: 0.5 },
    competitive_env: { weight: 0.10, score: 0.25 },
    product_ip: { weight: 0.15, score: 0.25 },
    partnerships: { weight: 0.10, score: 0.375 },
    funding_required: { weight: 0.10, score: 0.5 },
  };
  const averagePreMoneyValuation = 4164857;

  const result = computeScorecard(criteria, averagePreMoneyValuation);
  
  expect(result.valuation).toBeCloseTo(5310193, -2); // Within $100
});
