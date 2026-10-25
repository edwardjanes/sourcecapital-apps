# Changelog

## 1.2.0

Currency conversion for benchmarks (slice E3). This reverses the 31 Aug 2026 "no FX conversion" decision for the case where a figure's currency differs from the run's, with Ed's approval. Where the currencies match nothing changes.

- `fx.ts`: `FX_RATES`, the ECB euro foreign exchange reference rates for 23 October 2026 (raw rates per 1 EUR, from `eurofxref-daily.xml`), plus the UAE dirham's official peg (AED 3.6725 per USD, Central Bank of the UAE). Crosses are derived through EUR at use. `convertAmount({ amount, from, to })` returns `{ amount, rate, rateAsOf, source, kind }`, or null when either currency is unsupported. `FX_UNSUPPORTED` lists the one currency the engine can meet with no rate (NGN) and why. `FX_STALE_DAYS = 180`. `REFERENCE_DATA_AS_OF.fxRates` carries the table's date.
- `resolveBenchmark` converts a cell in another currency into the run's currency and returns `converted: true` with `fx` (rate, date, source, original median and currency, converted median). With no rate it returns the cell unchanged and `currencyMismatch: true`, as before. `buildDefaultParameters` takes an optional fourth argument `{ currency }`, the run's reporting currency; without it the country's currency is used, which is what the Raise HQ engine app reports in. `runAngelValuation` passes `opts.currency`. The Scorecard average, the Checklist ceiling and the sensitivity's benchmark driver all read the converted figure.
- The size-premium bands are in USD (their anchor is the Kroll/CRSP deciles of US-listed companies). Last actual revenue in another currency is converted to USD for the band lookup, recorded as `discount_rate_build_up.sizeBandRevenue` and `sizeBandFx`. With no rate the revenue is compared as entered, as before. This can move a non-USD company whose revenue sits near a band edge (5m, 25m, 100m, 500m USD).
- `parametersSnapshot.fx` lists every conversion a run made. A replay uses the stored figures, never the live table.
- `parameter_stale` now judges only the datasets the run used: the risk-free rate, the country risk premium, the industry rows, the resolved benchmark cell (when Scorecard or Checklist carried weight), and the FX table when a conversion was made (against `FX_STALE_DAYS`). It names the dataset by its real name and date. A UK or German run no longer fails it, or loses quality points, for the US PitchBook-NVCA data it did not use. Each benchmark cell gains a `dataset` name for this; no benchmark value changed.

**Results change** only for runs whose currency differs from a benchmark cell's (or, through the size bands, for a non-USD company near a band edge). On the Raise HQ path (country currency) that is: UK, French, German, Irish, Spanish and Italian companies at Idea (the European pre-seed cell is in USD); Swedish, Swiss and Polish companies at every stage; and every company outside Europe and the US at Development and later (the global seed cell is in EUR).

## 1.1.0

Added for TheAngel, all taking one input type, `ValuationContext`:

- `runAngelValuation(ctx)`: the one entry point for a run. It maps the intake, builds and overrides the parameters (or replays stored ones), computes the valuation and sensitivity, runs the checks, scores data quality, sets the range, builds the actions and writes a one-sentence stage note. It returns `status` (`ready`, `draft` or `benchmark_only`), the point and range, and a `parametersSnapshot` that replays the run to the cent.
- `evaluateChecks`: 17 extended checks on top of `validateWizardData` (unchanged), each with severity, copy and a `fieldRoute`. `forecast_outlier` and `growth_below_peers` return `not_evaluated` until a sourced growth-quartile table exists.
- `computeQualityScore` (completeness 40, evidence 30, consistency 20, freshness 10) and `applyRangeSpread`.
- The optimiser: `OPTIMISE_RULES` (angel-optimise-v1, 24 rules), `buildActions`, `computeHeadroom` and `simulate`.

**Audit item 2b changes results for loss-making companies:** DCF with long-term growth is now excluded when terminal-year net income is zero or below, and DCF with exit multiple when terminal-year revenue is zero or below, with their weight redistributed. Raise HQ gets this when the engine app moves to 1.1.0.

## 1.0.0

Extracted from apps/valuation-engine with no behaviour change. Added intake field definitions, mapIntakeToEngine and suggestStage.

Also new: `ENGINE_VERSION`, `REFERENCE_DATA_AS_OF`, `INTAKE_REQUIRED_COUNT` (63), and `INDUSTRY_ALIASES` / `SECTOR_SOURCE` are now exported (values unchanged).

## 1.0.0-rc.1

Prerelease of 1.0.0, published under the `rc` dist-tag so the engine app's PR preview could be tested before merge. 1.0.0 differs only in the intake definitions: `revenue` and `fundraising_this_year` listed as grid fields, and `INTAKE_REQUIRED_COUNT`. No change to the valuation path.
