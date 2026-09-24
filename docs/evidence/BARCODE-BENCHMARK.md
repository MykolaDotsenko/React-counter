# Barcode Interaction Benchmark

## Status

**IMPLEMENTED evidence harness; empirical benchmark result pending.**

This document owns the operating protocol for the experimental barcode interaction benchmark accepted by D-037.

The benchmark is not a production scanner and does not approve production barcode breadth.

## Guarded route

Use:

> `/shopping-budget-companion/barcode-benchmark/`

Build flag:

> `VITE_SHOPPING_BARCODE_BENCHMARK=1`

The route is isolated from the shopping lifecycle:

- no ShoppingTrip/cart mutation;
- no product lookup;
- no current-price lookup;
- no PWA/service worker;
- no analytics/network telemetry;
- no production scanner dependency in the public bundle.

## Current technical scope

The first benchmark intentionally tests the smallest useful hypothesis:

> can native camera barcode capture plus human confirmation reduce interaction cost?

Current implementation uses the browser's native `BarcodeDetector` only.

It does **not** yet add the D-031 lazy WASM fallback. Native unsupported devices are valid benchmark evidence rather than a reason to hide capability limitations.

Production architecture remains:

1. native detector when viable;
2. lazy BarcodeDetector-compatible WASM fallback only if evidence justifies production work;
3. barcode produces identity candidate only;
4. current shelf price remains explicit/manual unless independently confirmed.

## What is measured

A timed attempt begins when the tester chooses:

> Start timed scan

The timer stops only on a terminal human-visible outcome:

- confirmed candidate;
- rejected candidate / retry;
- 8-second timeout;
- manual fallback;
- detector error.

The 8-second timeout is owned by the benchmark wall clock rather than detector responsiveness: an unresolved or slow `detect()` call cannot extend the timeout indefinitely. Async detector results arriving after fallback/stop/timeout are ignored.

This deliberately measures **scan → human decision**, not detector-only latency.

Derived evidence includes:

- attempts;
- confirmed scans;
- median confirmed duration;
- P75 confirmed duration;
- P90 confirmed duration;
- recognition-failure rate (timeouts + detector errors; manual fallback is reported separately);
- correction/rejection rate;
- manual-fallback rate;
- permission-denied count;
- camera failures;
- detector errors;
- structured preference after repeated use;
- structured cognitive-effort score after repeated use.

Capability failures such as unsupported detector/camera or denied permission are recorded separately from completed timed attempts.

## Privacy contract

The retained/exported benchmark evidence may contain:

- device/browser user agent;
- viewport;
- reported detector formats;
- device/browser label supplied by the tester;
- timestamps;
- durations;
- outcome types;
- detected barcode **format** such as EAN-13.

It must not contain:

- raw barcode values;
- product/item names;
- prices;
- budgets;
- store identity/history;
- images/video frames;
- location;
- account identity;
- email;
- network telemetry.

The detected raw barcode may be displayed temporarily for human confirmation but remains React-memory-only and is never persisted/exported.

## Physical benchmark protocol

Use a representative physical phone.

Record the exact device/browser label.

Where practical, benchmark at least:

- 10+ confirmed scans across ordinary retail barcodes;
- repeated scans rather than one novelty success;
- normal indoor/store-like lighting;
- at least one less favourable lighting/angle condition;
- one explicit manual fallback path;
- correction/rejection when a candidate is wrong or ambiguous;
- permission denial/recovery on a separate fresh permission state if safely practical.

Do not manufacture rejections merely to improve coverage. Record natural failures honestly.

If a restored session was captured with a different device, browser, viewport, or reported detector capability, it is frozen. During a live session, keep orientation/viewport fixed; the harness refuses to start a new timed scan when the viewport no longer matches the retained environment. Export/reset before continuing under a new environment.

This prevents mixed-environment latency from looking like one comparable sample set.

A session has a hard limit of 200 timed attempts. At the limit, scanning is stopped and the existing evidence must be exported/reset. Earlier samples are never silently dropped from the distribution.

## Paired manual baseline

Use [BARCODE-PAIRED-DECISION-TEMPLATE.md](./BARCODE-PAIRED-DECISION-TEMPLATE.md) to keep the same-device comparison and go/no-go decision auditable.

A scanner is useful only if it improves on the manual interaction it is intended to accelerate.

For any decision to promote barcode work beyond benchmark status, collect a paired quantitative manual baseline on the same representative device/context using the existing timing QA path.

The 2026-09-24 B6 physical-usability attestation did not preserve exact median/P75/max timing JSON, so it cannot serve as a quantitative comparator for this benchmark.

Do not claim scanner advantage from scanner timing alone.

## Interpretation

A positive result should show that scan → human confirm is materially useful relative to the paired manual baseline while keeping correction/fallback/trust cost acceptable.

A negative result should simplify or defer scanner work.

Examples of evidence against promotion:

- scan + confirm is slower than manual digits → Add;
- detector support is too narrow on target devices;
- timeout/fallback is frequent;
- corrections erase the time advantage;
- permission/camera friction dominates;
- repeated use increases cognitive effort.

Technical novelty is not a positive product result.

## Export

Preferred:

> Download benchmark JSON

Fallback:

> Copy privacy-safe benchmark JSON

Both paths use the same versioned privacy-safe evidence payload. The default filename contains only the session timestamp and no participant identity.

Export failure stays inside the benchmark UI. If the device clock predates retained evidence, correct the device date/time and retry rather than editing timestamps manually.

The export recomputes its derived summary from validated local evidence. Tampered derived summaries or malformed session data must fail parsing.

## Exit rule

The experimental benchmark can support a production-barcode decision only when:

1. representative physical-phone data exists;
2. repeated-use samples exist;
3. failure/correction/fallback data exists;
4. preference/effort evidence is recorded where practical;
5. a paired quantitative manual baseline exists;
6. the scanner interaction demonstrates meaningful benefit rather than novelty.

Until then:

- production barcode identification remains **PLANNED / GATED**;
- no ProductLookup/provider integration is justified;
- no WASM scanner fallback is admitted to the product dependency graph;
- manual entry remains the universal baseline.
