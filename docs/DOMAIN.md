# Domain

## Status

**IMPLEMENTED current business contract.**

This document owns shopping-domain concepts and invariants, including the barcode and price-tag rules. Parsing detail, money formulas and over-budget derivation live in `specs/MONEY-SPEC.md`; lifecycle detail lives in `specs/STATE-MACHINES.md`.

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
- optional actual checkout total.

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

The buffer sets the safe limit; formulas live in [MONEY-SPEC.md](./specs/MONEY-SPEC.md#derived-values).

### CartItem

Canonical item fields:

- id;
- unit price;
- quantity;
- price source;
- price confidence;
- created/updated timestamps.

Optional:

- label.

A label is not required for a valid item.

Items carry no product or store identity. A scanned barcode links to an item label through a separate advisory record (`domain/barcode-link.ts`, D-054).

## Money

Canonical financial state uses integer EUR minor units.

Never use binary floating point as authority.

Derived totals are recalculated from canonical state.

## Quantity

Quantity is a positive bounded integer. Line totals follow [MONEY-SPEC.md](./specs/MONEY-SPEC.md#quantity-multiplication).

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

Formulas: [MONEY-SPEC.md](./specs/MONEY-SPEC.md#derived-values).

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

Over-budget is a valid state, not a domain error. Nominal and safe-limit overage are derived as [MONEY-SPEC.md](./specs/MONEY-SPEC.md#over-budget-semantics) defines.

## Price provenance

Source and confidence are independent dimensions.

### Implemented sources

- manual — a typed or corrected price, including a price read from a tag once the shopper confirms it in price entry;
- price-memory — a remembered price reused as-is.

### Reserved/gated sources supported by the model

- shelf-scan — no current flow writes it, because a confirmed tag price is recorded as manual;
- encoded-barcode — a price embedded in a store-printed code, which is never read;
- retailer-feed — only where a future provider contract justifies it.

Presence in the type model does not mean the feature is shipped.

## Price confidence

The model has three confidence kinds:

- confirmed — a current observation, stamped when the shopper commits it;
- remembered — a historical observation reused from Price Memory, keeping its original observation time;
- estimated — reserved; no current flow writes it.

There is no candidate confidence: a price read from a tag is a candidate only until the shopper confirms it in price entry, and it never reaches the model before then.

The model must not collapse “where the number came from” and “how trustworthy/current it is” into one enum.

## Price Memory

**IMPLEMENTED advisory subsystem.**

Rules:

- learned only from eligible durably completed confirmed items;
- remembers historical observation, not authoritative current price;
- reuse preserves remembered provenance;
- old memory does not become “fresh” merely because it was reused;
- the latest observation per product is the one offered;
- a Price Memory record, and a remembered item's confidence, can carry an optional store, but no current flow records one;
- deletion is independent from completed history.

Price Memory failure must never invalidate a durably completed trip.

## Barcode identity

**IMPLEMENTED.**

Barcode identifies a product, not a guaranteed current shelf price.

- EAN-13, EAN-8, UPC-A and UPC-E values are validated with the GS1 mod-10 check digit and normalised to a 14-digit GTIN; UPC-E is expanded to UPC-A first;
- GS1 restricted-circulation numbers (GTIN-13 prefixes 02, 04 and 20–29, and GTIN-8 prefixes 0 and 2) are store-printed codes: they change from pack to pack, so they are never remembered as a product and their embedded values are never read as a price;
- coupon and refund ranges (05, 99, 980–984) are not products;
- a barcode links to the shopper's own item label; a remembered price reached through that label is context until the shopper confirms or reuses it explicitly.

Manual current-price entry stays available in every barcode state.

## Shelf-price reading

**IMPLEMENTED (D-055).**

OCR output is candidate data. `rankPriceTagCandidates` in `domain/shelf-price.ts` turns it into ranked exact-money candidates:

- every accepted amount goes through `parseEurDraft`; bare digits never gain an invented decimal separator, and percentages, dates, weights, volumes and barcodes are not money;
- a date is a dotted day.month without a euro sign (day 1–31, month 1–12) followed by another dot and then a digit, whitespace, a dash or the end of the text: "24.09.2026", "24.09.–30.09." and "30.9. asti" offer no price, while "4.29." stays a price because 29 is not a month;
- an amount needs a euro sign, a price word nearby or headline prominence: printed at least 60 % as tall as the tallest line on the tag;
- taller printing ranks higher; unit prices, regular prices and multi-buy offers rank lower and carry their context, member prices (including compounds such as "Jäsenhinta" and "Plussahinta") carry theirs without ranking lower, and a per-item ("yks.") price is not treated as a multi-buy offer;
- a price takes its labels only from the words printed since the previous amount, so a "Norm. 2,99 €" line above a member price labels only its own price;
- superscript cents read separately join their euros, and cents split into single digits by OCR are rejoined;
- candidates are de-duplicated by amount and capped at eight.

No candidate becomes committed money until the shopper confirms it in price entry.

## Discounts / weighted goods / tax mechanics

**PLANNED / GATED** for weighted goods and discounts. Tax-exclusive pricing is not planned ([ROADMAP.md](./ROADMAP.md)).

Do not implement percentage/weight mechanics without an explicit exact-money/rounding contract.

## Checkout reconciliation

**IMPLEMENTED.**

A completed trip may store an optional actual checkout total. The derived difference follows [MONEY-SPEC.md](./specs/MONEY-SPEC.md#derived-values).

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
