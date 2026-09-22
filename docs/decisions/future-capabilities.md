# Future Capability Decisions

## Status

Accepted decision records. These explain durable choices but do not override current code/tests or authoritative current contracts.

Use [../DECISIONS.md](../DECISIONS.md) as the retrieval index.

## D-028 — PWA uses vite-plugin-pwa + Workbox generateSW first

Date: 2026-09-21

Status: accepted

### Decision

Implement initial offline/PWA support with:

- vite-plugin-pwa
- Workbox generateSW
- prompt-based updates
- application-shell precaching

Do not hand-write the first service worker.

### Rationale

The core offline requirement is simple static-shell availability.

A generated Workbox service worker is more reliable and maintainable than custom lifecycle/cache code for the MVP.

### Consequence

Business data remains in localStorage, not Cache Storage.

The service worker must never force a reload during an active trip.

### Revisit when

A documented feature requires custom background sync, complex runtime caching, or bespoke service-worker messaging. At that point, evaluate injectManifest.

## D-031 — Barcode scanning uses progressive native + lazy WASM detection

Date: 2026-09-21

Status: accepted

### Decision

For P1 barcode scanning:

1. use native BarcodeDetector when supported for required formats
2. otherwise lazy-load a BarcodeDetector-compatible ZXing-C++ WebAssembly ponyfill
3. self-host WASM for offline compatibility

The current preferred fallback candidate is the barcode-detector package.

### Rationale

The native Barcode Detection API remains unavailable in some widely used browsers.

A standardized native/ponyfill interface gives cleaner capability boundaries than coupling the application to one scanner library.

### Consequence

Scanner code remains outside the initial bundle and behind BarcodeScanner.

Manual price entry remains available in every scanner failure state.

### Revisit when

Browser support becomes sufficient to drop the fallback, or benchmark data shows a materially better scanner SDK.

## D-032 — Open Food Facts is an optional product-identity provider, not a price provider

Date: 2026-09-21

Status: accepted

### Decision

Use Open Food Facts as the first provider candidate behind ProductLookup for barcode-based product identity.

Do not treat it as an authoritative current store-price source.

### Rationale

The API supports product retrieval by barcode and an official JS/TS SDK exists.

The product's business rule remains that barcode identifies a product; current shelf price is contextual.

### Consequence

- remote responses are runtime-validated
- not-found is normal
- manual flow survives provider failure
- API client-identification policy must be resolved before production
- provider-specific DTOs never enter the domain

### Revisit when

A better product-identity data source exists for the target market, or API policy makes browser usage impractical.

## D-033 — Shelf OCR provider remains benchmark-gated

Date: 2026-09-21

Status: accepted

### Decision

Do not make a production OCR vendor/library part of core architecture yet.

Keep ShelfPriceScanner provider-agnostic.

Use Tesseract.js in a Web Worker as the first on-device benchmark candidate.

### Rationale

OCR accuracy and latency on real grocery shelf labels are empirical risks.

Locking a heavy OCR library or cloud vendor before mobile benchmarking would be technology-first design.

### Consequence

No OCR production dependency is added until fixture/mobile tests demonstrate useful speed and candidate quality.

If local OCR fails, cloud OCR can be evaluated behind the same port without changing domain/application code.

### Revisit when

Benchmark data exists.

## D-037 — Run an early scanner benchmark without promoting scanner to the production roadmap

Date: 2026-09-21

Status: accepted

### Decision

After Phase 5 establishes a stable, measured manual baseline, run a small experimental scanner benchmark before Phase 6–8 and the broader real-store beta.

This benchmark may test:

- barcode capture
- shelf-label price capture
- scan -> confirm interaction
- failure/fallback behaviour

It must remain:

- experimental
- optional
- outside the critical product bundle/path
- recoverable immediately to manual entry

Production barcode and OCR implementation remains scheduled for Phase 10/11.

### Rationale

The manual path is the universal baseline, but scanner value is an empirical interaction question.

A scanner could reduce:

- seconds per item
- typing effort
- cognitive fatigue

or it could increase:

- latency
- correction work
- ambiguity
- trust risk

Testing the hypothesis cheaply after the manual baseline exists gives earlier evidence without committing the product to scanner-first architecture.

### Consequence

The roadmap contains an Experimental Scanner Benchmark Gate after Phase 5.

Positive benchmark evidence may justify a scanner cohort in later beta testing.

Negative evidence must simplify/defer scanning rather than trigger more scanner engineering.

D-035 remains authoritative for production feature sequencing: Repeat Trip / Recent Items / Price Memory still precede production scanner breadth.

### Revisit when

The benchmark has representative mobile timing, failure, correction, and repeated-use data.
