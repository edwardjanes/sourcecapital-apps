# Claude Code handoff: E3, currency conversion for benchmarks in the valuation engine

Repo: `edwardjanes/sourcecapital-apps`. Branch: `claude/e3-fx-conversion`, cut from `main`. One PR. Ed approves the merge. Package: `packages/valuation-core/`, published as `@edwardjanes/valuation-core`. This slice publishes `1.2.0`.

Context: TheAngel slice A3 found that engine 1.1.0 never converts currency. A benchmark quoted in GBP is read as if it were the run's currency, so a UK listing priced in USD gets a £3.2M benchmark treated as $3.2M. A3 measured the damage on the same intake: UK Startup minus 11.3%, UK Development minus 20.1%, Germany Startup minus 6.4%, Germany Development minus 11.5%. TheAngel now shows no figure for any listing whose benchmark is in another currency, so only US listings get a valuation until this is fixed. Read PR #284 in `edwardjanes/theangel-app` ("Currency: the engine does not convert") before you start.

The engine's header comment in `benchmarks.ts` records a standing decision of 31 August 2026: "NO FX CONVERSION". This slice reverses it, with Ed's approval, for the case where the benchmark's currency differs from the run's currency. Where the currencies match nothing changes.

This handoff is slice E3. It does not change theangel-app. A short follow-up PR there (pin bump and the currency guard) comes after the package is published. See "After merge".

## Ground truth to check first

Read these before changing anything. Report in the PR if any of it is wrong.

- `src/benchmarks.ts`. `resolveBenchmark({ countryCode, stage, currency })` returns `{ benchmark, rung, substituted, currencyMismatch, note }`. `currencyMismatch` is `benchmark.currency !== args.currency`. Find every caller. A3 reports that callers pass the country's own currency (GB gives GBP), not the run's `opts.currency`, so the mismatch is never detected and `opts.currency` changes no number. Confirm this, and say exactly which argument each caller passes today.
- The cells and their currencies today: US in USD, GB seed in GBP, DE seed in EUR (marked `validated`), `r:europe` pre-seed in USD, `r:europe` seed in EUR, `r:global` pre-seed in USD, `r:global` seed in EUR (modelled). So the EUR global fallback also hits every non-US, non-EU listing that resolves to it.
- `CHECKLIST_MAX_RATIO` and `benchmarkQuartiles` are ratios, so they do not need conversion. The Checklist ceiling is a multiple of the benchmark and must be converted with it.
- The size-premium revenue bands. A3 reports they are defined in "the company's own currency" and that at their thresholds the effect is small. Read the code and the source comments. State which currency the thresholds are really in, and what they should be compared against.
- Every other monetary parameter. List them (benchmark pre-money, Checklist ceiling, size-premium thresholds, any fixed monetary constant in `defaults.ts`, `referenceData.ts`, `dcf.ts`, `vc.ts`, `simpleMultiples.ts`). Everything else should be a rate or a ratio. Confirm that.
- `src/data-as-of.ts` (`REFERENCE_DATA_AS_OF`) and the `parameter_stale` check in `src/checks/evaluateChecks.ts`. A3 reports that `parameter_stale` names its oldest dataset whatever the country, so a UK listing reads "The oldest dataset used here, US round valuations, dates from 2025-09-30". Confirm and read how the check picks the dataset.
- Who calls the engine today. The Raise HQ portal calls `apps/valuation-engine` over HTTP. Find out what currency the portal sends for a company, and whether any Raise HQ payload today reaches the resolver with a currency that differs from the country's. If one does, that is a silent mix today and E3 will change its result. Quantify it.
- The Northwind Analytics and NovaCloud fixtures, and the Germany `validated` cell. All three must reproduce to the dollar after E3 when the run currency equals the benchmark's currency.

## Goal

When a benchmark's currency differs from the run's currency, convert the benchmark (and everything derived from it) into the run's currency using a dated, sourced rate held in the package, and say so in the output. When no rate is held for the pair, do what the engine does today: report the mismatch and do not convert. Nothing is converted silently, and no rate is ever invented.

## Part 1: the FX table

Add `src/fx.ts` and export it.

- A table of rates with a single `asOf` date and a `source` per entry. Use the ECB euro foreign exchange reference rates as the source (rates per 1 EUR). Cross rates are derived through EUR. Store the raw published rates, not pre-computed crosses.
- Which currencies: every currency that appears in `VALUATION_BENCHMARKS` and in `COUNTRIES` (read the file for the list), where the ECB publishes a reference rate. For a currency the ECB does not publish, include it only if it has an official peg that you can cite (the UAE dirham is pegged to the US dollar at 3.6725, Central Bank of the UAE; Saudi riyal 3.75), recorded as `kind: 'pegged'` with the source. Otherwise leave it out. A currency with no rate is unsupported, and that is correct.
- **Get the rates from the ECB itself.** Use the published reference rate file (the daily XML or CSV download from the ECB's euro foreign exchange reference rates page). Never type a rate from memory. If your environment cannot reach the ECB, stop and ask Ed to download the CSV and attach it. Record the file's reference date as `asOf` and the URL as the source.
- Export `convertAmount({ amount, from, to })` returning `{ amount, rate, rateAsOf, source, kind }` or `null` when either currency is unsupported. Same currency returns the amount unchanged with rate 1 and no FX entry. Round only at the end. Rates are used at full published precision.
- Add `fxRates` to `REFERENCE_DATA_AS_OF`. Extend its type. `null` is not allowed for this one: the table always has a date.
- FX moves faster than the other reference data. Give the FX table its own staleness threshold: `FX_STALE_DAYS = 180` as an exported constant. Ed can change it.

## Part 2: resolve and convert

- `resolveBenchmark` takes the run's currency. Callers pass `opts.currency` (the reporting currency), not the country's currency. If a caller cannot know the run currency, it passes the company's currency and you say so.
- When `benchmark.currency !== args.currency`: if `convertAmount` can convert, return the benchmark converted into the run currency (median, and mean where present), plus `fx: { from, to, rate, rateAsOf, source, kind, originalMedian, originalCurrency }`, `converted: true` and `currencyMismatch: false`. If it cannot, return the original benchmark unchanged, `converted: false`, `currencyMismatch: true`, and the existing note. Callers that treat `currencyMismatch` as "do not trust this" keep working for unsupported pairs.
- Extend `note` for the converted case in plain words: "converted from GBP to USD at 1.34 (ECB, 31 December 2025)". Use real values. No em dashes, no exclamation marks. Keep the existing note for the unconverted case.
- The Checklist ceiling (2.155 times the benchmark) must use the converted median. Check the sensitivity module and the optimiser too: anywhere that reads the benchmark median must read the converted one, and anywhere that perturbs it must perturb the converted value. Search for every use of `preMoney`, `resolveBenchmark` and `CHECKLIST_MAX_RATIO`.
- Size-premium bands: apply the rule you found in the ground-truth step. If the thresholds are in one currency and the company's revenue is in another, convert the revenue to the threshold currency for the band lookup, using the same table. Report the size of the effect. If conversion is not possible, behave as today.
- No other parameter changes. Rates, ratios, betas and survival curves are untouched.

## Part 3: replay and the parameter snapshot

A stored run must replay to the same numbers after the table is refreshed. So `parametersSnapshot` (the object `runAngelValuation` returns, and that `buildDefaultParameters` feeds) must record, for any converted benchmark: the rate, its date, its source, the original median and currency, and the converted median. Replaying a stored snapshot uses the stored rate, never the live table. Add a test: run, change the table in the test, replay from the snapshot, get identical output.

## Part 4: `parameter_stale`

- Evaluate only the datasets this run actually used: the risk-free rate and country ERP for the run's country, the industry rows, the resolved benchmark's own `asOf` (the resolved cell, not every benchmark in the file), and the FX table when a conversion was made (against `FX_STALE_DAYS`, not 12 months).
- Name the oldest dataset used, correctly. A UK run names the British Business Bank figure, not the PitchBook-NVCA one. A US run names PitchBook-NVCA. A converted run can name the FX rates. Write the message in plain words with the dataset's real name and date.
- The 12-month rule for the other datasets is unchanged.
- This changes quality scores for non-US runs (they no longer lose points for a US dataset they did not use). Say so in the PR with a before and after for a UK run, a German run and a US run.
- Read the `null` entries of `REFERENCE_DATA_AS_OF` and leave them ignored, as today.

## Part 5: tests

- `fx.ts`: every supported pair converts through EUR to the expected value (hand-calculate three), same currency is the identity, an unsupported currency returns null, a pegged rate converts, the table's `asOf` is present, and a test fails if any currency used in `VALUATION_BENCHMARKS` or `COUNTRIES` is neither supported nor on an explicit "unsupported" list with a reason.
- `resolveBenchmark`: converted case (GBP to USD), unsupported pair (reports the mismatch and does not convert), same currency (unchanged, no `fx`), every rung (country, region, global).
- Pipeline: GB Startup, GB Development, DE Startup and DE Development run in USD. Show the old 1.1.0 point, the new 1.2.0 point and the difference, with the rate and its date, in the PR. The 1.2.0 figure for each must equal the figure you get by running the same intake with the benchmark pre-converted by hand at the same rate. That is the correctness test, and it is the one A3 used.
- Same currency, no change: GB in GBP, DE in EUR, US in USD give identical output to 1.1.0, to the dollar. The Germany `validated` cell still reproduces. Northwind and NovaCloud reproduce.
- Replay test from Part 3.
- Sensitivity and optimiser: the benchmark driver moves the converted value. The guardrail test (no counterfactual changes a market parameter) still passes, and now also asserts the FX entry in the snapshot is identical before and after every counterfactual.
- `parameter_stale`: US, UK, DE and a converted run, as in Part 4.
- The "no Sentry, Supabase, Next or React import" test stays green.

## Part 6: version, exports, docs

- `package.json` and `ENGINE_VERSION` to `1.2.0`. Export `convertAmount`, the FX types, `FX_STALE_DAYS`, and the extended `BenchmarkResolution`.
- Replace the "NO FX CONVERSION" paragraph in `benchmarks.ts` with an accurate one: converts when a dated rate is held, reports the mismatch when not, never invents a rate. Keep the rest of that header.
- `CHANGELOG.md` entry: what was added, that the change affects only runs whose currency differs from the benchmark's, and that `parameter_stale` now names the datasets the run used.
- README: the `fx` field on the resolution and the snapshot, and how to refresh the table (where the ECB file is, which fields to edit, which tests to run).
- Do not bump `apps/valuation-engine`. It stays on `1.1.0` in this PR.

## Raise HQ impact

Report this in the PR, in its own section, before the code summary.

1. What currency does the portal send, and does any real payload reach the resolver with a run currency different from the benchmark's? Test the two portal shapes you can find (a UK company, a German company, a US company, and one in a currency with no benchmark).
2. For each: same result as 1.1.0, or different? If different, by how much and why.
3. Whether a note to Raise HQ users is needed when the engine app moves to 1.2.0.

## Acceptance

- Typecheck clean. All 1.1.0 tests pass, except any test that encodes the old unconverted behaviour. List every test you change.
- `npm run build` produces `dist/` with ESM, CJS and types.
- Northwind, NovaCloud and the Germany `validated` cell reproduce to the dollar when the currencies match.
- The converted runs match the hand-converted runs.
- No rate in the table that is not in the published ECB file or a cited peg. Show the file name and its date in the PR.
- `git diff` on `referenceData.ts` and `benchmarks.ts` shows no benchmark value changed, unless Ed supplied refreshed figures (see below).
- The engine app and the deck app are unchanged.
- CI for the package passes.

## Not in scope

Refreshing the PitchBook-NVCA or British Business Bank figures (unless Ed supplies them, see below). New benchmark cells. Real quartiles. A peer dataset. The `multiple_kind_fallback` check (hard-coded to pass today). The expected-dilution, net-debt and exit-timing audit items. Any change in theangel-app or the Raise HQ portal.

## Ed must do

1. Before the session starts: decide whether to supply refreshed benchmark figures for this release. The PitchBook-NVCA data is dated 30 September 2025, so every TheAngel run loses 10 quality points until it is refreshed, and the British Business Bank data goes stale on 31 December 2026. If you have the new figures, attach them with their sources. The session will add them as a separate commit, re-validate, and list every changed cell. If you do not, they stay as they are and E3 ships without them.
2. Confirm you accept reversing the 31 August "no FX conversion" decision for the case where currencies differ. This handoff assumes you do.
3. After the work is ready: push the tag `valuation-core@1.2.0` on the final commit, wait for the publish run, then merge. This keeps production green, as with E1 and E2.
4. Read the Raise HQ impact section. Decide whether Raise HQ users need a note before the engine app moves to 1.2.0.
5. Type the service key for the hosted Northwind check on the engine-app bump PR.

## After merge

1. A small PR in `sourcecapital-apps` bumps `apps/valuation-engine` to `1.2.0`. Open it after the tag publishes. It changes the dependency string and nothing else. Run the hosted Northwind check as in E1 and E2. Northwind must match `main` to the cent. Show the before and after for any payload from the Raise HQ impact section that moves. Title it so that it says it can change Raise HQ results.
2. A follow-up PR in `theangel-app` (Ed asks Claude to write it as A3b): bump the pin to exactly `1.2.0`, make the currency guard in `src/lib/valuation/model.ts` follow the package's `currencyMismatch` flag so only unconverted pairs are benchmark-only, show the conversion note on the Against the benchmark strip and in the report, re-run the UK and German seeded listings, and screenshot them. Ed then flips `CURRENCY_MISMATCH_IS_BENCHMARK_ONLY`.

## Final report

End the session with: the PR link and a one-line summary; the ECB file name and reference date, and the URL; the table of currencies supported and any left unsupported with the reason; the callers of `resolveBenchmark` and what each passed before and after; the old and new point values for GB and DE at Startup and Development, with the rate used; Northwind, NovaCloud and Germany `validated` old and new values; the `parameter_stale` before and after for UK, DE and US; the size-premium finding; the Raise HQ impact section in one paragraph; every existing test changed; anything you found that is not on this list.
