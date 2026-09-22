# AI Engineering Instructions

## Purpose

This file is the operating contract for AI-assisted work in this repository.

The repository ships a focused Shopping Budget Companion. Implementation and documentation must stay aligned; future capabilities remain phase-gated until they are implemented and validated.

An agent must distinguish:

- what is already implemented
- what is target design
- what is explicitly out of scope

Never present target documentation as shipped functionality.

## Required reading order

Before changing code, read:

1. AGENTS.md
2. docs/README.md to identify the owning source of truth
3. docs/PRODUCT.md
4. docs/DOMAIN.md and relevant docs/specs/* contracts
5. docs/ARCHITECTURE.md
6. docs/ROADMAP.md for the current phase and evidence gates
7. docs/TESTING.md for the applicable quality contract
8. docs/DESIGN.md for user-facing visual/interaction-system work
9. relevant supporting reference under docs/reference/* when deeper UX, scenario, technology, brand, or marketing context is needed
10. relevant specialized contracts such as docs/architecture/DATA-PERSISTENCE.md or docs/quality/ACCESSIBILITY.md
11. docs/research/* only when the change depends on research, alternatives, product strategy, or platform evidence
12. docs/archive/* only for historical traceability; archived execution plans are not current instructions

For a narrow change, do not reread every long document once the relevant contract is known. Never skip docs/PRODUCT.md, the relevant domain/spec contract, docs/ARCHITECTURE.md, and the current docs/ROADMAP.md phase. Use docs/README.md to resolve documentation authority.

## Product in one sentence

Help a shopper with a hard spending limit know how much they can still safely spend before checkout.

Primary product promise:

> Set your limit. Add prices. Always know what is left.

## Core product rules

MUST:

- keep remaining budget as the primary active-trip metric
- preserve fast manual price entry
- keep the core workflow usable offline
- persist committed shopping changes promptly
- represent canonical money in integer minor units
- keep price source and price confidence explicit and separate
- keep optional smart features recoverable to manual entry
- surface persistence failure
- keep tone non-judgmental

MUST NOT:

- require an account for the core workflow
- connect to a bank for the core workflow
- treat barcode identity as current price
- treat remembered price as current without confirmation
- commit OCR/scanner candidates without confirmation
- use floating-point money as canonical financial state
- put financial calculations in React components
- make animation callbacks responsible for money commits
- silently lose shopping-trip data
- turn the product into a general finance, grocery, meal-planning, or household platform

## Current repository reality

The repository is mid-migration.

Default/public path:

- Shopping Budget Companion is the only product shell
- its JavaScript counter model/UI, native View Transition orchestration, and pointer-reactive effects remain in the repository

Internal QA/beta variants use the same shopping product with evidence-only feature flags:

- strict TypeScript EUR money domain
- ShoppingTrip / CartItem domain and projections
- Zod-validated active-trip localStorage persistence
- plain-TypeScript ShoppingAppController + React `useSyncExternalStore`
- Calm Utility start/active/recovery/persistence-health UI
- manual price-entry flow, exact consequence projection, one-step Undo, Phase 6 edit/remove correction and trust metadata, browser/a11y hardening, and the automated/code portion of Phase 5 / B6

Still target-only or incomplete:

- representative human B6 timing, physical one-hand, software-keyboard, and bright-store evidence required before the public-shell switch
- repeat-trip acceleration / price memory
- PWA installability and later scanner/OCR phases
- repeat-trip acceleration and price memory
- installable offline PWA
- production scanner/OCR breadth

When modifying any area, inspect actual current code and the current roadmap slice. Never infer implementation solely from a target document.

## Architecture principles

### Proportionality

Choose the smallest architecture that protects real behaviour.

Do not add libraries, layers, services, or patterns merely because they sound production-grade.

### Domain independence

Business rules belong in pure domain modules.

The domain must not depend on React, DOM, storage, camera, OCR, network, or animation.

### Exact money

MVP supports EUR only.

All canonical monetary arithmetic uses integer cents.

Example:

- EUR 4.79 → 479
- EUR 50.00 → 5000

Do not widen currency support without an explicit documented decision and complete MONEY-SPEC coverage.

Formatting is presentation. Arithmetic is domain.

### Canonical state

Persist canonical inputs, not redundant derived totals.

Derive:

- cart total
- remaining
- safe remaining
- progress
- over-budget flags

from canonical trip/item state.

### Local-first

Core shopping state belongs on device for MVP.

Do not introduce a backend until a user requirement such as multi-device sync or cloud collaboration justifies it.

## UX rules

Frequent interactions happen in a supermarket aisle with limited attention.

Optimise for:

- one hand
- few taps
- large targets
- immediate feedback
- easy correction
- compact mobile screens
- poor network

Do not require product name/category/store for a simple price add.

Do not leave the numeric keypad unnecessarily active after commit.

Do not crowd the main screen with every capture method.

## Scanner rules

Barcode and price-tag scanning are optional accelerators.

### Barcode

Barcode identifies a product.

It normally does not provide an authoritative current store price.

A known barcode may surface a remembered price with date/store context, but the user must retain control over current-price confirmation.

### Price-tag scan

OCR output is candidate data.

Never mutate cart state before explicit confirmation.

Ambiguous labels must present candidates or fall back to manual entry.

### Failure

Scanner failure must never block:

- manual add
- cart view
- budget calculations
- undo
- trip completion

## Persistence rules

Every committed cart mutation should be persisted promptly.

Storage failure is a user-facing reliability condition, not a silent implementation detail.

If persistence is degraded:

- keep valid in-memory state usable
- mark degraded state
- tell the user clearly
- provide recovery/export if available

Do not claim data is saved when persistence failed.

## Motion rules

Preserve high-quality motion where it adds comprehension and delight.

Correct order:

1. user intent
2. domain commit
3. persistence attempt
4. render
5. optional visual feedback

Never delay or duplicate a financial mutation because of a View Transition.

Respect reduced motion.

## Accessibility rules

For the primary flow:

- frequent touch targets at least 48px
- keyboard operability
- visible focus
- no colour-only state
- meaningful screen-reader labels
- currency announced clearly
- 200% zoom resilience
- reduced-motion support
- forced-colours resilience

Automated axe success is necessary but not sufficient.

## Testing rules

Before finishing a change, run the strongest currently available local quality gates.

Current baseline before TypeScript migration:

- npm run lint
- npm test
- npm run build
- relevant Playwright tests

If npm run check already covers lint/tests/build, use it as the baseline aggregate.

After a typecheck script is introduced, typecheck becomes mandatory.

Every confirmed bug should gain a regression test at the lowest useful layer.

Money and persistence bugs require tests before the fix is considered complete.

## Documentation rules

Documentation is a contract.

When behaviour changes:

- update the smallest authoritative document
- do not duplicate detailed rules across many files
- keep current vs target status explicit
- update README only for shipped behaviour

Documentation roles:

Current authority is defined in docs/README.md.

Authoritative current contracts:

- docs/PRODUCT.md — product thesis, scope, principles, and success criteria
- docs/DESIGN.md — current visual and interaction-system direction
- docs/DOMAIN.md — business rules and invariants
- docs/ARCHITECTURE.md — software boundaries and trade-offs
- docs/TESTING.md — quality contract
- docs/ROADMAP.md — delivery order and evidence gates
- docs/specs/MVP-SPEC.md — executable MVP requirements
- docs/specs/CONTRACTS.md — implementation contracts and ports
- docs/specs/STATE-MACHINES.md — valid transitions and forbidden states
- docs/specs/STORAGE-SCHEMA.md — exact persisted schema and completion recovery
- docs/specs/MONEY-SPEC.md — EUR-only parsing, formatting, arithmetic, limits, and money tests
- docs/architecture/DATA-PERSISTENCE.md — specialized storage contract
- docs/quality/ACCESSIBILITY.md — specialized accessibility contract
- docs/DECISIONS.md — accepted product/architecture decisions

Supporting reference:

- docs/reference/FUNCTIONALITY.md — extended functional catalogue and fallbacks
- docs/reference/SCENARIOS.md — scenario matrix, edge cases, and risk analysis
- docs/reference/UX.md — detailed interaction heuristics
- docs/reference/TECH-STACK.md — technology rationale and future candidates
- docs/reference/BRAND.md — positioning, naming, voice, identity, and trust system
- docs/reference/MARKETING.md — acquisition, ASO, content, launch, pricing, and experimentation strategy
- docs/research/* — external evidence, alternatives, and strategic research
- docs/marketing/* — store and launch material
- docs/archive/* — historical execution context only

Supporting/reference material must not independently redefine current implementation status or override an authoritative contract.

## Scope-control questions

Before adding a feature ask:

1. Does this help the shopper stay under the trip limit before checkout?
2. Does it reduce friction or increase confidence?
3. Can the simple manual workflow remain intact?
4. Does the core still work offline?
5. Is the feature proportionate to the problem?
6. Is this already scheduled later in docs/ROADMAP.md?

If the answer to question 1 is no, stop and justify the feature before implementing it.

## Prohibited opportunistic expansion

Do not add, unless docs/PRODUCT.md is intentionally revised with evidence:

- bank sync
- income tracking
- bill tracking
- investments
- net worth
- savings dashboards
- meal planning
- recipes
- nutrition
- grocery delivery
- coupon marketplace
- loyalty platform
- social feed
- AI financial advice
- generic chatbot
- mandatory cloud backend

## Dependency policy

docs/reference/TECH-STACK.md is supporting technology rationale. Current dependency reality is defined by package.json/package-lock.json, current architecture decisions, and the applicable authoritative contracts.

Prefer native platform capabilities and existing dependencies when they satisfy requirements cleanly.

Before adding any dependency, answer:

1. Which documented requirement does it protect?
2. Can a platform API solve the problem cleanly?
3. Is the dependency allowed in the current roadmap phase?
4. What does it add to the initial bundle?
5. Does it work offline?
6. Does it add network/privacy/runtime requirements?
7. Can it be lazy-loaded?
8. What is its maintenance/security surface?
9. What is the removal/migration cost?
10. Does its benefit exceed its architectural surface?

Do not add these in MVP without a new documented decision:

- Redux Toolkit
- Zustand
- XState runtime
- React Router
- Tailwind
- CSS-in-JS runtime
- React Hook Form
- Motion/Framer Motion
- GSAP
- Axios
- TanStack Query
- Dexie
- date-fns/dayjs
- UUID packages
- backend/auth/database

Scanner/OCR dependencies are phase-gated and must stay out of the initial critical bundle.

Exception: after Phase 5, an isolated experimental scanner benchmark may be built exactly as defined by docs/ROADMAP.md and D-037. That experiment must not become a required production path or justify shipping scanner breadth without evidence.

## Code review checklist for AI

Before presenting work as complete verify:

### Product

- still solves the documented core job
- no accidental scope expansion

### Domain

- canonical/derived state remains clear
- money remains exact
- price source and confidence remain separate
- uncertainty remains explicit

### Specs

- numbered requirements affected by the change are identified
- state-machine transitions remain valid
- storage schema changes include migration/recovery
- application/adapter contract changes are deliberate
- money changes comply with docs/specs/MONEY-SPEC.md
- no parseFloat-based canonical money path is introduced
- EUR-only scope is preserved unless deliberately revised

### Technology

- change is compatible with the actual package/runtime configuration and docs/reference/TECH-STACK.md rationale
- new dependency has a documented requirement and current-phase justification
- native/platform alternative was considered
- scanner/OCR code is lazy and optional
- no backend/state/router/UI framework is added opportunistically

### Functionality

- feature behaviour matches docs/PRODUCT.md, applicable specs, and relevant docs/reference/FUNCTIONALITY.md reference
- relevant scenarios in docs/reference/SCENARIOS.md are covered
- Tier 0 scenarios are not weakened
- optional services have a manual fallback
- no new metadata is required without clear value
- P0/P1/P2 scope is respected
- repeat-trip work follows docs/research/PRODUCT-SUCCESS-STRATEGY.md
- scanner/OCR production work does not bypass the retention validation gate
- any early scanner work is limited to the D-037 benchmark contract

### UX

- remaining amount remains obvious
- common path did not gain unnecessary taps
- errors are recoverable

### Design

- product purpose is obvious without explanation
- one primary visual action remains dominant
- secondary controls are progressively disclosed
- brand styling does not overpower shopping information
- light/dark/large-text states remain coherent

### Brand / marketing

- message leads with pre-checkout remaining control, not generic finance or AI
- CartRoom is not treated as a final public name
- no marketing copy claims unshipped features
- store assets match STORE-LISTING-SPEC.md
- monetization does not contradict D-023
- material paid acquisition is not treated as required before retention evidence

### Reliability

- persistence path considered
- offline path considered
- optional capability failure considered

### Accessibility

- keyboard/focus semantics considered
- no colour-only state
- reduced motion preserved

### Quality

- tests updated
- relevant commands pass
- docs match shipped behaviour

## Commit discipline

Prefer small, meaningful commits that describe one logical change.

Do not mix:

- broad formatting cleanup
- architecture migration
- new feature behaviour
- unrelated documentation

in one commit unless inseparable.

Good examples:

- refactor: introduce exact money domain
- feat: add shopping trip selectors
- test: cover safe-limit boundaries
- docs: document price confidence rules

## Working style

When uncertain:

1. inspect current code
2. consult authoritative docs
3. preserve simpler behaviour
4. choose the reversible option
5. add evidence before expanding scope

The goal is not maximum code. The goal is a small product that feels unusually clear, reliable, and deliberate.
