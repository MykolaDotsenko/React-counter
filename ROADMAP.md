# Roadmap

## Purpose

This roadmap turns the product pivot into a sequence of small, reviewable changes.

The repository should evolve from Pulse Counter into a focused shopping budget companion without a rewrite, feature explosion, or loss of the existing interaction-engineering quality.

The roadmap is ordered by product dependency, not novelty.

## Delivery principles

- one clear responsibility per PR
- every PR leaves main in a working state
- domain correctness lands before visual expansion
- manual price entry is complete before any scanner benchmark
- an early scanner benchmark may test interaction value, but production scanner breadth stays phase-gated
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

**Status: complete — Phase 4 A0.**

Selected direction:

> **Calm Utility**

Decision record:

- docs/design/PHASE-4-DESIGN-VALIDATION.md

The three directions defined in DESIGN.md were compared against the same canonical fixture:

- Calm utility
- Premium spatial
- Warm everyday

Evaluate them using task questions rather than aesthetic preference:

- Can a first-time viewer explain the app purpose in 3–5 seconds?
- Can they identify remaining budget instantly?
- Can they identify Add price instantly?
- Can they use the primary action one-handed?
- Does the progress visual clearly mean remaining capacity?

Decision: use Calm Utility as the base direction. Do not merge all three styles by default.

Key locks:

- safe remaining is the hero when a safety buffer exists
- nominal remaining is secondary
- quiet linear capacity bar
- Add price is the single primary action
- light mode is first-class for bright-store use
- subtle Pulse-quality motion may survive only as polish

## Phase 4 — core Budget Cart UI

Progress:

- A0 Design validation — **complete**
- A1 ShoppingAppController + React bridge — **complete via PR #15**
- A2 App bootstrap / restore state — **complete via PR #17**
- A3 Start Trip screen — **complete via PR #18**
- A4 Remaining-first active screen — **complete via PR #19**
- A5 Persistence-health UX — **complete via PR #20**
- A6 Mobile/a11y/E2E hardening — **complete via PR #21**

Sprint A stop/go status: **passed for the guarded shopping shell**.

Validation evidence:

- exact EUR 50 start and reload/restore
- safety-buffer semantics
- degraded-write and recovery paths
- malformed and future-version storage preservation
- 360×800 and 390×844 compact layouts
- 200% text-size resilience
- reduced-motion behavior
- keyboard focus/activation
- axe WCAG A/AA on start and active screens
- Chromium, Firefox, and WebKit green
- A6 caught and fixed a real 200% overflow defect and a WCAG contrast defect before merge

The public/default Pulse Counter shell remains in place until Sprint B makes **Add price** genuinely functional. The replacement shopping shell is browser-gated with `VITE_SHOPPING_SHELL=1` during migration so every merged PR leaves the default product usable.

**Next: Phase 5 / Sprint B — ultra-fast manual price entry.**

Execution contract:

- docs/CORE-UI-EXECUTION-BRIEF.md — Sprint A

Do not implement Phase 4 as one oversized PR. Follow the brief's application-controller → bootstrap → start-flow → remaining-first-screen → persistence-health → hardening sequence.

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

Progress:

- B0 Price-entry interaction contract — **complete via PR #22**
- B1 One-hand price-entry surface — **complete via PR #22**
- B2 Live projected remaining — **complete via PR #23**
- B3 Buffer / over-budget consequence states — **complete via PR #24**
- B4 Quantity — **complete via PR #25**
- B5 Commit / persist / return — **complete via PR #26**
- B6 Correction minimum + quality gate — **automated/code gate implemented and green; representative human timing and physical one-hand/bright-store evidence remains unverified under explicit D-039 sequencing waiver**

B5 closes the projection-to-canonical loop: the application controller creates the confirmed manual CartItem from the validated `unitPriceMinor + quantity` intent, commits it through the domain reducer, attempts persistence immediately, and returns the UI to canonical summary state. A failed storage write keeps the committed item in memory and surfaces degraded persistence rather than rolling back valid shopping state.

B4 keeps quantity ephemeral until commit while projecting the exact Phase 2 line total through `projectAddItem()`. The validated handoff carries both `unitPriceMinor` and `quantity`, so B5 commits the exact reviewed item intent without reconstructing quantity from UI state.

B3 locks the threshold interaction before canonical commit wiring: reserve-only crossing stays frictionless, while nominal over-budget requires explicit `Add anyway`. The exact reviewed price intent is emitted only after confirmation. B5 remains responsible for proving that this intent becomes the identical canonical/persisted cart state.

Execution contract:

- docs/CORE-UI-EXECUTION-BRIEF.md — Sprint B

Do not begin Sprint B until the Sprint A stop/go gate passes.

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

## Experimental scanner benchmark gate — after Phase 5

This is a **measurement spike, not a production scanner phase**.

Purpose:

- compare the stable manual baseline against a minimal scan -> confirm path
- measure whether camera capture reduces time or cognitive effort
- identify large failure modes before the broader retention beta

### Allowed scope

- isolated experimental branch or clearly gated prototype
- representative barcode and/or shelf-label capture path
- timing instrumentation for the experiment
- manual fallback
- fixture-based recognition tests
- no production navigation dependency

### Required comparison

Benchmark manual:

> digits -> Add

against experimental scanner:

> open -> frame -> detect -> confirm

Measure:

- median seconds per item
- P75/P90 latency
- recognition failure rate
- correction rate
- fallback-to-manual rate
- user preference after repeated use
- fatigue after 10+ items

### Decision

If scanner is materially faster or lower-friction without reducing trust:

- retain the evidence
- allow Cohort C in the later real-store beta
- keep production implementation scheduled for Phase 10/11

If scanner is slower, fragile, or confusing:

- simplify or defer
- do not promote scanner in product positioning
- do not let scanner work delay Phase 6–8

### Hard constraints

- no scanner candidate commits without confirmation
- no camera/network requirement for the core flow
- no scanner dependency in the initial critical bundle
- no production scanner UI becomes required before the retention gate
- Phase 10/11 remain the production implementation phases

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

## Phase 8 — repeat-trip acceleration and price memory

Suggested PR:

> feat: make repeated shopping materially faster

### Why this moves before PWA/scanning

The largest unresolved product risk is repeated-use friction, not installability or capture technology.

The second and third trips should be materially easier than the first.

### Scope

- Shop again with previous budget
- recent-budget shortcut on later launch
- Recent Items
- product identity abstraction sufficient for remembered items
- remembered price records
- observed date
- optional store context
- one/two-action remembered-item reuse
- clear freshness labels
- current-price override always available

### Acceptance criteria

- a returning user can restart the previous budget in one action
- remembered price never appears as confirmed-current without explicit action
- age is visible
- store-specific suggestion works when store is known
- recent familiar items can be reused in one/two actions
- user can always enter current price instead
- repeated-trip workflow is measurably lighter than first-trip setup
- no account, network, or camera is required for this acceleration

## Retention validation gate — after Phase 8

Before adding PWA/scanner/OCR breadth, run a focused real-store beta.

Recommended cohort:

> **20–50 real shoppers**

Where practical, segment directionally:

- Cohort A — manual-first
- Cohort B — manual + Repeat Trip / Recent Items / Price Memory
- Cohort C — manual + the experimental scanner path, only if the benchmark was positive

This cohort size is directional, not statistically powered.

Primary signal:

> **Second-trip rate**

Provisional decision bands:

- 45% or higher — exceptional early signal; validate third-trip behaviour
- 35–45% — strong; preserve the core and proceed carefully
- 25–35% — viable/promising; optimise recurring friction before broadening
- 15–25% — problematic; freeze feature expansion
- below 15% — revisit the core interaction/job before building production scanner/OCR

Also measure:

- median manual price-entry time
- first / fifth / tenth item reached
- trip completion
- second-trip rate
- third-trip rate
- repeated-budget use
- remembered-item use
- scanner fallback rate for Cohort C
- manual-entry abandonment
- trust/data-loss complaints

During this gate, do not add barcode, OCR, voice, cloud sync, family sharing, retailer integrations, or advanced analytics merely because they are available.

Exceptions:

- blocker bug
- data-integrity issue
- accessibility failure
- repeatedly observed missing capability preventing the core job

Full retention contract:

- docs/PRODUCT-SUCCESS-STRATEGY.md
- docs/CORE-UI-EXECUTION-BRIEF.md

## Phase 9 — offline PWA

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

First retention tier:

- trip history
- repeat previous budget / Shop again
- Recent Items
- price memory
- optional store context

After retention validation:

- PWA/offline installation
- barcode identification
- price-tag scanning
- weighted items
- discount support
- export/backup

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

Phase 4 / Sprint A is complete for the guarded shopping shell.

Phase 5 / Sprint B has completed B0–B5 and the automated/code portion of B6; only the representative human B6 evidence gate remains.

The B6 empirical validation remains a release-quality debt under D-039 rather than the active implementation blocker.

The next implementation step is:

> **Phase 6 — correction and confidence**

PR #28 implements the B6 code/automated portion:

- one-action Undo after add
- typo/correction minimum
- full flagship exact-money E2E
- price-entry and warning accessibility coverage
- compact 360×800 / 390×844 keypad coverage
- 200% text resilience for the price-entry flow
- reduced-motion add/undo equivalence
- keyboard/focus completion
- Chromium / Firefox / WebKit
- runtime no-network manual-core proof
- Calm Utility reserve-boundary and light/dark design alignment

The <=2.5 second KPI remains an empirical human interaction target. Automation must not be used as a substitute.

Before the default/public shell makes speed/physical-usability claims, record the representative timing, one-hand reach, software-keyboard, typo/repeated-add, compact-device/equivalent, and bright-store checks defined in `docs/SPRINT-B-QUALITY-GATE.md`. The QA recorder must show the evidence as release-eligible; code/automation alone cannot satisfy this gate.

D-039 explicitly waives this human gate only for **continued implementation sequencing**. It does not mark the gate passed and does not authorize claiming the <=2.5 second KPI.

The Experimental Scanner Benchmark Gate is deferred while human timing evidence is unavailable, because an automated scanner-vs-manual comparison would not answer the intended human-friction question. Proceed with Phase 6 correction/confidence work. Production scanner sequencing remains governed by D-035 and D-037.
