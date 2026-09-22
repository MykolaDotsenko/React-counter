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

Build a focused shopping budget companion for people shopping under a hard per-trip spending limit.

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

Shopping persistence failure must be surfaced to the user rather than silently degrading to ephemeral memory.

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

Status: accepted; threshold bands refined by D-038

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



## D-037 — Run an early scanner benchmark without promoting scanner to the production roadmap

Date: 2026-09-21

Status: accepted

### Decision

After Phase 5 establishes a stable, measured manual baseline, run a small experimental scanner benchmark before Phase 6–8 and the broader real-store beta.

This benchmark may test:

- barcode capture
- shelf-label price capture
- scan -> confirm interaction
- failure/fallback behaviour

It must remain:

- experimental
- optional
- outside the critical product bundle/path
- recoverable immediately to manual entry

Production barcode and OCR implementation remains scheduled for Phase 10/11.

### Rationale

The manual path is the universal baseline, but scanner value is an empirical interaction question.

A scanner could reduce:

- seconds per item
- typing effort
- cognitive fatigue

or it could increase:

- latency
- correction work
- ambiguity
- trust risk

Testing the hypothesis cheaply after the manual baseline exists gives earlier evidence without committing the product to scanner-first architecture.

### Consequence

The roadmap contains an Experimental Scanner Benchmark Gate after Phase 5.

Positive benchmark evidence may justify a scanner cohort in later beta testing.

Negative evidence must simplify/defer scanning rather than trigger more scanner engineering.

D-035 remains authoritative for production feature sequencing: Repeat Trip / Recent Items / Price Memory still precede production scanner breadth.

### Revisit when

The benchmark has representative mobile timing, failure, correction, and repeated-use data.

## D-038 — Refine retention thresholds and include third-trip behaviour

Date: 2026-09-21

Status: accepted

### Decision

Keep second-trip rate as the primary early retention signal, but refine the provisional internal decision bands to:

- 45% or higher — exceptional early signal
- 35–45% — strong
- 25–35% — viable/promising
- 15–25% — problematic
- below 15% — core product-risk signal

Also track third-trip behaviour before assigning high confidence to retention.

These thresholds are internal heuristics, not claimed industry benchmarks.

### Rationale

A single return trip is a strong signal, but healthy third-trip behaviour better distinguishes a one-time novelty/revisit from a forming habit.

The stricter upper band creates a more demanding internal bar before scaling distribution or monetisation.

### Consequence

Product-success, roadmap, beta, and launch documentation must use the refined bands.

High-confidence product-success estimates require:

- strong second-trip behaviour
- healthy third-trip behaviour
- no major trust/data-loss issue

### Revisit when

Enough product-specific cohort data exists to replace heuristic bands with observed baselines.


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


## D-039 — Human B6 gate is explicitly waived for continued development, not declared passed

Date: 2026-09-21

Status: accepted risk

### Decision

Continue development beyond the Sprint B human B6 gate without claiming that representative one-hand timing, physical reach, software-keyboard, or bright-store validation has passed.

The automated/code B6 gate remains valid and green. The human KPI remains **unverified**.

### Rationale

The project owner explicitly chose to continue implementation rather than pause roadmap work for a manual physical-device test.

This is a sequencing waiver, not evidence. Automated browser timing, Playwright, desktop emulation, or AI review must not be re-labelled as representative human interaction evidence.

### Consequence

- the public/default shell remains guarded unless a later explicit release decision changes that
- documentation must distinguish `automated-green` from `human-unverified`
- the <=2.5 second one-hand KPI must not be described as achieved
- Phase 6 correction/confidence work may proceed
- the experimental scanner benchmark is deferred because its meaningful comparison also depends on representative human interaction evidence
- future release/marketing work must revisit the human gate before making speed or physical-usability claims

### Revisit when

Representative physical-device evidence is recorded, or when the project owner explicitly changes the release-quality policy with documented rationale.

## D-040 — Repeat budget derives from completed history, not duplicate settings state

Date: 2026-09-22

Status: accepted

### Decision

The first Phase 8 repeat-trip accelerator derives its source from validated completed-trip history.

Shop again copies only:

- budget
- safety buffer

into a newly created active trip with a fresh trip id, fresh start timestamp, and empty cart.

Do not introduce a separate persisted `recentBudget` or repeat-settings record for this slice.

### Rationale

Completed history is already:

- versioned
- runtime validated
- durable
- locally available
- the factual source of the user's previous spending plan

Persisting the same plan again would create two sources of truth and a synchronization/migration problem without user value.

A fresh trip is also materially safer than reopening a completed trip because it does not require a two-record history/active rollback transaction.

### Consequence

- later-launch recent-budget UI selects the newest valid completed trip
- completed history remains immutable when Shop again is used
- cart items and actual checkout totals are never copied into the new trip
- repeat is rejected while history durability is degraded or completion cleanup is pending
- Continue shopping remains a separate deferred capability
- a dedicated settings record is added only if future adaptive defaults require state that cannot be derived safely from history

### Revisit when

Recent-budget preferences must intentionally diverge from completed history, or user research demonstrates a need for persistent defaults independent of the latest completed trip.

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

## D-042 — Retention beta evidence stays local and content-free

Date: 2026-09-22

Status: accepted

### Decision

Use a guarded beta build with a separate local evidence record:

~~~text
budget-cart:qa:retention-v1
~~~

The evidence schema may contain only behavioural structure required for the retention gate:

- trip ordinal
- new/repeat trip start
- trip finish
- 1/5/10 item milestones
- manual-entry completion duration
- manual-entry abandonment
- remembered-item reuse
- current-price override start

It must not contain:

- budgets
- prices or line totals
- item names
- product/memory/store identifiers
- checkout totals
- camera content

The application sends no beta telemetry. Evidence export is an explicit manual action.

### Rationale

The retention question can be answered from behavioural structure without collecting shopping content. A remote analytics platform would add privacy, consent, operational, and architectural complexity before product retention is proven.

Keeping evidence separate from shopping persistence also prevents validation infrastructure from becoming business-state authority.

### Consequence

- beta evidence failure never affects the active shopping trip
- old shopping history does not define beta trip ordinals
- starting evidence collection mid-trip does not fabricate a trip start
- a guarded `/beta/` build may be published while the default public shell remains unchanged
- human beta evidence is still required before Phase 9 breadth

### Revisit when

A later validated product needs aggregate telemetry across a larger cohort and has an explicit privacy/consent design.

## D-043 — Structured physical evidence is required for B6 eligibility

Date: 2026-09-22

Status: accepted

### Decision

The B6 empirical timing gate must not infer physical test conditions from free-form notes.

QA timing schema v3 requires explicit structured evidence for:

- comparable input method
- one-handed primary timing use
- bright/store-like physical lighting
- default system text size
- primary device/browser
- compact-phone/equivalent spot-check

Dark appearance, 200%/large text, and reduced-motion physical checks are recorded independently as:

- `not-run`
- `pass`
- `fail`

A recorded secondary physical failure blocks B6 eligibility immediately.

A `not-run` value remains visible and must never be interpreted as a physical pass.

Valid v2 timing samples and device labels migrate to v3, but migration deliberately initializes the new physical-context fields as unverified.

### Rationale

The B6 KPI is a human physical-interaction gate.

Timing samples alone cannot prove:

- one-handed use
- store-like lighting
- default text conditions
- consistent real input method

Keeping these facts only in notes makes the release result too easy to overstate and too hard to audit.

Preserving valid v2 timing evidence avoids throwing away legitimate measurements while refusing to fabricate evidence that v2 never recorded.

### Consequence

- B6 remains human-unverified until the v3 primary context is explicitly completed
- the same input-method label must accompany comparable timing samples
- a migrated v2 session cannot become B6-eligible merely because its old checklist was complete
- secondary physical checks are optional to run where unavailable, but any recorded failure is a B6 blocker
- automation may verify the recorder and migration logic but still cannot prove the <=2.5 second human KPI

### Revisit when

The B6 physical-device protocol changes materially, or real testing shows that different structured context is needed to explain timing variance.

## D-044 — Guarded shopping builds use provisional product identity without locking the final brand

Date: 2026-09-22

Status: accepted

### Decision

Keep internal QA/beta browser metadata distinct from the public product context without creating a second product identity.

The guarded `/qa/` and `/beta/` builds use:

- the descriptive migration label `Shopping Budget Companion`
- a provisional remaining-room favicon/mark
- warm shopping theme metadata
- shopping-specific descriptions
- noindex/nofollow/noarchive

The public/default root is Shopping Budget Companion. QA and beta routes remain internal evidence surfaces.

The provisional mark must follow the brand metaphor rather than decorative spectacle:

- rounded boundary/container
- intentionally open/remaining space
- no gradient
- no euro symbol
- no cart/calculator/AI-sparkle cliché

This decision does not lock `CartRoom`, the current accent hue, or a final production icon family.

### Rationale

The guarded shopping experience already implements Calm Utility, remaining-first hierarchy, and local-first trust. Using an obsolete prototype favicon or inconsistent browser naming would create a visible identity contradiction.

At the same time, promoting a working codename or provisional colour to final commercial identity before naming and recognition evidence would create a different form of premature lock-in.

A migration-specific product label and provisional metaphor-led mark resolve the current drift while preserving reversibility.

### Consequence

- QA and beta builds inherit the same core product identity while specializing their internal title/description
- static post-build metadata and runtime React metadata must stay aligned
- the public root is the canonical Shopping Budget Companion
- future brand PRs use `docs/evidence/BRAND-IMPLEMENTATION-AUDIT.md` as the anti-drift checklist
- final naming, accent and production icon work remain evidence-gated
- the shopping mark should not be added persistently to active-trip UI where it would compete with the remaining amount

### Revisit when

Final naming/conflict checks are complete, or user evidence requires a different visual identity direction.



## D-045 — Retire the compatibility shell and publish one product

Date: 2026-09-22

Status: accepted

### Decision

Shopping Budget Companion is the only application shell in the repository and the canonical public GitHub Pages root.

Remove the obsolete prototype UI, its feature directory, presentation CSS, persistence implementation, component/model/storage tests, alternate favicon, and shell-selection feature flag.

Keep only the minimal historical-storage retirement safeguard required to prevent unrelated old numeric state from being interpreted as shopping money.

QA and retention-beta routes reuse the same shopping application. Their flags enable evidence instrumentation only; they do not select a different product.

### Rationale

Maintaining two products in one repository created avoidable cost:

- the public demo did not represent the actual product work
- README and architecture documentation needed migration disclaimers
- CI built and deployed a product that was no longer the repository's purpose
- legacy UI code, CSS, tests, branding, and feature flags obscured the architecture for reviewers
- future contributors could accidentally preserve or extend compatibility code that had no product value

The shopping implementation is already independently covered by exact-domain tests, application/controller tests, component tests, persistence/recovery tests, and the Chromium/Firefox/WebKit browser matrix.

Retaining the old UI therefore adds noise without adding meaningful release safety.

### Consequence

- `src/App.jsx` always composes Shopping Budget Companion
- no product-shell selection feature flag remains
- the public root, QA route, and beta route share one product identity
- the repository structure exposes only current product features
- historical storage keys remain implementation details solely for safe retirement
- B6 physical timing and Phase 8 retention evidence remain explicitly unverified and must not be fabricated or inferred from automation

### Revisit when

Only if a genuinely separate product shell becomes a validated product requirement. A demo or migration convenience is not sufficient reason to reintroduce one.

---

## D-046 — Make documentation authority explicit and keep the repository root small

**Status:** Accepted  
**Date:** 2026-09-22

### Context

The repository accumulated several high-quality documents that overlapped in product scope, UX, design, functionality, scenarios, technology, and execution planning. The content was useful, but the repository no longer made it obvious which documents were current sources of truth versus supporting reference or completed execution material.

This created two risks:

1. a reviewer or contributor could treat multiple planning documents as equally authoritative;
2. a stale detailed document could silently contradict a newer product or architecture contract.

### Decision

- Keep the repository root focused on code/configuration entry points, `README.md`, `AGENTS.md`, and `LICENSE`.
- Move the long-form product/engineering Markdown set under `docs/`.
- Use `docs/README.md` as the documentation map and authority model.
- Treat `PRODUCT.md`, `ARCHITECTURE.md`, `DOMAIN.md`, `DESIGN.md`, `ROADMAP.md`, and `TESTING.md` as the current high-level authoritative documents.
- Treat `docs/reference/FUNCTIONALITY.md`, `docs/reference/UX.md`, `docs/reference/BRAND.md`, `docs/reference/SCENARIOS.md`, `docs/reference/TECH-STACK.md`, and `docs/reference/MARKETING.md` as supporting reference. They may add context but must not independently redefine current implementation status.
- Keep detailed contracts under `docs/specs/` and specialized contracts such as persistence/accessibility alongside the current docs.
- Move completed sprint decomposition such as `CORE-UI-EXECUTION-BRIEF.md` under `docs/archive/` instead of leaving it mixed with current contracts.
- Avoid duplicating current-status checklists across multiple documents. Update the smallest owning authoritative document and reconcile supporting reference only where it would otherwise mislead.

### Consequences

- Repository browsing becomes faster for reviewers and contributors.
- Existing historical detail is preserved instead of deleted.
- Documentation conflicts have an explicit resolution path.
- Future planning documents do not automatically become permanent sources of truth.

---

## D-047 — B6 timing evidence must be internally verifiable

Date: 2026-09-22

Status: accepted

### Decision

The B6 timing recorder treats empirical evidence as a validated artifact rather than a free-form clipboard dump.

Each timing sample must have:

- a non-empty unique sample ID
- a positive finite duration
- a positive integer minor-unit price
- a positive safe-integer quantity
- an exact safe-integer line total equal to unit price × quantity
- a positive budget and non-negative safety buffer
- a canonical ISO completion timestamp

Stored sessions reject duplicate sample IDs. Representative KPI summaries re-check sample integrity before counting a sample.

Copied evidence uses a versioned `shopping-timing-evidence` export. The export contains the validated QA session plus a derived B6 gate summary. Import validation recomputes the gate from the session and rejects a tampered derived summary.

The export privacy declaration is explicit: no network transmission, item names, or store history are included, while device metadata is intentionally present because physical-test context is part of the evidence.

A separate two-step **Start fresh QA session** action clears empirical QA state and recaptures the current environment. Resetting only timing samples deliberately preserves the existing environment and checklist context.

### Rationale

Human evidence is useful only if later reviewers can tell whether the recorded measurements are internally coherent and whether a copied summary was derived from the same underlying samples.

The previous recorder already separated QA state from product state, but it trusted several sample fields independently and exported an unversioned report. That left avoidable opportunities for malformed, duplicate, stale-environment, or manually altered evidence to look legitimate.

### Consequence

- invalid or mathematically inconsistent timing samples fail closed
- duplicate sample IDs cannot inflate a timing cohort
- stale environment metadata can be intentionally discarded without clearing browser product data
- copied evidence has a stable machine-readable envelope
- derived B6 status is never trusted independently from the validated session
- none of these checks substitutes for the required physical human test

### Revisit when

The empirical protocol, timing schema, or cross-device evidence model changes materially.
