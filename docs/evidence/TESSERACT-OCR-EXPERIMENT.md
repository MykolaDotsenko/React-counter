# Tesseract.js Shelf-label OCR Experiment

## Status

**IMPLEMENTED concrete browser-local OCR adapter; representative physical-device evidence pending.**

This document owns the first named OCR-engine experiment under issue #90.

It does **not** authorize production OCR.

## Hypothesis

A pinned multilingual Tesseract.js worker may extract enough shelf-label text on representative phones for the existing deterministic exact-money parser to produce correct price candidates faster and with acceptable correction cost compared with manual price entry.

The experiment must measure the complete interaction:

> camera capture → OCR → deterministic price candidates → human decision

Do not compare OCR model latency alone with manual entry.

## Pinned runtime

Runtime dependency:

> `tesseract.js@7.0.0`

Engine mode:

> LSTM

Languages:

> `fin + swe + eng`

Default language dataset family:

> `4.0.0_best_int`

The Tesseract worker/core/language assets may be downloaded and cached by the browser. Camera images remain inside browser-side OCR and are not uploaded by this adapter.

Tesseract.js 7 is selected because it is the current pinned runtime for this experiment and upstream reports a recognition runtime improvement over v6.

## Guarded route

Target route:

> `/shopping-budget-companion/shelf-label-ocr-tesseract-benchmark/`

Build flag:

> `VITE_SHOPPING_OCR_TESSERACT_BENCHMARK=1`

This route is isolated from the shopping product:

- no ShoppingTrip mutation;
- no Price Memory mutation;
- no PWA/service worker;
- no analytics;
- no raw image persistence;
- no raw OCR-text persistence;
- no canonical money from OCR output.

## Data boundary

The adapter declares:

> `local-only`

This means camera image bytes are supplied to the browser-local Tesseract worker only.

Network activity may still occur for OCR implementation assets:

- Tesseract worker/runtime assets;
- WASM core assets;
- trained language data.

Those assets contain no camera image or shopping data.

## Preparation boundary

Worker/core/language preparation occurs **before** timed OCR attempts.

Record separately:

- first preparation observation;
- warm-cache preparation observation;
- whether preparation failed;
- tested device/browser/network conditions.

Do not include preparation time inside capture → human-decision metrics.

## Runtime lifecycle

The concrete adapter must preserve:

- one reusable prepared worker during normal attempts;
- pre-aborted calls do not invoke recognition;
- an in-flight abort terminates the active worker;
- failed workers are invalidated before reuse;
- a later attempt may recreate a worker;
- explicit dispose terminates worker resources;
- dispose is idempotent;
- post-dispose recognition is rejected.

The outer benchmark still owns timeout and stale-result semantics.

## Money authority

The engine returns only:

- transient OCR text;
- optional normalized confidence.

The money flow remains:

> OCR text → `parseShelfPriceCandidates` → existing exact-money parser → candidate review → human confirmation

Never:

> OCR text → implicit canonical price

The deterministic parser remains responsible for:

- decimal comma/dot handling;
- split-cent handling only with adequate anchors;
- percentage rejection;
- date/EAN/weight false-positive rejection;
- regular/member/unit/multi-buy context;
- candidate ranking and deduplication.

## Required field cases

At minimum:

- one obvious product price;
- comma decimal;
- dot decimal;
- split/superscript-style cents;
- product price plus unit price;
- regular plus loyalty/member price;
- regular plus discounted price;
- multi-buy;
- percentage discount;
- unrelated numeric text;
- date/weight/EAN-like traps;
- no valid price.

Physical conditions:

- normal store-like lighting;
- glare;
- angle;
- blur;
- lower-quality lighting;
- complex labels with several monetary-looking values.

## Required metrics

Retain:

- top-1 correct-candidate rate;
- top-3 correct-candidate rate;
- no-candidate rate;
- OCR error rate;
- parser error rate;
- correction/rejection rate;
- manual fallback rate;
- median capture → human-decision time;
- P75;
- P90;
- repeated-use preference;
- cognitive effort.

Compare against same-device manual price entry.

After collecting the two unchanged JSON exports, validate and compare them with the local [OCR paired decision template](./OCR-PAIRED-DECISION-TEMPLATE.md) and guarded `/ocr-paired-analyzer/` route. The analyzer is descriptive only; it never makes the PROMOTE / REMEDIATE / DEFER decision.

## Decision

The field experiment ends with one explicit human decision:

- **PROMOTE** — evidence supports production-oriented OCR design;
- **REMEDIATE** — OCR appears useful but this engine/configuration is not sufficient;
- **DEFER** — OCR does not currently reduce enough interaction cost/trust burden to justify production complexity.

No automated score makes this decision.

## Production boundary

Even a positive result does not allow silent price mutation.

Production OCR must still require:

1. provider-neutral OCR application boundary;
2. transient OCR text;
3. deterministic money candidate parsing;
4. explicit user confirmation;
5. complete manual fallback;
6. lazy model/worker loading;
7. camera/worker lifecycle cleanup;
8. explicit data boundary;
9. no OCR code in the public initial bundle until the user invokes the capability.
