# Domain

## Status

**IMPLEMENTED current business contract.**

This document owns shopping-domain concepts and invariants. Parsing detail lives in `specs/MONEY-SPEC.md`; lifecycle detail lives in `specs/STATE-MACHINES.md`.

## Goals

The domain must be:

- exact;
- deterministic;
- framework independent;
- easy to test;
- explicit about uncertainty;
- proportionate to the product.

React, storage, OCR, barcode providers, network and animation must not own financial rules.

## Core concepts

### ShoppingTrip

One active or completed shopping session.

Canonical fields include:

- id;
- currency;
- budget;
- safety buffer;
- items;
- status;
- timestamps;
- optional actual checkout total;
- optional store context.

Current product supports one active trip.

### Budget

Nominal spending limit.

Rules:

- > EUR 0;
- within product maximum defined by MONEY-SPEC.

### SafetyBuffer

Optional reserved amount inside the budget.

Rules:

- >= 0;
- <= budget.

```text
safe limit = budget - buffer
```

### CartItem

Canonical item fields:

- id;
- unit price;
- quantity;
- price source;
- price confidence;
- created/updated timestamps.

Optional:

- label;
- product/store identity where supported by the model.

A label is not required for a valid item.

## Money

Canonical financial state uses integer EUR minor units.

Never use binary floating point as authority.

Derived totals are recalculated from canonical state.

## Quantity

Quantity is a positive bounded integer.

```text
line total = unit price × quantity
```

Multiplication must remain within safe/product limits.

## Derived values

Never persist as authority:

- line total;
- cart total;
- remaining;
- safe remaining;
- progress percentage;
- item count;
- over-budget flags;
- checkout difference.

```text
cart total = sum(line totals)
remaining = budget - cart total
safe remaining = budget - buffer - cart total
```

Negative remaining values are valid and represent overage.

## Trip states

**IMPLEMENTED**

- active;
- completed.

### Active

Budget/buffer/items may change through valid commands.

### Completed

Retained as history.

Do not silently mutate a completed trip back into an active trip.

Historical reopen remains **PLANNED / GATED** until a loss-safe two-record contract exists.

## Adding an item

Before commit:

1. validate price;
2. validate quantity;
3. project line/cart/remaining state;
4. surface relevant reserve/over-budget consequence.

On commit:

1. create item;
2. apply domain transition;
3. application layer attempts persistence;
4. selectors derive totals.

Domain mutation never depends on animation/network.

## Editing / removing / Undo

Editing may change:

- price;
- quantity;
- label;
- provenance/confidence when semantically required.

Removal deletes the canonical item from the active trip.

Undo is bounded; full event sourcing is not required.

## Budget / buffer changes

Users may intentionally change the active budget or buffer.

If the new budget is below cart total:

- allow it;
- expose over-budget state.

Do not reject user intent merely because it creates overage.

## Over-budget semantics

```text
nominal over-budget: cartTotal > budget
safe over-budget: cartTotal > safeLimit
```

Over-budget is a valid state, not a domain error.

## Price provenance

Source and confidence are independent dimensions.

### Implemented sources

- manual;
- price-memory.

### Reserved/gated sources supported by the model

- shelf-scan;
- encoded-barcode / external identity;
- retailer/external feed where a future provider contract justifies it.

Presence in the type model does not mean the feature is shipped.

## Price confidence

Examples include:

- confirmed current observation;
- remembered/stale observation;
- candidate/estimated states where future capabilities need them.

The model must not collapse “where the number came from” and “how trustworthy/current it is” into one enum.

## Price Memory

**IMPLEMENTED advisory subsystem.**

Rules:

- learned only from eligible durably completed confirmed items;
- remembers historical observation, not authoritative current price;
- reuse preserves remembered provenance;
- old memory does not become “fresh” merely because it was reused;
- store/freshness context may affect ranking;
- deletion is independent from completed history.

Price Memory failure must never invalidate a durably completed trip.

## Barcode identity

**PLANNED / GATED.**

Barcode identifies a product, not a guaranteed current shelf price.

Any future barcode adapter must keep manual current-price entry available.

## Shelf-price scanning

**PLANNED / GATED.**

OCR output is candidate data.

No candidate becomes committed money without explicit confirmation where ambiguity/currentness requires it.

## Discounts / weighted goods / tax mechanics

**PLANNED / GATED.**

Do not implement percentage/weight mechanics without an explicit exact-money/rounding contract.

## Checkout reconciliation

**IMPLEMENTED.**

A completed trip may store an optional actual checkout total.

```text
difference = actual checkout - estimated cart total
```

Reconciliation does not retroactively rewrite item prices.

## Validation invariants

At minimum:

- one supported currency per trip;
- safe integer money;
- product bounds;
- buffer <= budget;
- positive bounded quantity;
- unique ids;
- valid timestamps/order;
- no invalid lifecycle mutation;
- completed state has completion timestamp;
- canonical data reconstructs through domain validation.

### Monotonic trip time

Trip commands are ordered: an item can be corrected only at or after its last update, and completion cannot precede the start or any item update.

The application stamps each trip command with the later of the device clock and `latestTripTimestamp(trip)`. A device clock that moves backwards (manual change, network-time correction) therefore never blocks correcting or finishing a trip; trip timestamps behave as a per-trip logical clock that never goes earlier than what the trip already records.

## Domain boundaries

### Domain owns

- money/trip invariants;
- projections/selectors;
- lifecycle-safe commands;
- provenance/confidence semantics;
- Price Memory selection/learning rules.

### Application owns

- orchestration;
- Undo snapshot coordination;
- persistence ordering;
- recovery;
- cross-subsystem coordination.

### Infrastructure owns

- storage/browser APIs;
- DTO validation;
- serialization;
- provider/network adapters.

### UI owns

- drafts;
- overlays;
- focus;
- copy;
- presentation;
- interaction feedback.

## Error classes

Keep errors explicit by layer:

- validation/domain;
- application/lifecycle;
- persistence/capability;
- external provider.

Do not surface provider implementation detail as financial truth.

## Anti-patterns

Do not:

- persist derived totals;
- put money arithmetic in components;
- let storage DTOs become branded domain values without reconstruction;
- use an event ledger for architectural appearance;
- treat a remembered/scanned/external value as authoritative solely because it came from technology;
- expand the domain for speculative features.

## Review checklist

- Is canonical money still exact?
- Is new state truly canonical rather than derived?
- Is the rule domain logic or application orchestration?
- Does the model distinguish source from confidence?
- Can the state survive serialize/restore without ambiguity?
- Did a future capability accidentally become claimed as current?
- Is the abstraction justified by a real product need?
