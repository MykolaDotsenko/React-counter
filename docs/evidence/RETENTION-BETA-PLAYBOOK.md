# Retention Beta Playbook

## Purpose

This playbook defines how to run the Phase 8 real-store retention beta without weakening the repository's evidence standards.

The beta exists to answer one question:

> Will real shoppers use the core shopping-budget flow again on a later real trip?

The app records only privacy-safe local event structure. It does not replace observation, interviews, or human timing evidence.

## Guarded beta route

Use:

> `/shopping-budget-companion/beta/`

Do not treat the default/public shell as evidence of a passed retention gate.

## Guarded cohort analyzer

Use:

> `/shopping-budget-companion/cohort/`

This facilitator-only route imports retention JSON files in browser memory, validates them with the current runtime contract and computes the cohort summary locally. It has no backend, no telemetry, no service worker and no shopping-state access.

A newer export with the same retained-session key replaces an older export from that session. This prevents accidental double-counting of repeated exports from one device session, but it is **not** participant identity deduplication. Keep the external study log authoritative for participant uniqueness.

The copied or downloaded aggregate summary excludes raw participant events and filenames. Prefer **Download aggregate summary** when preserving a cohort result; clipboard copy remains a fallback.

## Cohort

Target:

> **20–50 real shoppers**

Each participant should contribute at most one current-schema retention session to one cohort analysis.

A participant may use the beta across multiple real shopping trips. Do not reset the local beta evidence between those trips.

If a session must be reset because the test was invalid, discard the previous export from cohort analysis rather than counting both as separate participants.

## What the app records

Allowed event structure includes:

- trip start
- trip finish
- trip restore
- 1 / 5 / 10 item milestones
- manual-entry completion duration
- manual-entry abandonment
- remembered-item reuse
- current-price override start

The evidence export intentionally excludes:

- budgets
- prices
- item names
- store history
- camera content
- account identity
- network telemetry

Do not add participant names, email addresses, store names, shopping lists, prices, or free-text notes to the app evidence payload.

## Participant workflow

1. Open the guarded beta route.
2. Use the product during a real shopping trip.
3. Use the app naturally; do not force a specific feature merely to create events.
4. Leave the retained beta evidence on the device after the first trip.
5. Reuse the beta on later real trips when that matches normal shopping behaviour.
6. After the agreed observation window, open **Beta evidence** and choose **Download JSON evidence**.
7. If local download is unavailable, use **Copy privacy-safe evidence** as the fallback and save the copied JSON outside the app.
8. Keep the downloaded/copied export as a separate JSON file. The default filename contains only the beta session timestamp, not participant identity.
9. On the facilitator device, import the retained exports into `/cohort/` and review invalid/duplicate/replacement counts before interpreting metrics.
10. Save the cohort result with **Download aggregate summary**. Use **Copy aggregate summary** only when a local download is unavailable.

A facilitator may rename the exported file with an external study code such as `P001`. That external code must remain outside the app payload and must not be injected into the evidence JSON.

## Evidence quality rules

Before an export enters cohort analysis:

- it must use the current schema version
- its privacy declaration must match the current contract
- its embedded session must pass runtime validation
- imported summary values are not trusted; summaries are recomputed from validated events
- one participant contributes one retained beta session
- synthetic/manual fixture data must never be mixed with real cohort data
- incomplete evidence may remain useful, but must not be silently upgraded to completed-trip evidence
- second- and third-trip retention require a contiguous observed start sequence (1 → 2 → 3) with non-decreasing start timestamps
- a `trip_finished` event counts as completion only when the same trip ordinal has an observed start at or before that finish timestamp

The implementation provides:

- `parseRetentionBetaExport(...)` for runtime validation and summary recomputation
- `summarizeRetentionBetaCohort(...)` for cohort-level aggregation from current validated exports

Cohort aggregation uses each export's `generatedAt` as that participant's observed-through timestamp. An export whose timestamp predates retained session evidence is invalid.

## Primary denominator

The primary retention denominator is:

> participants with at least one observed `trip_started` event

Participants who opened the beta but never started a trip are not counted as activated users in second-trip rate.

Keep the raw participant count separately so activation loss remains visible.

### 7 / 14 / 30 day denominator maturity

Do not count a participant as a failure for a time window that has not elapsed.

For each window:

- a participant is eligible immediately if a qualifying second trip has already occurred within that window;
- otherwise the participant enters that denominator only when `generatedAt - first trip start` reaches the full window;
- participants still inside the window are right-censored and excluded from that window-specific denominator;
- report the eligible-participant count next to every window-specific rate.

This prevents an actively recruiting cohort from artificially depressing 7-, 14-, or 30-day retention.

### Interpretation readiness

The target cohort remains **20–50 real shoppers**, but imported participant count and time-window eligibility are different concepts.

For a time-window retention decision:

- do not interpret the 7-day rate until at least 20 participants are eligible for the 7-day window;
- do not interpret the 14-day rate until at least 20 participants are eligible for the 14-day window;
- do not interpret the 30-day rate until at least 20 participants are eligible for the 30-day window;
- a participant who has already returned successfully inside a window is immediately eligible for that window;
- a non-returner becomes eligible only after the full window has elapsed.

The analyzer exposes this readiness explicitly. It does not convert readiness into a “good/bad” product verdict.

The aggregate second-trip and third-trip values across all activated users are descriptive **observed-so-far shares**, not time-normalized retention outcomes. Use the maturity-aware 7/14/30-day rates for time-bounded retention decisions.

## Primary metrics

Report at minimum:

- participant count
- activated participants
- second-trip participants
- second-trip rate
- second trip within 7 days + eligible participant count
- second trip within 14 days + eligible participant count
- second trip within 30 days + eligible participant count
- third-trip participants
- third-trip rate
- third trip among second-trip participants
- total started trips
- completed-started trips
- trip completion rate

Completion rate counts only a `trip_finished` event whose trip ordinal has a corresponding `trip_started` event at or before the finish timestamp. Orphan, reversed, or partial finish evidence must not inflate completion.

Second-trip and third-trip metrics likewise require contiguous chronological starts. Observing trip ordinal 3 without a valid ordinal 2 does not imply either second- or third-trip retention.

## Friction and acceleration metrics

Also report:

- participants reaching item 1
- participants reaching item 5
- participants reaching item 10
- median completed manual-entry duration
- manual-entry abandonment rate
- repeat-trip starts
- participants using repeat-trip start
- remembered-item uses
- participants using remembered items
- current-price overrides

Remembered-item participant reach uses activated participants as the denominator. A participant may already have Price Memory before the beta session starts, so remembered-item usage is not restricted to users who reached a second beta-relative trip.

## Human observation

The local recorder cannot answer why a participant abandoned or returned.

Use [RETENTION-STUDY-LOG-TEMPLATE.md](./RETENTION-STUDY-LOG-TEMPLATE.md) as the private facilitator-log structure. Do not commit completed participant logs to the public repository.

After a real trip, capture short facilitator notes outside the evidence JSON:

- Did the user understand remaining budget immediately?
- Did manual price entry interrupt normal shopping?
- Was one-handed use comfortable?
- Did the user trust the totals and persistence?
- Did Recent Items / Price Memory reduce effort?
- What was the biggest moment of friction?
- Would the user choose to use it on the next real trip?

Keep qualitative notes separate from privacy-safe app evidence.

## Decision discipline

Use the provisional retention bands only from `docs/research/PRODUCT-SUCCESS-STRATEGY.md`. They are internal heuristics, not industry benchmarks, and real cohort evidence overrides them.

Do not start Phase 9 merely because the engineering backlog is ready.

Human cohort evidence must drive the gate. Code, automated browser tests, synthetic fixtures, and manually constructed event JSON cannot substitute for real repeated shopping behaviour.

## B6 timing status

The physical-phone interaction gate is separate from retention and was accepted for the current cycle on 2026-09-24 by explicit owner/user attestation.

No structured timing JSON was retained, so exact human timing statistics and the <=2.5 s KPI must not be quoted from that attestation.

Retention success does not retroactively create quantitative B6 timing evidence.
