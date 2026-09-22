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

- Zod at untrusted/runtime boundaries

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

## Backend

None required for current product.

A backend becomes justified only by a validated need such as:

- multi-device sync;
- collaboration;
- server-side OCR/provider proxy;
- account-owned remote history;
- privacy-reviewed aggregate telemetry requiring server ingestion.

Choose a backend only after the requirement exists.

## Analytics

No remote analytics SDK is required for current evidence work.

Retention/timing evidence remains local/content-minimized under the current contract.

## Future PWA

**PLANNED / GATED.**

When approved, select the smallest reliable Vite-compatible service-worker/PWA solution.

Requirements:

- app-shell caching only;
- correct GitHub Pages scope/base;
- no canonical business state in Cache Storage/service worker;
- safe update/reload behaviour.

Do not add PWA tooling before the roadmap gate.

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
- PWA/service-worker tooling.

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
