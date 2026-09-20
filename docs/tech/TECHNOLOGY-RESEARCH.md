# Technology Research and Stack Evaluation

## Status

Research snapshot for choosing the implementation stack for the shopping-budget product.

Last reviewed: 2026-09-21.

This document separates current platform facts from our product-specific architectural judgement.

## Evaluation model

Technology choices are scored /100 using:

- reliability / browser maturity — 25
- fit to product requirements — 25
- implementation simplicity — 15
- testability — 10
- bundle/performance cost — 10
- maintenance/ecosystem — 10
- migration cost from current repo — 5

A technology does not win because it has more features.

The best choice is the smallest mature tool that protects the product contract.

## Product constraints that drive the stack

The product is:

- mobile-first
- offline-first
- local-first
- single-user in MVP
- exact-money sensitive
- mostly one active screen
- no mandatory backend
- no SSR requirement
- camera/barcode/OCR only as progressive enhancement
- accessibility-sensitive
- expected to run on Chromium, Firefox, and WebKit-family browsers
- currently already a React/Vite application

These constraints strongly favour a static SPA/PWA architecture.

# 1. UI framework

## React 19.3 + Vite 8

Score: **99/100**

Why it fits:

- already in the repository
- React 19.3 is current and includes stable ViewTransition support
- Vite 8 uses Rolldown and remains a lightweight SPA build tool
- no server/runtime dependency
- excellent testing ecosystem
- zero rewrite cost
- strong fit for progressive browser APIs

Risk:

- React can invite unnecessary state-management libraries

Mitigation:

- keep application/domain state outside component-local business logic
- no Redux/Zustand by default

Decision:

> **Keep React 19.3 + Vite 8.**

## Next.js

Score: **82/100**

Strengths:

- strong React framework
- static export possible
- good routing/metadata/SSR options
- official PWA guidance exists

Weaknesses for this product:

- server/route conventions are unnecessary
- static export limits server features anyway
- adds architectural surface to an offline client app
- migration cost with no core user benefit

Decision:

> Reject for MVP.

Revisit only if the product later needs a substantial public content site, SSR, server routes, or authenticated cloud application.

## Preact

Score: **90/100**

Strengths:

- smaller runtime
- React-like ecosystem
- signals available

Weaknesses:

- migration has real cost
- current React bundle is not the product bottleneck
- React 19.3 features/testing ecosystem already fit

Decision:

> Reject optimization-by-rewrite.

## Vue 3

Score: **84/100**

Strong framework, but rewriting a healthy React codebase adds migration cost without solving a product problem.

## Svelte 5

Score: **86/100**

Excellent client-app framework and bundle story, but the same rewrite argument applies.

### Framework winner

**React 19.3 + Vite 8 — 99/100**

# 2. Language / type system

## Strict TypeScript 6.0.x

Score: **99/100**

Why:

- stable bridge release
- excellent ecosystem/tool compatibility
- catches domain/persistence contract mistakes
- branded money/id types are genuinely useful
- discriminated unions fit price provenance and trip lifecycle
- current project is small enough for incremental migration

Recommended compiler options include:

- strict
- noUncheckedIndexedAccess
- exactOptionalPropertyTypes
- noImplicitReturns
- noFallthroughCasesInSwitch
- useUnknownInCatchVariables
- isolatedModules
- verbatimModuleSyntax

## TypeScript 7.0

Score: **96/100 for this migration now**

TypeScript 7 is current and brings a new native Go implementation with major speed improvements.

Why not choose it immediately:

- our codebase is small, so compiler performance is not a bottleneck
- 7.0 is a major compiler implementation transition
- conservative migration reliability is more valuable than faster typecheck today

Decision:

> Start the product migration on TypeScript 6.0.x; schedule a dedicated TS7 compatibility upgrade after the domain/application migration is green.

This is not a rejection of TS7.

It is sequencing risk.

## JavaScript

Score: **74/100**

No longer adequate for the richer money/persistence/scanner contracts.

### Language winner

**Strict TypeScript 6.0.x — 99/100**

# 3. Application state

## Small custom application store + React useSyncExternalStore

Score: **98/100**

Recommended architecture:

~~~text
ShoppingAppController
  ├─ getSnapshot()
  ├─ subscribe()
  ├─ startTrip()
  ├─ dispatch()
  ├─ undo()
  └─ finishTrip()

React
  └─ useSyncExternalStore(controller.subscribe, controller.getSnapshot)
~~~

Why:

- application state stays independent of React
- persistence orchestration remains in plain TypeScript
- deterministic unit tests
- React receives immutable snapshots
- no third-party state dependency
- exactly one canonical in-memory app state

Important:

- getSnapshot must return cached immutable state until a real change occurs
- components should consume selectors/feature contexts rather than re-rendering the entire tree unnecessarily

## React reducer/context only

Score: **94/100**

Simpler at first, but persistence orchestration either leaks into React or requires awkward effect coordination.

Still acceptable if the custom controller proves ceremony-heavy.

## Zustand

Score: **89/100**

Good library, but solves a problem the product does not yet have.

## Redux Toolkit

Score: **82/100**

Excellent for large shared-state systems; disproportionate here.

## XState

Score: **87/100**

The product benefits from state-machine thinking, but not from a state-machine runtime dependency yet.

Typed discriminated unions already make forbidden states explicit.

### State winner

**Custom application controller + useSyncExternalStore — 98/100**

# 4. Runtime schema validation

Static TypeScript cannot validate localStorage or API JSON.

## Zod 4

Score: **98/100**

Use only at untrusted boundaries:

- localStorage envelopes
- migrations
- Open Food Facts / future API responses
- scanner adapter payloads if external

Why:

- stable TypeScript-first schema validation
- zero external dependencies
- small core footprint
- broad ecosystem
- excellent readability for migrations

Rule:

> Zod does not enter the pure domain.

Infrastructure validates DTOs, then maps to branded domain values.

## Valibot

Score: **96/100**

Excellent and smaller due modular architecture.

Why second:

- bundle difference is not material for our small boundary schemas
- Zod's ecosystem/familiarity reduces maintenance risk

## Handwritten validators

Score: **87/100**

Can be smaller, but persistence migrations and discriminated payloads create enough complexity that schema duplication becomes error-prone.

### Validation winner

**Zod 4 — 98/100**

# 5. Persistence

## localStorage + versioned Zod schemas

Score: **98/100 for MVP**

Why:

- data volume is tiny
- synchronous write is useful for durability-before-render semantics
- widely supported
- simple migrations
- inspectable
- no database dependency

Implementation rules:

- full validated snapshots
- small independent logical records
- explicit persistence-health state
- never write from arbitrary components
- no passive useEffect-only durability

## IndexedDB directly

Score: **83/100 for MVP**

More capable but asynchronous and unnecessary for small text data.

## Dexie + IndexedDB

Score: **89/100 for MVP**
**98/100 if later storing large price history/images**

Great future upgrade, wrong starting point.

### Persistence winner

**localStorage first — 98/100**

Upgrade trigger:

- receipt images
- large product/price history
- large offline catalogues
- storage volume or query patterns that genuinely justify IndexedDB

# 6. PWA / offline layer

## vite-plugin-pwa + Workbox generateSW

Score: **98/100**

Recommended initial mode:

- generateSW
- precache app shell/assets
- prompt-based update flow
- no forced auto reload during active trip
- offline app shell
- do not put business data in Cache Storage

Why:

- integrated with Vite
- Workbox is production-oriented
- generated service worker is sufficient for simple shell caching
- avoids hand-maintained service-worker complexity

Upgrade to injectManifest only if we later need custom:

- runtime routes
- background sync
- complex offline API queues
- bespoke service-worker messaging

## Handwritten service worker

Score: **78/100**

Too easy to get lifecycle/cache invalidation wrong for little benefit.

## No service worker

Score: **61/100**

Conflicts with offline/PWA product promise.

### PWA winner

**vite-plugin-pwa + Workbox generateSW — 98/100**

# 7. Navigation / routing

## No router in MVP

Score: **99/100**

The core product is one task surface.

Use application/UI state for:

- active trip
- history overlay/view
- settings overlay/view
- completed summary

Benefits:

- smaller conceptual surface
- no URL/state synchronization bugs
- works cleanly on GitHub Pages subpaths

## React Router declarative mode

Score: **92/100 when deep links are needed**

React Router supports a simple Declarative mode.

Add later if real routes appear:

- /history/:tripId
- /settings
- shared/public pages

## React Router framework/data modes

Score: **76/100 for MVP**

Unneeded loaders/actions/server-like abstractions.

## TanStack Router

Score: **86/100**

Excellent typed routing but not needed without a routing problem.

### Routing winner

**No router initially — 99/100**

# 8. Styling / design system

## CSS Modules + CSS Custom Properties

Score: **99/100**

Recommended:

- CSS Modules for feature isolation
- global design tokens via custom properties
- OKLCH where supported
- container queries
- logical properties
- clamp() typography/spacing
- prefers-reduced-motion
- prefers-contrast
- forced-colors handling

Why:

- current visual engineering is already strong in CSS
- no runtime styling cost
- exact control for unusual branded UI
- recruiter-readable
- integrates naturally with native View Transitions

## Tailwind CSS

Score: **89/100**

Excellent productivity tool, but adds little here and would obscure part of the custom CSS/design-system signal.

## CSS-in-JS runtime

Score: **72/100**

Unnecessary runtime/architecture cost.

## Global monolithic CSS

Score: **82/100**

Works at current size, but feature migration benefits from modules.

### Styling winner

**CSS Modules + CSS variables — 99/100**

# 9. UI primitives

## Native semantic HTML first

Score: **98/100**

Use:

- button
- form
- label
- output
- progress where semantically correct
- dialog
- lists
- native inputs

The native dialog element is broadly available and supplies important modal/inert/Escape behavior.

Build a thin project wrapper around it for:

- bottom sheet
- edit item
- destructive confirmations

## Radix Primitives

Score: **95/100**

Very good accessible primitives.

Why not default:

- native dialog is now broadly available
- our component set is small
- avoid dependency until native semantics prove insufficient

Revisit if testing reveals:

- focus restoration bugs
- nested overlay complexity
- browser-specific native dialog limitations

## Full UI kit

Score: **72/100**

Would fight the custom brand/design system.

### Primitive winner

**Native HTML + thin project wrappers — 98/100**

# 10. Motion

## React 19.3 ViewTransition + CSS

Score: **99/100**

Use for:

- remaining number/layout transitions
- trip start/finish
- panel changes

Use plain CSS for:

- pressed states
- opacity
- progress
- small feedback

Rules:

- state/persistence first
- motion second
- reduced motion respected
- no financial mutation waits on animation

## Motion / Framer Motion

Score: **86/100**

Great library, but unnecessary for the intended motion vocabulary.

## GSAP

Score: **70/100**

Powerful but disproportionate.

### Motion winner

**React ViewTransition + CSS — 99/100**

# 11. Forms / input

## Native controlled inputs + product-specific keypad

Score: **99/100**

Why:

- few forms
- money parser is highly specialized
- quantity/budget input has custom rules
- avoids generic form abstraction around the most critical interaction

Use:

- inputMode
- autocomplete intentionally
- typed ephemeral draft state
- inline errors

## React Hook Form

Score: **84/100**

Excellent for larger form-heavy applications, not needed here.

### Forms winner

**Native React form state — 99/100**

# 12. Dates / IDs / formatting

Use platform APIs.

## IDs

crypto.randomUUID()

Score: **99/100**

No UUID dependency.

## Dates

ISO timestamps + Intl.DateTimeFormat

Score: **99/100**

No date-fns/dayjs until complex calendar arithmetic exists.

## Money display

Intl.NumberFormat

Score: **99/100**

Canonical cents remain independent.

# 13. Barcode scanning — P1

Native Barcode Detection API is currently limited availability, so it cannot be the only implementation.

## Recommended layered strategy

### Layer 1

Native BarcodeDetector when:

- available
- requested retail formats are supported

### Layer 2

Lazy-loaded barcode-detector ponyfill using ZXing-C++ WebAssembly.

Score: **97/100**

Why this candidate:

- standardized BarcodeDetector-like API
- supports broad 1D/2D formats
- WASM implementation
- can self-host WASM for offline use
- can be loaded only when user chooses scanning

Requirements:

- self-host WASM rather than relying on CDN
- keep it out of initial bundle
- camera access only after explicit user action
- manual entry always available
- scan result is candidate/identity data, never automatic cart mutation

## Native BarcodeDetector only

Score: **72/100**

Browser coverage is insufficient.

## @zxing/browser only

Score: **94/100**

Mature/battle-tested approach, but a standardized native+ponyfill API gives us a cleaner adapter boundary.

## Commercial scanner SDK

Score: **76/100 initially**

Could outperform open-source scanning, but cost/vendor lock is unjustified before real scan usage is proven.

### Barcode winner

**Native BarcodeDetector + lazy ZXing-C++ WASM ponyfill — 97/100**

# 14. Product identity lookup — P1

## Open Food Facts adapter

Score: **93/100 as an optional provider**

Useful because it supports barcode-based product retrieval and has an official JS/TS SDK.

Use only for:

- product identity
- product name
- optional image/brand metadata

Never use it as an authoritative current store-price source.

Architecture:

~~~text
ProductLookup port
  ↓
OpenFoodFactsProductLookup adapter
~~~

Rules:

- validate response
- request only required fields
- timeout/AbortController
- not-found is normal, not a fatal error
- cache successful identity locally where useful
- manual workflow survives every failure

Important implementation detail:

Open Food Facts asks clients to identify API requests. Browser limitations around the User-Agent header must be resolved in the adapter/usage design before production launch.

Do not introduce a backend solely for product lookup until this issue or API policy actually requires it.

# 15. Shelf-price OCR — P1/P2

This is the least mature technology choice.

## Tesseract.js in a Web Worker

Score: **84/100 as first benchmark candidate**

Strengths:

- on-device/browser
- privacy-friendly
- can work offline after assets are cached
- worker-based
- no cloud bill/backend

Weaknesses:

- trained data/runtime weight
- mobile latency
- shelf labels are visually difficult
- unit/member/old-price ambiguity still needs product logic

Decision:

> Use Tesseract.js only as the first benchmark implementation behind ShelfPriceScanner.

Do **not** lock the product to it before real fixture/mobile benchmarks.

Recommended pipeline:

1. capture/crop
2. lightweight Canvas preprocessing
3. lazy worker
4. restrict recognition character set where practical
5. extract numeric candidates
6. semantic heuristics
7. user confirmation

## Cloud OCR

Score: **81/100 overall**

Potentially stronger recognition, but adds:

- backend/secrets
- network dependency
- latency
- recurring cost
- privacy disclosure

Only consider if on-device OCR fails the real-use benchmark.

## Browser experimental text detection APIs

Score: **65/100**

Not reliable enough as sole production path.

### OCR winner

**Provider adapter + Tesseract.js benchmark first — 90/100 architecture decision**

The provider itself remains intentionally provisional.

# 16. Data fetching

## Plain fetch + AbortController

Score: **98/100**

For one or two optional lookup adapters, TanStack Query is unnecessary.

Implement:

- timeout
- cancellation
- validation
- explicit Result error
- small local cache only when valuable

## TanStack Query

Score: **88/100 now**
**97/100 if server-state complexity grows**

Add only when there are multiple cacheable remote resources, invalidation rules, retries, and background refresh.

# 17. Icons

## Small local SVG icon set

Score: **97/100**

The product needs few icons.

Advantages:

- no runtime dependency
- exact brand alignment
- easy accessibility control

## Lucide React

Score: **96/100**

Excellent fallback if icon count grows.

Do not hand-draw dozens of generic utility icons.

# 18. Testing stack

## Vitest 5

Score: **99/100**

Keep.

## React Testing Library + user-event

Score: **99/100**

Keep.

## Playwright 1.63+

Score: **99/100**

Keep Chromium/Firefox/WebKit.

## axe via @axe-core/playwright

Score: **98/100**

Keep.

## fast-check

Score: **97/100 as dev dependency**

Recommended addition for property tests around:

- money arithmetic
- selectors
- add/remove invariants
- serialization round trips

This is a strong fit because our specs already define algebraic invariants.

## Snapshot-heavy testing

Score: **60/100**

Avoid as primary assurance.

# 19. Lint / CI

Recommended:

- ESLint 10
- typescript-eslint compatible with chosen TS version
- tsc --noEmit
- Vitest
- Vite build
- Playwright
- axe
- Node 24 CI

Target commands:

~~~text
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
~~~

No pre-commit framework is required initially.

CI is the authoritative gate.

# 20. Backend

## No backend in MVP

Score: **100/100**

The product's primary value becomes stronger without one:

- offline
- private
- cheap
- simple
- resilient

Do not add:

- auth
- database
- API server
- server-side sessions

until a shipped feature actually requires them.

## Future edge/serverless backend

Potential reasons:

- cloud OCR
- cross-device sync
- household sharing
- API-secret proxy
- retailer integrations

When that requirement appears, choose the platform based on that feature rather than preselecting infrastructure now.

# 21. Hosting

## GitHub Pages for portfolio/beta

Score: **97/100**

Already configured.

Fits:

- static Vite PWA
- HTTPS
- simple CI
- zero infrastructure cost
- portfolio visibility

Important:

- configure Vite/PWA base/scope correctly for /React-counter/
- service-worker update tests must run against the production subpath

## Cloudflare Pages

Score: **96/100 future production option**

Attractive if later requiring:

- custom edge headers
- Workers/API proxy
- tighter edge integration

Do not migrate hosting without a requirement.

## Vercel

Score: **93/100**

Excellent platform, but offers little extra for a static offline-first MVP.

### Hosting winner now

**GitHub Pages — 97/100**

# 22. Analytics / telemetry

## No product analytics in MVP implementation

Score: **96/100**

For portfolio/private beta:

- direct feedback is more valuable
- avoids privacy surface

If public beta requires aggregate events, add a separate privacy-reviewed decision.

Never send:

- budget values
- item prices
- item names
- store history

by default.

# Final recommended stack

## Core runtime

- React 19.3
- Vite 8.x
- strict TypeScript 6.0.x
- React DOM
- native browser APIs

## Application architecture

- pure TypeScript domain
- plain TypeScript application controller
- React useSyncExternalStore adapter
- dependency ports/adapters
- no Redux/Zustand/XState

## Validation

- Zod 4 at persistence/network boundaries
- branded domain constructors internally

## Storage

- localStorage MVP
- versioned snapshots
- Zod validation
- IndexedDB/Dexie only after concrete scale/media trigger

## PWA

- vite-plugin-pwa
- Workbox generateSW
- prompt update strategy
- app-shell precache
- offline core

## UI

- CSS Modules
- CSS custom properties
- native semantic HTML
- native dialog wrapper
- React 19.3 ViewTransition
- CSS motion
- small local SVG icons

## Testing

- Vitest
- Testing Library
- user-event
- fast-check
- Playwright
- axe

## P1 barcode

- MediaDevices camera
- native BarcodeDetector when available
- lazy barcode-detector ZXing-C++ WASM ponyfill
- self-hosted WASM
- Open Food Facts behind ProductLookup adapter

## P1/P2 OCR

- provider-agnostic ShelfPriceScanner
- Tesseract.js worker as first benchmark candidate
- no release commitment until real mobile accuracy/speed beats or materially complements manual entry

## Deployment

- GitHub Actions
- GitHub Pages now
- no backend

# Dependency budget

Target MVP production dependencies:

Required:

- react
- react-dom
- zod
- vite-plugin-pwa / Workbox-generated runtime as required by build setup

No production dependency yet for:

- router
- global state
- form library
- UI kit
- date library
- animation library
- HTTP client
- IndexedDB wrapper
- barcode
- OCR

P1 scanner/OCR packages must be lazy chunks.

# Stack scorecard

| Area | Winner | Score |
|---|---|---:|
| UI framework | React 19.3 + Vite 8 | 99 |
| Language | TypeScript 6 strict | 99 |
| App state | custom controller + useSyncExternalStore | 98 |
| Runtime validation | Zod 4 | 98 |
| MVP persistence | localStorage | 98 |
| PWA | vite-plugin-pwa + Workbox | 98 |
| Routing | none | 99 |
| Styling | CSS Modules + tokens | 99 |
| UI primitives | native HTML/dialog | 98 |
| Motion | React ViewTransition + CSS | 99 |
| Forms | native/custom | 99 |
| IDs/dates/formatting | platform APIs | 99 |
| Tests | Vitest/RTL/Playwright/axe/fast-check | 99 |
| Barcode architecture | native + WASM ponyfill | 97 |
| Product lookup | Open Food Facts adapter | 93 |
| OCR architecture | adapter + benchmark gate | 90 |
| Backend | none | 100 |
| Hosting now | GitHub Pages | 97 |

Overall MVP technology fit:

> **98/100**

The deliberately lower OCR score is honest: OCR quality is an empirical problem, not something architecture documents can guarantee.

## Rejected stack pattern

Do not build MVP as:

- Next.js
- Redux
- Tailwind
- React Hook Form
- Framer Motion
- Dexie
- TanStack Query
- React Router framework mode
- backend/auth/database
- cloud OCR

all at once.

Every one of those tools can be good.

The combination would be poor engineering for this product because most would solve problems the MVP does not have.

## Research sources

- React 19.3 release: https://react.dev/blog/2026/09/09/react-19-3
- React useSyncExternalStore: https://react.dev/reference/react/useSyncExternalStore
- Vite 8: https://vite.dev/blog/announcing-vite8
- TypeScript 6: https://devblogs.microsoft.com/typescript/announcing-typescript-6-0/
- TypeScript 7: https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/
- Zod: https://zod.dev/
- Valibot: https://valibot.dev/
- Web Storage API: https://developer.mozilla.org/en-US/docs/Web/API/Web_Storage_API
- native dialog: https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/dialog
- Workbox: https://developer.chrome.com/docs/workbox
- Vite PWA / Workbox: https://vite-pwa-org.netlify.app/workbox/
- Barcode Detection API: https://developer.mozilla.org/en-US/docs/Web/API/Barcode_Detection_API
- barcode-detector ponyfill: https://github.com/Sec-ant/barcode-detector
- Tesseract.js: https://github.com/naptha/tesseract.js
- Open Food Facts API: https://openfoodfacts.github.io/documentation/docs/Product-Opener/api/
- Open Food Facts JS SDK: https://openfoodfacts.github.io/openfoodfacts-js/
- React Router modes: https://reactrouter.com/start/modes
- Next.js static exports: https://nextjs.org/docs/app/guides/static-exports
