# Technology Stack

## Status

Authoritative target technology stack for the shopping-budget product.

The current repository still ships the Pulse Counter implementation. Dependencies in this document are target choices and should only be added when the roadmap phase that needs them begins.

Detailed evaluation and alternatives live in:

- docs/tech/TECHNOLOGY-RESEARCH.md

## Stack philosophy

The product should be implemented with the smallest mature stack that protects:

- exact money correctness
- offline reliability
- accessibility
- one-hand mobile UX
- progressive scanning
- testability

Do not add a framework or library merely because it is popular.

## Core runtime

### React 19.3

Decision: keep.

Role:

- component rendering
- local ephemeral UI state
- context boundary
- React ViewTransition integration

Score: **99/100**

### Vite 8.x

Decision: keep.

Role:

- dev server
- build
- code splitting
- asset pipeline
- PWA plugin integration

Score: **99/100**

### TypeScript 6.0.x, strict

Decision: add incrementally starting with domain/application code.

Required compiler posture:

- strict
- noUncheckedIndexedAccess
- exactOptionalPropertyTypes
- noImplicitReturns
- noFallthroughCasesInSwitch
- useUnknownInCatchVariables
- isolatedModules
- verbatimModuleSyntax

TypeScript 7 upgrade is deliberately deferred until the product migration is green.

Score: **99/100**

## Target production dependencies

MVP should stay close to:

~~~text
react
react-dom
zod
vite-plugin-pwa
~~~

Workbox dependencies may be pulled transitively/generated through the PWA tooling.

Do not add production dependencies for:

- global state
- routing
- forms
- animation
- dates
- HTTP client
- IndexedDB
- barcode
- OCR

until their phase requires them.

## Application state

Use a small application controller outside React.

Concept:

~~~ts
interface ShoppingAppController {
  getSnapshot(): ShoppingAppState
  subscribe(listener: () => void): () => void

  startTrip(input: StartTripInput): AppCommandResult
  dispatch(command: TripCommand): AppCommandResult
  undo(): AppCommandResult
  finishTrip(): AppCommandResult
}
~~~

React adapter:

~~~ts
useSyncExternalStore(
  controller.subscribe,
  controller.getSnapshot,
)
~~~

Benefits:

- application orchestration remains plain TypeScript
- no persistence in React effects
- deterministic tests
- one canonical application state
- no third-party state library

Do not add Redux, Zustand, or XState unless actual complexity changes the trade-off.

Score: **98/100**

## Runtime validation

Use **Zod 4** only at untrusted boundaries.

Allowed:

- localStorage envelope validation
- schema migrations
- remote API responses
- future scanner/provider DTOs

Not allowed:

- pure domain depending on Zod
- using Zod as the domain model itself

Flow:

~~~text
unknown JSON
   ↓
Zod DTO schema
   ↓
validated DTO
   ↓
domain constructor
   ↓
branded domain state
~~~

Score: **98/100**

## Persistence

MVP:

> versioned localStorage adapters

Why:

- tiny text dataset
- synchronous durability path
- widely supported
- easy to inspect/test/migrate

Use:

- ActiveTripRepository
- HistoryRepository
- SettingsRepository

Validation:

- Zod at read boundary
- domain invariant validation after DTO parsing

Do not introduce IndexedDB/Dexie in MVP.

Upgrade only if the product begins storing:

- images
- large price histories
- large offline catalogues
- data requiring indexed queries

Score: **98/100**

## PWA / offline

Use:

> vite-plugin-pwa + Workbox generateSW

Initial strategy:

- generated service worker
- app-shell precache
- prompt-based update
- no forced reload during active shopping
- static assets available offline
- business data remains in localStorage

Do not use service-worker Cache Storage as shopping-state persistence.

Move to injectManifest only when custom service-worker behavior has a demonstrated requirement.

Score: **98/100**

## Routing

MVP:

> no router

Application lifecycle and overlays are not URLs.

Do not add React Router just for:

- history panel
- settings
- add price
- checkout summary

Revisit if meaningful deep links appear.

Preferred future router if needed:

> React Router Declarative Mode

Score now: **99/100**

## Styling

Use:

- CSS Modules for feature/component styles
- global CSS custom properties for design tokens
- native CSS layers/features
- OKLCH where appropriate
- container queries
- logical properties
- clamp()
- forced-colors support
- prefers-reduced-motion
- prefers-contrast

Do not introduce Tailwind or CSS-in-JS for MVP.

Score: **99/100**

## UI primitives

Native semantic HTML first.

Use:

- button
- form
- label
- output
- progress where semantically correct
- dialog
- list semantics
- native input

Build small internal wrappers for:

- modal/bottom sheet
- alert/confirmation
- visually hidden text
- focus restoration where needed

Do not introduce a full component kit.

Radix may be added later only if native primitives fail a verified accessibility/browser requirement.

Score: **98/100**

## Forms and keypad

Use controlled React input/draft state.

Do not use React Hook Form.

Money entry is specialized enough that a generic form abstraction would hide important behavior.

Use:

- inputMode
- product-specific keypad
- inline validation
- MONEY-SPEC parser
- ephemeral draft state

Score: **99/100**

## Motion

Use:

- React 19.3 ViewTransition
- CSS transitions/animations

Do not add Motion/Framer Motion or GSAP for MVP.

Rules:

1. domain commit
2. persistence attempt
3. render
4. optional motion

Motion never owns correctness.

Score: **99/100**

## IDs, dates and formatting

Use platform APIs.

### IDs

~~~ts
crypto.randomUUID()
~~~

### Time

~~~ts
new Date().toISOString()
~~~

behind the Clock adapter.

### Date display

~~~ts
Intl.DateTimeFormat
~~~

### Currency display

~~~ts
Intl.NumberFormat
~~~

No uuid/date-fns/dayjs dependency.

Score: **99/100**

## Network requests

For optional provider adapters use:

- fetch
- AbortController
- explicit timeout
- Zod validation
- Result error types

Do not add Axios.

Do not add TanStack Query until remote server state becomes a meaningful subsystem.

Score: **98/100**

## Barcode scanning — P1

Architecture:

~~~text
camera
 ↓
BarcodeScanner port
 ↓
native BarcodeDetector if supported
 ↓ otherwise
lazy WASM ponyfill
 ↓
BarcodeCandidate
 ↓
application review / product lookup
~~~

Preferred fallback candidate:

> barcode-detector ponyfill backed by ZXing-C++ WebAssembly

Requirements:

- self-host WASM
- lazy import
- do not add to initial bundle
- support EAN/UPC retail codes
- detect capability at runtime
- manual price path always available

Native BarcodeDetector alone is not sufficient because browser support remains incomplete.

Score: **97/100**

## Product identity lookup — P1

Preferred first provider:

> Open Food Facts

Architecture:

~~~text
ProductLookup port
 ↓
OpenFoodFactsProductLookup
~~~

Use only for product identity.

Never treat product database metadata as current shelf price.

Rules:

- narrow requested fields
- timeout
- not-found is normal
- validate response
- provider failure does not block manual entry
- resolve API-identification/User-Agent policy before production launch

Do not let provider-specific response shapes enter the domain.

Score: **93/100**

## Shelf-price OCR — P1/P2

Do not lock a production OCR vendor yet.

Architecture:

~~~text
ShelfPriceScanner port
 ↓
provider adapter
 ↓
PriceCandidate[]
 ↓
explicit user confirmation
~~~

First benchmark candidate:

> Tesseract.js in a Web Worker

Implementation experiment:

- lazy-loaded worker
- crop before recognition
- lightweight Canvas preprocessing
- character restriction where useful
- numeric candidate extraction
- no automatic cart commit

Release rule:

> Keep Tesseract.js only if real mobile benchmark data shows acceptable speed/accuracy and a user-value improvement over manual entry.

If local OCR fails the benchmark, evaluate a cloud provider behind the same port.

Cloud OCR must not leak into domain/application contracts.

Architecture decision score: **90/100**

## Testing

Keep:

- Vitest 5
- React Testing Library
- @testing-library/user-event
- Playwright
- @axe-core/playwright

Add:

> fast-check

Use fast-check for property-style domain invariants.

Target test layers:

### Domain

- money
- cart selectors
- projections
- trip commands
- invariants

### Application

- controller commands
- persistence ordering
- undo
- degraded persistence
- completion transaction

### Infrastructure

- Zod schema parsing
- migrations
- localStorage errors
- provider adapters

### Component

- keypad
- warnings
- focus
- editing
- undo feedback

### E2E

- Tier 0 scenarios
- offline
- reload
- mobile
- reduced motion
- accessibility
- browser matrix

Score: **99/100**

## Tooling / CI

Runtime:

- Node 24

Quality:

- ESLint 10
- compatible typescript-eslint
- TypeScript compiler
- Vitest
- Playwright
- axe

Required CI:

~~~text
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
~~~

Do not require a pre-commit framework.

CI is authoritative.

## Backend

MVP decision:

> none

No:

- authentication
- database
- API server
- cloud session
- user account

Reasons:

- offline-first
- local-first privacy
- lower failure surface
- lower cost
- no feature requires one

Score: **100/100**

Future backend is selected only after a concrete requirement appears.

Possible future triggers:

- cloud OCR
- API-secret proxy
- sync
- family sharing
- retailer integration

Do not choose the future backend platform before the trigger exists.

## Hosting

Current:

> GitHub Pages + GitHub Actions

Score: **97/100**

Fits the static PWA.

Production considerations:

- Vite base must match deployment path
- PWA scope/base must match
- WASM assets later must be self-hosted under correct base
- E2E should test production-like subpath

Possible future upgrade:

> Cloudflare Pages/Workers if edge functions, custom headers or API proxy become necessary.

Do not migrate hosting for prestige.

## Analytics

MVP/private beta:

> none

Do not add telemetry until public product measurement is required.

If introduced later:

- separate architecture/privacy decision
- no budget amounts
- no item prices
- no item names
- no store history by default

## Dependency admission rule

Before adding any dependency, answer:

1. Which documented requirement does it protect?
2. Can a platform API solve it cleanly?
3. Is it needed now or in a later roadmap phase?
4. What does it add to the initial bundle?
5. Does it work offline?
6. Does it add a privacy/network dependency?
7. Does it complicate testing/migrations?
8. Can it be lazy-loaded?
9. What is the removal/migration cost?
10. Is its value greater than its maintenance surface?

If the requirement can be solved clearly with a small amount of native code, prefer native code.

## Target dependency phases

### Phase 1

Add:

- typescript
- typescript-eslint tooling as required
- zod
- fast-check

No PWA/scanner/OCR dependency yet.

### Core UI / PWA phase

Add:

- vite-plugin-pwa

### Barcode P1

Add only after benchmark:

- barcode-detector or selected WASM fallback

### OCR P1/P2

Add only after benchmark:

- tesseract.js or selected provider adapter

## Explicit non-selections

Not part of MVP stack:

- Next.js
- Preact
- Vue
- Svelte
- Redux Toolkit
- Zustand
- XState runtime
- Tailwind
- styled-components/emotion
- React Hook Form
- Motion/Framer Motion
- GSAP
- React Router
- TanStack Router
- Axios
- TanStack Query
- Dexie
- date-fns/dayjs
- uuid package
- backend/auth/database
- cloud OCR

These are not “bad technologies.”

They are currently lower-fit technologies for this product.

## Final stack score

| Layer | Selection | Score |
|---|---|---:|
| UI | React 19.3 | 99 |
| Build | Vite 8 | 99 |
| Language | TypeScript 6 strict | 99 |
| App state | controller + useSyncExternalStore | 98 |
| Validation | Zod 4 | 98 |
| Persistence | localStorage | 98 |
| PWA | vite-plugin-pwa + Workbox | 98 |
| Routing | none | 99 |
| CSS | CSS Modules + tokens | 99 |
| Primitives | native HTML/dialog | 98 |
| Motion | ViewTransition + CSS | 99 |
| Forms | native/custom | 99 |
| Data fetch | fetch + AbortController | 98 |
| Tests | Vitest/RTL/Playwright/axe/fast-check | 99 |
| Barcode | native + lazy WASM fallback | 97 |
| Product lookup | Open Food Facts adapter | 93 |
| OCR | adapter + benchmark-gated Tesseract candidate | 90 |
| Backend | none | 100 |
| Hosting | GitHub Pages | 97 |

Overall technology architecture:

> **98/100**

The stack intentionally leaves OCR with the lowest score because recognition quality must be proven empirically.
