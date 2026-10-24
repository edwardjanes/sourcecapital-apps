import { expect, it } from "vitest";
import { buildDefaultParameters } from "../defaults";
import { CompanyProfile, FinancialYear } from "../types";

it("VC Method terminal_metric_value is terminal-year EBITDA, not revenue", () => {
  const profile: CompanyProfile = {
    name: "TestCo",
    country: "Germany",
    industry: "SaaS",
    stage: "development",
  };

  // Real-world figures pulled from a live Vantage Metrics Ltd snapshot: year+5 revenue $6.2M,
  // EBITDA (revenue - cogs - salaries - otherOpex) $2.9M. The two must never be equal for this
  // to be a meaningful regression test.
  const financials: FinancialYear[] = [
    {
      yearOffset: 5,
      yearNumber: null,
      isActual: false,
      revenue: 6200000,
      cogs: 1200000,
      salaries: 1400000,
      otherOpex: 700000,
      totalDa: 30000,
      interest: 15000,
      taxes: 500000,
      receivables: 0,
      inventory: 0,
      payables: 0,
      capex: 0,
      debt: 0,
      fundraisingPlan: 0,
    },
  ];

  const params = buildDefaultParameters(profile, financials);

  const expectedEbitda = 6200000 - 1200000 - 1400000 - 700000; // 2,900,000
  expect(params.vc_method.terminal_metric_value).toBe(expectedEbitda);
  expect(params.vc_method.terminal_metric_value).not.toBe(6200000); // not revenue
});
