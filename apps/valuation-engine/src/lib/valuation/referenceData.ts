// Reference data sourced from public sources (Damodaran/NYU Stern, Equidam's published industry multiples,
// PitchBook-NVCA, British Business Bank) as of Aug 2026. NOT Equidam's proprietary/internal data.
// All values are editable by the user.
//
// Country avgSeedPreMoney / checklistMaxValuation sourcing status:
//   - DE: validated against a real Equidam sample report (avg + max both real).
//   - US, GB, FR, NL, IE, SE, CH: avg sourced from PitchBook-NVCA/BBB/PitchBook-Europe 2025 reports
//     (FR/NL/IE/SE/CH are regional, not country-specific figures -- finest grain publicly available).
//     checklistMaxValuation for these 7 is a PROXY: DE's validated max/avg ratio (2.155x) applied to
//     each country's avg -- no public source publishes a "max valuation" figure for any country.
//   - All other countries: still illustrative, no adequate public source found despite searching
//     PitchBook, Carta, CVCA, LAVCA, Partech Africa, MAGNiTT, and others -- do not treat as benchmarked.
//
// Sources: Risk-free rates from Trading Economics (10Y govn't bond yields, Aug 21 2026);
//          Equity risk premiums from Damodaran/NYU Stern "Country Default Spreads" (Jan 2026 update);
//          Industry beta from Damodaran unlevered beta (Jan 2026 update);
//          Industry multiples from Equidam published TRBC data (Feb-July 2026).

export const COUNTRIES = {
  US: { avgSeedPreMoney: 7700000,  checklistMaxValuation: 16600000, riskFree10Y: 0.047, equityRiskPremium: 0.0446, corporateTaxRate: 0.2557 },
  GB: { avgSeedPreMoney: 7100000,  checklistMaxValuation: 15300000, riskFree10Y: 0.051, equityRiskPremium: 0.0501, corporateTaxRate: 0.2500 },
  DE: { avgSeedPreMoney: 6107000,  checklistMaxValuation: 13161000, riskFree10Y: 0.033, equityRiskPremium: 0.0423, corporateTaxRate: 0.3006 },
  FR: { avgSeedPreMoney: 5940000,  checklistMaxValuation: 12800000, riskFree10Y: 0.041, equityRiskPremium: 0.0501, corporateTaxRate: 0.3613 },
  NL: { avgSeedPreMoney: 5940000,  checklistMaxValuation: 12800000, riskFree10Y: 0.033, equityRiskPremium: 0.0423, corporateTaxRate: 0.2580 },
  IE: { avgSeedPreMoney: 6050000,  checklistMaxValuation: 13040000, riskFree10Y: 0.034, equityRiskPremium: 0.0501, corporateTaxRate: 0.1250 },
  ES: { avgSeedPreMoney: 4586000,  checklistMaxValuation: 9991000,  riskFree10Y: 0.037, equityRiskPremium: 0.0578, corporateTaxRate: 0.2500 },
  IT: { avgSeedPreMoney: 3919000,  checklistMaxValuation: 7277000,  riskFree10Y: 0.041, equityRiskPremium: 0.0669, corporateTaxRate: 0.2781 },
  SE: { avgSeedPreMoney: 7340000,  checklistMaxValuation: 15820000, riskFree10Y: 0.030, equityRiskPremium: 0.0423, corporateTaxRate: 0.2060 },
  CH: { avgSeedPreMoney: 8210000,  checklistMaxValuation: 17690000, riskFree10Y: 0.004, equityRiskPremium: 0.0423, corporateTaxRate: 0.1961 },
  IL: { avgSeedPreMoney: 6624000,  checklistMaxValuation: 15263000, riskFree10Y: 0.038, equityRiskPremium: 0.0630, corporateTaxRate: 0.2300 },
  AE: { avgSeedPreMoney: 6542000,  checklistMaxValuation: 13400000, riskFree10Y: 0.052, equityRiskPremium: 0.0487, corporateTaxRate: 0.0900 },
  SG: { avgSeedPreMoney: 5961000,  checklistMaxValuation: 15020000, riskFree10Y: 0.024, equityRiskPremium: 0.0423, corporateTaxRate: 0.1700 },
  HK: { avgSeedPreMoney: 6871000,  checklistMaxValuation: 13194000, riskFree10Y: 0.036, equityRiskPremium: 0.0501, corporateTaxRate: 0.1650 },
  IN: { avgSeedPreMoney: 3425000,  checklistMaxValuation: 9398000,  riskFree10Y: 0.069, equityRiskPremium: 0.0708, corporateTaxRate: 0.3000 },
  CN: { avgSeedPreMoney: 10250000, checklistMaxValuation: 14619000, riskFree10Y: 0.017, equityRiskPremium: 0.0514, corporateTaxRate: 0.2500 },
  JP: { avgSeedPreMoney: 6208000,  checklistMaxValuation: 11920000, riskFree10Y: 0.029, equityRiskPremium: 0.0514, corporateTaxRate: 0.2974 },
  KR: { avgSeedPreMoney: 6690000,  checklistMaxValuation: 12846000, riskFree10Y: 0.044, equityRiskPremium: 0.0487, corporateTaxRate: 0.2640 },
  CA: { avgSeedPreMoney: 6390000,  checklistMaxValuation: 14256000, riskFree10Y: 0.038, equityRiskPremium: 0.0423, corporateTaxRate: 0.2598 },
  BR: { avgSeedPreMoney: 4021000,  checklistMaxValuation: 9451000,  riskFree10Y: 0.146, equityRiskPremium: 0.0747, corporateTaxRate: 0.3400 },
  MX: { avgSeedPreMoney: 7692000,  checklistMaxValuation: 15367000, riskFree10Y: 0.092, equityRiskPremium: 0.0669, corporateTaxRate: 0.3000 },
  AU: { avgSeedPreMoney: 4186000,  checklistMaxValuation: 9756000,  riskFree10Y: 0.050, equityRiskPremium: 0.0423, corporateTaxRate: 0.3000 },
  ZA: { avgSeedPreMoney: 3027000,  checklistMaxValuation: 6726000,  riskFree10Y: 0.088, equityRiskPremium: 0.0813, corporateTaxRate: 0.2700 },
  NG: { avgSeedPreMoney: 2223000,  checklistMaxValuation: 5676000,  riskFree10Y: 0.171, equityRiskPremium: 0.1264, corporateTaxRate: 0.3000 },
  PL: { avgSeedPreMoney: 6068000,  checklistMaxValuation: 14656000, riskFree10Y: 0.059, equityRiskPremium: 0.0533, corporateTaxRate: 0.1900 },
  default: { avgSeedPreMoney: 2500000, checklistMaxValuation: 5500000, riskFree10Y: 0.050, equityRiskPremium: 0.070, corporateTaxRate: 0.2400 },
} as const;

// Currency the valuation report is displayed/labeled in, resolved automatically
// from the company's country -- never a founder-facing choice (Ed, 31 Aug 2026,
// see claude/track-11-currency-localization-scope.md). Rule as given: UK -> GBP,
// Europe -> EUR, everywhere else -> USD, with three named exceptions for European
// countries that are not on the euro and already have their own entry above:
// SE (SEK), CH (CHF), and PL (PLN) -- applying "Europe -> EUR" literally to these
// would mislabel them, the same issue flagged for SE/CH and confirmed by Ed;
// PL was found while building this table and extends the same already-approved
// principle rather than a new decision. This is a label only -- it does not
// change any discount-rate/multiple lookup, which stays keyed off COUNTRIES above.
export const CURRENCY_BY_COUNTRY: Partial<Record<keyof typeof COUNTRIES, string>> = {
  GB: 'GBP',
  DE: 'EUR', FR: 'EUR', NL: 'EUR', IE: 'EUR', ES: 'EUR', IT: 'EUR',
  SE: 'SEK',
  CH: 'CHF',
  PL: 'PLN',
  // everything else, including 'default', falls through to DEFAULT_CURRENCY
};
export const DEFAULT_CURRENCY = 'USD';

// Callers pass the country as a display name ("United Kingdom" -- what both the
// engine's own profile step and the Raise HQ portal wizard store), so every
// country-keyed lookup has to go through this rather than indexing COUNTRIES /
// CURRENCY_BY_COUNTRY directly. ISO codes ("GB") are accepted too.
export const COUNTRY_NAME_TO_CODE: Record<string, keyof typeof COUNTRIES> = {
  'united states': 'US', 'usa': 'US', 'us': 'US',
  'united kingdom': 'GB', 'uk': 'GB', 'britain': 'GB',
  'germany': 'DE',
  'france': 'FR',
  'netherlands': 'NL',
  'ireland': 'IE',
  'spain': 'ES',
  'italy': 'IT',
  'sweden': 'SE',
  'switzerland': 'CH',
  'israel': 'IL',
  'uae': 'AE', 'united arab emirates': 'AE',
  'singapore': 'SG',
  'hong kong': 'HK',
  'india': 'IN',
  'china': 'CN',
  'japan': 'JP',
  'south korea': 'KR', 'korea': 'KR',
  'canada': 'CA',
  'brazil': 'BR',
  'mexico': 'MX',
  'australia': 'AU',
  'south africa': 'ZA',
  'nigeria': 'NG',
  'poland': 'PL',
};

export function resolveCountryCode(country: string | undefined | null): keyof typeof COUNTRIES {
  const raw = (country || '').trim();
  if (raw && raw !== 'default' && raw.toUpperCase() in COUNTRIES) {
    return raw.toUpperCase() as keyof typeof COUNTRIES;
  }
  return COUNTRY_NAME_TO_CODE[raw.toLowerCase()] || 'default';
}

export function getCurrencyForCountry(country: string | undefined | null): string {
  return CURRENCY_BY_COUNTRY[resolveCountryCode(country)] ?? DEFAULT_CURRENCY;
}

/**
 * How well sourced this country's benchmark data actually is.
 *
 * These three sets are not a new judgement -- they restate the data-quality
 * note at the top of this file in a form code can branch on, so the report can
 * caveat a valuation honestly instead of presenting all 25 countries as equally
 * benchmarked. Keep them in step with that note: if a country graduates from
 * illustrative to sourced, it moves here at the same time.
 *
 *   validated     DE only. Average and max are both real, checked against a
 *                 genuine Equidam sample report.
 *   partial       Average sourced from PitchBook-NVCA / British Business Bank /
 *                 PitchBook-Europe 2025. The checklist max is a PROXY: DE's
 *                 validated max/avg ratio (2.155x) applied to the sourced
 *                 average, not an independently sourced figure.
 *   illustrative  Everything else, including 'default'. No adequate public
 *                 source was found. The file's own note says "do not treat as
 *                 benchmarked" and the report must say so too.
 */
export type CountryDataTier = 'validated' | 'partial' | 'illustrative';

const VALIDATED_COUNTRY_CODES = ['DE'] as const;
const PARTIALLY_SOURCED_COUNTRY_CODES = ['US', 'GB', 'FR', 'NL', 'IE', 'SE', 'CH'] as const;

export function getCountryDataTier(country: string | undefined | null): CountryDataTier {
  const code = resolveCountryCode(country);
  if ((VALIDATED_COUNTRY_CODES as readonly string[]).includes(code)) return 'validated';
  if ((PARTIALLY_SOURCED_COUNTRY_CODES as readonly string[]).includes(code)) return 'partial';
  return 'illustrative';
}

/**
 * Sector exit multiples, re-sourced 27 Sep 2026. Previously `INDUSTRIES` carried
 * `ebitdaMultiple` and `revenueMultiple` as two independent constants with NO
 * provenance comment of any kind, and they contradicted each other: SaaS held
 * 6.77x EBITDA and 1.04x revenue, an implied mature margin of 15.4%, while four
 * different sectors (SaaS, Fintech, AI/ML, MobileApp) shared one identical pair.
 *
 * Three independent lines of evidence said the REVENUE multiple was the broken
 * one, all recorded in AUDIT-05 and AUDIT-06:
 *
 *   1. The row contradicted itself. The spec's identity is
 *      EV/Revenue = EV/EBITDA x EBITDA margin, and "revenue multiple selection
 *      cannot be separated from mature-margin assumptions".
 *   2. The comparables users actually typed into the wizard run 4.1x to 10.9x
 *      revenue, median 6.0x -- against a table saying 1.04x.
 *   3. This repo's own test file already said so:
 *      "Development-stage SaaS typically valued at 4-8x revenue".
 *
 * These are EXIT multiples, applied to a YEAR-5 metric -- dcf_multiple uses
 * `revenueMultiple` and the VC method uses `ebitdaMultiple`. So the right
 * reference is a normalised through-cycle figure for a scaled business, not a
 * current growth-company ARR multiple. The DCF-EM spec is explicit: "A Year 5
 * business growing 15% should not automatically receive the same revenue multiple
 * as a current peer growing 70%."
 *
 * SOURCE. Aswath Damodaran's US industry datasets, January 2026:
 *   EV/Sales    pages.stern.nyu.edu/~adamodar/New_Home_Page/datafile/psdata.html
 *   EV/EBITDA   pages.stern.nyu.edu/~adamodar/New_Home_Page/datafile/vebitda.html
 * (the EV/EBITDA figures are the "only positive EBITDA firms" column).
 *
 * Both columns of every row come from the SAME source pair, so the implied mature
 * margin is the source's own and the two multiples cannot contradict each other.
 * A test asserts `revenueMultiple / ebitdaMultiple === impliedMatureMargin` for
 * every sector, which is what makes the 15.4%-vs-46.6% class of defect
 * unrepeatable rather than merely fixed.
 */
const SECTOR_SOURCE = {
  // Damodaran industry, its EV/Sales and EV/EBITDA, and the firm count behind it.
  SaaS:        { industry: 'Software (System & Application)', evSales: 11.41, evEbitda: 24.48, firms: 309, beta: 1.28, unleveredBeta: 1.25 },
  Fintech:     { industry: 'Software (System & Application)', evSales: 11.41, evEbitda: 24.48, firms: 309, beta: 1.28, unleveredBeta: 1.25,
                 note: 'Mapped to software rather than "Financial Svcs (Non-bank & Insurance)" (EV/Sales 18.91), whose revenue definition is not comparable for financial firms.' },
  AI_ML:       { industry: 'Software (System & Application)', evSales: 11.41, evEbitda: 24.48, firms: 309, beta: 1.28, unleveredBeta: 1.25 },
  MobileApp:   { industry: 'Software (System & Application)', evSales: 11.41, evEbitda: 24.48, firms: 309, beta: 1.28, unleveredBeta: 1.25 },
  Marketplace: { industry: 'Software (Internet)',             evSales:  9.56, evEbitda: 30.26, firms: 29, beta: 1.69, unleveredBeta: 1.59 },
  Ecommerce:   { industry: 'Retail (General)',                evSales:  2.05, evEbitda: 17.38, firms: 0, beta: 0.81, unleveredBeta: 0.78,
                 note: 'Damodaran publishes no "Retail (Online)" row; Retail (General) is the nearest.' },
  Healthtech:  { industry: 'Healthcare Information and Technology', evSales: 5.31, evEbitda: 21.27, firms: 115, beta: 1.11, unleveredBeta: 1.02 },
  Biotech:     { industry: 'Drugs (Biotechnology)',           evSales:  7.92, evEbitda: 15.78, firms: 496, beta: 1.14, unleveredBeta: 1.08 },
  Hardware:    { industry: 'Computers/Peripherals',           evSales:  6.63, evEbitda: 25.42, firms: 36, beta: 1.35, unleveredBeta: 1.32 },
  Deeptech:    { industry: 'Electronics (General)',           evSales:  3.21, evEbitda: 19.99, firms: 114, beta: 0.97, unleveredBeta: 0.94,
                 note: 'Deeptech spans many industries; electronics is a middling proxy, not a match.' },
  Cleantech:   { industry: 'Green & Renewable Energy',        evSales:  7.87, evEbitda: 13.44, firms: 15, beta: 0.86, unleveredBeta: 0.47 },
  Gaming:      { industry: 'Software (Entertainment)',        evSales:  9.13, evEbitda: 22.01, firms: 77, beta: 1.03, unleveredBeta: 1.02 },
  EdTech:      { industry: 'Education',                      evSales:  1.99, evEbitda:  9.26, firms: 32, beta: 0.78, unleveredBeta: 0.72 },
  Logistics:   { industry: 'Transportation',                  evSales:  1.64, evEbitda: 12.55, firms: 19, beta: 0.86, unleveredBeta: 0.71 },
  PropTech:    { industry: 'Real Estate (Operations & Services)', evSales: 1.46, evEbitda: 21.95, firms: 54, beta: 0.97, unleveredBeta: 0.86 },
  Media:       { industry: 'Entertainment',                   evSales:  4.33, evEbitda: 19.41, firms: 92, beta: 0.83, unleveredBeta: 0.76 },
  default:     { industry: 'Total Market (without financials)', evSales: 3.46, evEbitda: 16.95, firms: 4822, beta: 0.99, unleveredBeta: 0.9,
                 note: 'Deliberately the whole-market figure rather than a generous sector guess. The previous default (3.00x revenue, 9.00x EBITDA, beta 1.05) was RICHER than SaaS on every axis, so leaving `industry` blank was worth +37% on the composite across 7 of 23 production snapshots. A fallback must never beat the thing it stands in for.' },
} as const;

/**
 * Discount applied to Damodaran's published sector aggregates to reach a figure
 * appropriate to a small company.
 *
 * WHY ONE IS NEEDED. Damodaran's tables are aggregates (total EV / total sales),
 * which is cap-weighted, so a handful of mega-caps dominate. Software (System &
 * Application) reads 11.41x EV/Sales across 309 firms largely because of the few
 * largest. Our companies reach single-digit millions of revenue by year 5.
 *
 * CALIBRATION. Software is the one sector with a second, independent reading at
 * the right size cohort: the SaaS Capital Index and the SEG SaaS Index both put
 * the EQUAL-WEIGHTED median near 3.2x TTM revenue as of mid-2026. 3.2 / 11.41 =
 * 0.28. Applied to both columns of a row it leaves the implied margin untouched,
 * so consistency survives.
 *
 * THE HONEST WEAKNESS, stated because it matters. One calibration point is
 * applied to seventeen sectors, and it is almost certainly too harsh for those
 * whose aggregate is NOT mega-cap distorted -- Transportation (19 firms),
 * Education (32), Real Estate (54). Per-sector small-cap medians are the fix and
 * are not available here. The factor is deliberately a single named constant so
 * that fix lands in one place.
 *
 * THE ALTERNATIVE CONSIDERED. A 0.5 factor puts SaaS at 5.7x, which matches both
 * the comparables users entered (median 6.0x) and this repo's own "4-8x revenue"
 * comment. It was rejected because those are entry multiples for companies still
 * growing fast, and these are EXIT multiples for a business five years further on
 * -- exactly the substitution the DCF-EM spec warns against. 0.28 is the
 * conservative, public, equal-weighted, through-cycle reading.
 */
export const SMALL_COMPANY_MULTIPLE_FACTOR = 0.28;

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Betas, re-sourced 28 Sep 2026 -- the last unsourced column in this table.
 *
 * They had no provenance comment and several were not defensible: Cleantech 0.46
 * and Media 0.48 implied businesses roughly half as volatile as the market, and
 * Cleantech's is what drove the Swiss Cleantech discount rate to 2.35% and broke
 * the Gordon denominator (see MIN_LTG_SPREAD). `default` at 1.05 also sat ABOVE
 * the market, which is not what a whole-market fallback should be.
 *
 * They now come from the SAME Damodaran row as that sector's multiples, so beta
 * and multiples describe one industry rather than two. The mapping lives in
 * SECTOR_SOURCE and a test asserts the two cannot diverge.
 *
 * LEVERED, NOT UNLEVERED. The engine discounts FCFE -- a levered cash flow, after
 * interest and including debt movements -- at a cost of equity, so the consistent
 * pairing is an equity (levered) beta. Damodaran's unlevered-corrected-for-cash
 * figures are carried alongside for the re-levering work below but are not used.
 *
 * The approximation that makes this safe is small, and measured rather than
 * assumed: re-levering software's unlevered 1.25 at Northwind's own capital
 * structure gives 1.309 against Damodaran's levered 1.28, a 2.3% difference,
 * using MARKET-value weights (D/E 0.063 at a ~4m equity value). At BOOK weights
 * it would read 1.589, but book equity for a startup is accumulated losses plus
 * paid-in capital rather than value, and the DCF-LTG spec names "using book-value
 * rather than market-value capital weights without justification" as a Common
 * Error. Per-company re-levering at market weights is the refinement; it is worth
 * about 2% on the rate here and needs a D/E input the discount rate does not
 * currently take.
 *
 * WHY NOT TOTAL BETA. Damodaran argues for total beta (beta / correlation with
 * the market) when an owner is undiversified, which is the case for a founder.
 * It is deliberately not used: it captures undiversification and illiquidity,
 * which this engine already charges twice over through SIZE_PREMIUM_BANDS and
 * ILLIQUIDITY_DISCOUNT_DEFAULT. Adding total beta on top would be the third
 * charge for one risk -- the same double-count reasoning that capped the size
 * premium at CRSP decile 10 rather than 10z.
 */
export const INDUSTRIES = Object.fromEntries(
  (Object.keys(SECTOR_SOURCE) as Array<keyof typeof SECTOR_SOURCE>).map((key) => {
    const src = SECTOR_SOURCE[key];
    return [key, {
      beta: src.beta,
      revenueMultiple: round2(src.evSales * SMALL_COMPANY_MULTIPLE_FACTOR),
      ebitdaMultiple: round2(src.evEbitda * SMALL_COMPANY_MULTIPLE_FACTOR),
      /** Damodaran's unlevered-corrected-for-cash beta. Carried, not used. */
      unleveredBeta: src.unleveredBeta,
      /** The source's own implied mature EBITDA margin: EV/Sales / EV/EBITDA. */
      impliedMatureMargin: src.evSales / src.evEbitda,
      source: `Damodaran US industry data, January 2026, "${src.industry}" (${src.firms} firms), scaled by SMALL_COMPANY_MULTIPLE_FACTOR.`,
    }];
  })
) as Record<keyof typeof SECTOR_SOURCE, {
  beta: number; unleveredBeta: number; revenueMultiple: number; ebitdaMultiple: number;
  impliedMatureMargin: number; source: string;
}>;

/**
 * Required annual return for the VC method, by stage. Re-based 28 Sep 2026.
 *
 * WHAT WAS WRONG. The three earliest stages sat above anything the method spec
 * cites for any stage, and by a long way:
 *
 *   idea         135.93%  ->  implied 73x over five years
 *   development  111.47%  ->  implied 42x
 *   startup       89.12%  ->  implied 24x
 *
 * A 73x five-year MOIC is not an underwriting hurdle. The spec's published
 * ranges (Sahlman) top out at 50-70% for the earliest stage, with a note that
 * "other instructional materials show similarly broad ranges, including
 * seed-stage rates above 80% in some formulations". 135.93% is not in that
 * neighbourhood.
 *
 * The three later stages were already inside the spec's ranges and are LEFT
 * UNCHANGED -- expansion at 48.60% also happens to match Equidam's own stated
 * "minimum of about 48%", which is the only external validation point this table
 * has, and there is no reason to spend it.
 *
 * MAPPING. The engine's six stages run earliest to latest, as do Sahlman's, so
 * they map in order:
 *
 *   engine        Sahlman row     published range   taken
 *   idea          Startup            50-70%          70%
 *   development   First stage        40-60%          60%
 *   startup       Second stage       35-50%          50%
 *   expansion     Third stage        35-50%        48.60%  (unchanged)
 *   growth        Fourth stage       30-40%        36.20%  (unchanged)
 *   maturity      IPO                25-35%        26.10%  (unchanged)
 *
 * WHY THE TOP OF EACH RANGE rather than the midpoint. This method applies NO
 * survival curve -- unlike the two DCFs, which carry SURVIVAL_RATES_BY_COUNTRY --
 * so its hurdle legitimately carries the failure load. The spec is explicit that
 * classic VCM "usually values a success case and embeds failure and
 * underperformance risk in a high target return". The conservative end of the
 * published range is therefore the right pick, and it keeps the ladder monotonic
 * above expansion's fixed 48.60%.
 *
 * Note the compression between `startup` (50%) and `expansion` (48.60%): only
 * 1.4pp. That is not an artefact, it is Sahlman's own Second and Third stage
 * ranges being identical at 35-50%.
 *
 * WHAT THESE ARE NOT, because the substitution is tempting and wrong. Contemporary
 * surveys put target FUND net IRR at roughly 30%+ for seed funds and 25-35% for
 * Series A. Those are portfolio returns, net of fees and AFTER most holdings have
 * failed. The figure this table needs is the per-company hurdle applied to a
 * single success case, which must be higher for exactly that reason. Using a fund
 * net IRR here would understate the hurdle badly, and the spec warns against the
 * mirror-image error too: "Using a 40% venture target return as WACC in a
 * perpetual-growth DCF is generally not the same as estimating the company's
 * market-participant cost of capital."
 *
 * STILL OPEN. The spec's own guidance is that these are "historical conventions,
 * not universal contemporary mandates" and that a hurdle should be built
 * deliberately against stage, time to exit, dilution, capital intensity and fund
 * economics. This table is a defensible published baseline, not that build-up.
 */
export const VC_REQUIRED_ROI = {
  idea: 0.70,
  development: 0.60,
  startup: 0.50,
  expansion: 0.4860,
  growth: 0.3620,
  maturity: 0.2610,
} as const;

export const STAGE_DEFAULT_WEIGHTS = {
  idea: { scorecard: 0.38, checklist: 0.38, vc: 0.16, dcf_ltg: 0.04, dcf_multiple: 0.04, multiples: 0 },
  development: { scorecard: 0.30, checklist: 0.30, vc: 0.16, dcf_ltg: 0.12, dcf_multiple: 0.12, multiples: 0 },
  startup: { scorecard: 0.15, checklist: 0.15, vc: 0.16, dcf_ltg: 0.27, dcf_multiple: 0.27, multiples: 0 },
  expansion: { scorecard: 0.06, checklist: 0.06, vc: 0.16, dcf_ltg: 0.36, dcf_multiple: 0.36, multiples: 0 },
  growth: { scorecard: 0, checklist: 0, vc: 0.20, dcf_ltg: 0.40, dcf_multiple: 0.40, multiples: 0 },
  maturity: { scorecard: 0, checklist: 0, vc: 0, dcf_ltg: 0.50, dcf_multiple: 0.50, multiples: 0 },
} as const;

export const SURVIVAL_RATES = [0.8869, 0.7945, 0.7164, 0.6487, 0.5891, 0.5357];

// Per-country 6-year survival curves. Year 6 in every row is MODELED (year-5 x the year-4-to-5 decay
// ratio) since no source publishes a 6-year figure -- years 1-5 are sourced as noted, or a documented
// interpolation between two sourced anchor years where the full curve wasn't published.
// Countries not listed here have no adequate public cohort-survival data found (Israel, UAE, Singapore,
// Hong Kong, India, China, South Africa, Nigeria) -- they fall back to SURVIVAL_RATES (the prior global
// default) until real data is found; do not fabricate curves for them.
export const SURVIVAL_RATES_BY_COUNTRY: Partial<Record<keyof typeof COUNTRIES, number[]>> = {
  // Source: PitchBook-NVCA context aside -- these are Census Bureau BDS / BLS BED framework figures.
  US: [0.79, 0.69, 0.62, 0.56, 0.51, 0.4645],
  // Source: ONS Business Demography, UK: 2024.
  GB: [0.91, 0.75, 0.63, 0.50, 0.384, 0.2949],
  // DE deliberately excluded: SURVIVAL_RATES (the "global default" below) IS Germany's real curve --
  // it was reverse-engineered from the NovaCloud sample report, whose appendix confirms these exact
  // figures (88.69/79.45/71.64/64.87/58.91/53.57%) are Equidam's actual Germany output, not a generic
  // default. A Destatis-sourced alternative curve was tried here and rejected: it produced DCF-LTG and
  // DCF-Multiple values ~30% below the validated NovaCloud benchmark. Falls through to SURVIVAL_RATES,
  // which is correct for Germany specifically.
  // Source: INSEE Analyses, 2010 creation cohort tracked to 2015. Fully sourced, no interpolation.
  FR: [0.906, 0.801, 0.712, 0.638, 0.604, 0.5718],
  // Source: secondary press citing EU-startup survival research; only Y1 and Y5 anchors are sourced,
  // Y2-4 geometrically interpolated between them.
  NL: [0.92, 0.8015, 0.6983, 0.6084, 0.53, 0.4618],
  // Source: CSO Ireland, "Business in Ireland 2023 -- Insights on the Lifecycle of Businesses". Fully sourced.
  IE: [0.798, 0.635, 0.598, 0.556, 0.476, 0.4075],
  // Source: INE, Demografia Armonizada de Empresas 2023.
  ES: [0.85, 0.712, 0.597, 0.50, 0.419, 0.3511],
  // Source: Equidam's own methodology page (ISTAT-based) for Y1-3; Y4-5 extrapolated at the same decay ratio.
  IT: [0.761, 0.622, 0.526, 0.4449, 0.375, 0.3167],
  // Source: cross-country Eurostat-based microenterprise survival study, 2013-2018 cohorts; Y5 anchor,
  // other years assumed from the same study's shape.
  SE: [0.93, 0.875, 0.823, 0.775, 0.73, 0.6876],
  // Source: BFS (Federal Statistical Office) / kmu.admin.ch, 2022 -> 2018 cohorts.
  CH: [0.84, 0.726, 0.639, 0.573, 0.514, 0.4611],
  // Source: METI/SME Agency White Paper 2023 -- Y5 is the real widely-cited figure, earlier years assumed shape.
  JP: [0.97, 0.93, 0.89, 0.85, 0.807, 0.7662],
  // Source: Statistics Korea (2010-2018 cohort, individual/self-employed businesses).
  KR: [0.78, 0.592, 0.45, 0.374, 0.31, 0.2570],
  // Source: StatCan Entrepreneurship Indicators Database -- Y1/Y2 sourced, Y3-5 extrapolated.
  CA: [0.906, 0.729, 0.587, 0.472, 0.380, 0.3059],
  // Source: IBGE, 2017 formal-business cohort. Fully sourced.
  BR: [0.762, 0.596, 0.494, 0.423, 0.379, 0.3396],
  // Source: ABS Counts of Australian Businesses -- Y1/Y4 sourced, Y2/Y3/Y5 interpolated/extrapolated.
  AU: [0.77, 0.675, 0.592, 0.52, 0.456, 0.3999],
  // Source: GUS/PARP, 2011 cohort (Report on the State of the SME Sector in Poland). Fully sourced.
  PL: [0.86, 0.70, 0.54, 0.47, 0.44, 0.4119],
};

/**
 * Size premium added to the CAPM cost of equity, banded by last actual revenue.
 *
 * WHY THIS EXISTS. Before 27 Sep 2026 the discount rate was bare CAPM --
 * `riskFree10Y + beta * equityRiskPremium` -- with no size or stage adjustment.
 * That is a mature-listed-company cost of equity being applied to a startup, and
 * the DCF-LTG method spec names it directly: "using a mature public-company WACC
 * for a pre-revenue startup may understate risk". It also produced 31 of 442
 * country x industry combinations with a rate below 5.5%, two of them below the
 * 2.5% terminal growth rate -- see MIN_LTG_SPREAD, which was the guardrail for
 * the symptom while this is the correction for the cause.
 *
 * WHAT IT COVERS, AND DELIBERATELY DOES NOT. Both DCF specs warn against
 * counting the same risk twice ("Avoid loading failure risk into both a low
 * survival probability and an arbitrary additional WACC premium"). The engine
 * already models separately:
 *
 *   time value              -> riskFree10Y
 *   systematic risk         -> beta x equityRiskPremium
 *   FAILURE probability     -> SURVIVAL_RATES_BY_COUNTRY (GB: 38.4% by year 5)
 *   ILLIQUIDITY             -> ILLIQUIDITY_DISCOUNT_DEFAULT (25%)
 *
 * So this premium covers SIZE ONLY. It is not a failure premium and not an
 * illiquidity premium, and it must not be raised toward venture hurdle rates to
 * compensate for either. That is why it lands a startup near 20-23% rather than
 * the 40-70% of VC_REQUIRED_ROI: those figures are investor target returns that
 * carry the whole portfolio failure load, which is the VC method's job and not
 * this one. Both specs are explicit that the two are different quantities --
 * "Using a 40% venture target return as WACC in a perpetual-growth DCF is
 * generally not the same as estimating the company's market-participant cost of
 * capital."
 *
 * SOURCING. The one real anchor is Kroll's Cost of Capital Navigator (the CRSP
 * decile size premia, formerly Duff & Phelps):
 *
 *   decile 10  (smallest 10% of listed firms)   4.7%   Kroll, cited 2024
 *
 * Bands above it are a coarse read of deciles 6-9 rather than per-decile figures,
 * marked `modelled` -- the same convention SPEC-benchmark-reference-table.md
 * uses. Only the bottom band is `sourced`.
 *
 * WHY IT STOPS AT DECILE 10 AND NOT 10z. Kroll also publishes decile 10z (the
 * smallest half of the smallest half), at 11.17% in 2022. A GBP 900k-revenue
 * startup is far below even that, so extrapolating there looks defensible and is
 * not, for two reasons measured on 27 Sep 2026:
 *
 *   1. The listed size effect is substantially an ILLIQUIDITY effect -- a
 *      long-standing criticism of small-decile size premia. The engine already
 *      charges illiquidity explicitly at 25%. Stacking 10z on top of that
 *      charges the same risk twice, which is the exact trap both DCF specs warn
 *      about.
 *   2. The arithmetic bears it out. At 10z the rate reaches 22.46% and the
 *      Gordon multiple collapses from 11.7x to 5.1x, valuing Northwind's
 *      DCF-LTG at 1,140,821 -- 1.27x its last actual revenue, for a company
 *      forecasting 8.2m by year 5, after a 61.6% survival haircut and a 25%
 *      illiquidity discount have already been applied. At decile 10 the same
 *      company lands at 1,886,798, or 2.1x revenue, which is severe but
 *      defensible.
 *
 * So the bottom band is held flat at the sourced decile-10 figure. That means a
 * pre-revenue company and a 4.9m-revenue company carry the same premium, which is
 * a real limitation and preferred to inventing a gradient below the data. It is
 * also less consequential than it looks: the stage weights give DCF-LTG 4% at
 * `idea` against 36% at `expansion`, so the earliest companies lean on the
 * qualitative methods anyway.
 *
 * CURRENCY. Bands are in the company's own currency, matching the engine's
 * standing no-FX-conversion decision (31 Aug 2026). A EUR 1m company and a
 * GBP 1m company land in the same band; at these thresholds that is inside the
 * noise of the underlying data.
 */
export const SIZE_PREMIUM_BANDS: ReadonlyArray<{
  /** Inclusive lower bound of last actual revenue, in the company's own currency. */
  minRevenue: number;
  premium: number;
  basis: 'sourced' | 'modelled';
  source: string;
}> = [
  { minRevenue: 500_000_000, premium: 0,     basis: 'modelled', source: 'At or above CRSP mid-cap; no size premium applied.' },
  { minRevenue: 100_000_000, premium: 0.010, basis: 'modelled', source: 'Coarse read of CRSP deciles 6-8; interpolated toward zero.' },
  { minRevenue:  25_000_000, premium: 0.020, basis: 'modelled', source: 'Coarse read of CRSP decile 9.' },
  { minRevenue:   5_000_000, premium: 0.030, basis: 'modelled', source: 'Interpolated between decile 9 and decile 10.' },
  { minRevenue:            0, premium: 0.047, basis: 'sourced',  source: 'Kroll Cost of Capital Navigator, CRSP decile 10 size premium, cited 2024. Held FLAT below this rather than extrapolated to decile 10z (11.2%) -- see the note on the illiquidity overlap.' },
];

/** Resolve the size premium for a company from its last actual revenue. */
export function resolveSizePremium(lastYearRevenue: number): {
  premium: number;
  basis: 'sourced' | 'modelled';
  source: string;
  bandMinRevenue: number;
} {
  const revenue = Number.isFinite(lastYearRevenue) && lastYearRevenue > 0 ? lastYearRevenue : 0;
  // Bands are ordered largest-first, so the first match is the right one.
  const band = SIZE_PREMIUM_BANDS.find((b) => revenue >= b.minRevenue) ?? SIZE_PREMIUM_BANDS[SIZE_PREMIUM_BANDS.length - 1];
  return { premium: band.premium, basis: band.basis, source: band.source, bandMinRevenue: band.minRevenue };
}

export const ILLIQUIDITY_DISCOUNT_DEFAULT = 0.25;
export const LTG_GROWTH_RATE_DEFAULT = 0.025;
export const LTG_GROWTH_RATE_MIN = 0.001;
export const LTG_GROWTH_RATE_MAX = 0.025;

/**
 * Payne's published Scorecard weights, all seven factors.
 *
 * `funding_required` was 0.10 and `other` was absent, having been folded into it.
 * Both versions summed to 1.00 so nothing broke, but capital-needs sensitivity
 * ran at double the method's intent and the "Other" bucket -- regulatory, legal,
 * customer concentration, exceptional assets -- was unrepresented. Corrected
 * against the spec in raise-hq-portal's claude/valuation methods/.
 *
 * `other` has no sub-trait rubric yet, so scoring.ts returns a neutral 0 delta
 * for it. That is deliberate: it restores the correct weighting immediately
 * without inventing a score, and the 5% is there to be filled when the factors
 * behind it are actually collected.
 */
export const SCORECARD_CRITERIA_WEIGHTS = {
  team: 0.30,
  opportunity: 0.25,
  product_ip: 0.15,
  competitive_env: 0.10,
  partnerships: 0.10,
  funding_required: 0.05,
  other: 0.05,
} as const;

/**
 * Payne's rating scale: 0.50 materially below the comparable average, 1.00
 * average, 1.50 materially above. With weights summing to 1 the composite
 * multiplier cannot legitimately land outside this band, so it is clamped.
 */
export const SCORECARD_MULTIPLIER_MIN = 0.5;
export const SCORECARD_MULTIPLIER_MAX = 1.5;

export const CHECKLIST_CRITERIA_WEIGHTS = {
  team: 0.30,
  idea: 0.20,
  product_ip: 0.15,
  relationships: 0.15,
  operating_stage: 0.20,
} as const;
