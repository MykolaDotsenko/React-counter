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



## D-024 — Core runtime remains React 19.3 + Vite 8

Date: 2026-09-21

Status: accepted

### Decision

Keep the existing React/Vite SPA foundation.

Target core:

- React 19.3
- React DOM
- Vite 8.x
- Node 24 tooling/runtime for CI

Do not migrate to Next.js, Preact, Vue, or Svelte for the shopping-product pivot.

### Rationale

The product is a local-first static PWA with no SSR or mandatory server requirement.

React 19.3 and Vite already satisfy the UI, code-splitting, testing, browser-API, and PWA integration needs. Rewriting the UI framework would add migration risk without changing the user outcome.

### Consequence

Architecture work focuses on domain/application/persistence quality rather than framework migration.

### Revisit when

A future requirement materially depends on a capability that the current static React/Vite architecture cannot reasonably provide.

## D-025 — Begin migration on strict TypeScript 6.0.x

Date: 2026-09-21

Status: accepted

### Decision

Use strict TypeScript 6.0.x for the first shopping-product migration.

Do not adopt TypeScript 7 in the same change that introduces the new domain/application architecture.

### Rationale

TypeScript 7 is current and materially faster, but the repository is small enough that compiler speed is not a bottleneck.

The first migration already changes:

- money representation
- persistence schemas
- application boundaries
- domain types

Keeping the compiler/tooling transition separate reduces simultaneous risk.

### Consequence

After Phase 1–3 are green, create a focused TypeScript 7 compatibility upgrade.

### Revisit when

The initial TypeScript migration is complete and the current lint/testing ecosystem has verified TS7 compatibility.

## D-026 — No third-party global state library in MVP

Date: 2026-09-21

Status: accepted

### Decision

Use a small plain-TypeScript application controller/store and React useSyncExternalStore.

Do not add:

- Redux Toolkit
- Zustand
- XState runtime

for MVP.

### Rationale

The app has one small canonical application state, but persistence orchestration should remain outside React.

A custom controller provides:

- deterministic commands
- one canonical snapshot
- subscription to React
- clean dependency injection
- no library-specific domain model

### Consequence

Application state APIs must remain deliberately small and immutable at the snapshot boundary.

### Revisit when

State complexity or collaboration requirements grow enough that the custom solution becomes harder to reason about than a library.

## D-027 — Zod validates untrusted boundaries, not the domain

Date: 2026-09-21

Status: accepted

### Decision

Use Zod 4 for:

- persisted DTOs
- migrations
- external API responses
- future provider/scanner DTOs

Pure domain code must not depend on Zod.

### Rationale

TypeScript types cannot validate runtime JSON.

Zod materially reduces persistence/API corruption risk, while keeping it outside the domain preserves framework/library independence.

### Consequence

Infrastructure maps validated DTOs into domain constructors/branded types.

### Revisit when

A smaller/safer runtime validator materially improves the system without reducing schema clarity or migration reliability.

## D-028 — PWA uses vite-plugin-pwa + Workbox generateSW first

Date: 2026-09-21

Status: accepted

### Decision

Implement initial offline/PWA support with:

- vite-plugin-pwa
- Workbox generateSW
- prompt-based updates
- application-shell precaching

Do not hand-write the first service worker.

### Rationale

The core offline requirement is simple static-shell availability.

A generated Workbox service worker is more reliable and maintainable than custom lifecycle/cache code for the MVP.

### Consequence

Business data remains in localStorage, not Cache Storage.

The service worker must never force a reload during an active trip.

### Revisit when

A documented feature requires custom background sync, complex runtime caching, or bespoke service-worker messaging. At that point, evaluate injectManifest.

## D-029 — MVP uses native semantic UI and CSS Modules, not a UI framework

Date: 2026-09-21

Status: accepted

### Decision

Use:

- semantic HTML
- native dialog
- CSS Modules
- CSS custom properties
- React ViewTransition + CSS

Do not add Tailwind, a full component library, CSS-in-JS, or a general animation runtime for MVP.

### Rationale

The product has a small, custom, accessibility-sensitive interface.

Native primitives now cover the required modal/dialog semantics, while CSS Modules preserve strong custom design control with no runtime styling dependency.

### Consequence

Any later Radix/UI-library addition must solve a verified accessibility/browser problem rather than convenience alone.

### Revisit when

Native primitives fail a documented interaction/accessibility requirement.

## D-030 — No router until URLs have real product value

Date: 2026-09-21

Status: accepted

### Decision

Do not add React Router or another router to MVP.

Use application/UI state for:

- active trip
- add-price overlay
- history
- settings
- completed summary

### Rationale

The core product is one task surface.

Routing would add URL/state synchronization complexity without a deep-link requirement.

### Consequence

If future history/shared/public pages require durable URLs, prefer React Router Declarative Mode as the first option.

### Revisit when

A real deep-link/navigation requirement appears.

## D-031 — Barcode scanning uses progressive native + lazy WASM detection

Date: 2026-09-21

Status: accepted

### Decision

For P1 barcode scanning:

1. use native BarcodeDetector when supported for required formats
2. otherwise lazy-load a BarcodeDetector-compatible ZXing-C++ WebAssembly ponyfill
3. self-host WASM for offline compatibility

The current preferred fallback candidate is the barcode-detector package.

### Rationale

The native Barcode Detection API remains unavailable in some widely used browsers.

A standardized native/ponyfill interface gives cleaner capability boundaries than coupling the application to one scanner library.

### Consequence

Scanner code remains outside the initial bundle and behind BarcodeScanner.

Manual price entry remains available in every scanner failure state.

### Revisit when

Browser support becomes sufficient to drop the fallback, or benchmark data shows a materially better scanner SDK.

## D-032 — Open Food Facts is an optional product-identity provider, not a price provider

Date: 2026-09-21

Status: accepted

### Decision

Use Open Food Facts as the first provider candidate behind ProductLookup for barcode-based product identity.

Do not treat it as an authoritative current store-price source.

### Rationale

The API supports product retrieval by barcode and an official JS/TS SDK exists.

The product's business rule remains that barcode identifies a product; current shelf price is contextual.

### Consequence

- remote responses are runtime-validated
- not-found is normal
- manual flow survives provider failure
- API client-identification policy must be resolved before production
- provider-specific DTOs never enter the domain

### Revisit when

A better product-identity data source exists for the target market, or API policy makes browser usage impractical.

## D-033 — Shelf OCR provider remains benchmark-gated

Date: 2026-09-21

Status: accepted

### Decision

Do not make a production OCR vendor/library part of core architecture yet.

Keep ShelfPriceScanner provider-agnostic.

Use Tesseract.js in a Web Worker as the first on-device benchmark candidate.

### Rationale

OCR accuracy and latency on real grocery shelf labels are empirical risks.

Locking a heavy OCR library or cloud vendor before mobile benchmarking would be technology-first design.

### Consequence

No OCR production dependency is added until fixture/mobile tests demonstrate useful speed and candidate quality.

If local OCR fails, cloud OCR can be evaluated behind the same port without changing domain/application code.

### Revisit when

Benchmark data exists.

## D-034 — localStorage remains MVP persistence despite adding runtime validation

Date: 2026-09-21

Status: accepted

### Decision

Keep versioned localStorage as MVP canonical persistence and add Zod validation at its boundary.

Do not move to IndexedDB/Dexie merely because the product is becoming more complex.

### Rationale

Canonical shopping state remains small text data, and synchronous write semantics are useful for the durability contract.

### Consequence

Upgrade storage only for actual data-volume/query/media requirements.

### Revisit when

Images, large price history, large offline datasets, or indexed-query requirements appear.



## D-035 — Repeat-trip acceleration precedes scanner breadth

Date: 2026-09-21

Status: accepted

### Decision

After the core manual/correction/completion flow is stable, prioritise:

1. Shop again / repeat previous budget
2. Recent Items
3. basic Price Memory

before:

- barcode scanning
- shelf OCR
- voice capture
- broader smart-shopping features

PWA/installability may follow the retention gate, but must not displace repeat-trip validation.

### Rationale

The largest unresolved product risk is not capture technology. It is whether users tolerate repeated entry and voluntarily return for another real shopping trip.

Repeat-trip acceleration reduces friction for products the user already buys without introducing:

- camera permission
- network dependency
- recognition latency
- OCR ambiguity
- external product-database coverage

This directly targets retention rather than feature breadth.

### Consequence

ROADMAP.md must keep Repeat Trip / Recent Items / Price Memory ahead of barcode/OCR work.

Scanner/OCR work cannot be justified merely because competitors have it.

### Revisit when

Real-store evidence shows another capability is repeatedly blocking the core job before repeat-trip acceleration can help.

## D-036 — Second-trip rate is the primary early product-validation signal

Date: 2026-09-21

Status: accepted

### Decision

Use second-trip rate as the primary early product-success signal after the repeat-trip flow is implemented.

Provisional internal decision bands:

- 35% or higher — very strong early signal
- 25–35% — promising; optimise recurring friction
- 15–25% — material retention problem
- below 15% — revisit the core interaction/job before expanding features

These thresholds are heuristics, not external market benchmarks.

### Rationale

Downloads, first launches, feature usage, and stated intent can all look healthy while the product fails to become a real shopping habit.

A second real shopping trip is a much stronger signal that the product creates repeated value.

### Consequence

After Repeat Trip / Recent Items / Price Memory are implemented, freeze non-critical feature expansion long enough to run a focused real-store beta with approximately 20–50 shoppers.

Do not respond to weak retention by automatically adding OCR, barcode, voice, cloud sync, or more analytics.

### Revisit when

Enough real cohort data exists to replace these provisional thresholds with observed product-specific baselines.


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
