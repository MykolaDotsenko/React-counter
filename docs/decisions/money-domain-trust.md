# Money, Domain and Trust Decisions

## Status

Accepted decision records. These explain durable choices but do not override current code/tests or authoritative current contracts.

Use [../DECISIONS.md](../DECISIONS.md) as the retrieval index.

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

## D-041 — Price Memory learns only from durably completed confirmed items

Date: 2026-09-22

Status: accepted

### Decision

Create or refresh a Price Memory record only after the source trip has been durably persisted as completed history.

Eligible source items must:

- have a non-empty product label
- carry confirmed price confidence
- have a provenance that represents a current observation rather than an old remembered value

Do not learn Price Memory at Add/Edit time.

Do not refresh observation age merely because an unchanged remembered price appears in another completed trip.

### Rationale

Learning at mutation time creates false memories from:

- typing mistakes later undone
- removed items
- abandoned corrections
- failed completion
- remembered prices that were never verified as current

Completed-history durability is already the product's strongest local evidence that the shopping observation survived the user's correction flow.

### Consequence

- Price Memory remains advisory and independent from active-cart durability
- a Price Memory write failure cannot invalidate a successfully completed trip
- remembered reuse stays explicitly `remembered`
- manual current-price correction can create a new confirmed observation after completion
- baseline price-only entry remains label-optional
- unknown/future/corrupt price-memory storage is preserved rather than overwritten

### Revisit when

Real usage requires remembering an item before trip completion, with an explicit user action and a data-integrity model that is at least as clear as the completed-trip rule.
