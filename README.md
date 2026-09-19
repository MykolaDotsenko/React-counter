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

Pulse Counter uses native browser capabilities instead of a runtime animation library:

- animated conic-gradient orbit with CSS `@property`
- aurora-style background lighting
- pointer-reactive glass surface using CSS custom properties
- deterministic particle bursts with CSS transforms
- responsive glassmorphism with `backdrop-filter`
- tabular numeric typography and animated value transitions
- contrast and reduced-motion media queries

The effects are deliberately bounded: there is no permanent JavaScript animation loop and no third-party UI dependency.

## Stack

- React 19.3
- Vite 8
- modern CSS
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
        └── useCounter.js           # React/browser adapter

tests/
├── counter-model.test.js
└── counter-storage.test.js
```

The dependency direction is intentional:

```text
UI → React adapter → pure model
              ↘ persistence adapter
```

The model does not know about React, DOM APIs, CSS, or local storage.

See [`ARCHITECTURE.md`](./ARCHITECTURE.md) for trade-offs and design rationale.

## Quality gates

```bash
npm ci
npm run check
```

`npm run check` runs:

1. ESLint
2. Vitest unit and component tests
3. Vite production build

GitHub Actions then runs Playwright separately in Chromium, Firefox, and WebKit. Chromium also runs an axe WCAG A/AA scan.

## Interaction map

| Action | Pointer | Keyboard |
| --- | --- | --- |
| Increase | Increase button | `↑` / `→` |
| Decrease | Decrease button | `↓` / `←` |
| Reset | Reset button | native button keyboard activation |
| Step size | Step selector | focus + Enter/Space |
| Scoped counter | focus counter region | `↑` / `→` / `↓` / `←` |

## Why this project exists

A counter is too small to justify routing, a global state library, a design-system package, a server, or an animation framework. Adding those would make the repository look more complicated without making it better.

The goal is the opposite: **senior-level proportionality**. Use architecture where it protects behavior, native platform features where they are sufficient, and visual polish where it materially improves the interaction.
