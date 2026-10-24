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
 *   weighted      3,363,922 -> 3,308,842   -1.64%
 *
 * UPDATED A THIRD TIME, same day, for the DISCOUNT-RATE SIZE PREMIUM. This is the
 * largest deliberate move of the model pass so far, and the only one that touches
 * both DCFs at once.
 *
 * The rate was bare CAPM -- `riskFree10Y + beta * equityRiskPremium` -- with no
 * size or stage adjustment, which is a mature-listed-company cost of equity
 * applied to a startup. It now adds a size premium from SIZE_PREMIUM_BANDS,
 * keyed on last actual revenue:
 *
 *   5.10% riskFree + 6.16% systematic (beta 1.23) + 4.70% size = 15.962%
 *                                                    (was 11.262%)
 *
 * Measured deltas:
 *
 *   dcf_ltg       3,169,409 -> 1,886,798  -40.47%
 *   dcf_multiple  2,062,969 -> 1,710,139  -17.10%
 *   vc            1,930,301 -> 1,930,301    0.00%  (uses VC_REQUIRED_ROI, not this rate)
 *   scorecard     8,679,750 -> 8,679,750    0.00%
 *   checklist     9,925,875 -> 9,925,875    0.00%
 *   weighted      3,308,842 -> 2,720,083  -17.79%
 *
 * Correct blast radius: only the two methods that discount cash flows. DCF-LTG
 * moves more than DCF-multiple because the rate enters twice there -- once
 * discounting, once in the Gordon denominator, where the multiple falls from
 * 11.7x to 7.6x.
 *
 * TWO THINGS WORTH RECORDING, because both contradict earlier write-ups:
 *
 * 1. This is the first finding of the model pass that made the CASH-FLOW methods
 *    read too HIGH. AUDIT-04/05/06 all claimed every cash-flow method read too
 *    low (unnormalised terminal year, understated revenue multiples) and that the
 *    errors were partly cancelling against the qualitative methods' too-high
 *    benchmark. That was wrong about this one: the rate was too low, so fixing it
 *    pushes the DCFs DOWN and WIDENS the method-family gap, from 3.6x to 5.2x
 *    (qualitative mean / cash-flow mean).
 *
 * 2. MIN_LTG_SPREAD is no longer load-bearing. With the premium applied, 0 of the
 *    442 country x industry combinations floor, and the narrowest spread is 4.55%
 *    (CH/Cleantech) against the 3pp floor. The guardrail stays as defence in
 *    depth; the cause is fixed.
 *
 * UPDATED A FOURTH TIME, same day, for TERMINAL-YEAR NORMALISATION. The terminal
 * value now uses the spec's reinvestment form rather than growing the final
 * forecast year's cash flow:
 *
 *   naive         TV = FCFE_5 x (1 + g) x survival / (r - g)
 *   reinvestment  TV = NetIncome_6 x (1 - g/RONIC) x survival / (r - g)
 *
 * with RONIC defaulting to the discount rate (no excess returns in perpetuity).
 * Both are computed and both are reported, because the spec asks for the naive
 * form as a cross-check: "If the two approaches disagree, the Year 6
 * reinvestment assumptions are inconsistent."
 *
 *   reinvestment rate g/RONIC   15.66%
 *   naive TV                 3,768,675
 *   reinvestment TV          3,923,104   +4.10%
 *   dcf_ltg      1,886,798 -> 1,942,032   +2.93%
 *   weighted     2,720,083 -> 2,739,967   +0.73%
 *
 * A SMALL MOVE ON THIS FIXTURE, AND THAT IS LUCK RATHER THAN DESIGN.
 * AUDIT-04 predicted +18% by setting maintenance capex equal to D&A, which is
 * itself the "perpetual growth with no reinvestment" error the spec names -- that
 * prediction was wrong and the audit has been corrected. The real figure is
 * +2.93%, because Northwind's year-5 FCFE (1,289,000) happens to sit at 81% of
 * its net income (1,591,000) while a true steady state wants 84.3%.
 *
 * What the change is actually worth shows up when that coincidence does not
 * hold. Varying ONLY year-5 line items, naive against reinvestment:
 *
 *   as supplied                       3,768,675   3,923,104     +4.1%
 *   repays 250k of debt in year 5     3,183,931   3,923,104    +23.2%
 *   receivables 1.23m -> 2.05m        1,371,225   3,923,104   +186.1%
 *   capex 180k -> 900k                1,663,597   3,923,104   +135.8%
 *   DRAWS 550k of new debt            5,376,722   3,923,104    -27.0%
 *
 * The naive terminal value swings by a factor of four on financing and
 * working-capital decisions that happen to land in the final forecast year, and
 * it can overstate as easily as understate. The reinvestment form does not move,
 * because it keys on net income. That is the point of the change.
 *
 * UPDATED A FIFTH TIME, same day, for the SECTOR MULTIPLE RE-SOURCING. INDUSTRIES
 * previously carried `ebitdaMultiple` and `revenueMultiple` as two independent
 * constants with no provenance comment, contradicting each other -- SaaS held
 * 6.77x EBITDA and 1.04x revenue, an implied mature margin of 15.4%. Both columns
 * now come from the same source pair (Damodaran US industry data, January 2026,
 * EV/Sales and EV/EBITDA) scaled by one documented small-company factor, so they
 * cannot contradict each other and a test asserts they do not.
 *
 *   SaaS revenueMultiple  1.04 -> 3.19   +207%
 *   SaaS ebitdaMultiple   6.77 -> 6.85     +1%
 *
 * That asymmetry IS the finding: the EBITDA multiple was approximately right all
 * along and the revenue multiple was wrong by a factor of three. Three
 * independent lines of evidence said so (AUDIT-05, AUDIT-06) -- the row
 * contradicting itself, the comparables users actually entered (4.1-10.9x, median
 * 6.0x), and this repo's own test comment "Development-stage SaaS typically
 * valued at 4-8x revenue".
 *
 *   dcf_multiple 1,710,139 -> 4,131,506  +141.59%
 *   vc           1,930,301 -> 1,953,111    +1.18%
 *   dcf_ltg      1,942,032 -> 1,942,032     0.00%  (uses neither multiple)
 *   scorecard    8,679,750 -> 8,679,750     0.00%
 *   checklist    9,925,875 -> 9,925,875     0.00%
 *   weighted     2,739,967 -> 3,615,309   +31.95%
 *
 * TWO THINGS THIS IS THE FIRST CHANGE OF THE MODEL PASS TO DO:
 *
 * 1. It NARROWS the method-family gap rather than widening it: qualitative mean
 *    over cash-flow mean falls from 5.09x to 3.06x. Every prior fix -- the size
 *    premium especially -- widened it.
 * 2. It makes leaving `industry` blank a PENALTY instead of a bonus. `default`
 *    moves from 3.00x/9.00x (richer than SaaS on every axis) to the whole-market
 *    figure of 0.97x/4.75x, so a blank industry now costs -25.4% on the composite
 *    where it used to pay +36.8%. That closes ClickUp z8mad3qv1e as a side
 *    effect, and it affected 7 of 23 production snapshots.
 *
 * UPDATED A SIXTH TIME, same day, for the VC PRE-MONEY DECISION -- option (b) of
 * AUDIT-03 divergence 1, chosen by Ed.
 *
 * `capitalRaised` had been hardcoded to 0 at the call site, so V_pre = V_post - 0
 * and the engine reported POST-money value under a pre-money label for every
 * company at 16% of the weight. It now takes the founder's own stated
 * `capital_needed` (2,500,000 here), which was in the payload all along:
 *
 *   exit value              14,152,100
 *   V_post                   1,953,111
 *   capital raised           2,500,000
 *   V_pre                     -546,889   <- does not clear
 *
 * At a 48.6% required return over five years, Northwind's projections do not
 * support a 2.5m round by 546,889. Option (b) is that this is a statement about
 * the ROUND, not a valuation of the company, so the method is EXCLUDED and its
 * weight redistributed pro-rata rather than averaged in as a zero:
 *
 *   method        valuation    weight  effective
 *   scorecard     8,679,750      6.0%      7.14%
 *   checklist     9,925,875      6.0%      7.14%
 *   vc                    0     16.0%      0.00%   excluded
 *   dcf_ltg       1,942,032     36.0%     42.86%
 *   dcf_multiple  4,131,506     36.0%     42.86%
 *   multiples             0      0.0%      0.00%   excluded (no comparables)
 *
 *   weighted     3,615,309 -> 3,931,918   +8.75%
 *
 * It RAISES the composite, because the method being removed was the lowest of the
 * five. Wiring capitalRaised alone would have LOWERED it by 9.3% -- that is
 * option (a), and the difference between the two is entirely what a zero does
 * inside a weighted average.
 *
 * The redistribution is general, not a VC special case: `multiples` is excluded
 * here too for having no comparables. It carries 0% weight at every stage so
 * nothing moves, but a caller overriding that weight no longer drags the
 * composite toward zero. See computeWeightedValuation.
 *
 * UPDATED A SEVENTH TIME, 28 Sep 2026, for the BETA RE-SOURCING -- the last
 * unsourced column in INDUSTRIES. Betas now come from the SAME Damodaran row as
 * that sector's multiples, so the two describe one industry rather than two.
 *
 *   SaaS beta      1.23 -> 1.28   (Damodaran levered, Software (System & Application))
 *   discount rate  15.962% -> 16.213%
 *   dcf_ltg      1,942,032 -> 1,901,554   -2.08%
 *   dcf_multiple 4,131,506 -> 4,088,980   -1.03%
 *   weighted     3,931,918 -> 3,896,345   -0.90%
 *
 * Small here because SaaS's beta barely moved. The re-sourcing matters elsewhere:
 * the implausible ones moved hard -- Cleantech 0.46 -> 0.86, Marketplace
 * 0.92 -> 1.69, Media 0.48 -> 0.83, PropTech 0.58 -> 0.97. Cleantech's 0.46 is
 * what drove the Swiss discount rate to 2.35% and broke the Gordon denominator in
 * the first place; CH/Cleantech now resolves to 8.74% rather than 7.05%.
 *
 * `default` moved 1.05 -> 0.99 (Total Market without financials), which is BELOW
 * the median named sector of 1.11 -- so a blank industry gets a slightly lower
 * discount rate and a slightly higher DCF. That partially offsets the multiples
 * penalty without reversing it: blank vs SaaS is -23.4%, against -24.9% before.
 * The z8mad3qv1e principle -- a fallback must never pay -- still holds, so the
 * honest whole-market figure was kept rather than inflated to preserve a margin.
 *
 * UPDATED AN EIGHTH TIME, 28 Sep 2026, for the BENCHMARK REFERENCE TABLE -- the
 * largest single change of the model pass, and the one the rest was waiting on.
 *
 * `COUNTRIES[x].avgSeedPreMoney` was one figure per country used at EVERY stage,
 * and it was not even the same KIND of figure across countries. Checked against
 * the published sources rather than inferred from the field name:
 *
 *   US  $7,700,000  was EXACTLY PitchBook-NVCA's PRE-SEED median (Q3 2025).
 *                   A median -- of the wrong stage. Their seed median is $15.8M.
 *   GB  £7,100,000  was close to the BBB seed MEAN of £6.0m.
 *                   The right stage -- but the wrong statistic. Median is £3.2m.
 *
 * So correcting both to a seed median roughly DOUBLES the US benchmark and roughly
 * HALVES the UK one, and AUDIT-01/02's "a mean where the method requires a median"
 * was right for GB and wrong for the US. Both audits are corrected.
 *
 *   benchmark    7,100,000 -> 3,200,000   (BBB seed median, 2025)
 *   scorecard    8,679,750 -> 3,912,000   -54.9%
 *   checklist    9,925,875 -> 4,473,780   -54.9%
 *   vc                   0 ->         0    excluded either way
 *   dcf_ltg      1,901,554 -> 1,901,554     0.00%
 *   dcf_multiple 4,088,980 -> 4,088,980     0.00%
 *   weighted     3,896,345 -> 3,166,356   -18.7%
 *
 * THIS IS THE RESULT THE WHOLE MODEL PASS WAS CHASING. The gap that started it --
 * Scorecard and Checklist at three to five times the cash-flow methods -- is gone.
 * 3,912,000 and 4,473,780 now sit alongside 1,901,554 and 4,088,980: no longer
 * outliers, but in the same conversation.
 *
 * Northwind is `expansion`, and the benchmark stage is capped at `seed` for every
 * stage above `idea`. That is not a shortcut. Scorecard and Checklist are
 * early-stage methods by construction, and feeding them a Series A benchmark does
 * not make them more accurate for a scaled company -- it uses them outside their
 * domain. Mapping `expansion` to `series_a`, as the spec originally proposed, sent
 * this company to a global Series A cell and produced a Scorecard of £34,230,000
 * on £900k of revenue. Relevance at later stages is already handled, better, by
 * the stage weights falling to 6% and then to zero.
 */
export const NORTHWIND_BASELINE = {
	weightedValuation: 3166355.9801996546,
	lowBound: 2862385.8061004877,
	highBound: 3470326.1542988215,
	discountRate: 0.162128,
	currency: 'GBP',
	perMethod: [
		{ method: 'scorecard', weight: 0.06, valuation: 3912000 },
		{ method: 'checklist', weight: 0.06, valuation: 4473780 },
		{ method: 'vc', weight: 0.16, valuation: 0 },
		{ method: 'dcf_ltg', weight: 0.36, valuation: 1901554 },
		{ method: 'dcf_multiple', weight: 0.36, valuation: 4088980 },
		{ method: 'multiples', weight: 0, valuation: 0 },
	],
};

/** The as-shipped snapshot, kept so the audit's before/after stays checkable. */
export const NORTHWIND_SNAPSHOT_AS_RUN = {
	weightedValuation: 3401084.2249949267,
	scorecard: 8954875,
	checklist: 11188125,
};
