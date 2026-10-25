# E3 addendum: refresh the US benchmark cells

Read this together with `docs/handoffs/e3-fx-conversion.md`. It answers "Ed must do" item 1 of that handoff: Ed has no figures of his own, and a newer PitchBook-NVCA report exists. Add the refresh as its own commit, after the FX work, so the two changes can be reviewed and reverted separately.

## What was found

The PitchBook-NVCA Venture Monitor for Q3 2026 is published (PitchBook page dated 8 October 2026; PDF at https://nvca.org/wp-content/uploads/2026/10/Q3-2026-PitchBook-NVCA-Venture-Monitor.pdf). Page 11 holds the chart "Median VC pre-money valuation ($M) by series", footed "As of September 30, 2026". The chart's data labels, in extraction order, are 48.1, 140.0, 308.5, 831.9, 60.3, 187.0, 500.0, 1,723.7, 16.0, 18.3. Read as stage and year, that gives:

| Stage | 2025 | 2026 (as of 30 September 2026) |
| --- | --- | --- |
| Seed | $16.0M | $18.3M |
| Series A | $48.1M | $60.3M |

The reading is consistent with the chart title ("Median Series D+ pre-money valuation more than doubles 2025 level": $831.9M to $1,723.7M) and with the engine's current Q3 2025 cells (seed $15.8M, Series A $46.5M). It was extracted by a text tool, so **do not trust it until you have looked at page 11 yourself.** Download the PDF, open page 11 and confirm each number against its stage and year. If you cannot reach the PDF, stop and ask Ed to confirm the four numbers by eye. Do not proceed on the extraction alone.

The report has no pre-seed median. Nothing else was found: the British Business Bank 2026 Equity Tracker (2025 calendar year) is already the latest edition and is already in the table.

## What to change

In `src/benchmarks.ts`, only if page 11 confirms the numbers:

- US `seed`: median `18_300_000`, `asOf: '2026-09-30'`, source "PitchBook-NVCA Venture Monitor, Q3 2026 (published 8 October 2026), page 11, chart 'Median VC pre-money valuation ($M) by series', median seed pre-money valuation, as of 30 September 2026."
- US `series_a`: median `60_300_000`, same `asOf`, same source with "median Series A".
- US `pre_seed`: leave at `7_700_000` with `asOf: '2025-09-30'`. The Q3 2026 report has no pre-seed median. Do not estimate one. If you find a published Q3 2026 pre-seed median in a named source, tell Ed and stop. Do not add it without his approval.
- `REFERENCE_DATA_AS_OF.pitchbookNvca` currently holds one date. The cells now have two dates. Make the field hold the oldest PitchBook-NVCA date in the table (`2025-09-30`) and keep the per-cell `asOf` as the source of truth. E3's Part 4 already evaluates staleness per resolved cell, so a US seed or Series A run reads 2026-09-30 and stops showing the stale-data warning, and only a US idea-stage run still reads 2025-09-30.
- Update the comments in `data-as-of.ts` and `benchmarks.ts` to match.

## Effect, and what to report

This moves US results. The US seed benchmark rises 15.8% (15.8 to 18.3) and the Series A benchmark 29.7% (46.5 to 60.3). Seed is the cell every US company from `development` upward uses, so the Scorecard and Checklist methods move for every US company. Report in the PR, in its own section:

1. The old and new point values for a US Idea, Development and Startup company, using the existing fixtures where they are US companies. Say which of Northwind and NovaCloud are US companies.
2. The acceptance rule for the fixtures changes for those commits. Before the refresh commit, Northwind and NovaCloud must reproduce to the dollar. After it, a fixture may move only if it is a US company that resolves to the US seed or Series A cell. List every fixture that moves, with the old and new value, and every test whose expected value you change. Do not change an expected value for any other reason.
3. The Germany `validated` cell, the UK cell and every non-US run must not move because of this commit. Show that.
4. The Raise HQ impact. US companies in Raise HQ will see higher Scorecard and Checklist values after the engine app moves to 1.2.0. Say so plainly in the Raise HQ impact section, with one US example.

Ed decides whether to merge the refresh with E3 or to split it out. If the effect on Raise HQ is a concern, keep the refresh commit on a separate branch and say so in the PR.
