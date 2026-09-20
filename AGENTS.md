# AI Engineering Instructions

## Purpose

This file is the operating contract for AI-assisted work in this repository.

The repository is evolving from Pulse Counter into a focused shopping budget companion. The current code and the target documentation are intentionally not identical during the migration.

An agent must distinguish:

- what is already implemented
- what is target design
- what is explicitly out of scope

Never present target documentation as shipped functionality.

## Required reading order

Before changing code, read:

1. AGENTS.md
2. PRODUCT.md
3. FUNCTIONALITY.md and relevant SCENARIOS.md entries
4. DOMAIN.md
5. ARCHITECTURE.md
6. TECH-STACK.md
7. relevant docs/specs/* contracts
8. TESTING.md
9. UX.md / DESIGN.md for user-facing work
10. BRAND.md / MARKETING.md / docs/marketing/* for naming, copy, store, or launch work
11. docs/tech/TECHNOLOGY-RESEARCH.md when changing dependencies, frameworks, scanner/OCR, storage, PWA, hosting, or platform architecture
12. ROADMAP.md for the current implementation phase
13. other relevant docs/* for the concern being changed

For a narrow change, do not reread every long document once the relevant contract is known. Never skip PRODUCT.md, the relevant domain/spec contract, ARCHITECTURE.md, TECH-STACK.md, and the current roadmap phase.

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
- make remembered/scanned/estimated price origin explicit
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

At the time this contract was introduced, main still contains the Pulse Counter implementation:

- JavaScript
- counter reducer/model
- counter localStorage schema
- counter UI
- native View Transition orchestration
- pointer-reactive effects

Target shopping documentation describes planned migration.

When modifying a target area, first inspect the actual current code. Do not assume a documented target module already exists.

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

Authoritative roles:

- PRODUCT.md — what and why
- FUNCTIONALITY.md — what the product does, user-state flows, fallbacks, and P0/P1/P2 behaviour
- SCENARIOS.md — scenario matrix, edge cases, risk prioritisation, and target UX scores
- UX.md — interaction principles and usability rules
- DESIGN.md — visual system, hierarchy, branding restraint, and product storytelling
- DOMAIN.md — business rules
- ARCHITECTURE.md — software boundaries and trade-offs
- TESTING.md — quality contract
- docs/specs/MVP-SPEC.md — executable MVP requirements
- docs/specs/CONTRACTS.md — implementation contracts and ports
- docs/specs/STATE-MACHINES.md — valid transitions and forbidden states
- docs/specs/STORAGE-SCHEMA.md — exact persisted schema and completion recovery
- docs/specs/MONEY-SPEC.md — EUR-only parsing, formatting, arithmetic, limits, and money tests
- TECH-STACK.md — authoritative selected technologies, dependency budget, and phase admission
- docs/tech/TECHNOLOGY-RESEARCH.md — scored alternatives and current platform evidence
- BRAND.md — positioning, naming rules, voice, identity, and trust system
- MARKETING.md — acquisition, ASO, content, launch, pricing, and experimentation strategy
- docs/marketing/RESEARCH.md — platform guidance, competitor cases, and evidence quality
- docs/marketing/STORE-LISTING-SPEC.md — exact store metadata/assets contract
- docs/marketing/LAUNCH-CHECKLIST.md — marketing/release readiness gates
- ROADMAP.md — delivery order
- docs/COMPETITIVE-RESEARCH.md — external evidence and product lessons
- docs/DATA-PERSISTENCE.md — storage contract
- docs/ACCESSIBILITY.md — detailed accessibility contract

## Scope-control questions

Before adding a feature ask:

1. Does this help the shopper stay under the trip limit before checkout?
2. Does it reduce friction or increase confidence?
3. Can the simple manual workflow remain intact?
4. Does the core still work offline?
5. Is the feature proportionate to the problem?
6. Is this already scheduled later in ROADMAP.md?

If the answer to question 1 is no, stop and justify the feature before implementing it.

## Prohibited opportunistic expansion

Do not add, unless PRODUCT.md is intentionally revised with evidence:

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

TECH-STACK.md is authoritative.

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

- change matches TECH-STACK.md
- new dependency has a documented requirement and current-phase justification
- native/platform alternative was considered
- scanner/OCR code is lazy and optional
- no backend/state/router/UI framework is added opportunistically

### Functionality

- feature behaviour matches FUNCTIONALITY.md
- relevant scenarios in SCENARIOS.md are covered
- Tier 0 scenarios are not weakened
- optional services have a manual fallback
- no new metadata is required without clear value
- P0/P1/P2 scope is respected

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
