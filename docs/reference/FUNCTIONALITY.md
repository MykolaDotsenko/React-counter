# Functional Reference

## Status

**SUPPORTING REFERENCE.**

This file is a compact map of current user-facing capabilities and important future boundaries. It is not an executable specification.

Authoritative sources:

- [../PRODUCT.md](../PRODUCT.md)
- [../DOMAIN.md](../DOMAIN.md)
- [../DESIGN.md](../DESIGN.md)
- [../specs/MVP-SPEC.md](../specs/MVP-SPEC.md)

## Current user flows

### Start trip

User provides:

- EUR budget;
- optional safety buffer.

Result:

- fresh active trip;
- remaining-first screen;
- state persisted locally.

### Add manual price

Fast path:

```text
Add price → enter value → optional quantity/label → inspect consequence → Add
```

No product metadata is required.

### Adjust spending plan

Budget/buffer can change during an active trip.

Changes may create a valid reserve/over-budget state.

### Correct cart

Current flow supports:

- edit;
- remove;
- Undo.

Correction should remain cheaper than restarting a trip.

### Finish trip

Completion:

- writes history before active cleanup;
- shows completed summary;
- permits optional actual checkout total.

### History

Lightweight completed-trip history.

Not a general expense dashboard.

### Shop again

Creates a fresh empty trip from appropriate prior spending-plan context.

### Recent Items / Price Memory

Repeat-use accelerators.

Remembered value remains remembered until a current observation is explicitly confirmed according to the domain contract.

### Local data controls

Completed history and Price Memory can be cleared independently.

## Important state semantics

### Comfortable

Safe remaining >= 0.

### Reserve use

Safe remaining < 0 while nominal remaining >= 0.

### Nominal over-budget

Nominal remaining < 0.

All are valid states.

## Current UX invariants

- remaining-first;
- manual entry always available;
- item label optional;
- exact projected consequences;
- user can correct mistakes;
- no mandatory account/network service;
- degraded persistence visible;
- uncertain price provenance honest.

## Current evidence tooling

Internal QA/beta routes may record:

- timing/evidence structure;
- retention behaviour structure.

They must not own business state or collect forbidden shopping content.

## Planned / gated capability boundaries

### Installable PWA

May add offline application-shell launch after caching.

Must not own canonical shopping state.

### Barcode

May identify product context.

Must not be treated as authoritative current price.

### Shelf OCR

May propose current-price candidates.

Candidates require confirmation where appropriate.

### Weighted goods / discounts / tax mechanics

Require explicit exact-money/rounding contracts before production UI.

### Cloud/backend

Requires a concrete sync/collaboration/server capability need.

Do not introduce it for architectural appearance.

## Explicitly outside the core product

- general personal finance;
- banking;
- investment/net worth;
- meal planning/nutrition;
- grocery delivery;
- coupon marketplace;
- social network;
- household operating system.

## Functional decision rule

A user-facing capability should normally:

1. help pre-checkout budget control;
2. reduce friction, increase confidence or improve repeat use;
3. improve or preserve premium product quality;
4. preserve manual/local-first fallback;
5. preserve exact-money/durability/accessibility;
6. avoid category expansion.

## When to use this file

Use this file for a quick capability overview.

For implementation decisions, immediately switch to the owning current contract rather than extending this file with detailed duplicate requirements.
