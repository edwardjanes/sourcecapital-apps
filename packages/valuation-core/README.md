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
