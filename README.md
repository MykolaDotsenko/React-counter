# Pulse Counter → Shopping Budget Companion

A small React counter that evolved into a disciplined **product-migration and interaction-engineering case study**.

> **Repository status:** the public/default build is still Pulse Counter. The shopping-budget replacement is implemented behind a guarded feature flag and has passed its automated Sprint B quality gate. The final real-device one-hand timing validation is still required before the shopping shell can become the public default.

The repository deliberately separates **implemented**, **guarded**, and **future** capabilities instead of presenting roadmap ideas as shipped features.

## Live builds

### Public demo — Pulse Counter

https://mykoladotsenko.github.io/shopping-budget-companion/

This remains the default GitHub Pages experience until the shopping replacement passes its empirical release gate.

### Guarded retention beta

A separate internal beta build is published at:

> `https://mykoladotsenko.github.io/shopping-budget-companion/beta/`

It runs the guarded shopping product with a local privacy-safe retention evidence recorder.

It records behavioural structure only—trip starts/finishes, item-count milestones, manual-entry duration/abandonment, remembered-item reuse, and current-price override. It does **not** record prices, budgets, item names, stores, checkout totals, or transmit analytics.

This route exists to support the documented 20–50 real-shopper retention gate. It does not mean that retention has been validated.

See [docs/RETENTION-BETA.md](./docs/RETENTION-BETA.md) for the evidence schema, privacy boundary, reset/export rules, and study protocol.

## Guarded shopping QA

https://mykoladotsenko.github.io/shopping-budget-companion/qa/

The QA route is a separate internal build used for real-device timing and usability validation. It is statically marked noindex/nofollow/noarchive and does not change the public Pulse Counter bundle.

---

## What this repository demonstrates

The interesting part of this project is no longer the counter itself.

The repository now demonstrates how to migrate a polished but narrow UI experiment into a real product domain without discarding correctness, accessibility, interaction quality, or architectural proportionality.

The target product answers one question:

> **How much can I still safely spend before checkout?**

The core loop is intentionally narrow:

> **set a limit → add prices → always know what is left**

No account.  
No bank connection.  
No mandatory backend.  
No scanner dependency.  
Manual price entry remains the baseline.

---

## Current implementation status

| Area | Status |
| --- | --- |
| Public Pulse Counter shell | ✅ shipped |
| Exact EUR money model | ✅ implemented |
| ShoppingTrip / CartItem domain | ✅ implemented |
| Remaining-first active screen | ✅ implemented |
| Safety buffer | ✅ implemented |
| Manual price entry | ✅ implemented |
| Quantity | ✅ implemented |
| Exact projected remaining | ✅ implemented |
| Reserve / over-budget states | ✅ implemented |
| Canonical add + persistence | ✅ implemented |
| One-step Undo | ✅ implemented |
| Edit/remove correction flow | ✅ implemented |
| Atomic budget + safety-buffer adjustment | ✅ implemented |
| Persistence-health UX | ✅ implemented |
| Recovery from malformed/future saved state | ✅ implemented |
| Reload / restore active trip | ✅ implemented |
| 360×800 / 390×844 mobile gate | ✅ automated |
| 200% text resilience | ✅ automated |
| Reduced-motion flow | ✅ automated |
| Chromium / Firefox / WebKit | ✅ automated |
| Axe accessibility gate | ✅ automated |
| Runtime core with network offline | ✅ automated |
| Real-device one-hand timing | ⏳ pending |
| Public shopping-shell switch | ⛔ blocked until empirical gate passes |
| Completion/history/reconciliation | ✅ implemented |
| Lightweight budget-outcome history | ✅ implemented |
| Shop again / recent-budget shortcut | ✅ implemented |
| Recent Items | ✅ implemented |
| Local product identity + Price Memory | ✅ implemented |
| Freshness + current-price override | ✅ implemented |
| Store-aware matching foundation | ✅ implemented |
| User-facing store context | optional Phase 8 follow-up |
| Guarded privacy-safe retention beta | ✅ implemented |
| Real-user retention validation | ⏳ pending |
| PWA cold offline launch | blocked until retention gate |
| Barcode / OCR scanning | evidence-gated later work |

See [ROADMAP.md](./ROADMAP.md) for the authoritative sequence.

---

## Shopping flow implemented today

### Start

The guarded shopping shell begins with one question:

> **How much can you spend today?**

It supports:

- quick budget values
- custom EUR budget
- optional safety buffer
- no account or profile setup

### Returning trip

When completed history exists, the guarded shell offers **Shop again** using the most recent validated spending plan.

It reuses only:

- budget
- safety buffer

It deliberately creates a new trip with a new id/time and an empty cart. The completed trip remains immutable history.

### Recent Items and Price Memory

After a named, confirmed item is part of a **durably completed trip**, the guarded shopping shell can remember its last observed price locally.

Rules:

- the remembered price is advisory, not live
- observation age is visible
- one tap can reuse a familiar remembered price
- crossing the nominal budget still requires explicit confirmation
- **Enter current price** always remains available
- choosing the current-price path preserves the product name while using the ordinary manual confirmed-price flow
- using a remembered price keeps `priceSource=price-memory` and `priceConfidence=remembered`
- simply finishing a trip with an unchanged remembered price does not falsely refresh its observation date
- Price Memory has its own versioned storage record and cannot make the active cart unsavable

Manual price entry remains the universal baseline.

### Active trip

The primary metric is **remaining capacity**, not money already spent.

The screen shows:

- safe amount remaining
- cart total relative to budget
- spent progress
- explicit safe-limit boundary
- visible reserve zone
- recent cart items
- one dominant **Add price** action
- persistence warning when saving is degraded

### Add price

Common flow:

1. tap **Add price**
2. enter the price
3. optionally adjust quantity
4. inspect projected remaining
5. commit

Example:

~~~text
€1.29 × 3 = €3.87
~~~

The projection comes from domain logic before commit.

### Safety buffer

Budget and safety buffer can be adjusted during an active trip without mutating cart prices or quantities.

Example:

~~~text
Nominal budget   €50.00
Safety buffer     €2.00
Safe limit       €48.00
~~~

Crossing only the safety buffer is informational and does **not** introduce a second confirmation step.

Crossing the nominal budget requires explicit **Add anyway / Cancel** confirmation.

### Correction and active-trip adjustment

Implemented correction support includes:

- Backspace
- Clear
- Cancel
- one-action Undo after add/edit/remove
- edit price and quantity
- remove item
- adjust budget and safety buffer as one atomic canonical mutation

Budget adjustment deliberately preserves cart items. Lowering the budget below the current cart total is allowed and immediately produces the explicit over-budget state required by the product contract.

Undo restores the exact previous canonical cart snapshot and immediately attempts persistence. Budget/buffer adjustment is intentionally not added to the one-step cart Undo slot.

---

## Exact money by construction

Canonical financial state never uses floating-point prices.

~~~text
€4.79  → 479
€50.00 → 5000
~~~

Money arithmetic lives in the pure TypeScript domain layer using integer minor units.

React does not independently calculate:

- line totals
- cart totals
- remaining budget
- reserve use
- over-budget state

See [DOMAIN.md](./DOMAIN.md) and [docs/specs/MONEY-SPEC.md](./docs/specs/MONEY-SPEC.md).

---

## Architecture

The shopping migration uses one canonical application state and a deliberately small dependency graph.

~~~text
React UI / feature components
            ↓
ShoppingAppController
            ↓
Pure TypeScript domain + selectors
            ↓
application ports
            ↓
browser infrastructure adapters
~~~

Key rules:

- **domain owns business truth**
- React renders state and sends intent
- React does not perform storage writes
- React does not own financial arithmetic
- persistence happens in the application command path
- infrastructure never becomes a source of money truth
- one canonical in-memory application snapshot exists
- no Redux, Zustand or XState runtime is used

The plain-TypeScript ShoppingAppController owns lifecycle, canonical trip state, commands, persistence ordering, degraded durability, recovery and one-step Undo.

React reads the controller through useSyncExternalStore.

### Persistence ordering

~~~text
validate intent
    ↓
compute valid domain state
    ↓
attempt synchronous persistence
    ↓
publish canonical application state
    ↓
render
    ↓
optional visual feedback
~~~

If storage fails, the valid cart remains visible in memory and the UI reports degraded durability instead of pretending the trip was saved.

See [ARCHITECTURE.md](./ARCHITECTURE.md).

---

## Persistence and recovery

Active-trip persistence is:

- local-first
- versioned
- validated with Zod at the untrusted JSON boundary
- reconstructed through domain constructors
- isolated from React

Failure behavior is explicit:

- malformed saved data is not silently reinterpreted
- unsupported future versions enter recovery
- failed writes do not roll back valid in-memory cart state
- the UI never falsely claims that data was saved
- retry is available when technically meaningful

See [docs/DATA-PERSISTENCE.md](./docs/DATA-PERSISTENCE.md).

---

## Design system: Calm Utility

The shopping interface intentionally moved away from the visual spectacle of the original Pulse Counter.

Target feel:

> **calm, precise, practical, one-hand friendly**

Design priorities:

- remaining-first hierarchy
- large tabular money values
- warm neutral surfaces
- restrained semantic colour
- light mode as a first-class supermarket mode
- dark-mode equivalent
- visible focus
- reduced-motion equivalence
- forced-colours support
- no colour-only financial state

The progress model is:

> **spent → safe-limit boundary → reserve**

The reserve zone uses structural/pattern treatment so it remains understandable without relying only on colour.

See [DESIGN.md](./DESIGN.md) and [UX.md](./UX.md).

---

## Accessibility and browser quality

Automated coverage includes:

- semantic landmarks
- keyboard operation
- focus restoration
- over-budget focus management
- Escape recovery
- 48px frequent controls
- 200% text sizing
- reduced motion
- forced colours
- no colour-only reserve state
- axe WCAG A/AA checks
- Chromium
- Firefox
- WebKit

Axe coverage includes the start screen, active-trip screen, price-entry surface and nominal over-budget review.

Accessibility automation is treated as evidence, not a substitute for real assistive-technology testing.

See [docs/ACCESSIBILITY.md](./docs/ACCESSIBILITY.md).

---

## Sprint B flagship scenario

The browser gate exercises a full exact-money journey:

~~~text
budget €50
buffer €2

+ €3.79
+ €12.50
+ €1.29 × 3
→ exact remaining

enter typo
→ correct before commit

cross safety buffer
→ informational consequence

preview nominal overage
→ Cancel
→ cart unchanged

add valid item
reload
restore exact trip
continue adding
~~~

This scenario runs across the full browser matrix and includes persistence, mobile and accessibility assertions.

---

## Empirical release gate

The remaining Sprint B blocker is intentionally **human**, not technical.

Target for the common price-only flow:

> **median ≤ 2.5 seconds**

Minimum release-quality floor:

> **approximately ≤ 3.0 seconds**

Automation cannot honestly prove this because Playwright measures machine interaction, not a person using a phone one-handed.

The guarded QA build measures real time from **Add price activation** until the canonical summary is rendered again.

Required timing set:

- 10 × €4.79
- 10 × €12.50

The QA panel reports:

- median
- P75
- maximum
- sample count
- canonical gate status
- release eligibility
- ignored non-target samples
- device/browser evidence
- one-hand / bright-store checklist

The public shopping-shell switch remains blocked until this evidence is recorded.

See [docs/SPRINT-B-QUALITY-GATE.md](./docs/SPRINT-B-QUALITY-GATE.md).

---

## Legacy Pulse Counter

The original public shell remains a useful interaction-engineering artifact.

It demonstrates:

- scoped keyboard interaction
- native same-document View Transitions
- pointer-reactive effects without React render churn
- reduced-motion adaptation
- versioned legacy persistence
- container-query-driven layout
- modern CSS without an animation framework

The shopping migration deliberately keeps only the techniques that still create user value.

---

## Technology stack

### Runtime

- React 19.3
- Vite 8
- TypeScript 6 strict
- Zod 4 at persistence boundaries
- native Web APIs
- CSS Modules for shopping features

### State and architecture

- plain-TypeScript application controller
- useSyncExternalStore
- immutable canonical snapshots
- versioned localStorage persistence
- no global state library
- no router
- no backend

### Quality

- ESLint 10
- Vitest 5
- React Testing Library
- @testing-library/user-event
- Playwright
- @axe-core/playwright
- fast-check
- GitHub Actions

The dependency budget is intentionally small. A dependency is added only when a documented requirement earns it.

See [TECH-STACK.md](./TECH-STACK.md).

---

## Quality gates

Install:

~~~bash
npm ci
~~~

Core gate:

~~~bash
npm run check
~~~

This runs:

1. ESLint
2. strict TypeScript
3. Vitest unit/component tests
4. Vite production build

Browser gate:

~~~bash
npm run test:e2e
~~~

CI runs Playwright independently in Chromium, Firefox and WebKit.

The Quality workflow also compiles the guarded empirical QA build separately.

GitHub Pages publishes two isolated artifacts:

~~~text
/shopping-budget-companion/      → public Pulse Counter
/shopping-budget-companion/qa/   → guarded shopping empirical QA
~~~

QA instrumentation is tree-shaken from the public Pulse production bundle.

---

## Representative repository structure

~~~text
src/
├── app/
│   ├── ShoppingAppShell.tsx
│   └── composition-root.ts
├── application/
│   ├── shopping-app-controller.ts
│   └── react/
├── domain/
│   ├── money.ts
│   └── shopping-trip.ts
├── features/
│   ├── counter/
│   └── shopping/
├── infrastructure/
│   └── storage/
└── qa/
    ├── shopping-timing.ts
    └── ShoppingTimingQaPanel.tsx

tests/
e2e/
docs/
├── specs/
├── design/
├── marketing/
└── SPRINT-B-QUALITY-GATE.md
~~~

This is a responsibility map, not architecture theatre.

---

## Why this project exists

This repository started as a tiny counter.

Instead of creating another unrelated portfolio project, it is being evolved in place into a stronger case study:

- preserve good interaction engineering
- introduce a real user problem
- formalise exact money rules
- introduce a pure domain
- add application orchestration
- make persistence failure explicit
- design for one-hand mobile use
- test actual release gates
- keep target claims separate from shipped reality

The goal is to demonstrate something more useful than framework breadth:

> **how to turn a polished prototype into a trustworthy product without over-engineering it.**

---

## Documentation

The repository is documentation-driven.

Start here:

- [PRODUCT.md](./PRODUCT.md) — product thesis and scope
- [ROADMAP.md](./ROADMAP.md) — authoritative implementation sequence
- [ARCHITECTURE.md](./ARCHITECTURE.md) — dependency and state boundaries
- [DOMAIN.md](./DOMAIN.md) — business invariants
- [FUNCTIONALITY.md](./FUNCTIONALITY.md) — product behavior
- [UX.md](./UX.md) — interaction rules
- [DESIGN.md](./DESIGN.md) — Calm Utility visual system
- [TESTING.md](./TESTING.md) — quality strategy
- [docs/ACCESSIBILITY.md](./docs/ACCESSIBILITY.md) — accessibility contract
- [docs/SPRINT-B-QUALITY-GATE.md](./docs/SPRINT-B-QUALITY-GATE.md) — empirical release evidence
- [docs/specs/](./docs/specs/) — detailed technical contracts

When documentation and implementation disagree, the repository rule is to reconcile the contract rather than silently choosing one.
