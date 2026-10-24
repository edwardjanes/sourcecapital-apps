# Claude Code handoff: E1, extract the valuation engine into a shared package

Repo: `edwardjanes/sourcecapital-apps`. Branch: `claude/e1-valuation-core`. One PR. Ed approves the merge.

Spec: TheAngel Valuation Engine: Development Spec, section 7 (https://claude.ai/artifact/HK3GjBpk4z35VXTzx1KsQ4). Project copy: `claude/spec-valuation-engine.md`. This handoff is slice E1 of that spec.

## Goal

Move the pure valuation library out of `apps/valuation-engine/src/lib/valuation/` into a publishable package. The engine app imports the package and behaves exactly as before. TheAngel (`edwardjanes/theangel-app`) installs the same package in slice A1.

No behaviour change. Every test that passes today passes after the move with the same numbers.

## Ground truth to check first

Read these before you change anything. Report in the PR if any of it is wrong.

- The repo root is `deck-analysis-app` (Next.js 14, its own `package.json` and lockfile). It is not an npm workspace. `apps/valuation-engine/` is a second Next.js app with its own `package.json`, lockfile and Vercel project rooted at that directory.
- The library is `apps/valuation-engine/src/lib/valuation/`: `types.ts`, `referenceData.ts`, `benchmarks.ts`, `defaults.ts`, `scoring.ts`, `fcf.ts`, `scorecard.ts`, `checklist.ts`, `vc.ts`, `dcf.ts`, `simpleMultiples.ts`, `weights.ts`, `compute.ts`, `sensitivity.ts`, `validation.ts`, `dataQualityDisclaimer.ts`, `diff.ts`, `format.ts`, `pdf.ts`, and `__tests__/` (22 files, 264 tests at PR #35).
- `pdf.ts` imports `@sentry/nextjs` and calls PDFShift. It is not pure. It stays in the app.
- The headless route is `src/app/api/valuation/compute/route.ts`. It is the only runtime caller of the library apart from the wizard pages and `src/app/print/valuation/[snapshotId]`.
- The Raise HQ portal (`edwardjanes/raise-hq-portal`, `src/jsx/components/RaiseHQ/valuationPayload.js`) maps the portal wizard fields to the engine's questionnaire keys in `buildQuestionnaire` and `FINANCIAL_KEY_MAP`, with `PRODUCT_STATUS_BY_ROLLOUT` and `IP_STAGE_BY_STATUS`. You will port that mapping into the package as TypeScript.
- GitHub Packages npm scope must equal the repository owner. The owner is the user `edwardjanes`, so the package is `@edwardjanes/valuation-core`. If Ed has a GitHub organisation he wants to publish under, he says so in the PR and you rename before publishing.

## Part 1: the package

Create `packages/valuation-core/`:

```
packages/valuation-core/
  package.json
  tsconfig.json
  tsconfig.build.json
  vitest.config.ts
  README.md
  CHANGELOG.md
  src/
    index.ts
    types.ts
    referenceData.ts
    benchmarks.ts
    defaults.ts
    scoring.ts
    fcf.ts
    scorecard.ts
    checklist.ts
    vc.ts
    dcf.ts
    simpleMultiples.ts
    weights.ts
    compute.ts
    sensitivity.ts
    validation.ts
    dataQualityDisclaimer.ts
    diff.ts
    format.ts
    intake/
      fields.ts
      mapIntakeToEngine.ts
      suggestStage.ts
    __tests__/   (every existing test file, plus the new ones below)
```

Rules for the move:

1. Use `git mv` so history follows each file. Do not copy and delete.
2. Change nothing inside a moved file except import paths. If a file imports anything from outside the library (`@/lib/...`, `next`, `@sentry/nextjs`, `@supabase/...`), stop and list it in the PR. The audit says the library has no such imports. Confirm.
3. `package.json`:
   - `"name": "@edwardjanes/valuation-core"`, `"version": "1.0.0"`, `"license": "UNLICENSED"`, `"private": false`.
   - `"publishConfig": { "registry": "https://npm.pkg.github.com", "access": "restricted" }`.
   - `"main": "dist/index.js"`, `"types": "dist/index.d.ts"`, `"exports": { ".": { "types": "./dist/index.d.ts", "import": "./dist/index.js", "require": "./dist/index.cjs" } }`, `"files": ["dist"]`, `"sideEffects": false`.
   - Scripts: `build` (tsc with `tsconfig.build.json`, emitting ESM and CJS; `tsup` is acceptable if you prefer one tool), `test` (`vitest run`), `typecheck`, `prepublishOnly` (`npm run typecheck && npm run test && npm run build`).
   - No runtime dependencies. Dev dependencies: `typescript`, `vitest`, `tsx`, and `tsup` if used. Pin the same major versions the engine app uses.
4. `src/index.ts` exports, by name: `computeValuation`, `buildDefaultParameters`, `computeSensitivity`, `validateWizardData`, `hasBlockingIssues`, `computeWeightedValuation`, `getCountryDataTier`, `resolveCountryCode`, `resolveIndustry`, `formatMoney` and the other formatters, `diffParameters` (or the current name in `diff.ts`), the disclaimer copy, every exported type from `types.ts`, and the reference data: `COUNTRIES`, `CURRENCY_BY_COUNTRY`, `COUNTRY_NAME_TO_CODE`, `REGION_BY_COUNTRY`, `INDUSTRIES`, `INDUSTRY_ALIASES`, `SECTOR_SOURCE`, `VALUATION_BENCHMARKS`, `BENCHMARK_STAGE_BY_COMPANY_STAGE`, `STAGE_DEFAULT_WEIGHTS`, `VC_REQUIRED_ROI`, `SURVIVAL_RATES_BY_COUNTRY`, `SURVIVAL_RATES`, `SIZE_PREMIUM_BANDS`, `SMALL_COMPANY_MULTIPLE_FACTOR`, `CHECKLIST_MAX_RATIO`, `SCORECARD_CRITERIA_WEIGHTS`, `LTG_GROWTH_RATE_DEFAULT`, `MIN_LTG_SPREAD`. Add `ENGINE_VERSION` as a constant equal to the package version, read from `package.json` at build time.
5. Add `src/data-as-of.ts` exporting `REFERENCE_DATA_AS_OF`: one object with the as-of date of each dataset as the comments in `referenceData.ts` and `benchmarks.ts` state them (risk-free rates, country ERP, Damodaran industry rows, PitchBook-NVCA, British Business Bank, survival curves). TheAngel's `parameter_stale` check reads this. Take the dates from the existing source comments. Do not invent a date; if a dataset has no stated date, leave it `null` and list it in the PR.
6. Tests: every existing test moves unchanged and passes. The Northwind Analytics and NovaCloud fixtures reproduce to the dollar.

## Part 2: the intake mapping

Port the portal's mapping into the package as TypeScript. This is the only new logic in E1.

- `src/intake/fields.ts`: the 59 intake field ids, their steps, types, options and required flags, exactly as the design pack's `valuation-intake-data.js` defines them (the file is in the TheAngel project: `TheAngel_Valuation_Pages.zip`, and will be committed to theangel-app at `docs/design/valuation/valuation-intake-data.js` in slice A1). Export `INTAKE_FORM_VERSION = '1.0.0'`, `INTAKE_STEPS`, `INTAKE_FIELDS`, and the TypeScript type `IntakeAnswers` (field id to value). Steps 8 (`comparables`) and 9 (`advisor_overrides`) are advisor only; include them in the type, mark them `founderVisible: false`.
- `src/intake/mapIntakeToEngine.ts`: `mapIntakeToEngine(answers: IntakeAnswers, financials: IntakeFinancials, balance: IntakeBalance, opts: { asOf: string; currency: string }): { profile: CompanyProfile; financials: FinancialYear[]; questionnaire: QuestionnaireAnswers; balanceSheet: BalanceSheetInput; comparables: Comparable[] | null }`. Port `buildQuestionnaire`, `FINANCIAL_KEY_MAP`, `PRODUCT_STATUS_BY_ROLLOUT` and `IP_STAGE_BY_STATUS` from the portal. Keep the portal's thresholds (for example `core_technical_skills_in_house >= 4` gives `team_has_cto: true`). Where the portal sends no value for an engine key (`competitors_count`, `partnerships_count`, `recurring_revenue`, `legal_risks`, `has_ip`, `has_patents`), map it from the intake field that holds it: `competitors` list length, `strategic_partner_relationship_strength` 4 or 5 gives `partnerships_count: 1`, `ip_protection_types` gives `has_ip` and `has_patents`. Document each new mapping in the function's JSDoc.
- `src/intake/suggestStage.ts`: `suggestStage(input: { listingStage: 'pre_seed' | 'seed' | 'seed_plus' | 'series_a'; lastActualRevenue: number; lastActualEbitda: number | null; productRollout: 'Planning' | 'Prototype' | 'MVP' | 'Market' }): CompanyStage`. Rules from the spec, section 7: pre-seed with no revenue gives `development`; pre-seed, seed or seed_plus with revenue gives `startup`; series_a gives `expansion`; positive EBITDA and revenue over $5m gives `growth`; `Planning` roll-out with no revenue gives `idea`. Never returns `maturity`.
- Tests: a fixture that round-trips the portal's own sample payload through `mapIntakeToEngine` and produces the same `ComputeRequestBody` the portal sends today, key by key. A table test for `suggestStage` covering every rule and the boundaries ($0, $5m, EBITDA 0).

Do not change `scoring.ts` to read the new intake fields directly. The engine still scores `QuestionnaireAnswers`. The mapping is the adapter.

## Part 3: the engine app consumes the package

1. Delete `apps/valuation-engine/src/lib/valuation/` except `pdf.ts` and anything Part 1 flagged as impure. Keep `pdf.ts` at its path and point its imports at the package.
2. Add `"@edwardjanes/valuation-core": "1.0.0"` to `apps/valuation-engine/package.json`. Add a `.npmrc` at `apps/valuation-engine/` with `@edwardjanes:registry=https://npm.pkg.github.com` and `//npm.pkg.github.com/:_authToken=${NPM_GITHUB_TOKEN}`. Never commit a token.
3. Replace every `@/lib/valuation/...` import in the app with `@edwardjanes/valuation-core`. The route, the wizard pages, the print page and `pdf.ts`.
4. For local development add `npm run link:core` at the app level that runs `npm link ../../packages/valuation-core`, and document it in the app README. Do not use a `file:` dependency: the Vercel project is rooted at `apps/valuation-engine/` and does not upload `packages/`.
5. `npm run build` and `npm test` in the app pass. `npm test` in the app now runs only the app's own tests (route and pdf tests, if any). The 264 library tests run in the package.

## Part 4: publish and CI

1. GitHub Actions workflow `.github/workflows/valuation-core.yml`:
   - On every push and PR touching `packages/valuation-core/**`: install, typecheck, test, build.
   - On a tag `valuation-core@*`: the same, then `npm publish` with `NODE_AUTH_TOKEN: ${{ secrets.GITHUB_TOKEN }}` and `permissions: packages: write`.
2. Tag `valuation-core@1.0.0` is created by Ed after merge, not by the PR.
3. `CHANGELOG.md` entry for 1.0.0: "Extracted from apps/valuation-engine with no behaviour change. Added intake field definitions, mapIntakeToEngine and suggestStage."
4. Vercel for the engine app: Ed adds `NPM_GITHUB_TOKEN` (a classic PAT with `read:packages`, or a fine-grained token with package read) as an environment variable. List this in the PR under "Ed must do".

## Acceptance

- `git log --follow` on any moved file shows its full history.
- Package: typecheck clean, 264 existing tests plus the new intake and stage tests green, `npm run build` produces `dist/` with ESM, CJS and types.
- Engine app: `npm run build` green with the package installed from `npm link`; no file under `src/` imports `@/lib/valuation`; `pdf.ts` still at its path.
- A hosted test on the engine app's preview: POST the Northwind payload to `/api/valuation/compute` and compare `weightedValuation`, `lowBound`, `highBound` with a run from `main` before the change. Identical to the cent. Put both JSON responses in the PR.
- Raise HQ portal: no change required. State this in the PR and say why (the HTTP contract is unchanged).
- No reference data value changes. `git diff` on `referenceData.ts` and `benchmarks.ts` shows path moves only.
- No Sentry, Supabase, Next or React import anywhere under `packages/valuation-core/src/`. Add a test that asserts it.

## Not in scope

The quality score, the extended checks, the optimiser and audit item 2b (slice E2). Any change to method maths, weights or reference data. The PDF. The portal. TheAngel.

## Ed must do

1. Confirm the package name (`@edwardjanes/valuation-core`, or an organisation scope).
2. After merge: create and push the tag `valuation-core@1.0.0`.
3. Add `NPM_GITHUB_TOKEN` to the engine app's Vercel project (all environments) and to his local `.npmrc` for theangel-app.
4. Decide whether `packages/valuation-core` gets a `CODEOWNERS` line.

## Final report

End the session with: the PR link and a one-line summary; the two JSON responses from the hosted comparison; every import the move flagged as impure and what you did with it; every reference dataset with no stated as-of date; the list of things Ed must do; anything you found that is not on this list.
