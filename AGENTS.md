# AI Engineering Instructions

## Purpose

This file is the routing contract for AI-assisted work in this repository.

The goal is to keep changes correct, small, reviewable, and aligned with the current Shopping Budget Companion product without forcing every task to load the entire documentation set.

## Product in one sentence

Help a shopper with a hard spending limit know how much they can still safely spend before checkout.

Primary promise:

> Set your limit. Add prices. Always know what is left.

## Source-of-truth order

When sources disagree, resolve them in this order:

1. current code and green executable tests for what is actually implemented
2. authoritative product/engineering contracts under `docs/`
3. accepted decisions in `docs/DECISIONS.md`
4. supporting reference and research
5. archived execution/history material

A green test does not authorize changing the product contract. If code and an authoritative document disagree, inspect the owning contract and reconcile both in the same change.

Never use `docs/archive/` as current implementation instruction.

## Load only the context the task needs

Always read:

- this file
- `docs/README.md`
- the code and tests directly affected by the task

Then load the owning documents:

| Change | Required context |
| --- | --- |
| product scope / behaviour | `PRODUCT.md`, relevant spec |
| money / trip rules | `DOMAIN.md`, `specs/MONEY-SPEC.md` or relevant spec |
| application/controller | `ARCHITECTURE.md`, relevant state-machine/spec |
| persistence / recovery | `ARCHITECTURE.md`, `architecture/DATA-PERSISTENCE.md`, storage spec |
| UI / interaction | `PRODUCT.md`, `DESIGN.md`, accessibility contract when relevant |
| tests / CI | `TESTING.md` |
| sequencing / new capability | `ROADMAP.md`, relevant decision/research |
| brand / marketing | supporting brand/marketing docs only after product contracts |

Do not reread every long document for a narrow fix. Prefer the smallest authoritative context that owns the rule.

## Current repository reality

The repository ships one public product: Shopping Budget Companion.

Implemented:

- exact EUR money in integer minor units
- ShoppingTrip / CartItem domain rules and projections
- local-first active-trip and completed-history persistence
- persistence failure/recovery UX
- application controller + `useSyncExternalStore` React bridge
- start, active-trip, edit/remove/Undo, budget adjustment, completion and history flows
- Shop again, Recent Items and local Price Memory
- independent history and Price Memory deletion
- timing QA and retention-beta evidence tooling
- Chromium / Firefox / WebKit browser and accessibility coverage

Still evidence- or roadmap-gated:

- representative human one-hand/timing/bright-store validation
- real-shopper second-/third-trip retention evidence
- installable offline PWA
- production barcode and shelf-label OCR breadth

Internal `/qa/` and `/beta/` routes are evidence surfaces for the same product. They must not become alternate product shells or canonical business-state owners.

## Non-negotiable product rules

MUST:

- keep remaining safe spending as the primary active-trip metric
- preserve fast manual price entry
- keep the core business flow independent of accounts and external services
- persist committed financial mutations promptly
- surface degraded durability honestly
- keep price source and price confidence explicit
- make corrections immediate and reversible where the contract supports them
- keep tone neutral and non-judgmental

MUST NOT:

- use binary floating point as canonical money
- put financial arithmetic in React components
- treat a barcode as an authoritative current price
- treat remembered/OCR/scanned values as current without explicit confirmation
- make animation or telemetry callbacks responsible for financial mutations
- silently discard malformed/future persisted data
- make QA evidence canonical product state
- expand into general personal finance, meal planning, grocery delivery, banking, or household management without a new product decision

## Architecture boundary

The intended dependency direction is:

```text
React feature UI
      ↓
application controller + public application contracts
      ↓
pure domain rules / selectors
      ↓
application ports
      ↓
browser infrastructure adapters
```

Rules:

- `domain/` is pure and must not depend on React, DOM, storage, network, camera, OCR, or animation.
- `application/` owns lifecycle/orchestration and persistence ordering, not presentation.
- `infrastructure/` implements browser/storage boundaries and runtime validation.
- `features/` owns rendering, drafts, focus, accessibility, and interaction feedback.
- `qa/` records evidence only and must never become product authority.
- the composition root is the only place that wires browser adapters to the application controller.

Public application interfaces belong in `src/application/shopping-app-contracts.ts`. Controller implementation details belong in `shopping-app-controller.ts`.

Prefer cohesive extraction when a file mixes contracts, orchestration, serialization, rendering, or evidence responsibilities. Do not split files merely to satisfy a line-count target.

## Money rules

MVP currency scope is EUR.

- EUR 4.79 is stored as 479 minor units.
- All canonical money values are safe integers.
- Formatting/parsing are boundary concerns.
- Derived totals are recalculated from canonical trip/item state.
- Never persist redundant totals that can drift from canonical inputs.

## Persistence rules

Committed shopping state has higher priority than convenience state.

- active-trip/history writes must fail closed and expose degraded health
- completion must make durable history safe before active-trip cleanup
- stale active copies of already completed trips must reconcile safely on startup
- malformed or unsupported-future data must not be guessed into validity
- Price Memory is advisory and independently durable
- Price Memory failure must not invalidate a durably completed trip
- local-data deletion controls must remain explicit

## UI and accessibility rules

Optimise the aisle workflow for:

- one hand
- few taps
- large touch targets
- immediate consequence feedback
- easy correction
- compact mobile screens
- poor or absent network after the app is loaded

Manual entry is always the fallback.

Keyboard, focus, reduced-motion, large-text and forced-colour behaviour are release concerns, not optional polish.

## Testing contract

For code changes, run the smallest meaningful test set during iteration and the full gate before merge.

Repository gate:

```bash
npm ci
npm run check
npm run test:e2e
```

`npm run check` covers lint, strict TypeScript, unit/component tests and production build.

Add or update tests when changing:

- money/domain invariants
- application lifecycle or persistence ordering
- recovery behaviour
- UI financial consequences
- history/Price Memory semantics
- evidence-integrity logic

A money, persistence, recovery or evidence-integrity bug fix is incomplete without a regression test.

## Documentation maintenance

Current authoritative docs describe current contracts and current next decisions, not a chronological diary.

When behaviour changes:

1. change code/tests
2. update the smallest authoritative document that owns the rule
3. update a detailed spec only when its executable contract changed
4. add a decision only for cross-cutting/reversibility-sensitive choices
5. move completed execution detail to `docs/archive/` instead of leaving stale status in current docs

Do not duplicate implementation-status checklists across README, architecture, roadmap and specs.

Use exact language:

- **implemented** — present in current code
- **validated** — backed by the required evidence
- **planned / gated** — not current behaviour

Never promote automated evidence into a human-validation claim.

## Change workflow

Before editing:

1. inspect current branch/head
2. inspect the affected implementation and tests
3. identify the owning authoritative contract
4. state the invariant the change must preserve

While editing:

1. make the smallest coherent change
2. keep domain/application/infrastructure boundaries intact
3. avoid unrelated dependency or style churn
4. preserve backward/recovery semantics unless the task explicitly changes them
5. update tests with the behaviour

Before declaring complete:

1. verify code ↔ docs ↔ tests alignment
2. run quality gates
3. inspect changed-file scope for accidental churn
4. confirm no generated/build artifacts entered the repository
5. describe any human/evidence gate that remains unverified

## Dependency policy

Runtime dependencies must earn product value.

Prefer native Web APIs and existing abstractions. Do not add state libraries, routers, backends, analytics SDKs, scanner/OCR SDKs, PWA tooling, or UI frameworks unless the product requirement justifies their cost and the roadmap/decision gate allows them.

## Git discipline

- use focused commits
- do not mix large refactors with feature behaviour unless required
- preserve history rather than rewriting accepted decisions
- prefer a PR for multi-file architecture/documentation changes
- do not claim CI is green until the actual run is green

## Review questions

Before merge, ask:

- Did the user-facing behaviour change intentionally?
- Are money and derived values still exact?
- Can a failed write lose or misrepresent a trip?
- Did a convenience subsystem become coupled to core durability?
- Did React gain business logic that belongs in domain/application?
- Does the documentation now describe the current code rather than a past phase?
- Did this change reduce or increase the context an AI contributor must load?
