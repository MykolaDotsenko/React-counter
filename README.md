# Shopping Budget Companion

A **mobile-first, local-first shopping budget companion** built to answer one question while you shop:

> **How much can I still safely spend before checkout?**

[![Quality](https://github.com/MykolaDotsenko/shopping-budget-companion/actions/workflows/quality.yml/badge.svg)](https://github.com/MykolaDotsenko/shopping-budget-companion/actions/workflows/quality.yml)
[![React](https://img.shields.io/badge/React-19.3-20232a?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-6.0-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

**Live app:** https://mykoladotsenko.github.io/shopping-budget-companion/

---

## Why this project is interesting

This is not a generic expense tracker.

The product is deliberately optimized for a narrow in-store job:

> **set a spending limit → add prices quickly → always know what remains**

The engineering challenge is making that simple interaction trustworthy:

- exact financial arithmetic
- durable local persistence
- explicit degraded-storage states
- fast one-hand mobile interaction
- reversible corrections
- repeat-trip acceleration without pretending remembered prices are current
- accessibility across keyboard, reduced motion, large text, forced colours, and multiple browser engines
- evidence-driven release gates instead of unsupported product claims

There is no required account, backend, bank connection, camera, or network service in the core flow.

---

## Product flow

### 1. Start a trip

Choose a quick budget or enter a custom EUR amount.

Optionally reserve a safety buffer.

### 2. Add prices

The common path is intentionally short:

1. tap **Add price**
2. enter the price
3. optionally change quantity
4. review projected remaining
5. commit

Canonical money is stored in integer minor units:

```text
€4.79  → 479
€50.00 → 5000
```

No floating-point value is used as canonical financial state.

### 3. See what remains

The active screen is **remaining-first**, not spent-first.

It distinguishes:

- safe remaining
- nominal remaining
- safety-buffer use
- nominal over-budget state

Crossing the safety buffer is informational.

Crossing the nominal budget requires explicit confirmation.

### 4. Correct mistakes safely

Supported corrections include:

- Backspace / Clear / Cancel before commit
- one-step Undo
- edit price
- edit quantity
- remove item
- adjust budget and safety buffer during an active trip

### 5. Finish and reuse

Completed trips are stored separately from the active trip.

Returning shoppers can:

- **Shop again** with the previous spending plan
- inspect lightweight trip history
- reuse Recent Items
- use local Price Memory
- always choose **Enter current price** instead

Remembered prices remain explicitly advisory and visibly dated.

---

## Engineering highlights

### Exact money domain

Financial logic lives in a pure TypeScript domain layer.

React does not independently calculate:

- line totals
- cart total
- remaining budget
- safe remaining
- over-budget state

Property-based tests cover money and domain invariants.

### Local-first durability

Persistence is:

- versioned
- runtime-validated with Zod
- reconstructed through domain constructors
- isolated from React
- explicit about degraded writes

If a valid in-memory mutation cannot be persisted, the app keeps the valid state visible and reports degraded durability instead of pretending it was saved.

### Loss-safe completion and history

Trip completion uses reconciliation-aware persistence.

Important cases are covered:

- history write succeeds before active-trip cleanup
- failed history write keeps the active trip recoverable
- stale active copies are reconciled without duplicating completed trips
- destructive history changes use persist-before-publish semantics

### Independent Price Memory

Price Memory is a separate advisory persistence concern.

That separation prevents a Price Memory failure from degrading an otherwise healthy active cart/history record.

### One canonical application state

The application uses a plain TypeScript `ShoppingAppController` plus `useSyncExternalStore`.

No Redux, Zustand, XState, router, or backend is required for the current product.

---

## Architecture

```text
React UI
   ↓
ShoppingAppController
   ↓
Pure domain + selectors
   ↓
Application ports
   ↓
Browser infrastructure adapters
```

Responsibilities stay deliberately narrow:

| Layer | Owns |
| --- | --- |
| **Domain** | money, trip invariants, projections, selectors |
| **Application** | lifecycle, commands, Undo, persistence ordering, recovery |
| **Infrastructure** | storage schemas, localStorage adapters, runtime boundaries |
| **UI** | rendering, drafts, focus, accessibility, interaction feedback |
| **QA** | timing and retention evidence that never becomes product state |

See [ARCHITECTURE.md](./ARCHITECTURE.md).

---

## Tech stack

### Runtime

- React 19.3
- TypeScript 6 strict
- Vite 8
- Zod 4
- CSS Modules
- native Web APIs
- versioned `localStorage`

### Quality

- ESLint 10
- Vitest 5
- React Testing Library
- `@testing-library/user-event`
- fast-check
- Playwright
- `@axe-core/playwright`
- GitHub Actions

The dependency budget is intentionally small. A dependency is added only when a product requirement earns it.

---

## Quality gates

Core gate:

```bash
npm ci
npm run check
```

`npm run check` runs:

1. ESLint
2. strict TypeScript
3. unit/component tests
4. production build

Browser gate:

```bash
npm run test:e2e
```

CI runs browser and accessibility coverage independently in:

- Chromium
- Firefox
- WebKit

Automated coverage also includes:

- 360×800 and 390×844 mobile layouts
- 200% text sizing
- reduced motion
- keyboard/focus behavior
- forced-colours critical paths
- axe WCAG A/AA checks
- active-trip reload/restore
- storage failure and recovery
- exact-money flagship journeys
- independent history / Price Memory deletion semantics
- guarded QA and retention-beta builds

---

## Validation builds

The public root is the actual Shopping Budget Companion.

Two separate internal builds support evidence collection:

### Timing QA

https://mykoladotsenko.github.io/shopping-budget-companion/qa/

Used for representative one-hand timing and physical usability evidence.

The documented manual-entry target remains **unverified until real-device evidence is collected**. Automated Playwright timings are not used as a substitute for human interaction data.

### Retention beta

https://mykoladotsenko.github.io/shopping-budget-companion/beta/

Used for the Phase 8 real-store retention study.

The beta recorder is local-only and intentionally excludes:

- prices
- budgets
- item names
- store history
- account identity
- network telemetry

Real second-trip / third-trip validation is still pending.

See [docs/RETENTION-BETA-PLAYBOOK.md](./docs/RETENTION-BETA-PLAYBOOK.md).

---

## Current status

### Engineering

- ✅ exact EUR money model
- ✅ shopping trip domain
- ✅ local-first active-trip persistence
- ✅ remaining-first UI
- ✅ fast manual price entry
- ✅ quantity and projected totals
- ✅ reserve / over-budget states
- ✅ Undo, edit, remove, budget adjustment
- ✅ persistence-health and recovery UX
- ✅ trip completion and reconciliation
- ✅ lightweight completed-trip history
- ✅ Shop again
- ✅ Recent Items
- ✅ Price Memory
- ✅ local-data controls
- ✅ privacy-safe retention evidence harness
- ✅ cohort-level retention analysis
- ✅ Chromium / Firefox / WebKit CI

### Evidence still pending

- ⏳ representative real-device one-hand timing
- ⏳ bright-store / software-keyboard physical validation
- ⏳ 20–50 real-shopper retention beta
- ⏳ measured second-trip and third-trip behavior

PWA, barcode, and OCR breadth remain intentionally gated behind product evidence.

---

## Repository structure

```text
src/
├── app/             # composition root + shopping shell
├── application/     # controller, ports, React bridge
├── domain/          # exact money, shopping trip, Price Memory
├── features/
│   └── shopping/    # product UI
├── infrastructure/  # storage + browser adapters
└── qa/              # timing / retention evidence

tests/               # unit + component + application tests
e2e/                 # Playwright browser/a11y journeys
docs/                # detailed product, QA, and technical contracts
```

---

## Run locally

Requirements:

- Node.js 24+
- npm

```bash
git clone https://github.com/MykolaDotsenko/shopping-budget-companion.git
cd shopping-budget-companion
npm ci
npm run dev
```

Production build:

```bash
npm run build
npm run preview
```

---

## Key documentation

The repository is documentation-driven, but the main entry points are intentionally limited:

- [PRODUCT.md](./PRODUCT.md) — product thesis and scope
- [ROADMAP.md](./ROADMAP.md) — implementation sequence and evidence gates
- [ARCHITECTURE.md](./ARCHITECTURE.md) — ownership and dependency boundaries
- [DOMAIN.md](./DOMAIN.md) — business invariants
- [TESTING.md](./TESTING.md) — quality strategy
- [docs/DATA-PERSISTENCE.md](./docs/DATA-PERSISTENCE.md) — storage and recovery contract
- [docs/SPRINT-B-QUALITY-GATE.md](./docs/SPRINT-B-QUALITY-GATE.md) — human timing evidence contract
- [docs/RETENTION-BETA-PLAYBOOK.md](./docs/RETENTION-BETA-PLAYBOOK.md) — real-store retention protocol

Detailed specs remain under [docs/specs/](./docs/specs/).

---

## Design philosophy

The interface follows a **Calm Utility** direction:

- clear remaining-first hierarchy
- warm neutral surfaces
- one dominant action
- restrained semantic colour
- light mode suitable for bright stores
- dark-mode equivalent
- predictable focus
- reduced-motion equivalence
- no colour-only financial meaning

The UI is intentionally less decorative than many portfolio demos because the product's job is to stay understandable while someone is actively shopping.

---

## What this project demonstrates to a reviewer

This repository is primarily a case study in:

- translating a real product constraint into domain rules
- designing exact-money state instead of UI-level arithmetic
- handling persistence failure honestly
- keeping architecture proportional
- separating product state from QA evidence
- testing risky user journeys across browser engines
- building accessibility into interaction contracts
- using empirical gates to decide what **not** to build yet

The goal is not framework breadth.

It is a small product that is technically disciplined, testable, and explicit about what has — and has not — been validated.
