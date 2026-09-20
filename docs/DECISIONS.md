# Product and Architecture Decisions

## Purpose

This file records decisions that future contributors and AI agents must not casually reopen without new evidence.

Each decision captures:

- decision
- rationale
- alternatives considered
- consequences
- revisit trigger

Date format: YYYY-MM-DD.

## D-001 — Pivot from generic counter to shopping budget companion

Date: 2026-09-21

Status: accepted

### Decision

Evolve the current Pulse Counter into a focused shopping budget companion for people shopping under a hard per-trip spending limit.

### Rationale

The counter implementation has strong interaction engineering but weak product value. Shopping-under-a-limit is a validated recurring problem, while still matching the existing project's core interaction pattern: quick numeric input, immediate feedback, local persistence, and mobile use.

### Rejected alternatives

- generic multi-counter
- field observation recorder
- AI/data audit tool
- queue analysis tool
- event/traffic funnel tracker
- recording moment marker
- photography shot marker
- stockout predictor as the primary product

Many alternatives were interesting, but either required more explanation, duplicated domains already represented in the portfolio, were more niche, or weakened the direct evolution from the current interaction model.

### Consequence

The product must optimise first for grocery/retail shopping budget control, not for general finite-resource tracking.

### Revisit when

Real-user validation shows that the shopping problem is materially weaker than another validated use case.

## D-002 — Remaining amount is the primary metric

Date: 2026-09-21

Status: accepted

### Decision

The active-trip hero shows what the shopper can still safely spend, not just the amount already spent.

### Rationale

The user's actionable question in the aisle is “What can I still add?”

Spent amount remains visible as supporting context.

### Consequence

UI hierarchy and copy must remain remaining-first.

### Revisit when

Usability testing consistently shows that users misunderstand the remaining-first model.

## D-003 — Manual price entry is the baseline

Date: 2026-09-21

Status: accepted

### Decision

Manual price entry is always available and must remain a first-class, offline-capable path.

### Rationale

Barcode and OCR capabilities are inconsistent, may need network access, and can add friction when they fail. A fast keypad is deterministic and universal.

### Consequence

Scanner work cannot block MVP or degrade manual entry.

### Revisit when

A platform-native scanning path becomes more reliable and measurably faster without harming fallback usability.

## D-004 — Barcode identifies product, not current price

Date: 2026-09-21

Status: accepted

### Decision

Treat barcode data primarily as product identity.

A scanned barcode may lead to remembered price context, but must not imply an authoritative current shelf price unless a trusted current-price source exists and the user confirms the value.

### Rationale

Retail barcodes generally identify products; current price is store/context dependent.

Competitor review research also shows user frustration when barcode scanning creates the appearance of automation but still requires confusing manual follow-up.

### Consequence

Barcode integration belongs behind an adapter and price-confirmation flow.

### Revisit when

A reliable retailer-specific live-price integration is intentionally introduced.

## D-005 — Exact money uses integer minor units

Date: 2026-09-21

Status: accepted

### Decision

Canonical money values use integer minor units rather than binary floating-point decimal arithmetic.

Examples:

- EUR 4.79 = 479
- EUR 50.00 = 5000

### Rationale

Money correctness is a domain invariant and must not be vulnerable to floating-point drift.

### Consequence

Formatting and parsing live at boundaries; domain arithmetic stays integer-based.

### Revisit when

Supporting a currency or pricing model whose required precision cannot be represented by the chosen minor-unit model. Such a change requires explicit design, not ad hoc decimals.

## D-006 — Strict TypeScript becomes justified by the pivot

Date: 2026-09-21

Status: accepted

### Decision

Migrate incrementally from JavaScript to strict TypeScript as the shopping domain is introduced.

### Rationale

The original counter was too small for a TypeScript migration to provide much risk reduction. The target domain adds money, currencies, multiple price origins, persistence schemas, scanner result types, and trip lifecycle.

### Consequence

TypeScript migration should begin with the domain and proceed incrementally rather than as a cosmetic whole-repo rewrite.

### Revisit when

Not expected unless implementation evidence shows an unacceptable migration cost.

## D-007 — localStorage before IndexedDB

Date: 2026-09-21

Status: accepted

### Decision

Use versioned localStorage for MVP shopping state while the data remains small and text-only.

### Rationale

The simpler storage model is proportionate, inspectable, testable, and already aligned with the current repository.

### Consequence

Do not add IndexedDB for prestige.

### Revisit when

The product needs images, large receipt data, large price history, offline catalogues, or another data shape that materially exceeds localStorage's practical fit.

## D-008 — Persistence failure must be visible

Date: 2026-09-21

Status: accepted

### Decision

Unlike the old counter's silent memory fallback, shopping persistence failure must be surfaced to the user.

### Rationale

Losing an active budget/cart during shopping is user-impacting financial data loss.

### Consequence

The application needs persistence-health state and truthful save messaging.

### Revisit when

Never for the core flow; exact UI may evolve.

## D-009 — No backend for MVP

Date: 2026-09-21

Status: accepted

### Decision

The core product has no mandatory backend, authentication, or cloud database.

### Rationale

The primary job is single-user, local, privacy-friendly, and benefits from offline operation.

### Consequence

Do not create server infrastructure before a feature such as cross-device sync, family sharing, or retailer integration requires it.

### Revisit when

A validated multi-device or collaboration requirement appears.

## D-010 — Scanned values require confirmation

Date: 2026-09-21

Status: accepted

### Decision

OCR/price-tag scanner output is candidate data and cannot affect the cart before explicit confirmation.

### Rationale

Shelf labels may contain multiple numbers: current price, old price, unit price, loyalty price, deposit, quantity, or discount.

### Consequence

Scanner UX must show the candidate and allow correction/rejection.

### Revisit when

Even with future high-confidence models, explicit confirmation remains the safer default for financial state. Any relaxation requires measured evidence and a clear error-recovery model.

## D-011 — Price confidence is part of the product model

Date: 2026-09-21

Status: accepted

### Decision

Represent whether a price is:

- confirmed
- remembered
- scanned
- estimated

### Rationale

Not all pre-checkout totals have equal certainty. Making price origin explicit supports honest UI, safe buffers, and better future automation.

### Consequence

Price origin must survive persistence and be available to UI/selectors.

### Revisit when

Names may evolve, but the distinction between current confirmed and uncertain/stale values should remain.

## D-012 — Event sourcing is not justified

Date: 2026-09-21

Status: accepted

### Decision

Use ordinary canonical trip state plus a bounded undo mechanism instead of an append-only event ledger.

### Rationale

The shopping cart does not currently need audit-grade history. Event sourcing would add complexity without proportional user value.

### Consequence

Undo may use a previous-state snapshot, command stack, or reducer history.

### Revisit when

A genuine audit/history requirement appears that cannot be served by completed-trip history and normal state transitions.

## D-013 — State commits precede decorative motion

Date: 2026-09-21

Status: accepted

### Decision

Business-state mutation must not depend on View Transition callbacks or decorative animation completion.

### Rationale

The existing counter used advanced transition orchestration safely, but shopping data has higher correctness stakes. Motion remains a progressive enhancement.

### Consequence

Order is:

1. user intent
2. domain commit
3. persistence attempt
4. render
5. optional visual feedback

### Revisit when

Never for financial correctness; implementation details can evolve.

## D-014 — Core product remains free of mandatory smart features

Date: 2026-09-21

Status: accepted

### Decision

Manual budgeting, cart arithmetic, quantity, undo, persistence, and completion cannot depend on AI, OCR, barcode services, or subscription-only capability.

### Rationale

Competitor reviews show that paywalls and unreliable “smart” capture can damage trust. The basic problem should remain solvable immediately.

### Consequence

Optional smart features must degrade gracefully.

### Revisit when

No planned revisit for the portfolio product.

## D-015 — Product does not expand into general personal finance

Date: 2026-09-21

Status: accepted

### Decision

Do not add bank sync, income/bill management, investments, net worth, or generic monthly financial dashboards.

### Rationale

The product differentiates through focus on the in-store pre-checkout moment.

### Consequence

History and analytics must remain directly relevant to faster/more confident shopping.

### Revisit when

Only if the product thesis itself is intentionally replaced.

## D-016 — Competitive advantage is execution, not feature count

Date: 2026-09-21

Status: accepted

### Decision

Do not chase parity with every feature in Total Plus, GroceryBudget, CartBudget, Cart AI, Shopping Calculator, or other grocery apps.

### Rationale

The category is validated but crowded. Feature breadth is not a defensible portfolio story. A faster, clearer, more reliable experience is.

### Consequence

Feature proposals require a friction, confidence, or reliability rationale.

### Revisit when

Real user evidence shows a missing feature is repeatedly blocking the core job.


## D-017 — Price source and confidence are separate dimensions

Date: 2026-09-21

Status: accepted

### Decision

Represent price provenance with two independent concepts:

- source — where the numeric value came from
- confidence — what the product currently claims about its reliability/currentness

### Rationale

A single “price origin” enum creates contradictory states.

For example, a shelf-scanned value should remain traceable to the scanner after the user confirms it. If “scanned” and “confirmed” are mutually exclusive enum values, one piece of information is lost.

Separating the dimensions allows:

- source = shelf-scan, confidence = confirmed
- source = price-memory, confidence = remembered
- source = manual, confidence = estimated

### Consequence

CartItem, persistence schema, selectors, and future scanner/price-memory code must preserve both fields.

### Revisit when

Only if a simpler representation can preserve the same provenance and trust information without ambiguity.


## How to add a decision

Add a new numbered entry when a decision:

- changes a cross-cutting product rule
- changes a major architecture boundary
- chooses one expensive/reversibility-sensitive approach over another
- intentionally rejects a likely future suggestion

Do not record trivial implementation details here.

## How to supersede a decision

Do not silently rewrite historical rationale.

Instead:

1. mark old decision as superseded
2. add the new decision
3. explain evidence that changed
4. update authoritative product/domain/architecture docs
