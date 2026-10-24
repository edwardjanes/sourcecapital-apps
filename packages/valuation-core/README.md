# @edwardjanes/valuation-core

The pure valuation library behind the Raise HQ valuation engine (`apps/valuation-engine`) and TheAngel. Six methods (scorecard, checklist, VC, DCF long-term growth, DCF exit multiple, simple multiples), their reference data, and the intake mapping. No runtime dependencies, no framework, database or network code.

## Install

Published to GitHub Packages. In the consuming project's `.npmrc`:

```
@edwardjanes:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${NPM_GITHUB_TOKEN}
```

`NPM_GITHUB_TOKEN` is a classic PAT with `read:packages`, or a fine-grained token with package read. Pin an exact version.

## Use

```ts
import { mapIntakeToEngine, buildDefaultParameters, computeValuation, computeSensitivity, ENGINE_VERSION } from '@edwardjanes/valuation-core';

const { company, financials, questionnaire, balanceSheet } = mapIntakeToEngine(answers, grid, balance, { asOf, currency });
const profile = { name: company.name, country: company.country, industry: company.industry, stage: company.stage };
const params = buildDefaultParameters(profile, financials, balanceSheet);
const report = await computeValuation(profile, financials, questionnaire, { ...params, comparables: [] });
```

The engine app's `/api/valuation/compute` route is the reference caller.

## Intake

- `INTAKE_STEPS`, `INTAKE_FIELDS`, `IntakeAnswers`, `INTAKE_FORM_VERSION`: the intake form, ported from `docs/design/valuation/valuation-intake-data.js`. Steps `comparables` and `advisor_overrides` are advisor only (`founderVisible: false`).
- `mapIntakeToEngine`: intake answers to the compute route's body. Ported from the Raise HQ portal's `valuationPayload.js`; a test round-trips a portal form through both and compares key by key.
- `suggestStage`: the company stage to suggest from the listing stage, last actual revenue and EBITDA, and roll-out.

## TheAngel: one run, one call

TheAngel calls `runAngelValuation(ctx)` and nothing else on a run. It is pure: no I/O, and the same context always gives the same result.

```ts
import { runAngelValuation, type ValuationContext } from '@edwardjanes/valuation-core';

const ctx: ValuationContext = {
  answers,                       // IntakeAnswers, keyed by intake field id
  financials,                    // the grid: base year first, then five forecast years, keyed by grid row id
  balance,                       // the nine balance-sheet fields
  opts: { asOf: '2026-10-24', currency: 'GBP' },
  sources: { 'grid.revenue.0': 'verified', tam: 'founder' },
  confirmed: { stageConfirmed: 'startup', industryConfirmed: 'SaaS' },
  facts: { listingStage: 'seed', hasFinancialModel: true, lastUpdateAgeDays: 12, askPreMoney: 400_000_000 },
  overrides: [],
};

const run = await runAngelValuation(ctx);
// run.status: 'ready' | 'draft' | 'benchmark_only'
// run.point, run.low, run.high (null in benchmark_only), run.checks, run.quality, run.actions,
// run.stageNote, run.parametersSnapshot, run.engineVersion
```

To recompute a stored run exactly, pass its `parametersSnapshot.parameters` back as `ctx.replayParameters`.

### `ValuationContext`

| Field | What it holds |
| --- | --- |
| `answers` | `IntakeAnswers`: intake field id to value. |
| `financials`, `balance` | The financials grid and balance sheet, as `mapIntakeToEngine` takes them. |
| `opts` | `{ asOf, currency }`. `asOf` is ISO (`YYYY-MM-DD`). |
| `sources` | Per input: `founder`, `verified`, `platform`, `market`, `estimated` or `dataroom` (a confirmed model parse). Keys are intake field ids, or `grid.<rowId>.<column>` for a grid cell (column 0 is the base year). A missing key means `founder`. |
| `confirmed` | `stageConfirmed` and `industryConfirmed`, as engine keys, or null. |
| `facts` | Plain data from TheAngel's tables, all optional: `hasFinancialModel`, `listingStage`, `askPreMoney` (minor units), `lastUpdateAgeDays`, `advisorsHaveBios`, `hasTechnicalTeamMember`, `partnersNamed`, `retentionMetricPresent`, `customersSource`. Unknown means "does not hold". |
| `overrides` | `{ parameter, value, source, reason }`, `parameter` being a dotted path such as `dcf_shared.discount_rate`. Each is recorded in `overridesApplied`. |
| `replayParameters` | Optional. Stored parameters to use as they are. |

### Checks

`evaluateChecks(ctx, report)` returns every check as `{ id, severity, passed, title, why, fieldRoute, fixLabel }`. `severity` is `blocking`, `warning` or `info`. `passed` is `true`, `false`, or `null` for not evaluated, with `notEvaluatedReason` saying why. Any failing blocking check makes the run `draft`. The engine's own `validateWizardData` issues come first, as `engine_validation.<field>`.

`fieldRoute` says where the fix happens. It is data, not a URL:

```ts
{ kind: 'intake', step: 'funding', fieldId: 'use_of_funds' } | { kind: 'data_room' } | { kind: 'listing' } | { kind: 'none' }
```

### Quality and range

`computeQualityScore(ctx, checks)` returns `{ score, label, blocks }`: completeness 40, evidence 30, consistency 20, freshness 10. The labels are Low (0-39), Fair (40-59), Good (60-79) and Strong (80-100). `applyRangeSpread(report, sensitivity, quality)` takes the range from the sensitivity, and widens it to 10%, 20% or 30% around the point (Strong, Good, Fair or Low) when the sensitivity is `understated`.

### Actions

`buildActions(ctx, report, checks)` runs every applicable rule in `OPTIMISE_RULES` (`OPTIMISE_RULESET_VERSION` `angel-optimise-v1`). Each action carries `estimatedDeltaPoint`, which is one full pipeline run on the rule's counterfactual and can be negative. It also carries `headroomUpTo`, the most its criteria can still add (see `computeHeadroom`), and `evidence`. Blocking fixes rank first.

`evidence` is a descriptor that TheAngel evaluates against its own tables. Its `kind` is one of `EVIDENCE_KINDS`, with optional `params`:

```ts
{ kind: 'data_room_file', params: { category: 'financial_model' }, description: 'A data-room file with category financial_model.' }
```

`simulate(ctx, tickedCodes)` applies the ticked counterfactuals in rule order and runs the pipeline once. The combined effect is not the sum of the single effects.

## Exports

- **Valuation:** `computeValuation`, `buildDefaultParameters`, `computeSensitivity`, `computeWeightedValuation`, `getDefaultWeightsForStage`, `deriveFcfeByYear`, `computeScorecard`, `computeChecklist`, `computeVcMethod`, `computeDcfShared`, `computeLtgTerminalValue`, `computeSimpleMultiples`, `deriveScorecardCriteriaScores`, `deriveChecklistCriteriaScores`, `diffParameters`.
- **Validation:** `validateWizardData`, `hasBlockingIssues` and the per-section validators.
- **Reference data:** `COUNTRIES`, `CURRENCY_BY_COUNTRY`, `COUNTRY_NAME_TO_CODE`, `REGION_BY_COUNTRY`, `INDUSTRIES`, `INDUSTRY_ALIASES`, `SECTOR_SOURCE`, `VALUATION_BENCHMARKS`, `BENCHMARK_STAGE_BY_COMPANY_STAGE`, `STAGE_DEFAULT_WEIGHTS`, `VC_REQUIRED_ROI`, `SURVIVAL_RATES_BY_COUNTRY`, `SURVIVAL_RATES`, `SIZE_PREMIUM_BANDS`, `SMALL_COMPANY_MULTIPLE_FACTOR`, `CHECKLIST_MAX_RATIO`, `SCORECARD_CRITERIA_WEIGHTS`, `LTG_GROWTH_RATE_DEFAULT`, `MIN_LTG_SPREAD`, `REFERENCE_DATA_AS_OF`, plus `getCountryDataTier`, `resolveCountryCode`, `resolveIndustry`, `getCurrencyForCountry`.
- **Copy and format:** `getDataQualityDisclaimer`, `formatCurrency`, `formatPercent`, `formatGrowth`.
- **Intake:** `INTAKE_FORM_VERSION`, `INTAKE_STEPS`, `INTAKE_FIELDS`, `INTAKE_REQUIRED_COUNT`, `mapIntakeToEngine`, `suggestStage`, `FINANCIAL_KEY_MAP`, `PRODUCT_STATUS_BY_ROLLOUT`, `IP_STAGE_BY_STATUS`, `parseIntakeNumber`.
- **TheAngel (1.1.0):**
  - `runAngelValuation`, `runCore`, `runPipeline`, `buildStageNote`, `snapshotParameters`.
  - `evaluateChecks`, `hasBlockingChecks`, `requiredStatus`, `hasStrongAnswers`, `REVENUE_GROWTH_QUARTILES`.
  - `computeQualityScore`, `applyRangeSpread`, `qualityLabel`, `RANGE_SPREAD_BY_LABEL`.
  - `OPTIMISE_RULES`, `OPTIMISE_RULESET_VERSION`, `EVIDENCE_KINDS`, `buildActions`, `rankActions`, `computeHeadroom`, `simulate`, `applyCounterfactuals`.
- **Version:** `ENGINE_VERSION`.
- Every type in `types.ts` and the modules above is exported too.

## Develop

```
npm install
npm run typecheck
npm test
npm run build      # dist/: ESM (index.js), CJS (index.cjs), types
```

To use a local build in the engine app: `npm run build` here, then `npm run link:core` in `apps/valuation-engine`.

## Release

CI (`.github/workflows/valuation-core.yml`) typechecks, tests and builds on every change under `packages/valuation-core/`. Pushing a tag `valuation-core@<version>` (matching `package.json`) also publishes. Add a CHANGELOG entry and bump the version in the same PR.
