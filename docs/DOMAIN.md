# Domain

## Status

This document defines the target business rules for the shopping budget companion.

The repository implements the shopping domain through Phase 8 engineering: exact EUR money, ShoppingTrip / CartItem rules, price source/confidence semantics, projections, active-trip commands, correction/Undo, completion/history/reconciliation, local product identity, and Price Memory. Scanner-backed sources remain later evidence-gated slices.

## Domain goals

The domain model must make shopping-budget calculations exact, deterministic, framework-independent, easy to test, explicit about uncertainty, and proportionate to the problem.

React, browser APIs, OCR, barcode libraries, and persistence must not own money rules.

## Core concepts

### ShoppingTrip

One active or completed shopping session with one currency and one spending limit.

A trip contains:

- id
- currency
- budget
- optional safety buffer
- items
- status
- started time
- optional completed time
- optional actual checkout total
- optional store reference

Only one active trip is required for MVP.

### Budget

The maximum nominal amount the user intends to spend during the trip.

MVP rules:

- budget must be greater than EUR 0
- budget must not exceed EUR 999,999.99

### SafetyBuffer

An optional amount intentionally reserved inside the nominal budget.

Rules:

- buffer is never negative
- buffer cannot exceed budget
- safe limit equals budget minus buffer

### CartItem

One line in the active cart.

Required:

- id
- unit price
- quantity
- price source
- price confidence
- created time

Optional:

- label
- store or product identity
- note
- unit or weight metadata

### Price provenance

Price metadata is split into two independent dimensions.

#### Price source

Where the numeric value came from.

Target values:

- manual
- price-memory
- shelf-scan
- encoded-barcode
- retailer-feed

MVP only requires manual.

#### Price confidence

What the product claims about the value.

Target values:

- confirmed
- remembered
- estimated

Examples:

- a shelf-scanned value accepted by the user: source = shelf-scan, confidence = confirmed
- a reused old price: source = price-memory, confidence = remembered
- an approximate fruit price entered manually: source = manual, confidence = estimated

Do not collapse source and confidence into one enum.

### Store

Store context is optional.

It exists primarily to improve price-memory relevance and must never be required to start a trip.

## Money representation

MVP money behaviour is fully specified in docs/specs/MONEY-SPEC.md.

### Rule: never use binary floating point as canonical money

Represent money in integer minor units.

For EUR:

- EUR 1.00 = 100
- EUR 4.79 = 479
- EUR 50.00 = 5000

All canonical arithmetic uses integers.

Formatting into decimal currency strings belongs at a boundary or helper layer.

### Money type

Implementation should introduce a strong TypeScript boundary for:

- amount in minor units
- currency code

The exact shape can be decided during implementation, but raw unvalidated numbers must not spread through components.

### Currency

A trip has exactly one currency.

MVP supports EUR only.

Therefore:

- SupportedCurrency is EUR
- canonical EUR values use integer cents
- no currency switcher is shown in MVP
- no FX conversion exists
- persisted unsupported currency codes are rejected

The domain remains structured so additional currencies can be added deliberately later, but generic ISO-code acceptance is not part of MVP.

All parsing, formatting, limits, and arithmetic details are governed by docs/specs/MONEY-SPEC.md.

## Quantity

MVP quantity is an integer from 1 through 999.

MVP item unit price is greater than EUR 0 and no more than EUR 999,999.99.

Weighted goods should not overload ordinary integer quantity.

Weighted goods should not overload ordinary integer quantity. They need explicit weight or unit semantics, or an estimated direct line price.

### Line total

For integer quantity:

lineTotal = unitPriceMinor × quantity

The result must remain a safe integer.

## Derived values

Derived values are calculated from canonical trip state.

### Cart total

cartTotal = sum of all item line totals

### Nominal remaining

remaining = budget - cartTotal

Remaining may be negative.

### Safe limit

safeLimit = budget - safetyBuffer

### Safe remaining

safeRemaining = safeLimit - cartTotal

Safe remaining may be negative.

### Progress

Progress derives from cart total and the relevant limit.

UI may clamp visual percentages as needed, but the domain calculation must preserve real overage.

## Canonical vs derived state

Canonical:

- budget
- safety buffer
- items
- item prices
- quantities
- price sources
- price confidence states
- optional actual checkout total
- trip status
- timestamps
- optional store context

Derived and never authoritative:

- cart total
- remaining
- safe remaining
- progress percentage
- item count
- over-budget flag
- estimated checkout difference

Do not persist derived totals as source of truth.

## Trip states

Minimal target state model:

- active
- completed

Potential future state:

- abandoned

MVP does not need a workflow engine.

### Active

Items and limits can be edited.

### Completed

Trip is retained as history.

Edits after completion should either reopen explicitly or follow a clearly defined correction rule later. Do not silently mutate historical trips.

## Budget changes

The user owns the budget.

An active-trip budget may be changed intentionally.

If the new budget is below current cart total:

- allow the change
- show over-budget state

Do not block the user.

## Safety-buffer changes

May be changed during an active trip.

Safe remaining recalculates immediately.

Buffer changes do not alter item totals.

## Adding an item

Before commit:

1. validate price
2. validate quantity
3. calculate pending line total
4. calculate projected remaining state
5. present relevant warning if the projected total crosses a limit

On commit:

1. create the item
2. update canonical trip state
3. persist immediately through the application/persistence boundary
4. derive new totals

The domain commit must not depend on animation or network activity.

## Removing an item

Removing an item deletes it from the active trip's canonical item collection.

The UI should make ordinary removal recoverable through undo where practical.

## Undo

MVP does not require full event sourcing.

A bounded command or snapshot approach is sufficient.

At minimum, the most recent destructive or additive cart mutation should be recoverable.

Do not introduce an immutable event ledger solely for architectural appearance.

## Editing an item

Editable fields may include:

- unit price
- quantity
- label
- price source/confidence metadata when appropriate

Editing a remembered or estimated value into a user-confirmed current price should update confidence intentionally while preserving the true source where useful.

## Over-budget rules

Over-budget is a valid state.

Nominal over-budget:

cartTotal > budget

Safe over-budget:

cartTotal > safeLimit

The domain must not reject an item solely because it causes overage.

The application should preview the overage and request clear confirmation.

## Price memory

Price Memory is implemented as a separate advisory domain from the active cart.

A remembered-price record contains:

- deterministic product identity
- display label
- optional store identity
- exact EUR minor-unit price
- observation timestamp
- observation provenance

The first manual/offline product identity is derived from the normalized user label. This is intentionally a local recognition key, not a claim that two globally distinct products with the same label are universally identical.

### Learning rule

Memory is created or refreshed only when a named item:

1. has confirmed price confidence
2. belongs to a trip whose completed history write succeeded

This excludes undone, removed, cancelled, failed-completion, and unchanged remembered observations.

### Freshness

Remembered prices retain their original observation timestamp.

No rule may reinterpret a remembered price as a live current price.

Using an unchanged remembered value in a later trip does not refresh its age.

### Store-aware lookup

When store context exists, selection prefers:

1. product + exact store + currency
2. product + store-neutral + currency

A price observed only at a different known store is not silently suggested as if it were the current store price.

User-facing store capture remains optional until real-user evidence shows that the extra setup friction is justified.

### Cart reuse rule

Adding a remembered value creates a normal cart item with:

- `priceSource.kind = 'price-memory'`
- `priceConfidence.kind = 'remembered'`
- the original `observedAt`

The UI always offers **Enter current price** as an alternative.

If reuse would cross the nominal budget, it requires explicit second-step confirmation rather than bypassing the ordinary over-budget safety rule.

## Barcode identity

Barcode is an identifier, not a trusted price source.

A barcode record may map to product identity, label, and previous price memories.

A successful scan does not by itself create an item with a current price unless the price comes from a trusted current source and the user confirms it.

## Shelf-price scanning

OCR or scanning output is candidate data.

Rule:

- candidate price cannot affect cart totals until confirmed

If multiple candidate prices exist, the application resolves them before commit.

## Estimated prices

Estimated prices are allowed.

Examples:

- weighted goods before exact weighing
- approximate bundle price

Estimated status remains attached to the cart item.

The UI may derive an uncertainty summary from price origins.

## Discounts

Discounts must ultimately resolve to an exact effective item price in minor units before cart commit.

For percentage discounts, define deterministic rounding rules before implementation.

Do not scatter percentage arithmetic through React components.

## Tax

Tax mode is optional and region-dependent.

Potential modes:

- shelf price is final
- tax added at checkout

Tax implementation must define rounding and per-item versus total behaviour before coding.

Do not infer tax rules from location without explicit product requirements.

## Checkout reconciliation

Actual checkout total is optional.

When present:

difference = actualCheckoutTotal - estimatedCartTotalAtCompletion

This metric is informational.

A future buffer-suggestion system may use historical differences, but it must remain transparent and deterministic.

## Suggested safety buffer

Future rule, not an MVP requirement.

A deterministic strategy may consider previous reconciliation error.

Requirements:

- explain the basis
- allow user override
- never silently change the nominal budget
- do not claim statistical certainty from tiny history

## Validation invariants

At all times:

- budgetMinor is a safe integer greater than zero and within the MVP product maximum
- safetyBufferMinor is a safe integer from zero through budgetMinor
- item unit prices are safe integers greater than zero and within the MVP product maximum
- actual checkout total is a safe integer from zero through the MVP product maximum
- every canonical money amount is a safe integer
- standard item quantity is an integer from 1 through 999
- trip currency is consistent
- item IDs are unique inside a trip
- cart total equals the sum of canonical item line totals
- derived remaining values are reproducible from canonical state

## Domain boundaries

The domain must not know about:

- React
- DOM
- localStorage
- IndexedDB
- Service Workers
- camera APIs
- OCR providers
- barcode libraries
- CSS
- animation
- network requests

Adapters translate external input into validated domain commands and data.

## Error classes

### Validation error

Input violates a business rule.

Examples:

- negative price
- zero budget
- invalid quantity

### Capability failure

Optional feature is unavailable.

Examples:

- camera permission denied
- barcode API unsupported

Core manual workflow remains usable.

### Persistence failure

Valid domain change cannot be stored reliably.

This must be surfaced by the application.

### External lookup failure

Barcode or product service is unavailable.

This must not block manual entry.

## Legacy non-shopping data

Do not reinterpret historical non-shopping counter values as money.

Historical counter state has a different meaning and must not be silently migrated into a shopping trip.

Safe migration policy:

- preserve no old count as financial data
- retire historical counter-specific storage keys only after shopping bootstrap is safe
- document the migration version
- test fresh, legacy, malformed, and future-version storage

## TypeScript migration

The shopping domain is intentionally strict-TypeScript because money, persistence, and lifecycle invariants justify the stronger contract.

The shopping domain introduces distinct money concepts, multiple price origins, optional metadata, persistence evolution, scanner boundary data, and a trip lifecycle.

Strict TypeScript is now justified.

Migration should be incremental and should not mix broad type conversion with unrelated UI redesign when avoidable.

## Domain anti-patterns

Do not:

- store formatted currency strings as canonical money
- use floating-point totals as source of truth
- persist cartTotal as authoritative alongside items
- let React components calculate business totals independently
- treat remembered confidence as confirmed current price
- treat barcode as price
- let OCR results mutate cart before confirmation
- add event sourcing without a user or reliability need
- create a generic financial ledger
- introduce backend entities before cloud collaboration is required

## Detailed technical contract

Exact target TypeScript shapes and adapter contracts are specified in:

- `docs/specs/CONTRACTS.md`
- `docs/specs/MVP-SPEC.md`
- `docs/specs/STATE-MACHINES.md`
- `docs/specs/STORAGE-SCHEMA.md`

If this domain document and those executable specs diverge, reconcile the documents before implementation.

## Domain review checklist

For every domain change ask:

1. What is canonical?
2. What is derived?
3. Are all money operations exact?
4. Is uncertainty preserved?
5. Can this rule be unit-tested without React?
6. Does the rule still work offline?
7. Does this accidentally expand the product into general finance?
8. Is the abstraction proportionate to the business rule?
