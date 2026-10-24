import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import * as core from '../index';

const NAMED = [
  'computeValuation', 'buildDefaultParameters', 'computeSensitivity', 'validateWizardData', 'hasBlockingIssues',
  'computeWeightedValuation', 'getCountryDataTier', 'resolveCountryCode', 'resolveIndustry',
  'formatCurrency', 'formatGrowth', 'formatPercent', 'diffParameters', 'getDataQualityDisclaimer',
  'COUNTRIES', 'CURRENCY_BY_COUNTRY', 'COUNTRY_NAME_TO_CODE', 'REGION_BY_COUNTRY', 'INDUSTRIES', 'INDUSTRY_ALIASES',
  'SECTOR_SOURCE', 'VALUATION_BENCHMARKS', 'BENCHMARK_STAGE_BY_COMPANY_STAGE', 'STAGE_DEFAULT_WEIGHTS', 'VC_REQUIRED_ROI',
  'SURVIVAL_RATES_BY_COUNTRY', 'SURVIVAL_RATES', 'SIZE_PREMIUM_BANDS', 'SMALL_COMPANY_MULTIPLE_FACTOR',
  'CHECKLIST_MAX_RATIO', 'SCORECARD_CRITERIA_WEIGHTS', 'LTG_GROWTH_RATE_DEFAULT', 'MIN_LTG_SPREAD',
  'ENGINE_VERSION', 'REFERENCE_DATA_AS_OF',
  'INTAKE_FORM_VERSION', 'INTAKE_STEPS', 'INTAKE_FIELDS', 'mapIntakeToEngine', 'suggestStage',
] as const;

describe('public exports', () => {
  it.each(NAMED.map((n) => [n]))('exports %s', (name) => {
    expect((core as Record<string, unknown>)[name]).toBeDefined();
  });

  it('ENGINE_VERSION is the package version', () => {
    const pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8'));
    expect(core.ENGINE_VERSION).toBe(pkg.version);
  });

  it('every reference dataset date is an ISO date, an ISO month or null', () => {
    for (const [k, v] of Object.entries(core.REFERENCE_DATA_AS_OF)) {
      expect({ k, ok: v === null || /^\d{4}-\d{2}(-\d{2})?$/.test(v) }).toEqual({ k, ok: true });
    }
  });
});
