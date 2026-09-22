# Shopping Budget Companion

A **mobile-first, local-first shopping budget companion** built to answer one question while you shop:

> **How much can I still safely spend before checkout?**

[![Quality](https://github.com/MykolaDotsenko/shopping-budget-companion/actions/workflows/quality.yml/badge.svg)](https://github.com/MykolaDotsenko/shopping-budget-companion/actions/workflows/quality.yml)
[![React](https://img.shields.io/badge/React-19.3-20232a?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-6.0-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

**Live app:** https://mykoladotsenko.github.io/shopping-budget-companion/


<p align="center">
  <img
    src="docs/assets/shopping-budget-companion.png"
    alt="Shopping Budget Companion active trip screen with a €50 budget"
    width="390"
  />
</p>

<p align="center"><em>Current mobile active-trip UI — captured from the repository in Chromium.</em></p>

---

## Product

This is deliberately narrower than a generic expense tracker:

**set a spending limit → add prices quickly → always know what remains**

The core flow is local-first and account-free. The product prioritizes exact money, durable state, one-hand interaction, reversible corrections, accessibility, and evidence-based feature expansion.

Returning shoppers can reuse a previous spending plan, Recent Items, and local Price Memory while always retaining an explicit **Enter current price** path.

---

## Engineering highlights

- **Exact money:** canonical financial state uses integer minor units, never binary floating point.
- **Pure domain rules:** totals, remaining budget, safety buffer, projections, and over-budget state live outside React.
- **Local-first durability:** versioned Zod-validated persistence with explicit degraded-write and recovery states.
- **Loss-safe completion:** history and active-trip cleanup are reconciliation-aware.
- **Independent Price Memory:** advisory remembered prices cannot corrupt active-cart/history durability.
- **Proportional state architecture:** a plain TypeScript `ShoppingAppController` + `useSyncExternalStore`; no Redux/Zustand/XState/router/backend required.
- **Evidence separation:** QA timing and retention instrumentation never become product state.

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

| Layer | Owns |
| --- | --- |
| **Domain** | money, trip invariants, projections, selectors |
| **Application** | lifecycle, commands, Undo, persistence ordering, recovery |
| **Infrastructure** | storage schemas, localStorage adapters, runtime boundaries |
| **UI** | rendering, drafts, focus, accessibility, interaction feedback |
| **QA** | timing and retention evidence only |

See [Architecture](./docs/ARCHITECTURE.md).

---

## Tech stack

**Runtime:** React 19.3, TypeScript 6 strict, Vite 8, Zod 4, CSS Modules, native Web APIs, versioned `localStorage`.

**Quality:** ESLint 10, Vitest 5, React Testing Library, user-event, fast-check, Playwright, axe-core, GitHub Actions.

The runtime dependency budget is intentionally small; new dependencies must earn their product value.

---

## Quality gates

```bash
npm ci
npm run check
npm run test:e2e
```

`npm run check` runs lint, strict TypeScript, unit/component tests, and a production build.

CI additionally validates:

- Chromium, Firefox, and WebKit
- browser-level accessibility
- 360×800 and 390×844 mobile layouts
- 200% text sizing
- reduced motion
- keyboard/focus behavior
- forced-colours critical paths
- reload/restore and storage failure recovery
- exact-money flagship journeys
- independent history / Price Memory deletion semantics
- QA and retention-beta builds

---

## Current status

### Engineering

- ✅ exact EUR money model
- ✅ shopping-trip domain
- ✅ local-first active-trip persistence
- ✅ remaining-first UI
- ✅ fast manual price entry
- ✅ quantity and projected totals
- ✅ reserve / over-budget states
- ✅ Undo, edit, remove, and budget adjustment
- ✅ persistence-health and recovery UX
- ✅ trip completion and reconciliation
- ✅ completed-trip history and Shop again
- ✅ Recent Items and Price Memory
- ✅ local-data controls
- ✅ privacy-safe retention evidence harness
- ✅ cohort-level retention analysis
- ✅ Chromium / Firefox / WebKit CI

### Evidence still pending

- ⏳ representative real-device one-hand timing
- ⏳ bright-store / software-keyboard physical validation
- ⏳ 20–50 real-shopper retention beta
- ⏳ measured second-trip and third-trip behavior

PWA, barcode, and OCR breadth remain evidence-gated.

Internal evidence builds:

- **Timing QA:** https://mykoladotsenko.github.io/shopping-budget-companion/qa/
- **Retention beta:** https://mykoladotsenko.github.io/shopping-budget-companion/beta/

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
docs/                # current contracts, specs, evidence and reference material
```

The repository root intentionally stays small. Start with the [documentation map](./docs/README.md) instead of browsing individual Markdown files at random.

---

## Run locally

Requirements: Node.js 24+ and npm.

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

## Documentation

The authoritative entry point is [docs/README.md](./docs/README.md).

Key current contracts:

- [Product](./docs/PRODUCT.md)
- [Architecture](./docs/ARCHITECTURE.md)
- [Domain](./docs/DOMAIN.md)
- [Design](./docs/DESIGN.md)
- [Roadmap](./docs/ROADMAP.md)
- [Testing](./docs/TESTING.md)
- [Data persistence](./docs/architecture/DATA-PERSISTENCE.md)
- [Decision log](./docs/DECISIONS.md)
- [Detailed specs](./docs/specs/)

Supporting research, scenario analysis, execution history, and evidence protocols are indexed separately so they do not compete with current contracts.

---

## What this project demonstrates

This repository is a case study in:

- translating a real product constraint into domain rules
- designing exact-money state instead of UI-level arithmetic
- handling persistence failure honestly
- keeping architecture proportional
- separating product state from QA evidence
- testing risky journeys across browser engines
- building accessibility into interaction contracts
- using empirical gates to decide what **not** to build yet

The goal is not framework breadth. It is a small product that is technically disciplined, testable, and explicit about what has — and has not — been validated.

## License

MIT — see [LICENSE](./LICENSE).
