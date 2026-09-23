# Architecture

## Status

This document describes the **current** architecture of the public Shopping Budget Companion.

The repository no longer contains an alternate prototype product shell. The public root, timing QA route and retention-beta route all compose the same shopping product. The public build resolves the evidence boundary to a NoOp adapter; guarded QA/beta builds resolve the same boundary to evidence tooling at build time.

Human timing and retention gates remain unverified. The installable offline PWA shell is implemented; barcode and OCR remain future/gated capabilities.

## Architectural goal

Protect financial correctness and local durability while keeping the product small enough to understand, test and change quickly.

The architecture should make the common path obvious:

```text
React feature UI
      ↓
ShoppingAppController + application contracts
      ↓
pure shopping domain / selectors
      ↓
application ports
      ↓
browser infrastructure adapters
```

## Source shape

```text
src/
├── app/             composition root + product shell
├── application/     public contracts, controller, React state bridge, ports
├── domain/          exact money, ShoppingTrip, Price Memory rules
├── features/
│   └── shopping/    product UI and ephemeral interaction drafts
├── infrastructure/  runtime/storage adapters and validation
└── qa/              timing/retention evidence only
```

Entry points are TypeScript/TSX. Runtime business code should not require JavaScript escape hatches.

## Dependency rules

### Domain

`src/domain/` owns deterministic business rules.

It may depend on other domain modules. It must not depend on:

- React
- DOM/browser globals
- storage
- network
- camera/OCR
- analytics/evidence
- animation

Canonical money is integer minor units. Derived totals are selectors/calculations, never separately persisted authority.

### Application

`src/application/` owns use-case orchestration:

- lifecycle
- commands
- Undo semantics
- persistence ordering
- recovery/degraded-durability behaviour
- coordination between completed history and Price Memory

Public application interfaces and state/result types live in `shopping-app-contracts.ts`.

`shopping-app-controller.ts` contains controller behaviour, not public contract declarations. Consumers may continue importing re-exported types from the controller where compatibility matters, but new application-level types should be owned by the contracts module.

The application layer must not render UI or reach directly into `localStorage`.

### Infrastructure

`src/infrastructure/` implements ports and runtime boundaries.

It owns:

- versioned storage envelopes
- Zod validation
- DTO ↔ domain reconstruction
- browser storage access
- explicit persistence failure mapping
- safe retirement of historical non-shopping keys

Infrastructure must reconstruct domain objects through domain validation rather than trusting raw persisted JSON.

### React / features

`src/features/` owns:

- rendering
- local drafts
- focus management
- disclosure/overlays
- accessibility semantics
- interaction feedback

React components may call domain selectors for display, but financial mutation rules belong in domain/application code.

### Composition root

`src/app/composition-root.ts` is the wiring boundary between browser adapters and the application controller.

Keep environment-specific construction here instead of scattering singleton creation through features.

### QA

`src/qa/` records validation evidence only. Production code depends on the `#shopping-evidence` adapter contract, which resolves to a NoOp implementation in the public build and to the guarded evidence implementation only when a QA/beta build flag is enabled.

QA data:

- must be separate from shopping persistence
- must not change financial outcomes
- must not become a required runtime dependency
- must not transmit shopping content unless a future privacy/consent decision explicitly allows it

## State ownership

### Canonical product state

The controller owns the in-memory application snapshot:

- lifecycle
- active trip
- completed summary/history
- durability health
- completion-cleanup state
- Price Memory snapshot/health
- Undo snapshot
- recovery state

React subscribes through `useSyncExternalStore`.

Do not duplicate controller-owned business state into component state.

### Ephemeral UI state

Components may own temporary values such as:

- input drafts
- open/closed overlays
- focus targets
- confirmation UI
- transient feedback

Ephemeral UI state must not become a second source of truth for committed money.

## Exact-money architecture

EUR is the current currency scope.

Canonical values use safe integer cents.

```text
"3.79" input
   ↓ parse/validate
379 MinorUnits
   ↓ domain command
CartItem
   ↓ selector
cart total / remaining / safe remaining
   ↓ format
"€3.79"
```

Never use `parseFloat` + multiplication as a financial authority.

## ShoppingTrip domain

`shopping-trip.ts` is the stable public façade for the trip domain. Internal ownership is split by reason to change:

- `shopping-trip-model.ts` — canonical types, constructors and validation;
- `shopping-trip-selectors.ts` — derived totals and projections;
- `shopping-trip-reducer.ts` — state-changing trip commands.

Together they own:

- trip/item validation
- lifecycle-safe commands
- item identity and timestamps
- cart and line totals
- budget/safety-buffer projections
- remaining/overage selectors
- completion and checkout reconciliation

`reduceTrip()` is the central transition boundary for committed trip mutations.

UI-specific labels, focus and modal state do not belong here.

## Persistence architecture

Current durable stores are local-first and versioned.

Core durability is stronger than convenience durability.

### Active trip and completed history

Completion ordering is intentionally loss-safe:

1. validate/restore completed history
2. persist the completed trip into history
3. only after history is durable, clear the active-trip snapshot
4. if active clear fails, expose cleanup pending/degraded state
5. on startup, reconcile a stale active copy whose trip id already exists in durable history

A failed history write must never delete the active trip.

### Read failure

Malformed, invalid-business-value, conflicting or unsupported-future persisted data is not silently coerced.

Recovery surfaces preserve raw material where the contract allows it.

### Price Memory

Price Memory is an independent advisory subsystem.

It may improve repeated use, but:

- a Price Memory write failure cannot invalidate a completed trip
- remembered prices remain explicitly remembered
- reuse does not refresh observation age unless a current price is actually confirmed
- deletion semantics remain independent from completed-trip history

## React boundary

The product does not require Redux/Zustand/XState/router infrastructure for its current state model.

The controller + `useSyncExternalStore` boundary is sufficient because:

- there is one product shell
- state transitions are centralized
- domain rules are already pure
- persistence ordering lives outside React

Add a state library only when measured complexity cannot be handled cleanly by the current controller/contract boundary.

## Complexity management

Large files are a signal to inspect responsibilities, not an automatic refactor trigger.

Prefer extraction when one file owns multiple reasons to change, for example:

- public contracts + implementation
- serialization + storage transactions
- rendering + business orchestration
- product state + evidence collection

Do not introduce micro-files that make a single use case harder to trace.

Current structure:

- public application contracts are separated from controller implementation
- completion / checkout reconciliation is a cohesive application use-case module rather than part of the central controller body
- controller-wide state/result helpers live in a small support module and remain presentation-agnostic
- storage codec/schema reconstruction is separated from transactional persistence/recovery while preserving the existing public storage exports
- shell focus restoration is isolated from product orchestration
- price-entry presentation copy/calculation and the dumb keypad are separated from the stateful price-entry flow

Future extraction should continue by cohesive use-case boundary (for example history or recovery), not arbitrary line counts.

## UI architecture

The active-trip hierarchy remains:

1. remaining / over-budget amount
2. budget context
3. capacity/status visual
4. primary add action
5. cart details
6. secondary tools

Manual price entry is the baseline interaction.

Remembered/scanned/estimated values are accelerators and must never remove the explicit current-price path.

## Motion

Motion is progressive enhancement.

No committed financial mutation may depend on animation or View Transition completion. The current product does not require View Transition orchestration as an architectural dependency.

Reduced-motion behaviour must preserve the same information and controls.

## Network and backend

No backend is required for the current product.

A backend becomes justified only by a validated requirement such as:

- multi-device sync
- household collaboration
- server-side OCR/product lookup
- cross-device history/Price Memory
- aggregate telemetry with explicit privacy/consent design

Do not introduce remote state pre-emptively.

## PWA / offline

The public product ships an **IMPLEMENTED** installable/offline application shell.

- `vite-plugin-pwa` generates the service worker through Workbox `generateSW`.
- Workbox precaches application-shell assets only.
- canonical shopping state remains owned by the application/localStorage persistence adapters, never Cache Storage or the service worker;
- `/qa/` and `/beta/` evidence builds do not generate/register their own PWA service workers;
- service-worker updates use a prompt flow rather than auto-update;
- the update prompt is withheld during active/recovery/completed-summary shopping lifecycle states and is only offered from the idle state, so a new worker never forces a reload during an active trip.

Offline browser coverage verifies that an already installed/cached shell can restore an active trip, complete it while offline, persist history and restore that history after another offline reload.

## Scanner extension points

Barcode/OCR are not current production capabilities.

Future adapters must preserve these boundaries:

- barcode → identity candidate, not current price authority
- OCR → price candidate, not committed cart mutation
- user confirmation → domain/application command
- failure → manual entry remains available

Provider payloads must be runtime validated before entering domain/application logic.

## Testing architecture

### Domain

Pure tests cover exact money, trip invariants, projections and Price Memory rules.

### Application

Controller tests cover lifecycle, Undo, persistence ordering, completion, history, recovery and Price Memory coordination.

### Infrastructure

Storage tests cover schemas, malformed/future data, write failures, completion transactions and reconciliation.

### Components

Testing Library verifies user-visible interaction and accessibility semantics.

### Browser

Playwright runs Chromium, Firefox and WebKit journeys including accessibility and responsive/recovery cases.

Human physical/timing evidence remains a separate gate and must not be inferred from automation.

## Security and privacy posture

Current core data stays local.

The product does not require:

- authentication
- bank access
- remote shopping-content telemetry
- third-party financial APIs

Evidence tooling is intentionally content-minimized and separate from business persistence.

## Architectural invariants

A change is architecturally acceptable only if all relevant invariants remain true:

1. canonical money is exact integer minor units
2. domain remains framework/browser independent
3. React does not become financial authority
4. committed mutations go through domain/application rules
5. persistence failure is visible and cannot silently masquerade as durable success
6. completed-history durability is protected before active-trip cleanup
7. Price Memory remains advisory and independently durable
8. QA evidence remains separate from product state
9. manual entry remains available
10. future external payloads are validated at boundaries
11. current docs describe current code; historical phase narration belongs in archive

## Review checklist

Before merging architecture-affecting work:

- What layer owns the behaviour?
- Is there a new source of truth?
- Did any derived value become persisted unnecessarily?
- Can any failure path lose or misrepresent a committed trip?
- Did convenience state become coupled to core durability?
- Did React gain domain/application responsibility?
- Is a new dependency justified by current product value?
- Are code, tests and the smallest owning document updated together?
