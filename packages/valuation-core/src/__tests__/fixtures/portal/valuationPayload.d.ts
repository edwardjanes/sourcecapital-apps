// Types for the vendored portal module, so the package typechecks without allowJs.
export function buildComputePayload(form: {
  company: { name: string; country: string; industry: string; stage: string };
  questionnaire: Record<string, unknown>;
  financials: Array<Record<string, string | undefined>>;
  balanceSheet: Record<string, string | undefined>;
  funding: { capital_needed_current_round?: string };
}): {
  company: Record<string, unknown>;
  financials: Array<Record<string, unknown>>;
  questionnaire: Record<string, unknown>;
  balanceSheet: Record<string, number>;
};
