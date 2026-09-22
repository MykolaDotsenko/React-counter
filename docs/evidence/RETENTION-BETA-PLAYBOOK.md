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
6. After the agreed observation window, open **Beta evidence** and copy the privacy-safe export.
7. Save the export as a separate JSON file outside the app.

A facilitator may assign an external study code such as `P001` to the filename. That external code must not be injected into the app's evidence JSON.

## Evidence quality rules

Before an export enters cohort analysis:

- it must use the current schema version
- its privacy declaration must match the current contract
- its embedded session must pass runtime validation
- imported summary values are not trusted; summaries are recomputed from validated events
- one participant contributes one retained beta session
- synthetic/manual fixture data must never be mixed with real cohort data
- incomplete evidence may remain useful, but must not be silently upgraded to completed-trip evidence

The implementation provides:

- `parseRetentionBetaExport(...)` for runtime validation and summary recomputation
- `summarizeRetentionBetaCohort(...)` for cohort-level aggregation

## Primary denominator

The primary retention denominator is:

> participants with at least one observed `trip_started` event

Participants who opened the beta but never started a trip are not counted as activated users in second-trip rate.

Keep the raw participant count separately so activation loss remains visible.

## Primary metrics

Report at minimum:

- participant count
- activated participants
- second-trip participants
- second-trip rate
- second trip within 7 days
- second trip within 14 days
- second trip within 30 days
- third-trip participants
- third-trip rate
- third trip among second-trip participants
- total started trips
- completed-started trips
- trip completion rate

Completion rate counts only a `trip_finished` event whose trip ordinal also has a corresponding `trip_started` event. Orphan/partial finish evidence must not inflate completion.

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

Use the provisional retention bands defined in `ROADMAP.md` and `docs/research/PRODUCT-SUCCESS-STRATEGY.md`.

Do not start Phase 9 merely because the engineering backlog is ready.

Human cohort evidence must drive the gate. Code, automated browser tests, synthetic fixtures, and manually constructed event JSON cannot substitute for real repeated shopping behaviour.

## B6 timing debt

The Phase 5 B6 human timing/physical-usability gate remains separate from retention.

Before making release-quality speed claims, collect the representative one-hand, software-keyboard, repeated-add, typo, compact-device/equivalent, and bright-store evidence defined in `docs/evidence/SPRINT-B-QUALITY-GATE.md`.

Retention success does not automatically satisfy the B6 timing gate.
