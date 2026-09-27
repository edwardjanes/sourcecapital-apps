/**
 * Northwind Analytics Ltd — the model-pass baseline.
 *
 * These are the exact inputs of snapshot
 * `6cdd8d1d-e645-41da-b838-eff6a6ef7e4b`, run against production on 27 Sep 2026
 * from the Raise HQ portal wizard (Test Onboarding QA v2, GBP). Copied verbatim
 * from `valuation_snapshots.inputs`, not retyped from the fixture doc, so the
 * harness measures what the engine actually received.
 *
 * Why it exists: four separate findings all change valuation output —
 * ClickUp z8mad3qurk (sector multiples), z8mad3qup6 (seven unsupplied
 * questionnaire inputs), z8mad3quq9 (blank cells sent as zero) and z8mad3qup8
 * (the ±9.6% band). Each needs a before/after, and at 150 credits a run the
 * only affordable way to get one is to reproduce the baseline locally.
 *
 * `baseline` below is the stored `outputs` of that same snapshot. The companion
 * test asserts the engine still reproduces it exactly — that assertion is what
 * makes any later delta attributable to a change rather than to the harness.
 *
 * Note the two deliberate properties of this payload, both real:
 *   - `inventory` is absent from every year, because it was left blank in the
 *     wizard. It therefore reaches the engine as 0 (z8mad3quq9).
 *   - `yearOffset` runs -1 then 1..5 with no 0, which is what
 *     valuationPayload.js emits.
 */

export const NORTHWIND_COMPANY = {
	name: 'Northwind Analytics Ltd',
	country: 'United Kingdom',
	industry: 'SaaS',
	stage: 'expansion',
};

export const NORTHWIND_FINANCIALS = [
	{ yearOffset: -1, isActual: true, revenue: 900000, cogs: 198000, salaries: 620000, otherOpex: 260000, totalDa: 18000, interest: 6000, taxes: 0, receivables: 135000, inventory: 0, payables: 72000, capex: 40000, debt: 150000, fundraisingPlan: 0 },
	{ yearOffset: 1, isActual: false, revenue: 1550000, cogs: 341000, salaries: 880000, otherOpex: 390000, totalDa: 26000, interest: 9000, taxes: 0, receivables: 232000, inventory: 0, payables: 124000, capex: 70000, debt: 400000, fundraisingPlan: 2500000 },
	{ yearOffset: 2, isActual: false, revenue: 2600000, cogs: 572000, salaries: 1200000, otherOpex: 560000, totalDa: 38000, interest: 14000, taxes: 41000, receivables: 390000, inventory: 0, payables: 208000, capex: 95000, debt: 400000, fundraisingPlan: 0 },
	{ yearOffset: 3, isActual: false, revenue: 4100000, cogs: 902000, salaries: 1700000, otherOpex: 780000, totalDa: 52000, interest: 18000, taxes: 123000, receivables: 615000, inventory: 0, payables: 328000, capex: 120000, debt: 350000, fundraisingPlan: 0 },
	{ yearOffset: 4, isActual: false, revenue: 6000000, cogs: 1320000, salaries: 2300000, otherOpex: 1050000, totalDa: 68000, interest: 20000, taxes: 236000, receivables: 900000, inventory: 0, payables: 480000, capex: 150000, debt: 300000, fundraisingPlan: 0 },
	{ yearOffset: 5, isActual: false, revenue: 8200000, cogs: 1804000, salaries: 2950000, otherOpex: 1380000, totalDa: 82000, interest: 20000, taxes: 373000, receivables: 1230000, inventory: 0, payables: 656000, capex: 180000, debt: 250000, fundraisingPlan: 0 },
];

export const NORTHWIND_BALANCE_SHEET = {
	cash_and_equivalents: 420000,
	non_operating_cash: 60000,
	tangible_assets: 95000,
	intangible_assets: 180000,
	financial_assets: 0,
	deferred_tax_assets: 0,
	short_term_liabilities: 265000,
	long_term_liabilities: 150000,
	equity: 415000,
};

export const NORTHWIND_QUESTIONNAIRE = {
	tam: '4200000000',
	tam_size: 4200000000,
	team_size: 16,
	is_scalable: 'Yes',
	team_has_cto: true,
	advisor_count: '3',
	demand_tested: 'Extensively validated',
	has_customers: true,
	business_model: 'B2B',
	capital_needed: 2500000,
	employee_count: '14',
	founders_count: '2',
	product_status: 'revenue_generating',
	core_team_tenure: '3–5yr',
	founders_avg_age: '35–45',
	team_prior_exits: false,
	barriers_to_entry: '4',
	board_of_advisors: 'Yes',
	competition_level: '3',
	last_year_revenue: 900000,
	shareholder_types: ['Friends & Family', 'Business Angel'],
	market_growth_rate: 0.14,
	product_market_fit: true,
	business_model_type: 'B2B',
	ip_protection_stage: 'pending',
	ip_protection_status: 'Applications filed, pending',
	product_rollout_stage: 'Market',
	// Was the raw wizard string 'No'. The portal now maps it to a boolean in
	// buildQuestionnaire, the same way it already does team_prior_exits, so the
	// fixture reflects what the engine actually receives.
	sustainably_breakeven: false,
	team_has_business_lead: true,
	exit_strategy_readiness: '2',
	has_strategic_investors: true,
	founders_time_commitment: '5',
	founders_capital_invested: '180000',
	founders_prior_experience: 'Founded before',
	has_competitive_advantage: true,
	market_annual_growth_rate: '14',
	competitor_product_quality: 'Good',
	customer_loyalty_retention: '4',
	international_expansion_plans: '3',
	core_technical_skills_in_house: '5',
	differentiation_vs_competitors: '4',
	core_team_managerial_background: '4',
	international_competition_status: 'Growing',
	core_team_industry_experience_years: '12',
	strategic_partner_relationship_strength: '3',
};

/**
 * The expected output for these inputs.
 *
 * ORIGINALLY the stored `outputs` of snapshot 6cdd8d1d verbatim. UPDATED
 * 27 Sep 2026 for the first three Scorecard audit fixes, which are the first
 * deliberate model change since that snapshot was taken:
 *
 *   fix 0  absent sub-traits now contribute a neutral 50 instead of dropping
 *          out of the average, so a factor is no longer decided by whichever
 *          sub-trait happens to be supplied
 *   fix 3  Payne's seventh factor restored; funding_required back to 5% from
 *          the 10% it had absorbed
 *   fix 4  composite multiplier clamped to the method's own 0.50-1.50 band
 *
 * Measured deltas, every one in the intended direction:
 *
 *   scorecard     8,954,875 -> 8,679,750   -3.07%
 *   checklist    11,188,125 -> 10,843,875  -3.08%
 *   vc            1,930,301 -> 1,930,301    0.00%
 *   dcf_ltg       3,169,409 -> 3,169,409    0.00%
 *   dcf_multiple  2,062,969 -> 2,062,969    0.00%
 *   multiples             0 ->         0       —
 *   weighted      3,401,084 -> 3,363,922   -1.09%
 *
 * Only the two qualitative methods moved, which is the correct blast radius:
 * the fixes touch the sub-trait rubric and the Scorecard weights, and nothing
 * else reads them. Checklist moved too because it shares rawOpportunitySize and
 * rawStrategicPartnerships with Scorecard.
 *
 * The -3.07% reconciles exactly: opportunity -0.019 (recurring_revenue was
 * unsupplied and now contributes 50), competitive_env -0.015 and partnerships
 * -0.020 (competitors_count and partnerships_count likewise), less +0.015 from
 * halving funding_required's weight on a -0.30 delta. Net -0.039 against a
 * 1.2612 composite.
 *
 * fix 4 does not bind here: Northwind's composite is 1.2224 after the change,
 * inside the band.
 *
 * UPDATED AGAIN, same day, for the Checklist Operating Stage fix: the spec names
 * "development stage AND current profitability" as its two inputs, and
 * `sustainably_breakeven` had been collected by the wizard since the method
 * shipped while the engine read nothing. Northwind is revenue-generating but
 * loss-making, so it had been scoring the MAXIMUM on a criterion measuring what
 * it has demonstrably achieved.
 *
 *   operating_stage score  1.0 -> 0.7   (revenue_generating 1.0 averaged with not-breakeven 0.4)
 *   checklist    10,843,875 -> 9,925,875   -8.47%
 *   scorecard     8,679,750 -> 8,679,750    0.00%  (operating_stage is Checklist-only)
 *   weighted      3,363,922 -> 3,308,842   -1.64%
 *
 * Reconciles exactly: the achievement factor drops 0.20 x 0.3 = 0.06, which
 * against the GBP 15,300,000 ceiling is -918,000; at Checklist's 6% weight at
 * expansion stage that is -55,080 on the composite. At `development` stage,
 * where Checklist carries 30% and 16 of 19 companies sit, the same change would
 * be five times larger.
 */
export const NORTHWIND_BASELINE = {
	weightedValuation: 3308841.7249949267,
	lowBound: 2991192.9193954137,
	highBound: 3626490.53059444,
	discountRate: 0.112623,
	currency: 'GBP',
	perMethod: [
		{ method: 'scorecard', weight: 0.06, valuation: 8679750 },
		{ method: 'checklist', weight: 0.06, valuation: 9925875 },
		{ method: 'vc', weight: 0.16, valuation: 1930301 },
		{ method: 'dcf_ltg', weight: 0.36, valuation: 3169409 },
		{ method: 'dcf_multiple', weight: 0.36, valuation: 2062969 },
		{ method: 'multiples', weight: 0, valuation: 0 },
	],
};

/** The as-shipped snapshot, kept so the audit's before/after stays checkable. */
export const NORTHWIND_SNAPSHOT_AS_RUN = {
	weightedValuation: 3401084.2249949267,
	scorecard: 8954875,
	checklist: 11188125,
};
