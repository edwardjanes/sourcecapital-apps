import { DcfResult, FcfeYear } from "./types";

export function computeDcfShared(
  fcfeYears: FcfeYear[],
  terminalValue: number,
  discountRate: number,
  illiquidityDiscount: number,
  nonOperatingCash: number = 0,
  survivalRates: number[] = [0.8869, 0.7945, 0.7164, 0.6487, 0.5891, 0.5357]
): DcfResult {
  // Sum discounted cash flows: Σ[t=1..n] (FCFE_t × SurvivalRate_t) / (1+DR)^t
  let discountedFcfSum = 0;
  for (const fcfeYear of fcfeYears) {
    const survivalRate = survivalRates[fcfeYear.yearOffset - 1] ?? survivalRates[survivalRates.length - 1] ?? 0.5;
    const discount = Math.pow(1 + discountRate, fcfeYear.yearOffset);
    discountedFcfSum += (fcfeYear.fcfe * survivalRate) / discount;
  }

  // Discount terminal value: TV / (1+DR)^n
  const finalYearOffset = fcfeYears[fcfeYears.length - 1]?.yearOffset || 3;
  const discountFactor = Math.pow(1 + discountRate, finalYearOffset);
  const discountedTerminalValue = terminalValue / discountFactor;

  // Apply illiquidity discount to combined discounted cash flows + terminal value
  const valuation = (discountedFcfSum + discountedTerminalValue) * (1 - illiquidityDiscount) + nonOperatingCash;
  const illiquidityAdjustedTerminalValue = discountedTerminalValue * (1 - illiquidityDiscount);

  return {
    discountedFcfSum,
    terminalValue,
    discountedTerminalValue,
    illiquidityAdjustedTerminalValue,
    nonOperatingCash,
    valuation: Math.max(0, valuation),
  };
}
