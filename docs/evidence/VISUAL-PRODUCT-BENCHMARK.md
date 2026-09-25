# Visual Product Recognition Benchmark

## Status

**IMPLEMENTED provider-neutral benchmark harness + pinned local CLIP experimental adapter; representative physical-device evidence pending.**

This document owns the experimental protocol for camera-based product/package recognition.

The harness is deliberately not a production recognizer. It exists to answer:

> can a concrete visual recognizer produce useful ranked retail-product candidates quickly and accurately enough to beat manual interaction without weakening privacy or fallback quality?

## Guarded route

Target route:

> `/shopping-budget-companion/visual-recognition-benchmark/`

Build flag:

> `VITE_SHOPPING_VISUAL_BENCHMARK=1`

The route is isolated from the shopping lifecycle:

- no ShoppingTrip/cart mutation;
- no Price Memory mutation;
- no current-price authority;
- no PWA/service worker;
- no analytics;
- no persisted/exported image bytes;
- no persisted/exported product candidate labels.

## Architecture

The benchmark uses a provider-neutral `VisualProductRecognizer` contract.

A recognizer adapter must declare:

- a stable bounded adapter/model ID;
- whether image bytes remain `local-only` or cross a `remote-image` boundary;
- an async recognition method accepting one transient image plus an `AbortSignal`;
- ranked candidates with optional 0–1 confidence.

The guarded benchmark now includes one explicit experimental adapter for issue #88:

- Transformers.js `4.3.0`;
- model `Xenova/clip-vit-base-patch32`;
- pinned model revision `d15189d7028b43f1d3e65039190477f6af591c2a`;
- task `zero-shot-image-classification`;
- local image inference;
- WebGPU attempted first, with WASM fallback;
- a facilitator-supplied closed-set candidate catalog of 3–30 SKU-specific labels;
- a stable recognizer ID containing the model revision, execution device, prompt version and a SHA-256 catalog fingerprint.

The first model setup may download/cache model files from Hugging Face. That network activity is **model acquisition**, not image inference: captured product images and candidate labels are passed to the local pipeline and are not uploaded by this adapter.

The catalog stays in page memory. Product labels are neither persisted nor exported. Changing the model/device/catalog fingerprint changes the recognizer ID and therefore freezes any retained session until the facilitator starts a fresh benchmark session.

CLIP scores are closed-set ranking scores, not calibrated probability or SKU authority. A generic category hit is still insufficient; the benchmark must use deliberately confusing product variants.

## Timed interaction

A timed attempt starts when the tester selects:

> Start timed recognition

The timer includes:

1. camera frame capture;
2. recognizer latency;
3. ranked candidate display;
4. human confirmation/rejection.

Terminal outcomes are:

- top-1 candidate confirmed;
- rank 2–3 candidate confirmed;
- candidate set rejected;
- all shown candidates rejected;
- no candidate;
- 12-second timeout;
- manual fallback;
- recognizer error;
- frame-capture error.

The timeout owns wall-clock completion even if a recognizer promise never resolves.

Results arriving after timeout, fallback, cancellation or component teardown are stale and must not create a second outcome.

## Evidence

The retained/exported evidence may contain:

- device/browser user agent;
- viewport;
- recognizer ID;
- declared data boundary;
- timestamps/durations;
- candidate count;
- selected rank;
- numeric top confidence;
- structured outcomes;
- preference/effort.

It must not contain:

- camera images or video frames;
- base64/blob URLs;
- product candidate labels;
- product/item names;
- prices or budgets;
- store identity;
- location;
- account/email identity.

Candidate labels exist only in transient UI memory for human review.

## Model/provider benchmark gate

Before any production visual-recognition work:

1. use the pinned local CLIP experimental adapter defined above;
2. preserve its exact model revision, prompt version and candidate-catalog fingerprint per retained session;
3. use a representative retail fixture/device corpus;
4. include same-brand/different-size and same-design/different-flavour confusions;
5. include glare, angle, partial occlusion and ordinary store lighting;
6. measure top-1 and top-3 accuracy;
7. measure median/P75/P90 human-confirmed time;
8. record no-result/error/fallback/correction rates;
9. compare against the manual baseline;
10. record repeated-use preference and cognitive effort.

Category-only success such as “chocolate” or “milk carton” is not enough if the product flow requires SKU-level identity.

## Promotion rule

Production `VisualProductRecognizer` remains **GATED** until a concrete adapter demonstrates meaningful value on representative physical-device evidence.

A positive result must not remove the complete manual path.

If the benchmark is weak, simplify/defer visual recognition rather than compensating with hidden auto-commit or lower confidence thresholds.
