// VENDORED TEST FIXTURE -- do not edit. Exact copy of edwardjanes/raise-hq-portal
// src/jsx/components/RaiseHQ/valuationPayload.js at d427ec7 (2026-10-23).
// Used by mapIntakeToEngine.test.ts as the source of truth for the body the portal posts today.
// Refresh by re-copying the file at a newer commit and updating the hash above.

// Pure (no React) so it can be exercised directly against the valuation
// engine in apps/valuation-engine without a browser.

export const FINANCIAL_LINE_ITEMS = [
	{ key: "revenue", label: "Revenue" },
	{ key: "cogs", label: "COGS" },
	{ key: "salaries", label: "Salaries" },
	{ key: "other_opex", label: "Other Operating Expenses" },
	{ key: "depreciation_amortization", label: "Depreciation & Amortization" },
	{ key: "interest", label: "Interest" },
	{ key: "taxes", label: "Taxes" },
	{ key: "receivables", label: "Receivables" },
	{ key: "inventory", label: "Inventory" },
	{ key: "payables", label: "Payables" },
	{ key: "capex", label: "Capital Expenditures" },
	{ key: "debt_outstanding_year_end", label: "Debt Outstanding (year-end)" },
	{ key: "fundraising_this_year", label: "Fundraising This Year" },
];

export const BALANCE_SHEET_FIELDS = [
	{ key: "cash_and_equivalents", label: "Cash and Cash Equivalents" },
	{ key: "non_operating_cash", label: "Non-Operating Cash" },
	{ key: "tangible_assets", label: "Tangible Assets" },
	{ key: "intangible_assets", label: "Intangible Assets" },
	{ key: "financial_assets", label: "Financial Assets" },
	{ key: "deferred_tax_assets", label: "Deferred Tax Assets" },
	{ key: "short_term_liabilities", label: "Short-term Liabilities (< 1yr)" },
	{ key: "long_term_liabilities", label: "Long-term Liabilities (> 1yr)" },
	{ key: "equity", label: "Equity" },
];

// --- Wizard state -> compute-route payload ---------------------------------
//
// valuation-run passes this payload through to the valuation engine's
// /api/valuation/compute route untouched, so it has to match that route's
// contract (apps/valuation-engine/src/app/api/valuation/compute/route.ts and
// src/lib/valuation/types.ts), not the Phase 1 schema doc this wizard was
// first built from.

// Form inputs hold strings; the engine does arithmetic on these. Blank or
// unparseable -> undefined, so "not answered" stays distinguishable from 0.
const num = (v) => {
	if (v === "" || v === null || v === undefined) return undefined;
	const n = Number(v);
	return Number.isFinite(n) ? n : undefined;
};
const atLeast = (v, threshold) => {
	const n = num(v);
	return n === undefined ? undefined : n >= threshold;
};

// Portal line-item key -> engine FinancialYear key. Anything not listed
// (e.g. revenue, cogs) has the same name on both sides.
const FINANCIAL_KEY_MAP = {
	other_opex: "otherOpex",
	depreciation_amortization: "totalDa",
	debt_outstanding_year_end: "debt",
	fundraising_this_year: "fundraisingPlan",
};

// "Base Year" is the last actual year (yearOffset -1, which the engine reads
// as last year's revenue); Year 1-5 are forecast years 1-5. The engine's own
// wizard also has a "Current" year (offset 0) that this wizard doesn't
// collect -- the engine treats it as optional.
/**
 * Ticket 2 of the 25 Sep brief asks for `source: founder | benchmark` per line
 * item, on the premise that a blank Step 3 cell "silently defaults from industry
 * benchmarks". That premise does not hold, and the reality is worse: `num("")`
 * returns undefined and the `?? 0` below turns a blank into a hard **zero**.
 * Nothing substitutes a benchmark at either end — the engine's own fcf.ts reads
 * `current.cogs || 0`, so a skipped cost line really is treated as costing
 * nothing, and a partly-filled Step 3 produces an implausibly profitable company.
 *
 * So the second value here is `not_entered`, not `benchmark`: calling a zero a
 * benchmark would be exactly the kind of overstatement Ticket 1 exists to stop.
 * The enum can grow to include `benchmark` if defaulting is ever actually
 * implemented — that is a valuation-changing decision, tracked separately.
 *
 * `sources` sits on the row beside the values, keyed by the same engine-side
 * names. Safe to add: the engine's validateFinancials() iterates a fixed field
 * list rather than the row's own keys, and fcf.ts reads named keys, so an extra
 * object is ignored by both. It rides along into the snapshot's stored `inputs`,
 * which is what lets the report mark the distinction after the fact.
 */
export const FINANCIAL_SOURCE_FOUNDER = "founder";
export const FINANCIAL_SOURCE_NOT_ENTERED = "not_entered";

function buildFinancials(rows) {
	return rows.map((row, i) => {
		const out = { yearOffset: i === 0 ? -1 : i, yearNumber: null, isActual: i === 0 };
		const sources = {};
		for (const { key } of FINANCIAL_LINE_ITEMS) {
			const engineKey = FINANCIAL_KEY_MAP[key] || key;
			const entered = num(row[key]);
			out[engineKey] = entered ?? 0;
			sources[engineKey] = entered === undefined ? FINANCIAL_SOURCE_NOT_ENTERED : FINANCIAL_SOURCE_FOUNDER;
		}
		out.sources = sources;
		return out;
	});
}

/**
 * Cell-level summary for the Review step, so the founder is told what they left
 * blank BEFORE spending 150 credits rather than discovering it in the report.
 * Counts against the same 13 x 6 grid the wizard renders.
 */
export function summariseFinancialSources(rows) {
	const financials = buildFinancials(rows);
	const total = financials.length * FINANCIAL_LINE_ITEMS.length;
	const labelByEngineKey = {};
	for (const { key, label } of FINANCIAL_LINE_ITEMS) {
		labelByEngineKey[FINANCIAL_KEY_MAP[key] || key] = label;
	}

	let entered = 0;
	const blankByLineItem = {};
	for (const row of financials) {
		for (const [engineKey, source] of Object.entries(row.sources)) {
			if (source === FINANCIAL_SOURCE_FOUNDER) {
				entered += 1;
			} else {
				const label = labelByEngineKey[engineKey];
				blankByLineItem[label] = (blankByLineItem[label] || 0) + 1;
			}
		}
	}

	return {
		total,
		entered,
		notEntered: total - entered,
		// Line items with at least one blank year, worst first -- more useful to a
		// founder than a raw cell count, because a wholly blank row is the case
		// that distorts the result most.
		blankLineItems: Object.entries(blankByLineItem)
			.map(([label, years]) => ({ label, years }))
			.sort((a, b) => b.years - a.years || a.label.localeCompare(b.label)),
	};
}

const PRODUCT_STATUS_BY_ROLLOUT = {
	Planning: "idea",
	Prototype: "mvp",
	MVP: "beta",
	Market: "revenue_generating",
};

// The engine grades IP protection on a four-value scale and scores it
// 25/50/75/90 (scoring.ts). It prefers `ip_protection_stage` and only falls back
// to the has_patents/has_ip booleans when that is absent -- and the wizard used
// to send NONE of the three, asking instead for free prose under
// `ip_protection_type_and_status`, which nothing reads. So the IP criterion
// contributed nothing to any portal valuation. Founders see the wording on the
// left; the engine gets the value on the right.
//
// "None" maps to `none` rather than to undefined on purpose: having no IP is a
// real answer worth 25, not a missing one. A blank select stays unmapped so the
// criterion drops out, which is what the engine's own '' handling expects.
const IP_STAGE_BY_STATUS = {
	"No IP protection": "none",
	"Applications filed, pending": "pending",
	Granted: "granted",
	"Granted and enforced": "enforced",
};

// The engine scores a smaller, differently-named question set
// (QuestionnaireAnswers in types.ts) than this wizard collects. Each engine
// key is derived from the closest wizard answer; engine keys with no
// defensible source (competitors_count, partnerships_count, recurring_revenue,
// legal_risks, ip_protection_stage) are left undefined, which the engine
// treats as "not answered" and scores neutrally. The raw wizard answers are
// passed through as well so they're preserved on the snapshot.
function buildQuestionnaire(answers, financials, capitalNeeded) {
	const baseYearRevenue = financials[0]?.revenue;
	const growth = num(answers.market_annual_growth_rate);
	const shareholders = Array.isArray(answers.shareholder_types) ? answers.shareholder_types : [];
	const founders = num(answers.founders_count);
	const employees = num(answers.employee_count);

	const mapped = {
		team_size: founders === undefined && employees === undefined ? undefined : (founders || 0) + (employees || 0),
		team_has_cto: atLeast(answers.core_technical_skills_in_house, 4),
		team_has_business_lead: atLeast(answers.core_team_managerial_background, 3),
		team_prior_exits: answers.founders_prior_experience
			? answers.founders_prior_experience === "Sold a company"
			: undefined,
		business_model_type: answers.business_model || undefined,
		has_competitive_advantage: atLeast(answers.differentiation_vs_competitors, 4),
		has_strategic_investors: shareholders.length
			? shareholders.includes("Business Angel") || shareholders.includes("Venture Capitalist")
			: undefined,
		tam_size: num(answers.tam),
		// Entered as a percentage (15 = 15%); the engine compares against 0.05/0.1/0.2.
		market_growth_rate: growth === undefined ? undefined : growth / 100,
		product_status: PRODUCT_STATUS_BY_ROLLOUT[answers.product_rollout_stage],
		ip_protection_stage: IP_STAGE_BY_STATUS[answers.ip_protection_status],
		// The Checklist method's Operating Stage criterion reads "development stage
		// AND current profitability" -- this is the second. The wizard has collected
		// it since the method shipped and the engine read nothing, so a
		// revenue-generating but loss-making company scored full marks on a
		// criterion measuring what it has demonstrably achieved. Mapped to a boolean
		// the same way team_prior_exits is, because the engine types it as one.
		sustainably_breakeven: answers.sustainably_breakeven
			? answers.sustainably_breakeven === "Yes"
			: undefined,
		has_customers: baseYearRevenue > 0 ? true : answers.product_rollout_stage === "Market" ? true : undefined,
		product_market_fit: answers.demand_tested ? answers.demand_tested === "Extensively validated" : undefined,
		capital_needed: capitalNeeded,
	};

	const out = { ...answers };
	for (const [k, v] of Object.entries(mapped)) {
		if (v !== undefined) out[k] = v;
	}

	// sustainably_breakeven is the ONE mapped key whose name collides with a
	// wizard key -- every other mapping renames (ip_protection_status ->
	// ip_protection_stage, tam -> tam_size, and so on). So the raw value survives
	// the spread above whenever the mapping declines to set it, which is exactly
	// when the founder has not answered and the select still holds "".
	//
	// That matters because the engine types this as a boolean. A leaked "" is not
	// undefined, so the engine would treat the question as answered and score the
	// company as not-yet-profitable rather than leaving the signal out.
	if (typeof out.sustainably_breakeven !== "boolean") delete out.sustainably_breakeven;

	return out;
}

export function buildComputePayload(form) {
	const q = form.questionnaire;
	const financials = buildFinancials(form.financials);
	const employees = num(q.employee_count);

	const balanceSheet = {};
	for (const { key } of BALANCE_SHEET_FIELDS) {
		const v = num(form.balanceSheet[key]);
		if (v !== undefined) balanceSheet[key] = v;
	}

	return {
		company: {
			name: form.company.name.trim(),
			country: form.company.country,
			industry: form.company.industry,
			stage: form.company.stage,
			founders_count: num(q.founders_count),
			// The engine rejects employees_count < 1; 0 employees is a valid
			// answer here, so only send it when it's a count the engine accepts.
			employees_count: employees >= 1 ? employees : undefined,
			business_model: q.business_model || undefined,
			founders_committed_capital: num(q.founders_capital_invested),
		},
		financials,
		questionnaire: buildQuestionnaire(q, financials, num(form.funding.capital_needed_current_round)),
		balanceSheet,
	};
}

// Mirrors the engine's blocking profile checks (validation.ts) so a founder
// fixes these here instead of getting a 400 back from the run.
export function missingCompanyFields(company) {
	const missing = [];
	if (!company.name.trim()) missing.push("company name");
	if (!company.country) missing.push("country");
	if (!company.industry) missing.push("industry");
	if (!company.stage) missing.push("stage of development");
	return missing;
}
