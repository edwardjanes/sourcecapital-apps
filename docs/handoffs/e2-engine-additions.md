# Claude Code handoff: E2, engine additions for TheAngel

Repo: `edwardjanes/sourcecapital-apps`. Branch: `claude/e2-engine-additions`, cut from `main` after PR #43 (E1) is merged. One PR. Ed approves the merge.

Spec: TheAngel Valuation Engine: Development Spec, sections 7, 10 and 11 (https://claude.ai/artifact/HK3GjBpk4z35VXTzx1KsQ4). Project copy: `claude/spec-valuation-engine.md`. This handoff is slice E2.

The package name is `@edwardjanes/valuation-core`. The spec text says `@sourcecapital/valuation-core` in places. That is out of date. E1 published `1.0.0` under the `@edwardjanes` scope.

## Goal

Add the modules TheAngel needs on top of the extracted engine, inside `packages/valuation-core/`:

1. A shared input type for every new module.
2. Extended checks.
3. The data-quality score and the range spread rule.
4. The optimiser and the simulator.
5. One orchestration function, so TheAngel never repeats the pipeline.
6. Audit item 2b: drop the DCF methods when terminal earnings are zero or below.

Publish `1.1.0`. TheAngel installs it in slices A3 and A6. The engine app (`apps/valuation-engine`) stays on `1.0.0` in this PR.

No new data in the package unless a source exists. If a check needs reference data the package does not hold, see "Rules about data" below.

## Ground truth to check first

Read these before you change anything. Report in the PR if any of it is wrong.

- E1 is merged. `packages/valuation-core/` exists, `valuation-core@1.0.0` is published to GitHub Packages, and `README.md` there lists the exports. The root `tsconfig` and the deck app's Vercel ignore step already exclude `packages/`. Do not change them.
- The intake module is in `packages/valuation-core/src/intake/`: `INTAKE_FIELDS` (59 founder fields, 61 with the two advisor-only fields), `INTAKE_REQUIRED_COUNT` (63), `IntakeAnswers`, `mapIntakeToEngine`, `suggestStage`. Read their types. Every new module in E2 takes the same intake types.
- `compute.ts` is the entry point for `computeValuation`. `weights.ts` holds `computeWeightedValuation`. `dcf.ts` holds both DCF methods. `sensitivity.ts` returns the five-driver tornado. `validation.ts` holds `validateWizardData` and `hasBlockingIssues`. Read how a method with no data drops out and how the weights are redistributed.
- The audits are in `edwardjanes/raise-hq-portal` under `claude/valuation methods/`. Read the one that describes item 2b (terminal earnings zero or below). Read the other open items too. They are not in scope, but you must not make them harder to fix.
- The Northwind Analytics and NovaCloud fixtures reproduce to the dollar today. They must still do so after E2, unless a fixture has terminal earnings at or below zero. If one does, stop and tell Ed in the PR before changing any expected value.
- The portal (`raise-hq-portal`) calls the engine app over HTTP and uses `validateWizardData` today. The portal must see no change. See Part 2.

## Part 0: the shared input type

Define one type for everything new. Call it `ValuationContext` unless the code suggests a better name. It holds:

- `answers: IntakeAnswers` and the financials grid and balance sheet, as E1's `mapIntakeToEngine` takes them.
- `opts: { asOf: string; currency: string }`.
- `sources`: for each money input and each intake answer, one of `founder`, `verified`, `platform`, `market`, `estimated`, plus `dataroom` where the figure came from a confirmed model parse. This is what the quality score and the Prove rules read.
- `confirmed`: `stageConfirmed` and `industryConfirmed` (engine keys or null).
- `facts`: plain data the caller supplies. The package does no I/O. Suggested contents: `hasFinancialModel`, `listingStage`, `askPreMoney` (minor units or null), `lastUpdateAgeDays`, `advisorsHaveBios`, `hasTechnicalTeamMember`, `partnersNamed`, `retentionMetricPresent`, `customersSource`, `revenueSource`. Change the list to fit the rules you write. Every fact must be something TheAngel can read from its own database.
- `overrides`: advisor and founder overrides, each with parameter, value, source and reason.

Document the type in the README. TheAngel's slice A3 builds this object from its tables.

## Part 1: extended checks

Add `evaluateChecks(ctx, report)` in a new `checks/` module. It returns every check with `id`, `severity` (`blocking`, `warning`, `info`), `passed`, `title`, `why`, `fieldRoute` and `fixLabel`.

`fieldRoute` is data, not a URL. Use `{ kind: 'intake', step, fieldId }`, `{ kind: 'data_room' }`, `{ kind: 'listing' }` or `{ kind: 'none' }`. TheAngel turns it into a route.

Do not change `validateWizardData` or `hasBlockingIssues`. The portal depends on them. `evaluateChecks` calls `validateWizardData` and adds to it.

| Id | Severity | Condition |
| --- | --- | --- |
| `required_missing` | Blocking | Any required intake field or required grid cell is empty. Use `INTAKE_REQUIRED_COUNT` logic, with the grid rules from the design pack |
| `stage_mismatch` | Blocking until confirmed | `confirmed.stageConfirmed` is null or differs from `suggestStage()` |
| `balance_sheet_unbalanced` | Blocking | Optional balance sheet rows entered and assets differ from liabilities plus equity by more than 1% |
| `negative_cash` | Blocking | Any forecast year ends with cash below zero after the planned raise |
| `use_of_funds_missing` | Blocking | A raise is planned and use of funds is empty or does not total 100% |
| `ownership_not_100` | Blocking | `current_ownership` is entered and does not total 100% |
| `no_financial_model` | Warning | `facts.hasFinancialModel` is false and the forecast source is `founder` |
| `forecast_outlier` | Warning | Forecast growth is above the benchmark top quartile two years running |
| `growth_below_peers` | Warning | Forecast growth is below the benchmark bottom quartile |
| `qualitative_conflict` | Warning | A criterion scores at the floor while its intake answers are strong |
| `unverified_revenue` | Warning | Base-year revenue source is `founder` |
| `parameter_stale` | Warning | The oldest date in `REFERENCE_DATA_AS_OF` is more than 12 months before `opts.asOf`. Ignore `null` entries and list them in the PR |
| `multiple_kind_fallback` | Info | The VC method used a revenue multiple because EBITDA is zero or below |
| `dcf_excluded` | Info | The DCF methods were dropped (Part 5) |
| `override_present` | Info | Any override is present, listed with its source |
| `region_illustrative` | Info | `getCountryDataTier` returns `illustrative`. The run is `benchmark_only` |
| `ask_outside_range` | Info | `facts.askPreMoney` is more than 20% above the high bound or more than 20% below the low bound |

Copy rules for `title` and `why`: one short sentence each, plain words, no "advice", "guaranteed" or "skyrocket", no exclamation marks, no em dashes. One example is fixed by the spec. `no_financial_model`: title "No financial model supports your forecast", why "Investors will ask for the model behind these figures.", fix label "Add to data room". Write the others in the same style and list all of them in the PR for Ed to review.

### Rules about data

`forecast_outlier` and `growth_below_peers` need growth quartiles. `qualitative_conflict` needs a definition of "strong answers". If the package has no sourced growth quartile table, do not invent one.

- First look at `benchmarks.ts` and `referenceData.ts` for anything usable.
- If a sourced dataset exists, use it and add its as-of date to `REFERENCE_DATA_AS_OF`.
- If none exists, ship the check as `not_evaluated` (a fourth state: `passed: null`), with a constant that is easy to fill later, and list the gap in the PR. Never fill a number from memory.
- Define "strong answers" for `qualitative_conflict` in one small, tested function, and state the rule in the PR.

## Part 2: data-quality score

Add `computeQualityScore(ctx, checks)` returning `{ score, label, blocks }`.

| Block | Points | How |
| --- | --- | --- |
| Completeness | 40 | Share of required fields answered. Optional financial rows entered count a half point each, capped so the block never passes 40 |
| Evidence | 30 | Share of money inputs with source `verified` or confirmed `dataroom`. Base-year revenue weighs double |
| Consistency | 20 | 20 minus 5 per warning check that failed, floor 0 |
| Freshness | 10 | 10 when reference data is under 12 months old and the last update is under 90 days old. 5 when one holds. 0 when neither |

Labels: 0 to 39 `Low`, 40 to 59 `Fair`, 60 to 79 `Good`, 80 to 100 `Strong`.

Add `applyRangeSpread(report, sensitivity, quality)`. The range comes from the sensitivity bounds. When sensitivity cannot vary the benchmark (the engine's `understated` flag, or the closest equivalent in `sensitivity.ts`), widen the range around the point to 10% at Strong, 20% at Good and 30% at Fair and Low. If `sensitivity.ts` has no such flag, say so in the PR and implement the rule against the case where all five drivers give the same value.

## Part 3: the optimiser

Add `optimise/`.

### Rule shape

```ts
interface ActionRule {
  code: string;
  kind: 'fix' | 'prove' | 'build' | 'present';
  effort: 'S' | 'M' | 'L';
  timeBand: 'under_2_weeks' | '1_to_3_months' | 'longer';
  factors: FactorRef[];                  // { method, criterion }
  applies(ctx, report, checks): boolean;
  counterfactual(ctx): ValuationContext; // pure, returns a changed copy
  evidence: EvidenceRule;                // descriptor only; TheAngel evaluates it
  effectKind: 'value' | 'quality';       // Prove rules with no value effect use 'quality'
  copy: { title: string; why: string; proof: string };
}
```

Export `OPTIMISE_RULESET_VERSION = 'angel-optimise-v1'`.

### Rules

About 25 at launch. The spec gives 16. Write them exactly as below, then add Build and Present rules for the remaining Scorecard and Checklist criteria that have headroom, until the set is about 25. List every added rule in the PR.

| Code | Kind | Effort | Applies when | Counterfactual | Evidence |
| --- | --- | --- | --- | --- | --- |
| `confirm_stage` | Fix | S | `stage_mismatch` fails | Stage set to the suggested stage | Stage confirmed |
| `balance_the_sheet` | Fix | S | `balance_sheet_unbalanced` fails | None. Blocks until fixed | Sheet balances within 1% |
| `fund_the_plan` | Fix | M | `negative_cash` fails | None | No year ends below zero |
| `add_use_of_funds` | Fix | S | `use_of_funds_missing` fails | None | Totals 100% |
| `support_the_forecast` | Fix | M | `forecast_outlier` fails | Forecast growth moved to the peer top quartile | Model in data room or revised forecast |
| `upload_financial_model` | Prove | S | `no_financial_model` fails | None. Quality uplift only | File with category `financial_model` |
| `verify_revenue` | Prove | S | Revenue source is `founder` | Revenue source set to `verified` | Traction metric verified |
| `verify_customers` | Prove | S | Customer count source is `founder` | Source set to `verified` | Traction metric verified |
| `launch_beyond_prototype` | Build | L | Product roll-out is below Market | Roll-out one step up | Roll-out field changed and traction shows paying customers |
| `add_sector_advisor` | Build | M | Team criterion is below 0.25 | Board of advisors set, advisor count plus one | Advisor named on the listing team |
| `hire_core_technical` | Build | L | Core technical skills in-house is 2 or lower | Score plus 2 | Team member added with a technical role |
| `sign_partner` | Build | M | Strategic partner strength is below 3 | Score plus 2 | Partner named in a Timeline milestone or data room contract |
| `show_retention` | Build | M | Customer loyalty is 2 or lower | Score plus 2 | Retention metric in traction |
| `name_ip` | Present | S | IP status is None with IP types selected | Status set to In progress | IP field changed |
| `add_advisor_bios` | Present | S | Advisors present but no bios on the listing | Managerial background plus 1 | Bios on the team section |
| `name_competitors` | Present | S | Competitors list is empty | Differentiation plus 1 | Two or more competitors entered |

The 1 to 5 scores are capped at 5. If a counterfactual cannot change anything (already at the cap), the rule does not apply.

### Headroom

For each Scorecard and Checklist criterion, compute `(maximum minus current) x criterion weight x method weight x method base`. This is the most the criterion can add. Return it as `headroom` per criterion. A rule with `factors` shows the sum of its factors' headroom as "up to". Use the existing scoring code. Do not copy its constants.

### Output

`buildActions(ctx, report, checks)` returns an array. Each item has `code`, `kind`, `effort`, `timeBand`, `title`, `why`, `proof`, `effectKind`, `estimatedDeltaPoint` (null for `quality` effects), `headroomUpTo`, `evidence`, and `appliesToBlocking` (true when it fixes a blocking check).

For each applicable rule with a value effect: apply `counterfactual(ctx)`, run the full pipeline again, and report the difference in the point value. This is the estimated effect. The effect can be negative.

Rank: Fix actions that clear a blocking check first, even when their effect is negative. Then by effect divided by effort points (S is 1, M is 3, L is 8), then by time band, shortest first. Quality-only Prove actions rank by effort alone, after the value actions of the same effort.

### Simulator

`simulate(ctx, tickedCodes)` applies every ticked counterfactual in rule order, runs the pipeline once, and returns `{ point, low, high, deltaPoint, deltaLow, deltaHigh }`. The combined effect is never the sum of single effects. A test must show a case where the combined effect differs from the sum.

The simulator result for a set of ticks must equal one pipeline run on the context after those counterfactuals. Test that equality.

### Guardrails (tests, all required)

- No counterfactual changes a market parameter, a method weight, a discount rate or a multiple. Test this by diffing the output of `buildDefaultParameters` for the original and the counterfactual context for every rule. They must be identical.
- Forecast rules only move a forecast towards the peer median or top quartile, never above it. No copy says "raise your forecast".
- A Fix with a negative effect has `why` text that ends with "Fixing this protects you in due diligence".
- Copy lint: every `title`, `why` and `proof` in the rule set starts with a verb (title), has no em dash, no exclamation mark, and none of "advice", "guaranteed", "skyrocket". One test walks the whole rule set.
- Determinism: the same context gives the same actions in the same order.
- Every rule code is unique and every `evidence` descriptor has a kind from a closed list.

## Part 4: one orchestration function

Add `runAngelValuation(ctx)`. It is the only entry point TheAngel calls on a run. It does this, in order:

1. `mapIntakeToEngine`.
2. `buildDefaultParameters`, then apply `ctx.overrides` and record each in the output.
3. `computeValuation`, then `computeSensitivity`.
4. `evaluateChecks`.
5. `computeQualityScore`, then `applyRangeSpread`.
6. `buildActions`.
7. Build `stageNote`: one sentence on why the weights are what they are. Make it deterministic from `STAGE_DEFAULT_WEIGHTS` and any method that dropped out. Example: "At the Startup stage the two DCF methods carry 54% of the weight because there is revenue to project." List every variant in the PR.

It returns one object: `status` (`draft` when any blocking check fails, otherwise `ready`; `benchmark_only` when `getCountryDataTier` is `illustrative` or the country has no row), `point`, `low`, `high`, `currency`, `report`, `sensitivity`, `checks`, `quality`, `actions`, `stageNote`, `parametersSnapshot` (every parameter value used, with its as-of date), `engineVersion` (from `ENGINE_VERSION`) and `asOf`.

Rules:

- In `benchmark_only`, return no point or range from the engine. Still return checks, quality score and actions.
- In `draft`, still compute everything. The caller decides what to show.
- The function is pure. The same input gives the same output. A test replays a stored `parametersSnapshot` and gets the same numbers.

## Part 5: audit item 2b

Exclude the two DCF methods when terminal earnings are zero or below. The method shows as "Not enough data" and its weight goes to the other methods pro rata, as for any method with no data. Add `dcf_excluded` as an Info check.

- Read the audit first. Follow its definition of terminal earnings. If the audit and the code disagree, stop and say so in the PR.
- This changes results for loss-making companies in Raise HQ as well. That is intended. The portal gets it when the engine app bumps to `1.1.0` (see "After merge").
- Add tests: a loss-making fixture before and after, the weights after redistribution, and the unchanged result for a company with positive terminal earnings.
- If any existing test encodes the old behaviour, change it and list it in the PR. Do not change a test that does not encode it.

## Part 6: exports, version, docs

- Export every new function and type from `src/index.ts`. Keep the "no Sentry, Supabase, Next or React import" test green.
- `package.json` version `1.1.0`. `CHANGELOG.md` entry: what was added, and one line saying item 2b changes results for loss-making companies.
- README: the `ValuationContext` type, the new functions, and the `fieldRoute` and evidence descriptors, with one short example call to `runAngelValuation`.
- `ENGINE_VERSION` equals `1.1.0`.
- Do not bump `apps/valuation-engine`. It stays on `1.0.0` in this PR.

## Tests

Every new module has its own test file. Minimum coverage:

- Each check: one passing case and one failing case. The `not_evaluated` state where it applies.
- Quality score: each block at its bounds, each label boundary (39, 40, 59, 60, 79, 80), the range spread at all three widths.
- Optimiser: every rule applies and does not apply, ranking order including a negative-effect Fix pinned first, headroom against hand-calculated values for two criteria, the simulator equality test and the not-the-sum test, all guardrail tests above.
- `runAngelValuation`: Northwind end to end, a `draft` case, a `benchmark_only` case (a UAE company), a replay from a stored `parametersSnapshot`.
- Northwind and NovaCloud fixtures reproduce to the dollar. Show this in the PR with the old and new values side by side.

## Acceptance

- Typecheck clean. All E1 tests still pass (366 at E1). New tests green. `npm run build` produces `dist/` with ESM, CJS and types.
- `git diff` on `referenceData.ts` and `benchmarks.ts` shows no value change, unless Part 1 added a sourced dataset. If it did, list each value and its source in the PR.
- No file under `packages/valuation-core/src/` imports Sentry, Supabase, Next or React.
- CI for the package passes. The engine app and the deck app are unchanged.
- The PR body lists: every check title and why for Ed's review, every added rule, every `stageNote` variant, every gap (data not available), and every existing test changed.

## Not in scope

The peers section and any peer percentile. The engine has no peer dataset. TheAngel's slice A3 settles where that data comes from. Tell Ed in the PR if anything in E2 turns out to need it.

The other open engine items from the audits (expected dilution in the VC method, net-debt bridge, exit-timing range, the `other` scorecard rubric, the data-quality copy sign-off). The portal. TheAngel. The PDF.

## After merge

1. Ed pushes the tag `valuation-core@1.1.0` on the final commit of the branch before merging. CI publishes it. This keeps production green, as with E1.
2. A second, small PR bumps `apps/valuation-engine` to `1.1.0`. Open it after the tag publishes. It changes the dependency string and nothing else. Run the hosted Northwind check as in E1 (service key typed by Ed). Northwind must match `main` to the cent. Add a loss-making payload and show the before and after. This is the PR that changes Raise HQ results, so say that in its title.

## Ed must do

1. After the work is ready: push the tag `valuation-core@1.1.0` on the final commit, wait for the publish run, then merge.
2. Read the check copy and the added rules in the PR.
3. Decide whether Raise HQ results changing for loss-making companies needs a note to the portal users before the second PR merges.
4. Type the service key for the hosted check on the second PR.

## Final report

End the session with: the PR link and a one-line summary; the Northwind and NovaCloud old and new values; every check with its copy; every rule added beyond the 16; every gap where no sourced data existed; every existing test changed; the `not_evaluated` checks; anything you found that is not on this list.
