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

## Phase 1 — exact money foundation

Suggested PR:

> refactor: introduce strict TypeScript money domain

### Scope

- add TypeScript configuration
- introduce integer minor-unit money helpers/types
- introduce currency boundary
- add exact parsing/formatting tests
- keep existing Pulse UI working during the migration where practical

### Must not include

- shopping redesign
- barcode scanning
- OCR
- PWA
- history dashboard

### Acceptance criteria

- no canonical floating-point money
- typecheck in CI
- domain tests cover representative and boundary values
- existing quality gates remain green

## Phase 2 — shopping trip domain

Suggested PR:

> feat: add shopping trip and cart domain

### Scope

- ShoppingTrip
- CartItem
- budget
- safety buffer
- quantity
- price origin
- pure selectors for totals and remaining values
- reducer or equivalent pure state transition layer

### Acceptance criteria

- EUR 50 budget scenarios calculate exactly
- over-budget is representable, not rejected
- safe and nominal remaining are distinct
- derived totals are not canonical state
- domain remains React/browser independent

## Phase 3 — persistence migration

Suggested PR:

> feat: persist versioned shopping trips safely

### Scope

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
- normal item can be added in roughly three seconds in usability testing/manual timing
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
- confirmed / remembered / scanned / estimated states in model and UI
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

## Phase 13 — polish and recruiter-grade evidence

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
4. relevant UX.md section
5. DESIGN.md for visual/user-facing work
6. relevant DOMAIN.md section
7. ARCHITECTURE.md
8. TESTING.md
9. this roadmap item

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

After the documentation foundation is complete, the recommended first code change is:

> Phase 1 — exact money foundation and strict TypeScript domain

That step creates the safest base for all later UI work.
