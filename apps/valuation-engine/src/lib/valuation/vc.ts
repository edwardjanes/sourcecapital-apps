import { VcMethodResult } from "./types";

export function computeVcMethod(
  terminalYearMetricValue: number,
  industryMultiple: number,
  requiredRoi: number,
  projectionYears: number,
  capitalRaised: number = 0
): VcMethodResult {
  const exitValue = terminalYearMetricValue * industryMultiple;
  const discountFactor = 1 / Math.pow(1 + requiredRoi, projectionYears);
  const discountedExitValue = exitValue * discountFactor;
  const valuation = discountedExitValue - capitalRaised;

  return {
    exitValue,
    discountFactor,
    discountedExitValue,
    valuation: Math.max(0, valuation),
  };
}
