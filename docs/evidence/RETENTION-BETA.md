# Retention Beta Protocol

## Status

Authoritative operating protocol for the guarded real-store retention beta.

This supports the **Retention validation gate after Phase 8**.

It does not declare that the gate has passed.

## Guarded build

Pages path:

~~~text
/shopping-budget-companion/beta/
~~~

Build flags:

~~~text
VITE_SHOPPING_BETA_EVIDENCE=1
~~~

The timing/one-hand QA build remains separate at `/qa/`.

## Purpose

Measure whether real shoppers complete trips, return for second and third trips, and benefit from Phase 8 repeat acceleration.

The recorder is deliberately narrower than a normal analytics product.

## Recorded evidence

Local behavioural structure only:

- `trip_started`
  - source: `new`, `repeat`, or `resume`
  - session-relative trip ordinal
  - timestamp
- `trip_restored`
- `trip_finished`
- `item_milestone`
  - 1
  - 5
  - 10
- `manual_entry_completed`
  - duration only
- `manual_entry_abandoned`
- `remembered_item_used`
- `current_price_override_started`

Derived locally:

- trips started / finished
- second trip reached
- third trip reached
- second trip within 7 / 14 / 30 days
- repeat starts
- restores
- trips reaching 1 / 5 / 10 items
- median manual-entry duration
- manual-entry abandonment count
- remembered-item use
- current-price override count

## Explicitly excluded

The retention schema has no fields for:

- budget
- safety buffer
- item price
- line/cart total
- checkout total
- item name
- product id
- Price Memory id
- store id/history
- location
- camera content
- account identity
- email

There is no analytics SDK and no network telemetry.

## Storage

Key:

~~~text
budget-cart:qa:retention-v1
~~~

Storage:

> localStorage on the beta device

The record is versioned and runtime-validated.

Malformed evidence falls back to a fresh evidence session and must never affect shopping state.

The event history is bounded.

Evidence storage failure must never change the active cart, completed history, Price Memory, or completion transaction.

## Trip ordinals

Trip ordinals belong to the beta evidence session.

They are not derived from completed shopping-history length.

This matters because:

- historical shopping trips may predate the beta
- beta evidence may be reset between participants
- a shopper may resume a trip after reload
- the beta may be enabled while a trip is already active

If the guarded beta opens with an already-active trip:

- an existing open beta trip is recorded as restored
- if the beta had no open trip yet, the observed trip begins as `resume`

## Evidence UI

The **Beta evidence** panel is intentionally hidden during active shopping.

Reason:

> the measurement UI must not cover controls or alter the task it is measuring.

The panel appears between trips / after completion.

Reset is two-step and must not be available in the middle of an active trip.

## Export

Open **Beta evidence** and choose:

> Copy privacy-safe evidence

The export contains:

- schema version
- export timestamp
- explicit privacy flags
- local event session
- derived summary

If a study needs participant identifiers, keep them outside the app.

Do not add personal identifiers to the exported JSON.

## Real-store procedure

Recommended cohort:

> 20–50 real shoppers

Where practical:

- Cohort A — manual-first
- Cohort B — manual + repeat acceleration / Price Memory
- Cohort C — experimental scanner only if its benchmark gate is positive

The task is not “click through the prototype”.

The task is:

> use it during a real shopping trip

After actual trips, collect qualitative evidence separately:

1. At what point did entry feel tedious?
2. Did the app change a purchase decision?
3. Did the shopper trust the remaining amount?
4. What slowed them down?
5. Was Undo/edit used?
6. Did Recent Items reduce work?
7. Did they override a remembered price with the current price?
8. Would they use it next time?
9. Did they actually return on the next trip?

Observed behaviour outranks stated enthusiasm.

## Primary analysis

Primary metric:

> second-trip rate

Analyze at least:

- within 7 days, using only participants whose 7-day outcome is known
- within 14 days, using only participants whose 14-day outcome is known
- within 30 days, using only participants whose 30-day outcome is known

For a window-specific rate, an outcome is known when the participant already returned within that window or the full observation window has elapsed by the export's `generatedAt` timestamp. Report the eligible denominator with each rate so right-censored participants are never silently counted as failures.

Retention qualification rules:

- second trip requires observed chronological starts for ordinals 1 and 2;
- third trip requires observed chronological starts for ordinals 1, 2 and 3;
- skipped/reversed ordinals remain partial evidence and do not upgrade retention;
- completion requires a matching start at or before the finish event.

Also inspect:

- third-trip behaviour
- full-trip completion
- tenth-item reached
- median manual-entry time
- remembered-item usage
- current-price overrides
- manual-entry abandonment
- restore frequency
- trust/data-loss complaints

Use the interpretation bands in `docs/research/PRODUCT-SUCCESS-STRATEGY.md`.

## Gate rule

The existence of the recorder does not authorize Phase 9+ breadth.

Proceed only after real evidence is reviewed.

Automation can prove that evidence is collected correctly.

Automation cannot prove that shoppers want to use the product repeatedly.
