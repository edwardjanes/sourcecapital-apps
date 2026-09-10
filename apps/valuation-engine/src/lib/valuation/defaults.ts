import {
  UpdatedValuationParameters,
  CompanyProfile,
  FinancialYear,
  CompanyStage,
} from './types';
import {
  COUNTRIES,
  INDUSTRIES,
  STAGE_DEFAULT_WEIGHTS,
  VC_REQUIRED_ROI,
  ILLIQUIDITY_DISCOUNT_DEFAULT,
  LTG_GROWTH_RATE_DEFAULT,
  SURVIVAL_RATES,
  SURVIVAL_RATES_BY_COUNTRY,
} from './referenceData';
import { deriveFcfeByYear } from './fcf';

const COUNTRY_NAME_TO_CODE: Record<string, keyof typeof COUNTRIES> = {
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

export function buildDefaultParameters(
  profile: CompanyProfile,
  financials: FinancialYear[],
  balanceSheet?: { non_operating_cash?: number }
): UpdatedValuationParameters {
  // Look up country data from reference data
  const normalizedCountry = (profile.country || '').toLowerCase().trim();
  const countryKey = COUNTRY_NAME_TO_CODE[normalizedCountry] || 'default';
  const countryRef = COUNTRIES[countryKey];
  const countryData = {
    name: profile.country,
    avg_seed_pre_money: countryRef.avgSeedPreMoney,
    checklist_max_valuation: countryRef.checklistMaxValuation,
    risk_free_rate: countryRef.riskFree10Y,
    equity_risk_premium: countryRef.equityRiskPremium,
  };

  // Use country-specific survival rates if available, fall back to global default
  const survivalRates = SURVIVAL_RATES_BY_COUNTRY[countryKey] || SURVIVAL_RATES;

  // Look up industry data from reference data
  const industryKey = (Object.keys(INDUSTRIES) as (keyof typeof INDUSTRIES)[]).find(
    (key) => key.toLowerCase().replace(/_/g, '').replace(' ', '') ===
             (profile.industry || '').toLowerCase().replace(/_/g, '').replace(/\s/g, '')
  ) || 'default';
  const industryRef = INDUSTRIES[industryKey];
  const industryData = {
    name: profile.industry,
    beta: industryRef.beta,
    revenue_multiple: industryRef.revenueMultiple,
    ebitda_multiple: industryRef.ebitdaMultiple,
  };

  const stageNormalized = (profile.stage as string).toLowerCase();
  const stageWeights =
    STAGE_DEFAULT_WEIGHTS[stageNormalized as keyof typeof STAGE_DEFAULT_WEIGHTS] ||
    STAGE_DEFAULT_WEIGHTS.development;

  const requiredRoi =
    VC_REQUIRED_ROI[stageNormalized as keyof typeof VC_REQUIRED_ROI] || VC_REQUIRED_ROI.development;

  // Last year revenue (yearOffset: -1)
  const lastYearFinancial = financials.find((f) => f.yearOffset === -1);
  const lastYearRevenue = lastYearFinancial?.revenue || 0;

  // Terminal year revenue (yearOffset: 5, or last available)
  const terminalFinancial = financials.find((f) => f.yearOffset === 5) || financials[financials.length - 1];
  const terminalRevenue = terminalFinancial?.revenue || lastYearRevenue;

  // Terminal year EBITDA, derived the same way as the P&L/FCFE tables (revenue - cogs - salaries - otherOpex)
  // so the VC Method's exit value is computed on the same basis the methodology specifies: EBITDA x an
  // EBITDA multiple, not revenue x an EBITDA multiple.
  const fcfeByYear = deriveFcfeByYear(financials);
  const terminalFcfeYear =
    fcfeByYear.find((f) => f.yearOffset === 5) || fcfeByYear[fcfeByYear.length - 1];
  const terminalEbitda = terminalFcfeYear?.ebitda ?? 0;

  // Discount rate via CAPM
  const discountRate = countryData.risk_free_rate + industryData.beta * countryData.equity_risk_premium;

  return {
    stage: profile.stage,

    // Method weights
    method_weights: {
      scorecard: stageWeights.scorecard || 0,
      checklist: stageWeights.checklist || 0,
      vc: stageWeights.vc || 0.16,
      dcf_ltg: stageWeights.dcf_ltg || 0.27,
      dcf_multiple: stageWeights.dcf_multiple || 0.27,
      multiples: stageWeights.multiples || 0,
    },

    // Scorecard parameters
    scorecard: {
      average_pre_money_valuation: countryData.avg_seed_pre_money,
    },

    // Checklist parameters
    checklist: {
      max_valuation: countryData.checklist_max_valuation,
    },

    // VC Method parameters
    // terminal_metric_value is EBITDA (not revenue) — it's paired with an EBITDA multiple below,
    // matching Equidam's methodology: Exit Value = terminal-year EBITDA x industry EBITDA multiple.
    vc_method: {
      terminal_metric_value: terminalEbitda,
      industry_multiple: industryData.ebitda_multiple,
      required_roi: requiredRoi,
      projection_years: 5,
    },

    // DCF shared parameters
    dcf_shared: {
      discount_rate: discountRate,
      illiquidity_discount: ILLIQUIDITY_DISCOUNT_DEFAULT,
      non_operating_cash: balanceSheet?.non_operating_cash ?? 0,
    },

    // DCF LTG parameters
    dcf_ltg: {
      terminal_growth_rate: LTG_GROWTH_RATE_DEFAULT,
      survival_rates: survivalRates,
    },

    // DCF Multiple parameters
    dcf_multiple: {
      exit_multiple: industryData.revenue_multiple,
      survival_rates: survivalRates,
    },

    // Simple Multiples parameters
    simple_multiples: {
      last_year_metric: lastYearRevenue,
      metric_type: 'revenue',
    },

    // Comparables (empty by default, user-filled)
    comparables: [],
  };
}
