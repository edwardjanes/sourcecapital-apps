# Claude Code handoff: move the Raise HQ valuation engine app to valuation-core 1.2.0

Repo: `edwardjanes/sourcecapital-apps`. Branch: `claude/engine-bump-1-2-0`, cut from `main` (E3 is merged: PR #46, squash `b7b4d23`). One PR. Ed approves the merge. Do not merge it.

This is the same job as PR #45 (the 1.1.0 bump, `apps/valuation-engine/package.json`, one line). Read PR #45 first and follow its method and its PR layout.

## What this changes

`apps/valuation-engine` moves from `@edwardjanes/valuation-core` 1.1.0 to 1.2.0 (tag `valuation-core@1.2.0`, published). The dependency string in `apps/valuation-engine/package.json` is the only expected change. If a lockfile or anything else needs to change, say what and why in the PR.

**This PR changes Raise HQ valuation results for some companies.** 1.2.0 converts a benchmark quoted in another currency into the company's reporting currency, at ECB rates dated 23 October 2026. Until now the engine read, for example, a EUR benchmark as if it were SEK. From the E3 report, on the Raise HQ path (the country's own currency):

- UK, German, French, Irish, Spanish and Italian companies at Idea: the European pre-seed cell is in USD, so figures fall about 10% to 24%.
- Swedish and Polish companies at every stage: figures rise roughly 1.5 to 9 times (a real error being corrected).
- Swiss companies at every stage: figures fall 1% to 16%.
- Companies outside Europe and the US from Development on: the global seed cell is in EUR, so figures rise 3% to 11%.
- GB companies in GBP, US companies in USD and Northwind do not change.

E3's read-only query found only 3 UK companies (unchanged) and 16 blank-country rows that look like August test runs (about +10% on recompute) in Raise HQ today. No portal note is recommended. Ed decides before merge.

## Hosted check (the point of this PR)

Follow PR #45 exactly.

1. Open the PR, wait for the Vercel preview of `apps/valuation-engine`, and note the preview URL and commit.
2. **Predict first, in process.** Build the package at the tag and compute each payload below at 1.1.0 and at 1.2.0 locally. Record both figures to the cent before any hosted call.
3. **Stop and ask Ed to type the service key** for the hosted calls. Do not look for it, read it from the environment, or ask him to paste it into the chat. He types it into the command.
4. POST the same request bodies to `/api/valuation/compute` on production (1.1.0, `valuation-engine-sigma.vercel.app`) and on the preview (1.2.0). Give each call its own test `locationId`, for example `pr<number>-<payload>-prod` and `-rc`.
5. Compare. Every hosted value must equal the in-process prediction for its version exactly. Apart from the three figures and the per-call `companyId`, `snapshotId` and `reportUrl`, each pair of responses should be byte-identical. Report any other difference, including the data-quality copy and `currency`.

Payloads, using the Northwind fixture as the base:

| Payload | Expected |
| --- | --- |
| Northwind as it is (GB, GBP) | identical to the cent: point 3,166,355.9801996546, low 2,459,855.7016135636, high 3,843,405.216959769 |
| Northwind with country Sweden (SEK) | rises sharply |
| Northwind with country Germany at the Idea stage | falls (EUR run against a USD pre-seed cell) |
| Northwind with country Switzerland | falls slightly |

If a payload cannot be built from the fixture without changing more than the country and stage, say how you built it. If any country is not supported by the engine app, say so and use the nearest case from the E3 list.

## Checks

- Typecheck clean, the app's tests pass, `next build` green, as in PR #45.
- Check that the app's report PDF and its `data_quality` copy do not mention "no FX conversion" or anything else that 1.2.0 makes untrue. Search the app, not the package. If something is stale, list it in the PR. Fix it only if it is a one-line copy change, and say so.
- Check the compute route does not read the new `fx` fields in a way that changes the response shape. Report the response shape before and after.

## Not in scope

Any change to the package. Any change to `theangel-app` (A3b is a separate session). The US benchmark refresh, the Scorecard market-size thresholds, a portal user note, and cleaning up test rows (list the test rows the hosted calls created in the PR so Ed can delete them).

## Ed must do

1. Type the service key for the hosted check.
2. Decide whether portal users get a note about results moving before this merges.
3. Merge when green, then watch the production deploy.

## Final report

PR link and one line on what it does. The prediction table (each payload at 1.1.0 and 1.2.0, to the cent) next to the hosted results. Any difference beyond the three figures. The response shape check. Any stale copy found. The test rows created. What you did not check.
