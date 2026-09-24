# Transformers.js CLIP Retail Recognition Experiment

## Status

**IMPLEMENTED concrete experimental adapter; representative physical-device evidence pending.**

This document owns the first concrete recognizer experiment under issue #88.

It does **not** claim production SKU recognition.

## Hypothesis

A pinned browser-local CLIP zero-shot image classifier may be able to rank a small, explicitly configured set of retail product variants accurately and quickly enough to improve interaction versus manual product identification.

This is deliberately a baseline hypothesis.

If same-brand / different-size / different-flavour products are not reliably separated, the correct result is **REMEDIATE** or **DEFER**, not weaker confidence rules or automatic cart mutation.

## Pinned runtime and model

Runtime dependency:

> `@huggingface/transformers@4.3.0`

Model:

> `Xenova/clip-vit-base-patch32`

Pinned model revision:

> `d15189d`

Task:

> `zero-shot-image-classification`

Fixed hypothesis template:

> `a retail product package of {}`

Supported experiment devices:

- `wasm` — compatibility baseline;
- `webgpu` — accelerated experimental path when the browser exposes WebGPU.

Do not combine WASM and WebGPU sessions into one analytical cohort.

## Guarded route

Target route:

> `/shopping-budget-companion/visual-recognition-clip-benchmark/`

Build flag:

> `VITE_SHOPPING_VISUAL_CLIP_BENCHMARK=1`

This is a guarded evidence route:

- no production ShoppingTrip mutation;
- no Price Memory mutation;
- no automatic product authority;
- no PWA/service worker;
- no analytics;
- no model code in the public PWA bundle.

## Candidate-set contract

Before model preparation:

1. enter 3–30 unique candidate product labels;
2. use exact retail variants rather than broad categories;
3. keep every label <= 120 characters;
4. freeze the same candidate set for one retained cohort;
5. keep the same inference device for that cohort.

Example label quality:

- good: exact brand + product + flavour/variant + package size;
- weak: `milk`, `chocolate`, `juice`.

Labels remain transient in page memory.

The recognizer ID contains only:

- Transformers.js version;
- model family/revision;
- inference device;
- a truncated SHA-256 digest of the normalized label set.

Raw labels are not retained/exported in benchmark evidence.

## Data boundary

The adapter declares:

> `local-only`

Meaning:

- model/config/tokenizer/ONNX assets may be downloaded from the Hugging Face Hub;
- those assets may be cached by the browser;
- camera image bytes are passed to local browser inference;
- camera frames are not uploaded by this adapter;
- candidate labels are not uploaded by this adapter;
- benchmark evidence contains no candidate labels or raw images.

A future adapter that sends image bytes remotely must use a distinct `remote-image` boundary and a different recognizer ID.

## Timing boundary

Model download/loading is deliberately **outside** the existing timed recognition attempt.

The timed attempt remains:

1. capture one camera frame;
2. local CLIP inference against the frozen candidate set;
3. ranked candidate display;
4. human confirmation/rejection.

Cold model preparation still matters for product viability. Record first-load and warm-cache preparation observations separately in the issue #88 study notes; do not mix them into scan → decision timing.

## Required field cases

Use representative physical products and include:

- same brand / different package size;
- same brand / different flavour;
- visually similar variants;
- old/new package design where available;
- glare;
- angled package;
- partial occlusion;
- ordinary store lighting;
- less favourable lighting;
- multiple nearby packages while one target remains prominent.

Category-only correctness is insufficient when exact product identity is required.

## Metrics

Retain the existing visual benchmark metrics:

- top-1 correct-candidate rate;
- top-3 correct-candidate rate;
- median/P75/P90 capture → human-decision time;
- no-result rate;
- recognizer/capture error rate;
- correction/rejection rate;
- manual fallback rate;
- camera/permission friction;
- repeated-use preference;
- cognitive effort.

Also record separately:

- cold model preparation observation;
- warm-cache preparation observation;
- candidate-set size;
- inference device;
- whether the tested labels were exact SKU-like variants or broad descriptions.

## Decision rule

The experiment must end with one explicit human decision:

- **PROMOTE** — evidence supports proceeding to a production-oriented visual identity design;
- **REMEDIATE** — the concept is useful but zero-shot text labels are not reliable enough; test a stronger bounded recognizer such as reference-image embedding retrieval;
- **DEFER** — visual recognition does not currently beat simpler barcode/manual interaction enough to justify complexity.

No automated score selects the decision.

## Production boundary

Even a positive CLIP result does not authorize:

- silent ShoppingTrip mutation;
- inferred shelf price;
- automatic identity commitment;
- removal of barcode/manual fallback.

Production work, if authorized later, still requires a product-identity candidate contract plus explicit human confirmation.
