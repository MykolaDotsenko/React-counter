# Technology Stack Reference

## Status

**SUPPORTING REFERENCE.**

Actual runtime/dependency truth comes from `package.json`, source code, CI and current architecture decisions.

This file records current stack intent and dependency admission rules. It does not pre-authorize future dependencies.

## Current core stack

### Runtime / UI

- React 19
- React DOM 19
- Vite 8
- strict TypeScript 6
- native semantic HTML
- CSS Modules / existing CSS architecture

### Validation

- Zod 4 at untrusted/runtime boundaries, through the tree-shakeable `zod/mini` API so the public bundle pays only for the validators it uses

### Persistence

- localStorage through explicit infrastructure adapters

### Testing

- Vitest
- React Testing Library
- Playwright
- axe integration
- fast-check where property-style coverage adds value

### Hosting

- static GitHub Pages deployment

## State management

Current application state uses:

- explicit application controller;
- immutable snapshots;
- `useSyncExternalStore` bridge;
- pure domain state/transitions.

Do not add Redux/Zustand/XState/another global store unless measured complexity makes the current architecture insufficient.

## Routing

No client router is required for the current public product.

Add routing only when independent URLs/navigation states provide real product value.

## Styling

Keep the current lightweight styling approach.

Do not add Tailwind/CSS-in-JS/UI framework solely for developer preference.

A design-system dependency must improve delivery/product quality enough to justify bundle, conventions and migration cost.

## Forms

The product does not need a general form library for its current small interaction model.

Use focused controlled/uncontrolled React patterns plus domain/application validation boundaries.

## Motion

Prefer native CSS/platform capabilities for current needs.

Do not add a motion framework unless interaction requirements exceed the current approach and performance/accessibility remain strong.

## Time / IDs / formatting

Prefer platform APIs and explicit wrappers where testability matters.

Financial formatting follows the money contract.

## Remote/backend scope

Backend, authentication, cloud sync and collaborative remote shopping state are **outside the active product roadmap**.

The product remains local-first, offline-first and account-free. Do not add server-owned shopping state, remote history or account infrastructure as speculative architecture.

A future product-identity lookup may use a narrow external provider adapter only when barcode evidence justifies it. That adapter must be optional, runtime-validated and failure-safe; the core trip remains fully usable without network access.

## Analytics

No remote analytics SDK is required for current evidence work.

Retention/timing evidence remains local/content-minimized under the current contract.

## PWA / offline shell

**IMPLEMENTED.**

The current release uses:

- `vite-plugin-pwa` 1.3.x;
- Workbox `generateSW`;
- application-shell precaching;
- prompt-based updates;
- GitHub Pages-aware base/scope;
- no canonical business state in Cache Storage/service worker.

The generated service worker is disabled for guarded `/qa/` and `/beta/` builds so those evidence surfaces cannot create competing registrations. Update UI is lifecycle-aware and only becomes actionable when the shopping application is idle.
## Future barcode

**PLANNED / GATED.**

Provider/decoder selection must be based on:

- browser/device coverage;
- latency;
- bundle cost;
- failure behaviour;
- real interaction savings.

Barcode remains identity, not price authority.

## Future OCR

**PLANNED / GATED.**

Provider choice remains benchmark-driven.

Measure:

- fixture accuracy;
- mobile latency;
- bundle/network cost;
- permission/camera friction;
- correction burden.

Do not lock a provider based on popularity alone.

## Dependency admission rule

Before adding a runtime dependency, answer:

1. What current user/product requirement needs it?
2. Can native APIs/current abstractions solve the problem cleanly?
3. What bundle/runtime/security/maintenance cost does it add?
4. Does it weaken offline/local-first behaviour?
5. Does it improve UX/premium quality enough to justify the cost?
6. Is the capability approved by the roadmap/decision contract?

If the requirement is hypothetical, do not add the dependency.

## Explicit non-selections

Current architecture intentionally does not require:

- Redux/Zustand/XState;
- React Router;
- Tailwind;
- component UI frameworks;
- IndexedDB/Dexie;
- backend/auth;
- remote analytics SDK;
- scanner/OCR SDK;

These are not banned forever; they are simply unjustified today.

## Upgrade policy

Upgrade core dependencies when:

- security requires it;
- supported versions materially improve reliability;
- developer experience materially improves without destabilising product behaviour;
- migration cost is proportionate.

Do not upgrade major technology merely to make the stack look newer.

## Review checklist

- Does code/package metadata still match this reference?
- Is a proposed dependency solving a real problem?
- Is it loaded on the critical manual-entry path unnecessarily?
- Does it add a second source of state/validation?
- Does it improve the user experience or only architecture aesthetics?
- Will it make future AI/contributor reasoning harder?
