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
  // V_pre = V_post - investment. Kept UNCLAMPED as well as clamped, because a
  // negative value is the method's real answer and a useful one: it says the
  // raise does not clear at the required return, and by how much. The clamp is
  // for the weighted average; the shortfall is for the founder.
  const preMoneyValuation = discountedExitValue - capitalRaised;
  const valuation = preMoneyValuation;

  return {
    exitValue,
    discountFactor,
    discountedExitValue,
    capitalRaised,
    preMoneyValuation,
    /** False when the raise exceeds the discounted exit value at this hurdle. */
    clearsHurdle: preMoneyValuation > 0,
    valuation: Math.max(0, valuation),
  };
}
