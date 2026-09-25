# Release Specification

## Status

This is the executable contract for the current shopping-budget release.

The original core MVP is implemented. Several post-core capabilities are also implemented and are explicitly listed below.

The installable offline PWA shell is **IMPLEMENTED**. Barcode and OCR remain **PLANNED / GATED**.

## Core job

A shopper can:

> set a hard per-trip limit, add prices while shopping, always know what remains, correct mistakes quickly, survive reload, finish the trip, and do it without an account or mandatory network service.

## Current release capabilities

### IMPLEMENTED core

- one active trip;
- EUR;
- exact integer-minor money;
- budget;
- optional safety buffer;
- manual price entry;
- quantity;
- projected consequence before commit;
- add/edit/remove;
- one-step Undo;
- reserve and nominal over-budget states;
- active-trip persistence;
- degraded persistence UX;
- reload recovery;
- finish trip;
- optional actual checkout total;
- completed-trip history;
- keyboard/assistive-technology access.

### IMPLEMENTED repeat-use extensions

- Shop again from completed history;
- Recent Items;
- local Price Memory;
- local history deletion;
- independent Price Memory deletion;
- retention/timing evidence tooling that does not own shopping state;
- installable offline application shell with prompt-based updates.

### PLANNED / GATED
- barcode identification;
- shelf-label OCR;
- weighted goods;
- discount engine;
- tax-exclusive pricing mode;
- voice input;
- receipt scan;
- reopening completed trip into active state;
- cloud sharing/sync;
- backend/authentication.

## Functional requirements

### FR-001 — Start trip

Given no active trip, a valid positive EUR budget starts a trip.

Optional safety buffer must satisfy domain rules.

### FR-002 — Remaining-first state

The active screen exposes remaining safe spending as the primary metric.

Supporting context may include nominal remaining, cart total and budget progress.

### FR-003 — Manual price draft

The user can enter a price without supplying product metadata.

Input behaviour follows `MONEY-SPEC.md`.

### FR-004 — Project before commit

A valid draft projects:

- line total;
- cart total;
- nominal remaining;
- safe remaining;
- reserve/over-budget consequence.

Projection does not mutate canonical trip state.

### FR-005 — Add item

Commit creates one valid item and immediately updates the active trip.

Persistence is attempted synchronously through the application boundary.

### FR-006 — Quantity

Quantity is a positive bounded integer and line totals remain exact.

### FR-007 — Edit item

Active item price, quantity and optional label can be corrected.

### FR-008 — Remove item

Active items can be removed.

### FR-009 — Undo

The most recent supported active-trip cart mutation can be undone.

Undo is not full event sourcing.

### FR-010 — Budget / buffer adjustment

The active budget and safety buffer can be changed intentionally.

A change that creates overage remains valid.

### FR-011 — Reserve crossing

If projected cart total crosses the safe limit but not nominal budget, the user sees an explicit reserve consequence before commit.

### FR-012 — Nominal over-budget

If projected cart total exceeds budget, the user sees explicit overage and can intentionally continue.

### FR-013 — Persistence durability

Committed active-trip mutations attempt local persistence promptly.

The UI must not silently represent failed persistence as durable success.

### FR-014 — Reload recovery

Valid saved active state restores after reload.

Malformed/unsupported data follows the recovery contract rather than being guessed into validity.

No stored-data problem may leave the shopper without a path to shop: an unreadable saved trip offers continue-without-saving and set-aside, and damaged history never blocks starting a trip and can be set aside before finishing.

### FR-015 — Finish trip

Finishing creates a completed trip.

History must become durable before active-trip cleanup.

Failed history persistence must not erase the active trip.

### FR-016 — Completion cleanup failure

If history is durable but active cleanup fails, completion remains durable and the app exposes cleanup-pending/degraded state.

### FR-017 — Actual checkout total

A completed trip may store actual checkout total.

Derived difference does not rewrite item prices.

### FR-018 — Completed history

History provides enough information to understand prior shopping trips without becoming a general expense dashboard.

### FR-019 — Shop again

A valid completed trip can seed a **new empty active trip** with prior budget/buffer when persistence state is safe.

This is not reopening historical state.

### FR-020 — Price Memory learning

Eligible confirmed observations are learned only after completed history is durable.

### FR-021 — Price Memory reuse

Remembered price remains explicitly remembered and does not become authoritative current price merely through reuse.

### FR-022 — Local data controls

Completed history and Price Memory can be cleared independently according to their persistence contracts.

### FR-023 — No mandatory external service

Current release does not require:

- barcode/OCR;
- AI;
- authentication;
- bank API;
- backend;
- analytics service.

### FR-024 — Accessibility equivalence

The complete core workflow remains achievable through semantic controls and keyboard/assistive technologies.

### FR-025 — Local-first core

Shopping state, manual entry, editing, completion and history do not require a remote business service. After the application shell has been cached, the core flow remains available without network access.

### FR-026 — Continue/reopen after finish

**PLANNED / GATED.**

Historical reopen requires an explicit loss-safe history ↔ active-state transaction and is not current behaviour.

### FR-027 — Future barcode

**PLANNED / GATED.**

Barcode may identify product context but cannot be treated as authoritative current shelf price by default.

### FR-028 — Future shelf OCR

**PLANNED / GATED.**

OCR produces candidate price data requiring appropriate confirmation.

### FR-029 — Installable offline shell

**IMPLEMENTED.**

The public release exposes an installable manifest and Workbox-generated service worker that precaches application-shell assets.

The service worker:

- does not own or mutate canonical shopping state;
- does not generate for guarded QA/beta evidence builds;
- uses prompt-based updates;
- never forces a reload during an active shopping lifecycle.

After a successful online cache/install pass, active-trip and completed-history workflows remain available offline through the existing local persistence contract.

## Canonical state requirements

Canonical active/completed trip data includes only inputs and lifecycle facts required to reconstruct the shopping state.

Derived totals are never storage authority.

Detailed rules: `DOMAIN.md`.

## Money contract

All canonical financial values use integer EUR minor units.

Detailed parser/arithmetic contract: `specs/MONEY-SPEC.md`.

## Price trust contract

Source and confidence remain separate dimensions.

A value can be remembered/scanned in origin while independently carrying a confidence/currentness state.

## Non-functional requirements

### NFR-001 — Correctness

No canonical binary floating-point money arithmetic.

### NFR-002 — Responsiveness

Core local interactions feel immediate.

### NFR-003 — Reliability

A failed optional subsystem cannot silently corrupt core trip state.

### NFR-004 — Progressive enhancement

Optional capture/visual capabilities never become required for manual core completion.

### NFR-005 — Accessibility

Keyboard, focus, semantics, large text and reduced-motion requirements are release quality.

### NFR-006 — Mobile-first

The primary flow is usable one-handed on compact phone widths.

### NFR-007 — Bundle discipline

The shipped PWA shell must remain small and asset-only; gated future scanner/OCR dependencies must not penalise the current critical path before they ship.

### NFR-008 — Privacy

Core shopping state is local. Evidence tooling stays content-minimized and separate.

### NFR-009 — Premium quality

The product must feel intentional, polished and distinctive without adding recurring friction or reducing accessibility.

## Acceptance journey

A representative release journey:

1. open with clean storage;
2. start a EUR trip with budget/buffer;
3. add exact prices;
4. observe remaining/reserve consequence;
5. edit/remove/Undo;
6. reload and restore;
7. finish trip;
8. optionally enter actual checkout total;
9. return to history;
10. start another trip;
11. reuse or override a remembered value where available.

The journey must remain clear, fast, durable and accessible.

## Acceptance rule

Current release behaviour is accepted only when:

- applicable domain/spec tests pass;
- persistence/recovery semantics pass;
- component/browser journeys pass;
- accessibility checks pass;
- code/docs agree on implementation status;
- no gated capability is presented as shipped;
- premium polish does not compromise speed or clarity.
