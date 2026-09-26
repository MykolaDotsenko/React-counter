# Shelf-label OCR Benchmark

## Status

**IMPLEMENTED provider-neutral benchmark harness; OCR engine/model evidence pending.**

This document owns the experimental protocol for reading shelf-label text and producing exact-money price candidates.

The harness is deliberately not production OCR. It exists to answer:

> can a concrete OCR engine plus deterministic price-candidate parsing reduce end-to-end manual price-entry friction enough to justify product integration?

## Guarded route

Target route:

> `/shopping-budget-companion/shelf-label-ocr-benchmark/`

Build flag:

> `VITE_SHOPPING_OCR_BENCHMARK=1`

The route is isolated from the shopping lifecycle:

- no ShoppingTrip/cart mutation;
- no Price Memory mutation;
- no automatic canonical money;
- no PWA/service worker;
- no analytics;
- no retained/exported camera image;
- no retained/exported OCR text;
- no retained/exported price value.

## Architecture

The benchmark has two independent boundaries.

### OCR engine boundary

A concrete `ShelfLabelOcrEngine` adapter must declare:

- a stable bounded engine/model ID;
- whether image bytes stay `local-only` or cross a `remote-image` boundary;
- an async OCR call that accepts one transient image plus an `AbortSignal`;
- bounded OCR text and optional 0–1 confidence.

The provider-neutral harness remains independently testable from concrete OCR engines.

The first concrete engine experiment is documented in [TESSERACT-OCR-EXPERIMENT.md](./TESSERACT-OCR-EXPERIMENT.md): pinned Tesseract.js 7.0.0 with LSTM `fin+swe+eng`, browser-local camera-image inference and explicit worker lifecycle cleanup.

### Deterministic price parser

Raw OCR text remains transient and is passed into `parseShelfPriceCandidates`.

The parser:

- uses the existing exact-money `parseEurDraft` contract;
- accepts explicit comma/dot decimal prices;
- accepts split-cents only when anchored by an explicit euro marker;
- accepts whole-euro prices with an explicit euro marker;
- refuses to invent a decimal point in bare OCR digits;
- ignores percentage-only discounts as money;
- keeps unit prices and multi-buy totals visible but ranks direct product-price candidates above them;
- recognizes nearby regular-price and loyalty-price context;
- deduplicates equal monetary values after ranking;
- caps input length and candidate count.

OCR text is never canonical money. Parsed candidates are transient review objects only.

## Timed interaction

A timed attempt starts when the tester selects:

> Start timed OCR

The timer includes:

1. camera frame capture;
2. OCR engine latency;
3. deterministic candidate parsing;
4. candidate display;
5. human confirmation/rejection.

Terminal outcomes are:

- top-1 candidate confirmed;
- rank 2–3 candidate confirmed;
- all shown candidates rejected;
- no safe candidate;
- 12-second timeout;
- manual fallback;
- OCR engine error;
- parser error;
- frame-capture error.

A timeout owns wall-clock completion even if an OCR promise never resolves.

Results arriving after timeout, fallback, cancellation or teardown are stale and must not create a second outcome.

## Privacy contract

Retained/exported evidence may contain:

- device/browser user agent;
- viewport;
- OCR engine ID;
- declared image data boundary;
- timestamps/durations;
- candidate count;
- selected rank;
- numeric OCR confidence;
- structured outcome;
- repeated-use preference/effort.

It must not contain:

- image/video bytes;
- image/object/blob URLs;
- raw OCR text;
- parsed price values;
- candidate display values;
- item/product names;
- budget/cart contents;
- store identity;
- location;
- account/email identity.

The user may see transient OCR-derived prices in the candidate review UI, but those values are never retained in benchmark evidence.

## Required fixture and field cases

Before production OCR is considered, a concrete engine adapter should be tested against:

- one obvious product price;
- comma and dot decimals;
- split/superscript-style cents;
- product price plus unit price;
- regular price plus loyalty/member price;
- regular price plus discounted price;
- multi-buy offer such as `2 kpl 5 €`;
- percentage discount that must not become money;
- multiple unrelated numbers on the label;
- no valid product price;
- glare;
- angle;
- blur;
- less favourable lighting;
- representative Finnish/Nordic shelf labels.

Static OCR-text fixtures validate parser correctness. They do not substitute for physical camera/OCR evidence.

## Required metrics

At minimum retain:

- top-1 correct-candidate rate;
- top-3 correct-candidate rate;
- median/P75/P90 capture → human-decision time;
- no-candidate rate;
- OCR/parser/capture error rate;
- correction/rejection rate;
- manual fallback rate;
- camera/permission friction;
- repeated-use preference;
- cognitive effort.

Compare the result with the same-device manual price-entry baseline.

## Promotion rule

Production price tag reading was promoted by owner decision before issue #90 (D-055). Issue #90 now decides after release whether it stays, needs remediation or is switched off.

If approved later, production OCR must preserve:

1. OCR output is untrusted candidate text;
2. deterministic exact-money parsing is separate from OCR;
3. parsed prices are candidates, never canonical money;
4. ambiguous candidates require human choice;
5. user confirmation precedes ShoppingTrip mutation;
6. slow/failing OCR returns cleanly to complete manual entry;
7. image/OCR data boundaries remain explicit;
8. OCR/model code is lazy and outside the critical initial bundle.

A visually impressive camera demo that is slower or less trustworthy than manual entry should not ship.
