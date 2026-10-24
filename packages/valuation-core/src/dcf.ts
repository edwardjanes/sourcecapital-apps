import { DcfResult, FcfeYear, LtgTerminalValue } from "./types";
import { LTG_GROWTH_RATE_MIN } from "./referenceData";

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

/**
 * Minimum spread between the discount rate and the terminal growth rate.
 *
 * The Gordon-growth denominator is (r - g), and the method spec states the
 * required condition r > g outright, listing "Setting g equal to or above WACC"
 * among its Common Errors. Nothing enforced it until 27 Sep 2026, and because
 * `r` is CAPM per country x industry while `g` was a flat 0.025 for every
 * company, 66 of the 442 combinations sat under a 3pp spread: two below zero
 * (terminal value negative, then silently clamped to a valuation of 0) and
 * eleven inside 2pp (terminal multiples above 51x -- Swiss PropTech returned
 * GBP 126,182,407 for a company with GBP 900k of revenue).
 *
 * 3pp caps the implied terminal multiple at about 34x the terminal-year cash
 * flow. It binds on 15% of combinations and changes nothing for the other 85%.
 *
 * This is a guardrail, not a fix for the underlying cause. A 2.35% cost of
 * equity for a startup is wrong whatever the spread -- the spec says plainly
 * that "using a mature public-company WACC for a pre-revenue startup may
 * understate risk" -- and a stage/size premium on the discount rate is the real
 * correction. Tracked as ClickUp z8mad3qv19.
 */
export const MIN_LTG_SPREAD = 0.03;

/**
 * Gordon-growth terminal value for the DCF-LTG method.
 *
 * Extracted from compute.ts on 27 Sep 2026. It had been four inline lines with
 * no function, no module and no test of its own, which is precisely why the
 * unguarded spread survived fourteen passing tests on `computeDcfShared` -- that
 * function receives `terminalValue` already computed and cannot see r or g.
 *
 * The numerator is the terminal year's cash flow grown one year, per the spec:
 * "The numerator is Year 6 cash flow, not Year 5 cash flow without growth."
 * Survival weighting makes the perpetuity conditional on reaching that year.
 */
export function computeLtgTerminalValue(
  terminalFcfe: number,
  survivalRate: number,
  discountRate: number,
  requestedGrowthRate: number,
  /**
   * Terminal-year net income. When supplied, the spec's reinvestment form is
   * computed and USED in place of the naive form. Optional so the naive form
   * stays callable and testable on its own.
   */
  terminalNetIncome?: number,
  /**
   * Return on new capital for the terminal period. Defaults to the discount
   * rate, i.e. no excess returns in perpetuity -- the spec's own guidance:
   * "Competitive forces often push returns on incremental capital toward WACC
   * over time", and assuming otherwise "is a strong assumption".
   */
  returnOnNewCapital?: number,
  minGrowthRate: number = LTG_GROWTH_RATE_MIN,
  minSpread: number = MIN_LTG_SPREAD
): LtgTerminalValue {
  // Lower g until the spread clears the floor, but never below the method's own
  // minimum -- a negative perpetual growth rate is defensible for a shrinking
  // business and wrong for a scaling one, and these cases arise from too low a
  // discount rate rather than from any view about the company's prospects.
  const growthRateUsed = Math.max(minGrowthRate, Math.min(requestedGrowthRate, discountRate - minSpread));

  // Backstop: where the discount rate is itself below the floor, clamping g
  // cannot open the spread, so floor the denominator directly. Without this the
  // two combinations with r < g still divide by a negative number.
  const naturalSpread = discountRate - growthRateUsed;
  const spreadUsed = Math.max(naturalSpread, minSpread);

  const floored = growthRateUsed < requestedGrowthRate || spreadUsed > naturalSpread;

  // The naive form: grow the terminal year's actual cash flow by g.
  const naiveTerminalValue = (terminalFcfe * survivalRate * (1 + growthRateUsed)) / spreadUsed;

  // The reinvestment form. The spec: "growth is not free" -- g = RR x RONIC, so
  // RR = g / RONIC and steady-state cash flow is earnings net of the
  // reinvestment that growth requires.
  //
  // This is what makes the terminal year a STEADY state rather than a
  // continuation of the forecast's last year. The naive form carries whatever
  // working-capital draw, debt repayment and growth capex that year happened to
  // have, and grows all of it in perpetuity. Northwind's year 5 carries a
  // GBP 154,000 working-capital draw sized for 36.7% revenue growth and a
  // GBP 50,000 debt repayment against a GBP 250,000 balance -- neither can hold
  // forever, and the spec's Steady-State Checklist asks for exactly this.
  //
  // Note the spread floor protects this too: MIN_LTG_SPREAD guarantees
  // RONIC > g whenever RONIC defaults to the discount rate, so the reinvestment
  // rate cannot reach or exceed 1 and turn terminal cash flow negative.
  const ronic = returnOnNewCapital ?? discountRate;
  const hasReinvestmentForm = typeof terminalNetIncome === 'number' && Number.isFinite(terminalNetIncome) && ronic > 0;

  const reinvestmentRate = hasReinvestmentForm ? growthRateUsed / ronic : null;
  const reinvestmentTerminalValue = hasReinvestmentForm
    ? ((terminalNetIncome as number) * (1 + growthRateUsed) * (1 - (reinvestmentRate as number)) * survivalRate) / spreadUsed
    : null;

  const basis: 'naive' | 'reinvestment' = hasReinvestmentForm ? 'reinvestment' : 'naive';
  const terminalValue = basis === 'reinvestment' ? (reinvestmentTerminalValue as number) : naiveTerminalValue;

  return {
    terminalValue,
    growthRateRequested: requestedGrowthRate,
    growthRateUsed,
    spreadUsed,
    floored,
    impliedMultiple: (1 + growthRateUsed) / spreadUsed,
    basis,
    naiveTerminalValue,
    reinvestmentTerminalValue,
    reinvestmentRate,
    returnOnNewCapital: hasReinvestmentForm ? ronic : null,
    reinvestmentDisagreement:
      hasReinvestmentForm && naiveTerminalValue !== 0
        ? (reinvestmentTerminalValue as number) / naiveTerminalValue - 1
        : null,
  };
}
