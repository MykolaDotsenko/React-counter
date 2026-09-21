# Roadmap

## Purpose

This roadmap turns the product pivot into a sequence of small, reviewable changes.

The repository should evolve from Pulse Counter into a focused shopping budget companion without a rewrite, feature explosion, or loss of the existing interaction-engineering quality.

The roadmap is ordered by product dependency, not novelty.

## Delivery principles

- one clear responsibility per PR
- every PR leaves main in a working state
- domain correctness lands before visual expansion
- manual price entry is complete before scanning
- optional smart features never block the core workflow
- TypeScript migration is incremental
- documentation changes ship with the behaviour they describe
- no target-only README claims before implementation

## Phase 0 — documentation and product lock

Goal: make future AI-assisted development consistent.

### Deliverables

- PRODUCT.md
- FUNCTIONALITY.md
- SCENARIOS.md
- docs/specs/MVP-SPEC.md
- docs/specs/CONTRACTS.md
- docs/specs/STATE-MACHINES.md
- docs/specs/STORAGE-SCHEMA.md
- docs/specs/MONEY-SPEC.md
- TECH-STACK.md
- docs/tech/TECHNOLOGY-RESEARCH.md
- BRAND.md
- MARKETING.md
- docs/marketing/RESEARCH.md
- docs/marketing/STORE-LISTING-SPEC.md
- docs/marketing/LAUNCH-CHECKLIST.md
- UX.md
- DESIGN.md
- DOMAIN.md
- ARCHITECTURE.md
- TESTING.md
- ROADMAP.md
- AGENTS.md
- docs/COMPETITIVE-RESEARCH.md
- docs/DATA-PERSISTENCE.md
- docs/ACCESSIBILITY.md
- docs/DECISIONS.md or ADRs as decisions accumulate

### Exit criteria

- product scope is explicit
- non-goals are explicit
- money model is explicit
- target/current architecture distinction is explicit
- AI agent instructions point to authoritative docs
- visual design direction and prototype evaluation criteria are explicit
- Tier 0 scenario coverage and unresolved scenario risks are explicit
- exact MVP requirements, contracts, state machines, and storage schema are explicit
- technology stack, dependency budget, and rejected alternatives are explicit
- brand positioning, naming constraints, store assets, growth strategy, and launch gates are explicit

## Technical specification gate — before Phase 1

Before code migration begins, confirm:

- MVP currency scope is locked to EUR
- exact EUR parser/formatter contract is agreed
- application/domain/infrastructure boundaries match ARCHITECTURE.md
- state-machine forbidden states remain impossible
- v1 storage schema is internally consistent
- no unresolved spec contradiction exists

Current technical spec readiness: **98–99/100** depending on the concern.

The previous currency-scope blocker is resolved by D-018 and docs/specs/MONEY-SPEC.md.

## Technology gate — before Phase 1

Confirm before adding dependencies:

- React 19.3 + Vite 8 remain the UI/build foundation
- TypeScript migration starts on strict TypeScript 6.0.x
- no router/global-state/form/UI/animation framework is added
- Phase 1 adds only TypeScript/tooling and fast-check
- Zod waits until persistence runtime validation is implemented
- PWA/scanner/OCR dependencies remain phase-gated
- TECH-STACK.md and docs/tech/TECHNOLOGY-RESEARCH.md have no unresolved contradiction

Current stack fit: **98/100**.

## Phase 1 — exact money foundation

**Status: complete — merged via PR #11 on 2026-09-21.**

Implementation evidence:

- TypeScript 6.0.3 strict incremental configuration
- TypeScript-aware ESLint
- exact EUR integer-cent domain
- decimal and auto-cents parsing
- explicit product/quantity guardrails
- safe-integer overflow protection
- Intl-based EUR presentation boundary
- 43 dedicated money tests
- 4 property tests × 2,000 generated cases = 8,000 generated invariant cases per test run
- typecheck included in quality and Pages deployment gates
- production dependency audit clean at merge
- PR quality matrix green in Chromium, Firefox, and WebKit
- existing Pulse Counter UI remained unchanged

Suggested PR:

> refactor: introduce strict TypeScript money domain

### Scope

- add TypeScript 6.0.x configuration with strict compiler options
- add compatible typescript-eslint tooling
- add fast-check for property-style invariants
- introduce integer-cent money helpers/types
- implement EUR-only parser/formatter from MONEY-SPEC.md
- introduce explicit SupportedCurrency = 'EUR' boundary
- add exact parsing/formatting/property-style tests
- keep existing Pulse UI working during the migration where practical

### Must not include

- shopping redesign
- barcode scanning
- OCR
- PWA
- history dashboard

### Acceptance criteria

- no canonical floating-point money
- no parseFloat-based canonical conversion
- EUR-only product limits and fraction rules enforced
- typecheck in CI
- domain tests cover representative and boundary values
- existing quality gates remain green

## Phase 2 — shopping trip domain

**Status: complete — merged via PR #13 on 2026-09-21.**

Implementation evidence:

- pure strict-TypeScript ShoppingTrip / CartItem domain
- ActiveTrip / CompletedTrip discriminated union
- separate PriceSource and PriceConfidence dimensions
- branded trip/item/store/timestamp boundaries
- exact EUR budget, safety-buffer, unit-price and quantity validation
- exact line/cart totals and nominal/safe remaining selectors
- nominal and safe overage represented without rejecting over-budget state
- pure add-item projection with no canonical mutation
- pure add/edit/remove/budget/buffer/complete/checkout command reducer
- completed trips reject active-cart mutations
- item IDs unique inside a trip
- item labels normalized and bounded to 120 Unicode code points
- canonical UTC timestamps use exact Date.toISOString() form
- edit/completion timestamp ordering enforced
- derived totals remain non-canonical
- no React, DOM, storage, network or animation dependency
- 36 dedicated shopping-domain tests
- 4 property tests × 1,500 generated cases = 6,000 generated invariant cases per test run
- 95 tests green across the full repository at merge
- production dependency audit clean at merge
- PR quality matrix green in Chromium, Firefox, and WebKit

Suggested PR:

> feat: add shopping trip and cart domain

### Scope

- ShoppingTrip
- CartItem
- budget
- safety buffer
- quantity
- price source
- price confidence
- pure selectors for totals and remaining values
- reducer or equivalent pure state transition layer

### Acceptance criteria

- EUR 50 budget scenarios calculate exactly
- over-budget is representable, not rejected
- safe and nominal remaining are distinct
- derived totals are not canonical state
- domain remains React/browser independent

## Phase 3 — persistence migration

**Status: complete — delivered via PR #14 on 2026-09-21.**

Implementation evidence:

- Zod 4.6.5 runtime validation at the storage boundary
- strict `budget-cart:active-trip` v1 DTO/envelope
- DTO → domain reconstruction through Phase 2 constructors/reducer
- domain → DTO complete-snapshot serialization
- explicit healthy/degraded persistence outcomes
- malformed JSON and invalid-data recovery without startup crash
- unsupported future versions preserved and never overwritten during restore/bootstrap
- canonical data rejects unexpected derived fields
- active-trip write/restore/clear helpers with injected StorageLike boundary
- legacy `pulse-counter:state` and `counter` values never interpreted as money
- legacy keys retired only after successful shopping-state bootstrap
- valid in-memory trip survives simulated write failure unchanged
- 33 dedicated persistence tests
- full repository suite at PR validation: 128 tests
- production dependency audit clean
- browser/accessibility matrix retained as regression gate

Suggested PR:

> feat: persist versioned shopping trips safely

### Scope

- add Zod 4 runtime validation at infrastructure boundaries
- new storage schema
- active-trip persistence
- legacy Pulse storage retirement
- malformed-state recovery
- unsupported-version handling
- persistence-health state

### Acceptance criteria

- old counter value is never reinterpreted as money
- committed shopping mutations survive reload
- simulated write failure is visible to application/UI
- no silent claim that an unsaved trip is safe

## Scenario validation gate — before Phase 4

Before building the final core UI, review the Tier 0 scenarios in SCENARIOS.md and verify that the proposed interaction model supports them without contradictory behaviour.

At minimum, walkthrough/prototype:

- first launch
- active-trip resume
- basic manual add
- typo before and after commit
- quantity
- safety buffer
- safe-limit crossing
- nominal over-budget preview
- intentional over-budget state
- persistence failure
- reload durability
- offline launch
- one-hand use

No Tier 0 scenario may fall below the documented target quality without an explicit decision and updated documentation.

## Brand validation gate — before public naming and store assets

Before a final product name, icon, public landing page, or app-store metadata is locked:

- review BRAND.md
- complete the naming checks required by D-021
- validate that a new person understands the pre-checkout job
- ensure the visual mark communicates remaining capacity without looking like generic fintech
- keep CartRoom as working codename until this gate passes

Marketing must not delay Phase 1–3 engineering work.

## Design validation gate — before Phase 4

Before implementing the final visual system, prototype the three directions defined in DESIGN.md:

- Calm utility
- Premium spatial
- Warm everyday

Evaluate them using task questions rather than aesthetic preference:

- Can a first-time viewer explain the app purpose in 3–5 seconds?
- Can they identify remaining budget instantly?
- Can they identify Add price instantly?
- Can they use the primary action one-handed?
- Does the progress visual clearly mean remaining capacity?

Choose one direction or a deliberately justified hybrid only after this comparison. Do not merge all three styles by default.

## Phase 4 — core Budget Cart UI

Suggested PR:

> feat: build remaining-first shopping experience

### Scope

- first-use budget setup
- active trip
- dominant remaining amount
- cart total / budget
- progress indicator
- item list
- Add price action

### Acceptance criteria

- active-trip behaviour matches FUNCTIONALITY.md
- purpose is understandable in 3–5 seconds
- no account/setup wall
- mobile-first at compact viewport
- current Pulse visual identity is simplified rather than discarded
- remaining budget has strongest hierarchy

## Phase 5 — ultra-fast manual price entry

Suggested PR:

> feat: add one-hand price entry and projected remaining

### Scope

- large price keypad
- exact parsing
- optional auto-cents mode
- quantity
- projected remaining before commit
- add anyway / cancel when exceeding limit
- automatic return to summary after commit

### Acceptance criteria

- manual entry works fully offline
- common price-only item targets a median <=2.5 seconds in representative one-hand testing
- approximately 3 seconds or less remains the minimum release-quality expectation
- keypad does not remain dangerously active after commit
- no item name/category required

## Phase 6 — correction and confidence

Suggested PR:

> feat: add undo, editing and price confidence states

### Scope

- one-action undo
- edit price
- edit quantity
- remove item
- price source remains explicit (manual / price-memory / shelf-scan / encoded-barcode as implemented by phase)
- price confidence remains explicit (confirmed / remembered / estimated)
- source and confidence are never collapsed into one enum
- estimated cart cues where appropriate

### Acceptance criteria

- add then undo restores exact previous total
- uncertainty is visible but not noisy
- ordinary correction requires no destructive modal flow

## Phase 7 — trip completion and reconciliation

Suggested PR:

> feat: add checkout reconciliation and trip history

### Scope

- finish trip
- optional actual checkout total
- estimated vs actual difference
- lightweight trip history
- no general expense-dashboard expansion

### Acceptance criteria

- user may finish without actual total
- completed trip is recoverable from persistence
- history remains shopping-task focused

## Phase 8 — offline PWA

Suggested PR:

> feat: ship installable offline shopping experience

### Scope

- add vite-plugin-pwa + Workbox generateSW
- web manifest
- installability
- application shell caching
- offline startup
- safe service-worker update strategy

### Acceptance criteria

- previously loaded app opens without network
- active shopping workflow works offline
- service worker does not own canonical business data
- external helpers can fail independently

## Phase 9 — price memory

Suggested PR:

> feat: remember prices without pretending they are current

### Scope

- product identity abstraction
- remembered price records
- observed date
- optional store context
- one/two-action reuse
- clear freshness labels

### Acceptance criteria

- remembered price never appears as confirmed-current without explicit action
- age is visible
- store-specific suggestion works when store is known
- user can always enter current price instead

## Phase 10 — barcode identification

Suggested PR:

> feat: add optional barcode product lookup

### Scope

- scanner adapter boundary
- native BarcodeDetector capability detection
- lazy ZXing-C++ WASM BarcodeDetector-compatible fallback
- self-host scanner WASM for offline use
- capability detection/fallback
- product identity lookup
- connection to price memory
- manual current-price fallback

### Acceptance criteria

- scan reduces work for known products
- barcode is never treated as price
- failed/unsupported scanner leaves manual workflow intact
- scanner bundle does not unnecessarily inflate initial critical path

## Phase 11 — shelf-label price scan

Suggested PR:

> feat: add confirm-before-commit price tag scanning

### Scope

- camera/OCR adapter
- benchmark Tesseract.js Web Worker as first local provider candidate
- do not lock provider unless real mobile fixtures meet usability/accuracy criteria
- price candidate extraction
- multiple-candidate state
- confirmation preview
- optional product text

### Acceptance criteria

- no scanner output changes cart before confirmation
- ambiguous labels do not silently choose a price
- useful fixtures cover split price, superscript cents, unit price, discounts
- scanner failure is recoverable immediately with manual price entry

## Phase 12 — advanced price mechanics

Only after core usability is proven.

Possible separate PRs:

- weighted goods
- discounts
- optional tax mode
- store-aware price history
- deterministic safety-buffer suggestion

Each must have a demonstrated use case and explicit domain rules before implementation.

## Phase 13 — polish, launch evidence and recruiter-grade proof

Before broad consumer acquisition, run docs/marketing/LAUNCH-CHECKLIST.md.

Store work must follow docs/marketing/STORE-LISTING-SPEC.md.

Marketing order:

1. real-user beta
2. polished landing/store assets
3. organic short-form/build-in-public
4. store-listing experiments once traffic exists
5. meaningful paid acquisition only after retention evidence

Suggested PR group:

- performance budgets
- deterministic product screenshots
- measured interaction timings
- README rewrite around product problem
- architecture diagrams
- real-world case-study fixture
- accessibility hardening
- mobile browser matrix refinement

### Case-study target

A clear scenario such as:

> A shopper starts with EUR 50, uses a EUR 2 safety buffer, builds a 12–20 item cart, corrects one item, crosses the safe threshold, and finishes below the nominal limit with an estimate close to the real checkout value.

Do not fabricate user-success statistics.

## Feature priority table

### P0 — core product

- exact money
- trip budget
- remaining-first UI
- safety buffer
- fast manual price entry
- quantity
- add/edit/remove
- undo
- local persistence
- visible persistence failure
- checkout completion
- mobile accessibility

### P1 — reduce repeated friction

- trip history
- price memory
- optional store context
- barcode identification
- price-tag scanning
- weighted items
- discount support
- export/backup
- PWA/offline installation

### P2 — only after evidence

- voice price entry
- receipt import
- shared household cart
- cross-device sync
- deeper price analytics
- retailer integrations

## Explicitly not planned

Unless PRODUCT.md is intentionally changed with strong evidence:

- bank synchronization
- income/bill management
- investment features
- net-worth dashboards
- meal planning
- nutrition tracking
- recipe discovery
- grocery delivery
- coupon marketplace
- loyalty platform
- AI financial coaching
- social feed
- generic household OS
- mandatory account
- mandatory cloud backend

## Technical-debt policy

Do not postpone correctness debt in:

- money arithmetic
- persistence migrations
- accessibility of the primary flow
- scanner confirmation boundaries

Cosmetic refactoring can wait.

## AI-development policy

Before implementing a roadmap item, an AI agent should read:

1. AGENTS.md
2. PRODUCT.md
3. relevant FUNCTIONALITY.md section
4. relevant SCENARIOS.md entries
5. relevant docs/specs/MVP-SPEC.md requirements
6. relevant docs/specs/CONTRACTS.md interfaces
7. relevant docs/specs/STATE-MACHINES.md transitions
8. docs/specs/STORAGE-SCHEMA.md when persistence is touched
9. docs/specs/MONEY-SPEC.md for any price/budget/quantity/checkout work
10. TECH-STACK.md and docs/tech/TECHNOLOGY-RESEARCH.md for dependency/framework/platform work
11. BRAND.md for naming/copy/identity work
12. MARKETING.md and relevant docs/marketing/* for acquisition/store/launch work
13. relevant UX.md section
14. DESIGN.md for visual/user-facing work
15. relevant DOMAIN.md section
16. ARCHITECTURE.md
17. TESTING.md
18. this roadmap item

The agent should implement only the current roadmap slice plus fixes required to keep main healthy.

Do not opportunistically implement later phases because they seem easy.

## When to revise this roadmap

Revise when:

- real usability testing contradicts an assumption
- competitor/review research exposes a materially better interaction
- implementation uncovers a domain constraint
- the product thesis changes intentionally

Do not revise simply to accommodate an attractive technology.

## Current next implementation step

Phases 1, 2, and 3 are complete.

The next implementation gate is:

> **Scenario + design validation before Phase 4 — core Budget Cart UI**

Before changing the visible Pulse Counter experience, validate the Tier 0 shopping scenarios and the three documented design directions against the shipped exact-money/domain/persistence contracts.

Then Phase 4 should wire the application/UI to:

- start or restore an active shopping trip
- use the Phase 3 persistence boundary rather than the legacy counter storage
- make remaining budget the dominant information
- show cart total / budget and safety-buffer state
- expose persistence degradation clearly
- keep manual Add price as the primary action
- preserve mobile-first accessibility and the existing quality matrix

Do not start barcode, OCR, price memory, cloud sync, or PWA work inside Phase 4.
