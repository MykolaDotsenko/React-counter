# AI Engineering Instructions

## Purpose

This file is the routing contract for AI-assisted work.

The repository ships one focused product: **Shopping Budget Companion**. AI changes must improve or preserve user value, premium quality, competitive differentiation, reliability, and development clarity without adding speculative complexity.

## Product in one sentence

Help a shopper with a hard spending limit know how much they can still safely spend before checkout.

Primary promise:

> Set your limit. Add prices. Always know what is left.

## Source-of-truth order

When sources disagree:

1. current code and green executable tests establish what is implemented;
2. authoritative documents under `docs/` establish intended current behaviour;
3. accepted decisions in `docs/DECISIONS.md` explain durable choices;
4. supporting reference/research explains rationale;
5. `docs/archive/` is historical only.

If code and an authoritative contract disagree, treat that as drift and reconcile both in the same change.

Never use archive material as current implementation instruction.

## Load only the context the task needs

Always read:

- this file;
- `docs/README.md`;
- affected code and tests.

Then load only the owning contract:

| Change | Required context |
| --- | --- |
| product scope / feature | `PRODUCT.md`, relevant spec |
| money / trip rules | `DOMAIN.md`, relevant money/state spec |
| controller / lifecycle | `ARCHITECTURE.md`, state machine |
| persistence / recovery | `ARCHITECTURE.md`, data-persistence + storage schema |
| UI / interaction | `PRODUCT.md`, `DESIGN.md`, accessibility contract |
| tests / CI | `TESTING.md` |
| new capability / sequencing | `ROADMAP.md`, relevant decision/research |
| brand / marketing | `PRODUCT.md` first, then brand/marketing reference |

Do not load research, archive or long rationale unless the task needs it.

## Current repository reality

Implemented:

- exact EUR money in integer minor units;
- ShoppingTrip / CartItem domain rules and projections;
- local-first active-trip and completed-history persistence;
- degraded persistence and recovery UX;
- start, active trip, edit/remove/Undo, budget adjustment, completion and history;
- Shop again, Recent Items and local Price Memory;
- independent local-data controls;
- timing QA and retention-beta evidence tooling;
- Chromium / Firefox / WebKit browser and accessibility coverage.

Gated / not implemented:

- installable offline PWA shell;
- production barcode identification;
- production shelf-label OCR;
- representative human one-hand/timing/bright-store validation;
- real-shopper second-/third-trip retention validation.

Internal `/qa/` and `/beta/` routes are evidence surfaces for the same product, not alternate product shells.

## Product decision rule

For any meaningful user-facing change, evaluate all five dimensions:

1. **User usefulness** — does it help the shopper complete the core job?
2. **Interaction friction** — does it reduce taps, typing, waiting, recall or correction cost?
3. **Premium quality** — does it improve precision, hierarchy, polish, feedback, consistency or perceived quality without harming clarity?
4. **Competitive differentiation** — does it strengthen a reason to choose this product over a calculator, notes app or competing shopping-budget tool?
5. **Reliability / accessibility** — does it preserve correctness, durability, privacy, performance and inclusive use?

Prefer the option that improves the combined product outcome, not the option with the most technology or the fewest lines of code.

A visually impressive change that slows the aisle workflow is not premium.

A frictionless change that makes the product generic or visually cheap is also incomplete.

## Non-negotiable product rules

MUST:

- keep remaining safe spending as the primary active-trip metric;
- preserve fast manual price entry;
- keep the core business flow usable without accounts or mandatory external services;
- persist committed financial mutations promptly;
- surface degraded durability honestly;
- keep price source and confidence explicit;
- keep optional smart features recoverable to manual entry;
- keep tone calm and non-judgmental;
- preserve a polished, coherent and distinctive product experience.

MUST NOT:

- use binary floating point as canonical money;
- put financial mutation rules in React components;
- treat barcode identity as authoritative current price;
- treat remembered/OCR/scanned values as current without confirmation;
- make animation or evidence callbacks responsible for financial mutations;
- silently discard malformed/future persisted data;
- let QA evidence become canonical product state;
- expand into general finance, meal planning, grocery delivery, banking or household management without a product decision.

## Architecture boundary

Dependency direction:

```text
React feature UI
      ↓
application controller / use cases / contracts
      ↓
pure domain rules
      ↓
application ports
      ↓
browser infrastructure adapters
```

Rules:

- `domain/` is pure and browser/framework independent;
- `application/` owns lifecycle, orchestration and persistence ordering;
- `infrastructure/` owns runtime validation and browser/storage adapters;
- `features/` owns rendering, drafts, focus and interaction feedback;
- `qa/` records evidence only;
- the composition root wires adapters to the application layer.

Extract by **reason to change**, not line count.

Do not introduce a framework, service layer or state library unless the product needs it.

## Money rules

Current currency scope is EUR.

- canonical money uses safe integer minor units;
- formatting/parsing are boundaries;
- derived totals are recalculated from canonical state;
- redundant derived financial totals are not persisted.

## Persistence rules

Core durability outranks convenience state.

- history must be durable before active-trip cleanup on completion;
- a failed history write must not erase the active trip;
- stale active copies of completed trips must reconcile safely;
- malformed/future data must not be guessed into validity;
- Price Memory is advisory and independently durable;
- Price Memory failure must not invalidate a durably completed trip;
- deletion controls remain explicit.

## UI / design rules

Optimise the aisle workflow for:

- one hand;
- few taps;
- large touch targets;
- immediate consequence feedback;
- easy correction;
- compact mobile screens;
- poor or absent network after initial load.

Premium means:

- precise visual hierarchy;
- stable typography and money layout;
- restrained, purposeful motion;
- polished states and transitions;
- strong spacing and surface consistency;
- clear affordances;
- trustworthy feedback;
- distinctive but restrained brand expression.

Premium does **not** mean ornamental complexity, hidden controls, animation delays, glass effects everywhere or decorative dashboards.

Manual entry is always the fallback.

Accessibility is release quality, not optional polish.

## Testing contract

During iteration run the smallest useful test set; before merge run the full repository gate:

```bash
npm ci
npm run check
npm run test:e2e
```

`npm run check` covers lint, strict TypeScript, unit/component tests and production build.

Add regression coverage when changing:

- money/domain invariants;
- lifecycle/persistence ordering;
- recovery;
- UI financial consequences;
- history/Price Memory semantics;
- evidence-integrity logic.

Money, persistence, recovery and evidence-integrity bug fixes are incomplete without regression tests.

## Documentation maintenance

Current authoritative docs contain current contracts and current decisions, not chronological implementation narration.

When behaviour changes:

1. update code/tests;
2. update the smallest owning authoritative document;
3. update detailed specs only when their contract changed;
4. add a decision only for cross-cutting/reversibility-sensitive choices;
5. move useful historical rationale to reference/archive;
6. delete duplicated status narration.

Use only these status words for current docs:

- **IMPLEMENTED**
- **VALIDATED**
- **PLANNED / GATED**
- **HISTORICAL**

Do not infer human validation from automation.

## Change workflow

Before editing:

1. inspect current code/tests;
2. identify the owning contract;
3. state the invariant and user outcome to preserve.

While editing:

1. make the smallest coherent change;
2. protect layer boundaries and durability semantics;
3. avoid unrelated dependency/style churn;
4. update tests with behaviour;
5. prefer solutions that improve convenience and premium quality together.

Before declaring complete:

1. verify code ↔ docs ↔ tests;
2. run quality gates;
3. inspect changed-file scope;
4. confirm no generated/build artifacts entered the repo;
5. disclose any unverified human/evidence gate.

## Dependency policy

Runtime dependencies must earn product value.

Prefer native Web APIs and existing abstractions. Do not add state libraries, routers, backends, analytics SDKs, scanner/OCR SDKs, PWA tooling or UI frameworks without a validated requirement.

## Git discipline

- focused commits;
- no unrelated refactor + feature bundles;
- preserve accepted decision history;
- prefer PRs for multi-file architecture/documentation changes;
- never claim CI is green until the run is green.

## Review questions

Before merge:

- Is the user-facing behaviour intentionally better or unchanged?
- Is the common workflow still fast and obvious?
- Does the product still feel polished and distinctive rather than generic?
- Are money and derived values exact?
- Can a failed write lose or misrepresent a trip?
- Did convenience state become coupled to core durability?
- Did React gain business logic?
- Did documentation become more current and less duplicated?
- Did the change reduce or increase future AI context cost?
