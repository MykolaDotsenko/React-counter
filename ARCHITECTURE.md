# Architecture

## Status

This repository is in transition.

Current implementation:

- React 19.3
- Vite 8
- JavaScript
- one counter domain
- versioned localStorage persistence
- native typed View Transitions
- pointer-rendering adapter
- Vitest + Playwright + axe

Target product:

- mobile-first shopping budget companion
- strict TypeScript domain
- exact money arithmetic
- active shopping trip and cart items
- local-first persistence
- optional scanning adapters
- offline-capable PWA

This document describes both the current architectural strengths to preserve and the target boundaries for the product migration. It must not be read as evidence that target features already exist.

## Architectural goal

Preserve the proportional design quality of Pulse Counter while evolving from an arbitrary numeric counter into a real shopping domain.

The architecture should make the critical path:

- exact
- testable
- offline-capable
- resilient to storage failure
- independent of optional scanners and network services
- simple enough to understand from the repository structure

Complexity is accepted only when it protects money correctness, user data, or interaction quality.

## Core dependency rule

Target dependency direction:

~~~text
UI
 ↓
application / feature orchestration
 ↓
domain
 ↑
persistence and capability adapters
~~~

The domain owns business truth.

React renders and dispatches intent.

Adapters translate browser or external capabilities into validated data.

No scanner, storage API, animation API, or React component may become a source of financial truth.

## Target source shape

Exact file names may evolve, but responsibilities should remain recognisable.

~~~text
src/
├── app/
│   ├── App.tsx
│   └── app-shell.tsx
├── domain/
│   ├── money.ts
│   ├── shopping-trip.ts
│   ├── cart-item.ts
│   ├── price-origin.ts
│   └── selectors.ts
├── features/
│   ├── active-trip/
│   ├── price-entry/
│   ├── cart-items/
│   ├── checkout/
│   ├── price-memory/
│   └── scanning/
├── infrastructure/
│   ├── storage/
│   ├── barcode/
│   ├── price-scan/
│   └── pwa/
└── ui/
    ├── primitives/
    └── visual-effects/
~~~

Do not force this tree mechanically if implementation proves a smaller structure clearer.

## Domain boundary

The domain is pure TypeScript and has no dependency on:

- React
- DOM
- CSS
- localStorage
- IndexedDB
- Service Workers
- camera APIs
- barcode APIs
- OCR providers
- animation
- network requests

Domain responsibilities include:

- money representation
- budget validation
- safety-buffer rules
- item line totals
- cart totals
- remaining values
- over-budget state
- price-origin rules
- checkout reconciliation math

See DOMAIN.md for canonical business rules.

## Money architecture

Money correctness is the highest-value technical boundary introduced by the product pivot.

Canonical money uses integer minor units.

Example:

~~~text
EUR 4.79 → 479
EUR 50.00 → 5000
~~~

React components must never independently sum decimal prices.

Formatting is presentation.

Arithmetic is domain logic.

This separation prevents floating-point drift and makes all money calculations deterministic in unit tests.

## Canonical state

Target canonical active-trip state contains:

- currency
- budget
- safety buffer
- items
- item unit prices
- item quantities
- item price origins
- optional store context
- trip lifecycle timestamps
- optional actual checkout total

Derived values are not authoritative persisted state:

- cart total
- remaining
- safe remaining
- progress
- over-budget flags

Selectors derive these values from canonical data.

## Application layer

The application layer coordinates domain intent with adapters.

Examples:

### Add price

~~~text
user input
  ↓
parse + validate
  ↓
domain command / reducer
  ↓
canonical state commit
  ↓
persist
  ↓
derive remaining
  ↓
render + optional motion
~~~

### Barcode flow

~~~text
camera / detector
  ↓
barcode adapter
  ↓
product identity candidate
  ↓
price-memory lookup
  ↓
user confirmation / current-price entry
  ↓
domain item commit
~~~

Barcode lookup does not bypass price confirmation rules.

### Shelf-label scan

~~~text
camera
  ↓
OCR / scanning adapter
  ↓
price candidate(s)
  ↓
user confirmation
  ↓
domain item commit
~~~

Scanner output never mutates canonical cart state directly.

## Persistence

### MVP decision

Use versioned localStorage while the canonical dataset remains small and text-only.

This is intentionally conservative.

IndexedDB is not automatically “more production-grade.” It becomes justified if the product later stores:

- images
- large receipt data
- large price history
- larger structured offline datasets

### Persistence rules

- every committed cart mutation is persisted promptly
- persistence schema is versioned
- malformed state fails safely
- future unsupported schema versions do not get guessed into compatibility
- storage errors are observable by the application
- UI must surface inability to save an active trip

### Legacy Pulse Counter state

Old counter values must not be reinterpreted as money.

Migration should deliberately retire the old counter storage key rather than invent financial meaning for historical counter data.

## Persistence failure semantics

The current Pulse Counter safely falls back to memory on storage errors because losing an arbitrary count is low impact.

That behaviour is no longer sufficient for a shopping trip.

Target behaviour:

1. keep the valid in-memory state usable
2. mark persistence health as degraded
3. communicate the risk clearly
4. provide recovery/export options where practical

No silent data-loss risk.

## Undo architecture

Do not introduce event sourcing for appearance.

MVP only needs reliable recovery of recent mutations.

Acceptable approaches:

- bounded previous-state snapshot
- command stack
- reducer-level undo state

Choose the smallest approach that supports the UX contract.

## Price memory boundary

Price memory is separate from active-trip canonical state.

A remembered-price store may be keyed by:

- product identity
- optional store identity
- currency

Records retain:

- last observed price
- observed date
- source metadata

Price memory is advisory.

It never changes cart totals until a value is selected/confirmed through the application flow.

## Scanner architecture

Scanning is progressive enhancement.

Manual price entry is the permanent fallback.

### Barcode detection

The browser Barcode Detection API cannot be assumed available across all target browsers.

Architecture should support:

- capability detection
- a library-based or alternate implementation if justified
- graceful fallback to manual entry

Avoid coupling the domain to one scanner implementation.

### Product lookup

If a remote product database is introduced:

- it is optional
- timeouts/failure do not block manual input
- product identity and current price remain separate concepts

### Price-tag OCR

OCR is an untrusted candidate producer.

The adapter may return:

- candidate price
- multiple candidates
- optional product text
- optional unit text

The application requires confirmation before domain commit.

## Network architecture

Core product must not need a backend.

A future backend is justified only by a real feature such as:

- multi-device household sync
- cloud backup
- retailer integration
- shared price memory

Do not create authentication, server APIs, or databases pre-emptively.

## PWA and offline

PWA support is product-relevant because stores can have poor connectivity and the app benefits from home-screen launch.

Target PWA responsibilities:

- application shell availability
- static asset caching
- offline startup
- safe update behaviour

Business data remains owned by the persistence layer, not the service worker cache.

## React boundary

React components should:

- render state
- collect intent
- call application/domain actions
- manage local ephemeral UI state

React components should not:

- calculate financial totals ad hoc
- read localStorage directly
- call OCR or barcode APIs directly from business components
- silently reconcile scanner data
- encode currency rules in JSX

## Motion architecture

The current project contains sophisticated View Transition handling, including reduced-motion gates and failure recovery.

The product pivot changes one critical rule:

> Business state commits must never wait on decorative motion.

Target order:

~~~text
intent
  ↓
domain commit
  ↓
persistence attempt
  ↓
render
  ↓
optional visual transition / feedback
~~~

View Transitions remain valuable for:

- remaining-number changes
- start/finish transitions
- panel/layout changes

They are not part of the correctness path.

## Pointer effects

The current requestAnimationFrame-based pointer adapter is a good example of keeping high-frequency rendering outside React state.

Preserve the technique only where visual value remains after the product redesign.

Do not preserve visual complexity solely because it already exists.

## TypeScript migration

The original decision to stay in JavaScript was proportionate for a tiny counter.

The new domain changes that trade-off.

Strict TypeScript is justified by:

- branded or constrained money values
- currency boundaries
- multiple price origins
- persistence schemas
- scanner result unions
- optional metadata
- trip lifecycle

Migration strategy:

1. add TypeScript configuration and typed domain first
2. migrate application adapters around the domain
3. migrate feature components incrementally
4. remove obsolete counter modules after equivalent behaviour is replaced
5. avoid simultaneous full visual redesign + full type migration + new scanners in one change

## Testing architecture

Quality remains layered.

### Pure domain tests

Fast and exhaustive for:

- money
- selectors
- buffers
- quantities
- edge cases

### Component tests

Interaction semantics for:

- price entry
- warnings
- undo
- edits

### Browser tests

Real flow for:

- active-trip persistence
- offline shell
- mobile layout
- accessibility
- browser compatibility

Scanner integrations need adapter-contract tests and deterministic fixtures before camera-driven E2E is considered.

See TESTING.md for the quality contract.

## Security and privacy posture

MVP handles shopping data locally.

Do not collect data merely because analytics are easy to add.

If telemetry is added later, it must be:

- purposeful
- minimal
- documented
- non-blocking
- respectful of financial sensitivity

No bank credentials or financial-account access belong in this product.

## Architecture trade-offs

### Why no global state library initially?

One active trip plus small local feature state is manageable with React and a clear domain reducer/application boundary.

Add a library only when actual cross-feature state complexity justifies it.

### Why no backend initially?

The core job is single-user, device-local, and offline-friendly.

A backend increases operational and privacy cost without improving the primary job.

### Why localStorage before IndexedDB?

Canonical MVP state is small and structured.

The simpler storage API is easier to reason about, migrate, and test.

Upgrade storage when the data shape requires it.

### Why strict TypeScript now?

The domain now contains meaningfully different numeric/data concepts. Type safety reduces real risk rather than adding decorative ceremony.

### Why keep native motion?

The existing native-CSS approach provides visual quality without a large animation runtime. It remains appropriate when motion supports comprehension and does not own correctness.

## Architectural invariants

MUST:

- represent canonical money in integer minor units
- keep domain logic independent of React/browser APIs
- derive totals from canonical items
- preserve manual offline input
- validate scanner output before commit
- surface persistence failure

MUST NOT:

- use floating-point money as source of truth
- read/write storage from arbitrary components
- let animation callbacks own financial commits
- treat barcode identity as a current price
- treat remembered price as live price
- require network for the critical shopping flow
- add a backend without a product requirement

SHOULD:

- keep modules small and responsibility-focused
- prefer browser/platform primitives over broad runtime dependencies
- keep optional smart features behind adapters
- make each migration step independently testable

## Architecture review checklist

Before approving a structural change ask:

1. Does it protect a documented domain or UX requirement?
2. Is there a simpler boundary that would work?
3. Does the domain remain browser-independent?
4. Does the core workflow still work offline?
5. Did optional scanning/network code leak into the critical path?
6. Is canonical state still unambiguous?
7. Can failure be surfaced and recovered from?
8. Is this architecture implemented now, or clearly labelled as target state?
