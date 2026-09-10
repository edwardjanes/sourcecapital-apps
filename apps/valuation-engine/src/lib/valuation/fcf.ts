import { FinancialYear, FcfeYear } from "./types";

export function deriveFcfeByYear(years: FinancialYear[]): FcfeYear[] {
  const sortedYears = [...years].sort((a, b) => a.yearOffset - b.yearOffset);
  const result: FcfeYear[] = [];
  let deferredTaxBenefit = 0;

  for (let i = 0; i < sortedYears.length; i++) {
    const current = sortedYears[i];
    const previous = i > 0 ? sortedYears[i - 1] : null;

    const revenue = current.revenue || 0;
    const cogs = current.cogs || 0;
    const salaries = current.salaries || 0;
    const otherOpex = current.otherOpex || 0;
    const totalDa = current.totalDa || 0;
    const interest = current.interest || 0;
    const rawTaxes = current.taxes || 0;
    const receivables = current.receivables || 0;
    const inventory = current.inventory || 0;
    const payables = current.payables || 0;
    const capex = current.capex || 0;
    const debt = current.debt || 0;

    const ebitda = revenue - cogs - salaries - otherOpex;
    const ebit = ebitda - totalDa;
    const ebt = ebit - interest;

    // Handle NOL carryforward: loss years generate deferred tax benefits
    let taxes = rawTaxes;
    if (ebt < 0 && rawTaxes < 0) {
      // Loss year with an implied tax benefit — defer it to future profitable years
      deferredTaxBenefit += -rawTaxes;
      taxes = 0;
    } else if (ebt >= 0 && rawTaxes > 0 && deferredTaxBenefit > 0) {
      // Profitable year — use up as much carried-forward benefit as this year's tax liability allows
      const offset = Math.min(deferredTaxBenefit, rawTaxes);
      taxes = rawTaxes - offset;
      deferredTaxBenefit -= offset;
    }

    const netIncome = ebt - taxes;

    // Change in working capital = Δ(Receivables + Inventory - Payables)
    let deltaWc = 0;
    if (previous) {
      const currentWc = receivables + inventory - payables;
      const previousWc = (previous.receivables || 0) + (previous.inventory || 0) - (previous.payables || 0);
      deltaWc = currentWc - previousWc;
    }

    // Change in debt
    let deltaDebt = 0;
    if (previous) {
      deltaDebt = debt - (previous.debt || 0);
    }

    // FCFE = NetIncome + D&A - CapEx - ΔWC + ΔDebt
    const fcfe = netIncome + totalDa - capex - deltaWc + deltaDebt;

    result.push({
      yearOffset: current.yearOffset,
      ebitda,
      ebit,
      ebt,
      netIncome,
      da: totalDa,
      deltaWc,
      deltaDebt,
      fcfe,
    });
  }

  return result;
}
