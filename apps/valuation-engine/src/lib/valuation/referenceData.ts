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

export function getCurrencyForCountry(country: string | undefined | null): string {
  if (!country) return DEFAULT_CURRENCY;
  return CURRENCY_BY_COUNTRY[country as keyof typeof COUNTRIES] ?? DEFAULT_CURRENCY;
}

export const INDUSTRIES = {
  SaaS:        { beta: 1.23, ebitdaMultiple: 6.77, revenueMultiple: 1.04 },
  Fintech:     { beta: 0.78, ebitdaMultiple: 6.77, revenueMultiple: 1.04 },
  AI_ML:       { beta: 1.55, ebitdaMultiple: 6.77, revenueMultiple: 1.04 },
  Marketplace: { beta: 0.92, ebitdaMultiple: 8.00, revenueMultiple: 1.19 },
  Ecommerce:   { beta: 0.76, ebitdaMultiple: 8.00, revenueMultiple: 1.19 },
  Healthtech:  { beta: 0.69, ebitdaMultiple: 7.94, revenueMultiple: 1.29 },
  Biotech:     { beta: 1.03, ebitdaMultiple: 7.90, revenueMultiple: 1.30 },
  Hardware:    { beta: 1.31, ebitdaMultiple: 7.26, revenueMultiple: 0.85 },
  Deeptech:    { beta: 1.40, ebitdaMultiple: 10.47, revenueMultiple: 1.29 },
  Cleantech:   { beta: 0.46, ebitdaMultiple: 9.35, revenueMultiple: 3.55 },
  MobileApp:   { beta: 1.55, ebitdaMultiple: 6.77, revenueMultiple: 1.04 },
  Gaming:      { beta: 1.01, ebitdaMultiple: 6.93, revenueMultiple: 1.73 },
  EdTech:      { beta: 0.66, ebitdaMultiple: 4.68, revenueMultiple: 0.81 },
  Logistics:   { beta: 0.85, ebitdaMultiple: 7.15, revenueMultiple: 0.89 },
  PropTech:    { beta: 0.58, ebitdaMultiple: 6.53, revenueMultiple: 2.39 },
  Media:       { beta: 0.48, ebitdaMultiple: 6.08, revenueMultiple: 0.81 },
  default:     { beta: 1.05, ebitdaMultiple: 9, revenueMultiple: 3 },
} as const;

export const VC_REQUIRED_ROI = {
  idea: 1.3593,
  development: 1.1147,
  startup: 0.8912,
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

export const ILLIQUIDITY_DISCOUNT_DEFAULT = 0.25;
export const LTG_GROWTH_RATE_DEFAULT = 0.025;
export const LTG_GROWTH_RATE_MIN = 0.001;
export const LTG_GROWTH_RATE_MAX = 0.025;

export const SCORECARD_CRITERIA_WEIGHTS = {
  team: 0.30,
  opportunity: 0.25,
  competitive_env: 0.10,
  product_ip: 0.15,
  partnerships: 0.10,
  funding_required: 0.10,
} as const;

export const CHECKLIST_CRITERIA_WEIGHTS = {
  team: 0.30,
  idea: 0.20,
  product_ip: 0.15,
  relationships: 0.15,
  operating_stage: 0.20,
} as const;
