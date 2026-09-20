# MVP Specification

## Status

Target specification. The shipped application is still Pulse Counter until implementation work satisfies this document.

This is the executable product contract for the first shopping-budget release. It converts the higher-level product, UX, domain, scenario, and architecture documents into numbered requirements that can be implemented and verified.

## Scope

The MVP proves one complete job:

> A shopper sets a hard per-trip limit, adds prices while shopping, always knows what remains, corrects mistakes quickly, survives reload/offline use, and finishes the trip without needing an account or network.

The MVP deliberately does not require barcode scanning, OCR, price memory, voice, cloud sync, or retailer integrations.

Those features may follow only after the core loop meets the acceptance criteria below.

## Supported MVP capabilities

### Required

- start one active shopping trip
- EUR as the only supported MVP currency
- exact money arithmetic in integer cents
- spending budget
- optional safety buffer
- manual price entry
- quantity
- projected remaining before commit
- add item
- edit price
- edit quantity
- remove item
- one-step undo for the most recent cart mutation
- safe-limit state
- nominal over-budget preview
- intentional over-budget state
- local persistence
- visible persistence-degraded state
- reload recovery
- finish trip
- optional actual checkout total
- lightweight completed-trip history
- offline-capable installed/cached experience
- keyboard and assistive-technology access to the complete core flow

### Explicitly deferred

- barcode lookup
- shelf-label OCR
- price memory
- store-aware suggestions
- weighted-price calculator
- discount engine
- tax-exclusive pricing mode
- voice input
- receipt scan
- sharing/sync
- backend/authentication

A deferred feature may be prototyped independently, but it must not become a dependency of MVP acceptance.

## Functional requirements

### FR-001 — Start trip

Given no active trip, the user can create one by supplying:

- budget

Currency is fixed to EUR in MVP.

Optional:

- safety buffer

Acceptance:

- no account required
- no store required
- no product metadata required
- valid trip becomes the active trip
- active trip is persisted immediately
- UI opens the active-trip view directly

### FR-002 — Budget validation

Budget must:

- be representable exactly in EUR cents
- be greater than zero
- remain within JavaScript safe-integer bounds after conversion to minor units

Invalid input is rejected inline without discarding the user's draft.

### FR-003 — Safety buffer

Buffer:

- defaults to zero
- cannot be negative
- cannot exceed nominal budget
- can be changed during an active trip

Derived:

- safeLimit = budget - buffer
- safeRemaining = safeLimit - cartTotal

### FR-004 — Remaining-first active state

The active-trip view always exposes:

- primary remaining value
- cart total
- nominal budget
- safe-limit context when buffer is active
- primary Add price action

If buffer > 0, primary remaining value is safeRemaining.

### FR-005 — Manual price draft

Opening Add price creates ephemeral input state.

The price draft:

- is not canonical trip state
- is not persisted as a cart item before commit
- preserves user input across inline validation errors
- can be cleared or edited
- can be cancelled without changing the trip

### FR-006 — Exact price parsing

Committed prices are converted to integer minor units without binary floating-point arithmetic.

The implementation must not use parseFloat + multiplication as the canonical conversion path.

### FR-007 — Projected result

While a valid price/quantity draft exists, the UI derives:

- projected line total
- projected cart total
- projected safe remaining
- projected nominal remaining
- whether safe limit would be crossed
- whether nominal budget would be crossed

Projection does not mutate canonical state.

### FR-008 — Add item

A valid item can be committed with:

- generated item id
- unit price in minor units
- quantity
- optional label
- price provenance
- created timestamp

After commit:

- canonical active trip changes exactly once
- persistence is attempted immediately
- UI returns to the active-trip summary
- new totals derive from canonical items
- latest mutation becomes undoable

### FR-009 — Quantity

For standard MVP cart items:

- quantity is an integer >= 1
- default is 1
- lineTotal = unitPriceMinor × quantity
- arithmetic must remain within safe-integer bounds

Reducing an existing item's quantity from 1 to 0 through the UI means remove, not a zero-quantity canonical item.

### FR-010 — Edit item

For an active trip, the user can edit:

- unit price
- quantity
- optional label

A valid edit:

- changes the canonical item once
- persists promptly
- recalculates all derived values
- becomes undoable

### FR-011 — Remove item

Removing an item:

- removes it from canonical active-trip items
- persists the new trip
- makes the removal undoable

No confirmation dialog is required for ordinary single-item removal.

### FR-012 — Undo

MVP supports at least one-step undo for the latest cart mutation:

- add
- edit
- remove

Undo restores the previous canonical active-trip snapshot and persists the restored state.

Undo history itself does not need to survive reload.

### FR-013 — Safe-limit crossing

If a pending item crosses safeLimit but not budget:

- preview explains that the safety buffer will be used
- user may still commit
- committed trip enters a safe-limit-exceeded state derived from totals

This is not labelled as nominal over-budget.

### FR-014 — Nominal over-budget preview

If a pending item would make cartTotal > budget:

- show projected overage before commit
- require an explicit Add anyway action
- Cancel leaves canonical state unchanged

### FR-015 — Intentional over-budget

Over-budget is valid canonical state.

The application:

- shows exact overage
- does not disable further edits/adds
- does not use judgmental language
- permits budget adjustment

### FR-016 — Edit budget

The user may change active-trip budget.

If new budget < cartTotal:

- change remains allowed
- resulting over-budget state is shown

Changing budget never mutates item prices.

### FR-017 — Persistence durability

Every committed canonical mutation attempts synchronous/local persistence before the UI reports the mutation as durably saved.

A successful write sets persistence health to healthy.

### FR-018 — Persistence degradation

If canonical state is valid but storage write fails:

- in-memory state remains usable
- persistence health becomes degraded
- UI warns the user
- no false saved status is shown
- later valid mutations may retry persistence

### FR-019 — Reload recovery

On startup:

- valid active trip restores directly
- derived values are recomputed
- user does not have to confirm resume
- no committed item is duplicated

### FR-020 — Malformed storage

Malformed/invalid active-trip storage:

- must not crash startup
- must not be partially guessed into valid money data
- must not reinterpret Pulse Counter state as shopping state
- must expose a safe recovery path

### FR-021 — Finish trip

The user can finish an active trip.

Completion:

- produces completed status/timestamp
- persists completed trip to history before active state is cleared
- avoids data loss if history persistence fails

### FR-022 — Actual checkout total

For a completed trip, user may optionally add actual checkout total.

Derived:

difference = actualCheckoutTotal - estimatedCartTotal

This does not retroactively alter cart item prices.

### FR-023 — Continue/reopen immediately after accidental finish

The completed summary offers a clear recovery action.

Exact historical-reopen behaviour beyond the immediate completion context remains deferred until a dedicated domain rule is implemented.

### FR-024 — History

MVP history shows completed trips with enough data to understand:

- completion date
- budget
- estimated cart total
- optional actual total
- remaining/overage
- item count

It is not a general expense dashboard.

### FR-025 — Offline core

After the application shell has been cached/installed appropriately, these operations remain available offline:

- restore active trip
- start trip
- add/edit/remove
- quantity
- undo
- budget/buffer changes
- finish trip
- local history

### FR-026 — No mandatory external service

No MVP requirement depends on:

- barcode service
- OCR
- AI
- authentication
- bank API
- backend
- analytics service

### FR-027 — Accessibility equivalence

The complete MVP core flow must be achievable without:

- camera
- colour perception
- animation
- sound
- haptics
- swipe gestures
- network
- precise pointer input

### FR-028 — Locale-aware EUR display/input boundary

The MVP supports EUR only.

The UI:

- accepts the explicitly defined EUR input grammar from docs/specs/MONEY-SPEC.md
- formats EUR according to an explicit locale
- may accept both comma and period as unambiguous decimal separators
- never sends locale-formatted strings into canonical domain arithmetic

The money domain receives validated integer cents.

Unsupported currencies are rejected rather than accepted through a generic currency string.

## MVP state requirements

At application level, the system must distinguish:

- booting
- no-active-trip
- active-trip
- completed-summary
- recovery-required

Separately track:

- persistence health
- ephemeral UI state
- optional capability availability

Do not encode modal/sheet state into the canonical ShoppingTrip.

## MVP data requirements

Canonical active trip contains:

- id
- schema-compatible currency
- budgetMinor
- safetyBufferMinor
- items[]
- status
- startedAt
- optional completedAt
- optional actualCheckoutMinor

Each item contains:

- id
- unitPriceMinor
- quantity
- optional label
- price source
- price confidence
- createdAt
- updatedAt

Derived totals are never authoritative persisted fields.

## Money contract

All MVP money behaviour is governed by:

- docs/specs/MONEY-SPEC.md

Key requirements:

- EUR only
- integer cents
- no parseFloat-based canonical conversion
- no silent rounding of extra decimal digits
- explicit product maximum
- exact arithmetic tests
- locale formatting outside the domain

## Price provenance model

Price provenance is intentionally split into two dimensions.

### Source

Where did the numeric value come from?

MVP:

- manual

Future:

- price-memory
- shelf-scan
- encoded-barcode
- retailer-feed

### Confidence

What does the product claim about this value?

MVP:

- confirmed
- estimated

Future:

- remembered

This separation prevents contradictory states such as a shelf-scanned value losing its scanner provenance after user confirmation.

Example future item:

- source = shelf-scan
- confidence = confirmed

## Non-functional requirements

### NFR-001 — Correctness

No user-visible money calculation may depend on floating-point decimal arithmetic.

### NFR-002 — Responsiveness

Pure local operations must feel immediate and must not wait on animation/network.

### NFR-003 — Reliability

A successfully persisted mutation must restore identically after reload.

### NFR-004 — Progressive enhancement

Optional browser capabilities may improve the experience but cannot own core correctness.

### NFR-005 — Accessibility

Meet the detailed contract in docs/ACCESSIBILITY.md.

### NFR-006 — Mobile-first

The primary flow must work at compact phone widths and one-handed reach assumptions.

### NFR-007 — Bundle discipline

Deferred scanner/OCR dependencies should not enter the initial critical bundle before those features ship.

### NFR-008 — Privacy

Core shopping data remains local by default.

## MVP acceptance journey

A release candidate must demonstrate this exact scenario:

1. open with clean storage
2. start EUR 50 trip
3. set EUR 2 safety buffer
4. add EUR 3.79
5. add EUR 12.50
6. add EUR 1.29 × 3
7. verify exact cart total and safe remaining
8. enter a typo and correct before commit
9. add an item, then edit its price
10. remove an item and Undo
11. preview an item that crosses safe limit
12. commit it
13. preview an item that crosses EUR 50 nominal budget
14. cancel it
15. reload
16. verify canonical state restored exactly
17. simulate persistence write failure
18. verify degraded warning while in-memory arithmetic remains usable
19. recover persistence
20. finish trip
21. enter actual checkout total
22. verify difference
23. reopen app
24. verify completed trip exists in history

## Acceptance scoring

Architecture/spec readiness before coding: **96/100**

Remaining gaps before 100:

- final completed-trip immediate-reopen semantics
- exact PWA update strategy
- implementation evidence for the money parser and persistence transaction

These gaps are intentionally explicit rather than hidden in implementation.
