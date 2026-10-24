# Changelog

## 1.0.0

Extracted from apps/valuation-engine with no behaviour change. Added intake field definitions, mapIntakeToEngine and suggestStage.

Also new: `ENGINE_VERSION`, `REFERENCE_DATA_AS_OF`, `INTAKE_REQUIRED_COUNT` (63), and `INDUSTRY_ALIASES` / `SECTOR_SOURCE` are now exported (values unchanged).

## 1.0.0-rc.1

Prerelease of 1.0.0, published under the `rc` dist-tag so the engine app's PR preview could be tested before merge. 1.0.0 differs only in the intake definitions: `revenue` and `fundraising_this_year` listed as grid fields, and `INTAKE_REQUIRED_COUNT`. No change to the valuation path.
