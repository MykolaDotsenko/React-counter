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

Represent price confidence explicitly and independently from price source.

Current confidence states:

- confirmed
- remembered
- estimated

### Rationale

Not all pre-checkout totals have equal certainty. The UI and safety-buffer logic need to distinguish a price confirmed for the current trip from a stale remembered value or an intentional estimate.

Whether the numeric value came from manual entry, shelf scan, barcode payload, price memory, or another source is a separate provenance dimension recorded by D-017.

### Consequence

Price confidence must survive persistence and be available to selectors/UI. Source must not be inferred from confidence.

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



## D-018 — MVP supports EUR only

Date: 2026-09-21

Status: accepted

### Decision

The first shopping-budget MVP supports EUR as the only user-selectable currency.

The architecture remains currency-aware, but the UI, parser, formatter, fixtures, and persistence validation accept only EUR until additional currencies are deliberately implemented and tested.

### Rationale

The primary launch context is euro-denominated shopping. Supporting multiple currencies immediately would multiply parsing, formatting, minor-unit precision, auto-cents, locale, accessibility, and test cases before the core shopping interaction has been validated.

EUR-only allows the first implementation to be exact and deeply tested while preserving a clear extension seam through CurrencySpec / SupportedCurrency.

### Rejected alternative

Ship EUR, USD, GBP, JPY, and other currencies in the first release behind a generic ISO currency type.

This looks flexible but risks false correctness: different currencies can have different minor-unit precision and formatting/input conventions.

### Consequence

For MVP:

- SupportedCurrency = 'EUR'
- fractionDigits = 2
- all canonical EUR money uses integer cents
- no FX conversion exists
- changing currency is not exposed because there is no alternative supported currency
- persistence rejects unsupported currency codes rather than guessing

### Revisit when

A validated user need requires another currency. Each new currency must add an explicit CurrencySpec, parsing/formatting tests, accessibility checks, and relevant fixtures before it becomes user-selectable.



## D-019 — MVP money input guardrails are explicit

Date: 2026-09-21

Status: accepted

### Decision

For MVP:

- budget must be greater than EUR 0
- item unit price must be greater than EUR 0
- safety buffer may be EUR 0 but cannot exceed budget
- actual checkout total may be EUR 0
- any single user-entered money amount may not exceed EUR 999,999.99
- standard item quantity is an integer from 1 through 999

### Rationale

Technical safe-integer limits are far above realistic shopping values. Product-level bounds prevent obvious accidental input and make validation/test behaviour deterministic.

Zero-price cart items are more likely to represent incomplete entry than a useful grocery-budget case. Free/promotional items can be supported later if real usage justifies them.

### Consequence

MONEY-SPEC.md, domain validation, UI validation, fixtures, and persistence validation must enforce the same bounds.

### Revisit when

Real usage requires free items, unusually large quantities, or higher-value purchases outside the intended shopping context.



## D-020 — Brand promise is pre-checkout remaining control

Date: 2026-09-21

Status: accepted

### Decision

The primary brand promise is:

> Know what you can still afford before checkout.

The product must not position itself primarily as a generic budgeting app, expense tracker, shopping list, or AI scanner.

### Rationale

The category is crowded, but the timing difference is distinctive and directly tied to the user's actionable moment: before payment, while the cart can still change.

Competitor evidence repeatedly validates “know before checkout” language, while general finance positioning would create expectations the product intentionally does not meet.

### Consequence

Landing pages, App Store screenshots, social hooks, README product story, and future paid creative should lead with the pre-checkout remaining problem.

Advanced features such as scanning or price memory are proof/mechanism, not the brand promise.

### Revisit when

Only if user research consistently shows a different job drives adoption and repeated use.

## D-021 — CartRoom remains a working codename, not the locked product name

Date: 2026-09-21

Status: accepted

### Decision

Use CartRoom only as a working internal brand until final naming work includes:

- trademark/conflict review
- domain/handle checks
- App Store/Google Play checks
- recall/pronunciation testing
- international interpretation review

### Rationale

CartRoom fits the “remaining room” metaphor, but “cart” is saturated and “room” is generic. Current search did not surface a major shopping-budget app with the exact name, but search is not legal clearance.

### Consequence

Do not rename repository/package/store identity to CartRoom yet.

Marketing drafts may use [Brand] placeholders or identify CartRoom explicitly as a working name.

### Revisit when

Naming research is complete enough to make a durable public decision.

## D-022 — Organic proof before meaningful paid acquisition

Date: 2026-09-21

Status: accepted

### Decision

Prioritize:

1. real-user beta
2. App Store/Play Store conversion quality
3. organic short-form/demo content
4. SEO/build-in-public
5. only then meaningful paid acquisition

### Rationale

The product does not yet have measured activation, second-trip retention, or lifetime value.

Paid acquisition before retention proof risks buying installs for a product whose repeat value is still unknown.

### Consequence

Do not recommend material paid-ad spend as a launch requirement.

Store-listing experiments and organic creative tests should establish message/conversion signals first.

### Revisit when

The product has credible activation, second-trip retention, conversion, and monetization data.

## D-023 — Monetization must preserve core shopping trust

Date: 2026-09-21

Status: accepted

### Decision

The core manual shopping loop should remain free if the product is commercialized.

Avoid a weekly subscription or surprise paywall before first value.

Potential paid value should come from advanced or ongoing-cost features such as:

- heavy OCR/scanning
- cross-device sync
- family sharing
- advanced price history
- retailer integrations

### Rationale

The target audience is explicitly budget-conscious. Category evidence shows that transparent/no-subscription positioning can itself become a trust signal.

### Consequence

Marketing copy must never bait users with a free promise that hides the basic trip workflow behind payment.

### Revisit when

Real service economics make a different model necessary, with explicit user-value evidence.


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
