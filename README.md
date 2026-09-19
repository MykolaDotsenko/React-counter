# Pulse Counter

A tiny counter rebuilt as a focused **interaction-engineering case study**.

The product is intentionally simple. The engineering work is not about inventing unnecessary business logic; it is about showing how much quality can be extracted from a small interface through clear state transitions, resilient persistence, accessibility, responsive interaction design, and high-fidelity visual feedback.

## What it does

- increments and decrements a counter with configurable steps: `1`, `5`, `10`, `25`
- preserves the value and selected step in versioned local storage
- migrates the original project's legacy `counter` value automatically
- supports scoped keyboard control with arrow keys while preserving native page shortcuts
- adapts motion for `prefers-reduced-motion`
- exposes explicit disabled states at the supported boundaries
- keeps the domain logic independent from React and browser storage

## Visual system

Pulse Counter is deliberately built with modern browser and React platform capabilities instead of a runtime animation library:

- React 19.3 `<ViewTransition>` + `addTransitionType` for directional value changes
- animated spectral orbit using typed CSS custom properties with `@property`
- OKLCH color tokens and `color-mix()` progressive enhancement
- pointer-reactive 3D glass surface without React render churn
- `requestAnimationFrame` coalescing for pointer lighting
- component-level container queries for layout adaptation
- sliding segmented step control driven by a CSS custom property
- layered aurora, spectral field, holographic rings and deterministic particle bursts
- `backdrop-filter`, masks, conic gradients and GPU-friendly transforms
- high-contrast and reduced-motion adaptations

The effects are bounded: there is no continuous JavaScript animation loop and no third-party UI or animation runtime. Native View Transitions are progressive enhancement: reduced-motion, keyboard-driven updates, unsupported engines, and the currently unstable WebKit interop path fall back to immediate state commits without losing functionality.

## Stack

- React 19.3
- Vite 8
- modern CSS
- React View Transitions
- native ES modules
- Web Storage API
- Pointer Events
- Vitest + React Testing Library
- Playwright browser matrix + axe accessibility checks
- ESLint 10 flat config
- GitHub Actions

## Architecture

```text
src/
├── App.jsx
├── App.css
├── index.css
└── features/
    └── counter/
        ├── CounterExperience.jsx   # product UI / composition
        ├── ParticleBurst.jsx       # bounded visual feedback
        ├── counter-model.js        # pure domain state machine
        ├── counter-storage.js      # persistence + legacy migration
        ├── useCounter.js           # React/application adapter
        └── usePointerSurface.js    # pointer/rendering adapter

tests/
├── CounterExperience.test.jsx
├── counter-model.test.js
└── counter-storage.test.js

e2e/
├── accessibility.spec.js
└── counter.spec.js
```

The dependency direction is intentional:

```text
UI → React adapter → pure model
 │            ↘ persistence adapter
 └→ pointer/rendering adapter
```

The model does not know about React, DOM APIs, CSS, local storage, or motion.

See [`ARCHITECTURE.md`](./ARCHITECTURE.md) for trade-offs and design rationale.

## Quality gates

```bash
npm ci
npm run check
npm run test:e2e
```

`npm run check` runs:

1. ESLint
2. Vitest unit and component tests
3. Vite production build

GitHub Actions then runs Playwright separately in Chromium, Firefox, and WebKit. Chromium also runs an axe WCAG A/AA scan. Browser scenarios cover persistence, keyboard scoping, boundaries, compact mobile layout and reduced motion.

## Interaction map

| Action | Pointer | Keyboard |
| --- | --- | --- |
| Increase | Increase button | `↑` / `→` while counter region is focused |
| Decrease | Decrease button | `↓` / `←` while counter region is focused |
| Reset | Reset button | native button keyboard activation |
| Step size | Step selector | focus + Enter/Space |

## Why this project exists

A counter is too small to justify routing, a global state library, a design-system package, a server, WebGL, or a general animation framework. Adding those only to look sophisticated would make the repository more expensive without making the product better.

The goal is **senior-level proportionality**: use architecture where it protects behavior, use the newest stable platform capability where it removes custom machinery, and spend complexity only where it creates visible interaction value.
