import { expect, it } from "vitest";
import { deriveFcfeByYear } from "../fcf";

it("defers loss-year tax benefits to profitable years via NOL carryforward", () => {
  // Synthetic scenario: Year 1 loss with implied -30k tax benefit,
  // Year 2 profit with 15k tax liability (offsets 15k of the benefit),
  // Year 3 profit with 60k tax liability (offsets remaining 15k of benefit).

  const years = [
    {
      yearOffset: 1,
      yearNumber: 2025,
      isActual: false,
      revenue: 0,
      cogs: 0,
      salaries: 100000,
      otherOpex: 0,
      totalDa: 0,
      interest: 0,
      taxes: -30000, // Implied refund (30% of -100k EBT)
      receivables: 0,
      inventory: 0,
      payables: 0,
      capex: 0,
      debt: 0,
      fundraisingPlan: 0,
    },
    {
      yearOffset: 2,
      yearNumber: 2026,
      isActual: false,
      revenue: 150000,
      cogs: 0,
      salaries: 100000,
      otherOpex: 0,
      totalDa: 0,
      interest: 0,
      taxes: 15000, // 30% of 50k EBT
      receivables: 0,
      inventory: 0,
      payables: 0,
      capex: 0,
      debt: 0,
      fundraisingPlan: 0,
    },
    {
      yearOffset: 3,
      yearNumber: 2027,
      isActual: false,
      revenue: 300000,
      cogs: 0,
      salaries: 100000,
      otherOpex: 0,
      totalDa: 0,
      interest: 0,
      taxes: 60000, // 30% of 200k EBT
      receivables: 0,
      inventory: 0,
      payables: 0,
      capex: 0,
      debt: 0,
      fundraisingPlan: 0,
    },
  ];

  const result = deriveFcfeByYear(years as any);

  // Year 1: EBT = -100k, rawTaxes = -30k
  // Condition: ebt < 0 && rawTaxes < 0 → defer the benefit
  // taxes = 0, deferredTaxBenefit = 30k
  // netIncome = -100k - 0 = -100k
  expect(result[0].netIncome).toBe(-100000);

  // Year 2: EBT = 50k, rawTaxes = 15k
  // Condition: ebt >= 0 && rawTaxes > 0 && deferredTaxBenefit > 0
  // offset = min(30000, 15000) = 15000
  // taxes = 15000 - 15000 = 0, deferredTaxBenefit = 30000 - 15000 = 15000
  // netIncome = 50k - 0 = 50k
  expect(result[1].netIncome).toBe(50000);

  // Year 3: EBT = 200k, rawTaxes = 60k
  // Condition: ebt >= 0 && rawTaxes > 0 && deferredTaxBenefit > 0
  // offset = min(15000, 60000) = 15000
  // taxes = 60000 - 15000 = 45000, deferredTaxBenefit = 15000 - 15000 = 0
  // netIncome = 200k - 45000 = 155k
  expect(result[2].netIncome).toBe(155000);
});
