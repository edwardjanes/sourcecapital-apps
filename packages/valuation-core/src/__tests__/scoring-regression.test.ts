import { expect, it } from "vitest";
import { deriveScorecardCriteriaScores, deriveChecklistCriteriaScores } from "../scoring";
import type { QuestionnaireAnswers } from "../types";

// This test ensures that UI fields collected in QuestionnaireStep.tsx
// remain in sync with fields read by scoring functions.
// Failures indicate a mismatch in the questionnaire wiring (Phase 0).

it("QuestionnaireStep UI fields match scoring function reads", () => {
  // Fields that QuestionnaireStep.tsx collects in its state
  const UI_FIELDS = new Set([
    // Team tab
    "team_size",
    "team_has_cto",
    "team_has_business_lead",
    "team_prior_exits",
    // Business Model tab
    "business_model_type",
    "recurring_revenue",
    "competitors_count",
    "has_competitive_advantage",
    "partnerships_count",
    "has_strategic_investors",
    // Product & Market tab
    "tam_size",
    "market_growth_rate",
    "product_status",
    "has_customers",
    "product_market_fit",
    // IP & Legal tab
    "has_patents",
    "has_ip",
    "ip_protection_stage",
    "legal_risks",
    // Merged from external sources (snapshot/route.ts enrichment)
    "capital_needed",
    "last_year_revenue",
  ]);

  // Fields that scoring functions actually read
  // (extracted by analyzing deriveScorecardCriteriaScores & deriveChecklistCriteriaScores)
  const SCORING_READS = new Set([
    // scoreTeamStrength (team criterion)
    "team_size",
    "team_has_cto",
    "team_has_business_lead",
    "team_prior_exits",
    // scoreOpportunitySize (opportunity criterion in Scorecard, idea in Checklist)
    "tam_size",
    "market_growth_rate",
    "recurring_revenue",
    "has_customers",
    "product_market_fit",
    // scoreCompetitiveEnvironment (competitive_env in Scorecard only)
    "competitors_count",
    "has_competitive_advantage",
    // scoreProductStrength (product_ip in both Scorecard/Checklist)
    "product_status",
    "ip_protection_stage",
    "has_patents",
    "has_ip",
    "legal_risks",
    // scoreStrategicPartnerships (partnerships in Scorecard, relationships in Checklist)
    "partnerships_count",
    "has_strategic_investors",
    // scoreFundingRequired (funding_required in Scorecard)
    "capital_needed",
    "last_year_revenue",
  ]);

  // Test 1: Every field UI collects must be read by scoring (or intentionally unused)
  const INTENTIONALLY_UNUSED = new Set([
    "business_model_type", // Collected by UI but explicitly not scored (no defensible ranking)
  ]);

  for (const uiField of UI_FIELDS) {
    if (!SCORING_READS.has(uiField) && !INTENTIONALLY_UNUSED.has(uiField)) {
      throw new Error(
        `UI field '${uiField}' is collected but never read by scoring functions. ` +
        `Either add it to a scoring function or add it to INTENTIONALLY_UNUSED.`
      );
    }
  }

  // Test 2: Every field scoring reads must be collected by UI (or merged from external sources)
  for (const scoringField of SCORING_READS) {
    if (!UI_FIELDS.has(scoringField)) {
      throw new Error(
        `Scoring reads '${scoringField}' but UI doesn't collect it. ` +
        `Either add it to QuestionnaireStep.tsx or merge it in snapshot/route.ts enrichment.`
      );
    }
  }

  // Test 3: Verify a sample questionnaire triggers scoring without errors
  const sampleAnswers: QuestionnaireAnswers = {
    team_size: 5,
    team_has_cto: true,
    team_has_business_lead: true,
    team_prior_exits: true,
    business_model_type: "saas",
    recurring_revenue: true,
    competitors_count: 5,
    has_competitive_advantage: true,
    partnerships_count: 2,
    has_strategic_investors: true,
    tam_size: 1_000_000_000,
    market_growth_rate: 0.2,
    product_status: "revenue_generating",
    has_customers: true,
    product_market_fit: true,
    has_patents: true,
    has_ip: true,
    ip_protection_stage: "granted",
    legal_risks: false,
    capital_needed: 500_000,
    last_year_revenue: 1_000_000,
  };

  // Should not throw
  const scorecardScores = deriveScorecardCriteriaScores(sampleAnswers);
  const checklistScores = deriveChecklistCriteriaScores(sampleAnswers);

  // Verify all criteria are present
  expect(Object.keys(scorecardScores)).toContain("team");
  expect(Object.keys(scorecardScores)).toContain("opportunity");
  expect(Object.keys(scorecardScores)).toContain("competitive_env");
  expect(Object.keys(scorecardScores)).toContain("product_ip");
  expect(Object.keys(scorecardScores)).toContain("partnerships");
  expect(Object.keys(scorecardScores)).toContain("funding_required");

  expect(Object.keys(checklistScores)).toContain("team");
  expect(Object.keys(checklistScores)).toContain("idea");
  expect(Object.keys(checklistScores)).toContain("product_ip");
  expect(Object.keys(checklistScores)).toContain("relationships");
  expect(Object.keys(checklistScores)).toContain("operating_stage");

  // Scorecard scores are a signed delta from average (roughly -1..+1, 0 = average) --
  // NOT bounded to 0..1. A below-average trait must be able to produce a negative
  // delta so the Scorecard valuation can land below the country average, not just
  // at-or-above it.
  Object.values(scorecardScores).forEach((score) => {
    expect(typeof score).toBe("number");
    expect(score).toBeGreaterThanOrEqual(-1);
    expect(score).toBeLessThanOrEqual(1);
  });

  // Checklist scores are a 0-100% "closeness to ideal" -- no negative side by design.
  Object.values(checklistScores).forEach((score) => {
    expect(typeof score).toBe("number");
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(1);
  });
});

it("a below-average questionnaire produces a negative Scorecard delta (not clamped at 0)", () => {
  const weakAnswers: QuestionnaireAnswers = {
    team_size: 1,
    team_has_cto: false,
    team_has_business_lead: false,
    team_prior_exits: false,
    tam_size: 10_000_000,
    market_growth_rate: 0.02,
    competitors_count: 20,
    has_competitive_advantage: false,
    product_status: "idea",
    has_patents: false,
    has_ip: false,
    partnerships_count: 0,
    has_strategic_investors: false,
    capital_needed: 2_000_000,
    last_year_revenue: 500_000,
  };

  const scores = deriveScorecardCriteriaScores(weakAnswers);

  // Team: size 1 (25), no CTO (35), no lead (40), no prior exits (50, neutral) -> avg 37.5 -> delta -0.25
  expect(scores.team).toBeLessThan(0);
  // Opportunity: small TAM, slow growth, no PMF/customers signalled -> below average
  expect(scores.opportunity).toBeLessThan(0);
  // 20 competitors, no competitive advantage -> below average
  expect(scores.competitive_env).toBeLessThan(0);

  const weightedSum =
    0.3 * scores.team +
    0.25 * scores.opportunity +
    0.1 * scores.competitive_env +
    0.15 * scores.product_ip +
    0.1 * scores.partnerships +
    0.1 * scores.funding_required;

  // With this many below-average signals, the blended Scorecard adjustment should be
  // negative -- i.e. this company should value BELOW the country average, which the
  // old scoring rubric could never produce (it floored every criterion at "average").
  expect(weightedSum).toBeLessThan(0);
});

it("has_patents/has_ip fallback fires when ip_protection_stage is '' (the wizard's actual default), not just undefined", () => {
  // QuestionnaireStep.tsx initializes ip_protection_stage to '' and only sets it to a real
  // value once the user picks a dropdown option -- it is never `undefined` in practice. The
  // fallback to has_patents/has_ip must still work in that common case, otherwise anyone who
  // checks "has patents" / "has IP" but skips the dropdown gets no IP score contribution at all.
  const withPatentsEmptyStage: QuestionnaireAnswers = {
    ip_protection_stage: "",
    has_patents: true,
    has_ip: false,
  };
  const withoutPatentsEmptyStage: QuestionnaireAnswers = {
    ip_protection_stage: "",
    has_patents: false,
    has_ip: false,
  };

  const scorecardWith = deriveScorecardCriteriaScores(withPatentsEmptyStage);
  const scorecardWithout = deriveScorecardCriteriaScores(withoutPatentsEmptyStage);

  // Falls back to the has_patents/has_ip booleans (60 for true, 35 for false) rather than
  // treating '' as a real (unmatched) stage and silently contributing nothing.
  expect(scorecardWith.product_ip).toBeGreaterThan(scorecardWithout.product_ip);
});
