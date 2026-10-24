# Changelog

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
