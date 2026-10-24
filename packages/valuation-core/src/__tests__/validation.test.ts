import { describe, expect, it } from "vitest";
import {
  validateProfile,
  validateFinancials,
  validateBalanceSheet,
  validateQuestionnaire,
  validateWizardData,
  hasBlockingIssues,
  fieldIssue,
} from "../validation";

describe("validateProfile", () => {
  it("flags a blank profile as missing every required field", () => {
    const issues = validateProfile({});
    const fields = issues.map((i) => i.field);
    expect(fields).toContain("name");
    expect(fields).toContain("country");
    expect(fields).toContain("industry");
    expect(fields).toContain("stage");
    expect(hasBlockingIssues(issues)).toBe(true);
  });

  it("accepts a fully-populated, sane profile", () => {
    const issues = validateProfile({
      name: "Vantage Metrics Ltd",
      country: "United Kingdom",
      industry: "SaaS",
      stage: "startup",
      founders_count: 2,
      employees_count: 12,
      started_year: 2021,
      incorporated_year: 2021,
      founders_committed_capital: 50000,
    });
    expect(hasBlockingIssues(issues)).toBe(false);
  });

  it("rejects a whitespace-only company name", () => {
    const issues = validateProfile({ name: "   ", country: "US", industry: "SaaS", stage: "startup" });
    expect(fieldIssue(issues, "name")).toBeDefined();
  });

  it("rejects founders/employees counts below 1 and out-of-range years", () => {
    const issues = validateProfile({
      name: "Co",
      country: "US",
      industry: "SaaS",
      stage: "startup",
      founders_count: 0,
      employees_count: 0,
      started_year: 1850,
      incorporated_year: 3000,
      founders_committed_capital: -5,
    });
    expect(fieldIssue(issues, "founders_count")).toBeDefined();
    expect(fieldIssue(issues, "employees_count")).toBeDefined();
    expect(fieldIssue(issues, "started_year")).toBeDefined();
    expect(fieldIssue(issues, "incorporated_year")).toBeDefined();
    expect(fieldIssue(issues, "founders_committed_capital")).toBeDefined();
  });
});

describe("validateFinancials", () => {
  it("flags negative revenue and cost lines, addressed to the right year", () => {
    const issues = validateFinancials([
      { yearOffset: -1, revenue: 100_000 },
      { yearOffset: 1, revenue: -50_000, cogs: -1000 },
    ]);
    expect(issues.some((i) => i.field === "financials.1.revenue")).toBe(true);
    expect(issues.some((i) => i.field === "financials.1.cogs")).toBe(true);
    expect(issues.some((i) => i.field === "financials.-1.revenue")).toBe(false);
  });

  it("accepts an all-zero (blank) financials table -- zero is not negative", () => {
    const financials = Array.from({ length: 7 }, (_, i) => ({ yearOffset: i - 1, revenue: 0 }));
    expect(validateFinancials(financials)).toHaveLength(0);
  });
});

describe("validateBalanceSheet", () => {
  it("flags negative cash figures", () => {
    const issues = validateBalanceSheet({ cash_and_equivalents: -1, non_operating_cash: -1 });
    expect(fieldIssue(issues, "cash_and_equivalents")).toBeDefined();
    expect(fieldIssue(issues, "non_operating_cash")).toBeDefined();
  });
});

describe("validateQuestionnaire", () => {
  it("rejects a growth-rate typo like 150 (meant as 150%, i.e. 1.5)", () => {
    const issues = validateQuestionnaire({ market_growth_rate: 150 });
    const issue = fieldIssue(issues, "market_growth_rate");
    expect(issue?.severity).toBe("error");
  });

  it("warns but does not block on a plausible-but-unusual growth rate above 100%", () => {
    const issues = validateQuestionnaire({ market_growth_rate: 1.5 });
    const issue = fieldIssue(issues, "market_growth_rate");
    expect(issue?.severity).toBe("warning");
    expect(hasBlockingIssues(issues)).toBe(false);
  });

  it("accepts a normal growth rate and does not flag it", () => {
    const issues = validateQuestionnaire({ market_growth_rate: 0.2, team_size: 5, tam_size: 1_000_000_000 });
    expect(issues).toHaveLength(0);
  });

  it("rejects negative counts", () => {
    const issues = validateQuestionnaire({ team_size: -1, competitors_count: -1, partnerships_count: -1, tam_size: -1 });
    expect(hasBlockingIssues(issues)).toBe(true);
    expect(issues).toHaveLength(4);
  });
});

describe("validateWizardData", () => {
  it("aggregates issues across all sections", () => {
    const issues = validateWizardData({
      profile: {},
      financials: [{ yearOffset: 1, revenue: -1 }],
      balanceSheet: { cash_and_equivalents: -1 },
      questionnaireAnswers: { market_growth_rate: -0.1 },
    });
    expect(hasBlockingIssues(issues)).toBe(true);
    expect(issues.length).toBeGreaterThan(4);
  });

  it("is clean for a fully valid, realistic wizard submission", () => {
    const issues = validateWizardData({
      profile: {
        name: "Vantage Metrics Ltd",
        country: "United Kingdom",
        industry: "SaaS",
        stage: "startup",
        founders_count: 2,
        employees_count: 12,
      },
      financials: [
        { yearOffset: -1, revenue: 1_200_000, cogs: 300_000 },
        { yearOffset: 0, revenue: 2_400_000, cogs: 600_000 },
      ],
      balanceSheet: { cash_and_equivalents: 500_000, non_operating_cash: 0 },
      questionnaireAnswers: { market_growth_rate: 0.25, team_size: 8 },
    });
    expect(issues).toHaveLength(0);
  });
});
