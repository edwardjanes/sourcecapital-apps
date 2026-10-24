// ---------------------------------------------------------------------------
// Shared wizard input validation.
//
// This is the single source of truth for "is this input sane" -- it's used
// BOTH client-side (wizard step components, to show inline errors and gate
// Next/Generate Report) and server-side (the snapshot route, as defense in
// depth against a crafted request that skips the UI entirely). Keeping one
// implementation means the two can never drift out of sync.
//
// Scope: this only catches inputs that are structurally wrong for what the
// compute engine assumes (missing required fields the country/industry
// lookups and scoring depend on, negative amounts where the formulas assume
// non-negative, and a growth-rate typo class that's easy to make). It does
// NOT try to second-guess plausible business judgment calls (e.g. "is 40%
// growth realistic for this company") -- those are 'warning' severity so
// they show but never block.
// ---------------------------------------------------------------------------

export type ValidationSeverity = 'error' | 'warning';

export interface ValidationIssue {
  field: string;
  message: string;
  severity: ValidationSeverity;
}

export function hasBlockingIssues(issues: ValidationIssue[]): boolean {
  return issues.some((issue) => issue.severity === 'error');
}

export function fieldIssue(issues: ValidationIssue[] | undefined, field: string): ValidationIssue | undefined {
  return issues?.find((issue) => issue.field === field);
}

// --- Profile ----------------------------------------------------------------

export interface ProfileValidationInput {
  name?: string;
  country?: string;
  industry?: string;
  stage?: string;
  founders_count?: number;
  employees_count?: number;
  started_year?: number;
  incorporated_year?: number;
  founders_committed_capital?: number;
}

export function validateProfile(profile: ProfileValidationInput): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const currentYear = new Date().getFullYear();

  if (!profile.name || !profile.name.trim()) {
    issues.push({ field: 'name', message: 'Company name is required.', severity: 'error' });
  }
  // country/industry aren't just labels -- buildDefaultParameters() looks them up against
  // referenceData.ts and silently falls back to a generic "default" country/industry (average
  // discount rate, average multiples) when they're blank. That fallback is a reasonable safety
  // net for an unmapped country name, but for an EMPTY value it just quietly produces a
  // valuation on made-up reference data with no indication anything was skipped.
  if (!profile.country || !profile.country.trim()) {
    issues.push({
      field: 'country',
      message: 'Country is required -- it drives the discount rate and valuation benchmarks used in every method.',
      severity: 'error',
    });
  }
  if (!profile.industry || !profile.industry.trim()) {
    issues.push({
      field: 'industry',
      message: 'Industry is required -- it drives the beta and revenue/EBITDA multiples used in the VC and DCF methods.',
      severity: 'error',
    });
  }
  if (!profile.stage || !profile.stage.trim()) {
    issues.push({ field: 'stage', message: 'Stage is required -- it sets the default method weights.', severity: 'error' });
  }
  if (profile.founders_count !== undefined && profile.founders_count < 1) {
    issues.push({ field: 'founders_count', message: 'Founders must be at least 1.', severity: 'error' });
  }
  if (profile.employees_count !== undefined && profile.employees_count < 1) {
    issues.push({ field: 'employees_count', message: 'Employees must be at least 1.', severity: 'error' });
  }
  if (
    profile.started_year !== undefined &&
    (profile.started_year < 1900 || profile.started_year > currentYear)
  ) {
    issues.push({
      field: 'started_year',
      message: `Founded year must be between 1900 and ${currentYear}.`,
      severity: 'error',
    });
  }
  if (
    profile.incorporated_year !== undefined &&
    (profile.incorporated_year < 1900 || profile.incorporated_year > currentYear)
  ) {
    issues.push({
      field: 'incorporated_year',
      message: `Incorporated year must be between 1900 and ${currentYear}.`,
      severity: 'error',
    });
  }
  if (profile.founders_committed_capital !== undefined && profile.founders_committed_capital < 0) {
    issues.push({
      field: 'founders_committed_capital',
      message: "Founders' committed capital can't be negative.",
      severity: 'error',
    });
  }

  return issues;
}

// --- Financials ---------------------------------------------------------------

export interface FinancialRowValidationInput {
  yearOffset: number;
  revenue?: number;
  cogs?: number;
  salaries?: number;
  otherOpex?: number;
  totalDa?: number;
  interest?: number;
  taxes?: number;
  receivables?: number;
  inventory?: number;
  payables?: number;
  capex?: number;
  debt?: number;
  fundraisingPlan?: number;
}

const NON_NEGATIVE_FINANCIAL_FIELDS: { key: keyof FinancialRowValidationInput; label: string }[] = [
  { key: 'revenue', label: 'Revenue' },
  { key: 'cogs', label: 'COGS' },
  { key: 'salaries', label: 'Salaries' },
  { key: 'otherOpex', label: 'Other OpEx' },
  { key: 'totalDa', label: 'D&A' },
  { key: 'interest', label: 'Interest' },
  { key: 'taxes', label: 'Taxes' },
  { key: 'receivables', label: 'Receivables' },
  { key: 'inventory', label: 'Inventory' },
  { key: 'payables', label: 'Payables' },
  { key: 'capex', label: 'CapEx' },
  { key: 'debt', label: 'Debt' },
  { key: 'fundraisingPlan', label: 'Fundraising Plan' },
];

export function financialYearLabel(offset: number): string {
  if (offset === -1) return 'Previous year';
  if (offset === 0) return 'Current year';
  return `Year +${offset}`;
}

// Field key used to address one cell for inline UI lookups, e.g. financialFieldKey(2, 'revenue') -> "financials.2.revenue"
export function financialFieldKey(yearOffset: number, key: keyof FinancialRowValidationInput): string {
  return `financials.${yearOffset}.${key}`;
}

export function validateFinancials(financials: FinancialRowValidationInput[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  for (const row of financials || []) {
    for (const { key, label } of NON_NEGATIVE_FINANCIAL_FIELDS) {
      const value = row[key];
      if (typeof value === 'number' && !Number.isNaN(value) && value < 0) {
        issues.push({
          field: financialFieldKey(row.yearOffset, key),
          message: `${label} (${financialYearLabel(row.yearOffset)}) can't be negative.`,
          severity: 'error',
        });
      }
    }
  }
  return issues;
}

export interface BalanceSheetValidationInput {
  non_operating_cash?: number;
  cash_and_equivalents?: number;
}

export function validateBalanceSheet(balanceSheet: BalanceSheetValidationInput): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (typeof balanceSheet.cash_and_equivalents === 'number' && balanceSheet.cash_and_equivalents < 0) {
    issues.push({
      field: 'cash_and_equivalents',
      message: "Cash & equivalents can't be negative.",
      severity: 'error',
    });
  }
  if (typeof balanceSheet.non_operating_cash === 'number' && balanceSheet.non_operating_cash < 0) {
    issues.push({
      field: 'non_operating_cash',
      message: "Non-operating cash can't be negative.",
      severity: 'error',
    });
  }
  return issues;
}

// --- Questionnaire ------------------------------------------------------------

export interface QuestionnaireValidationInput {
  team_size?: number;
  competitors_count?: number;
  partnerships_count?: number;
  tam_size?: number;
  market_growth_rate?: number;
  capital_needed?: number;
}

export function validateQuestionnaire(answers: QuestionnaireValidationInput): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (typeof answers.team_size === 'number' && answers.team_size < 0) {
    issues.push({ field: 'team_size', message: "Team size can't be negative.", severity: 'error' });
  }
  if (typeof answers.competitors_count === 'number' && answers.competitors_count < 0) {
    issues.push({ field: 'competitors_count', message: "Competitor count can't be negative.", severity: 'error' });
  }
  if (typeof answers.partnerships_count === 'number' && answers.partnerships_count < 0) {
    issues.push({ field: 'partnerships_count', message: "Partnership count can't be negative.", severity: 'error' });
  }
  if (typeof answers.tam_size === 'number' && answers.tam_size < 0) {
    issues.push({ field: 'tam_size', message: "TAM can't be negative.", severity: 'error' });
  }
  if (typeof answers.capital_needed === 'number' && answers.capital_needed < 0) {
    issues.push({ field: 'capital_needed', message: "Capital needed can't be negative.", severity: 'error' });
  }
  if (typeof answers.market_growth_rate === 'number') {
    if (answers.market_growth_rate < 0) {
      issues.push({
        field: 'market_growth_rate',
        message: "Market growth rate can't be negative.",
        severity: 'error',
      });
    } else if (answers.market_growth_rate > 5) {
      // A value like 150 (meant as "150%", i.e. 1.5) flows straight through as market_growth_rate: 150
      // with no other guard anywhere in the pipeline -- treat anything above 500% as almost certainly a typo.
      issues.push({
        field: 'market_growth_rate',
        message: 'Enter growth rate as a decimal (e.g. 0.20 for 20%) -- values above 500% are almost always a typo.',
        severity: 'error',
      });
    } else if (answers.market_growth_rate > 1) {
      issues.push({
        field: 'market_growth_rate',
        message: `That reads as ${(answers.market_growth_rate * 100).toFixed(0)}% growth -- double check this is a decimal (0.20 = 20%), not a whole percentage.`,
        severity: 'warning',
      });
    }
  }

  return issues;
}

// --- Aggregate ------------------------------------------------------------

export interface WizardValidationInput {
  profile?: ProfileValidationInput;
  financials?: FinancialRowValidationInput[];
  balanceSheet?: BalanceSheetValidationInput;
  questionnaireAnswers?: QuestionnaireValidationInput;
}

export function validateWizardData(data: WizardValidationInput): ValidationIssue[] {
  return [
    ...validateProfile(data.profile || {}),
    ...validateFinancials(data.financials || []),
    ...validateBalanceSheet(data.balanceSheet || {}),
    ...validateQuestionnaire(data.questionnaireAnswers || {}),
  ];
}
