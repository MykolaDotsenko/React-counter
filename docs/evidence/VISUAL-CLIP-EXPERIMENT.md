# Visual CLIP Field Experiment

## Status

**Concrete benchmark adapter implemented; physical retail evidence pending.**

This document owns the field-study protocol for issue #88 using the merged CLIP implementation from PR #95.

It does not authorize production visual recognition.

## Pinned implementation

Runtime:

> `@huggingface/transformers@4.3.0`

Task:

> `zero-shot-image-classification`

Model:

> `Xenova/clip-vit-base-patch32`

Pinned model revision:

> `d15189d7028b43f1d3e65039190477f6af591c2a`

Prompt contract:

> `retail-package-v1`

The experiment attempts WebGPU first when available and falls back to WASM if model initialization fails.

Treat WebGPU and WASM sessions as distinct technical cohorts when interpreting performance.

## Candidate catalog

Use a facilitator-supplied JSON file:

```json
{
  "schemaVersion": 1,
  "labels": [
    "Brand product variant 200 g",
    "Brand product variant 300 g",
    "Brand product other flavour 200 g"
  ]
}
```

Rules:

- 3–30 unique labels;
- labels must be SKU-specific enough to expose confusing variants;
- include brand, variant/flavour and package size where relevant;
- do not use broad category-only labels such as `milk`, `juice` or `chocolate`;
- freeze one catalog for one analytical cohort;
- do not change labels after evidence collection starts.

The implementation canonicalizes and SHA-256 fingerprints the catalog. Raw labels are not persisted or exported in benchmark evidence.

## Data boundary

The recognizer declares:

> `local-only`

Meaning:

- model/config/ONNX assets may be downloaded and browser-cached;
- captured camera image bytes are used for local browser inference;
- captured image bytes are not sent by the recognizer for inference;
- candidate labels remain transient page memory;
- benchmark evidence contains no raw image or candidate-label content.

Model acquisition network traffic is not image-inference traffic.

## Timing boundary

Model setup is outside the timed interaction.

The timed benchmark remains:

1. capture frame;
2. run local recognizer;
3. show ranked candidates;
4. human confirms/rejects/falls back.

Record cold-model setup and warm-cache setup observations separately in study notes. Do not mix setup time into scan → decision timing.

## Required physical test cases

Use real retail products and include:

- same brand, different package size;
- same brand, different flavour/variant;
- visually similar package designs;
- old/new packaging where available;
- glare;
- angled package;
- partial occlusion;
- ordinary store lighting;
- less favourable lighting;
- multiple nearby packages with one intended target.

A category-level match is not sufficient when the product flow requires SKU-like identity.

## Required metrics

Use the existing visual benchmark evidence:

- top-1 confirmed rate;
- top-3 confirmed rate;
- median / P75 / P90 capture → human-decision time;
- rejected candidate rate;
- no-result rate;
- recognizer/capture error rate;
- manual fallback rate;
- camera/permission friction;
- repeated-use preference;
- cognitive effort.

Also record separately:

- device and browser;
- actual execution device reported by recognizer identity (WebGPU/WASM);
- candidate catalog size;
- cold setup observation;
- warm-cache setup observation;
- representative failure/confusion notes.

## Integrity rules

For one analytical cohort:

- use one immutable study baseline;
- require the exact retained `buildRevision`;
- keep one catalog fingerprint;
- keep one model revision;
- do not mix WebGPU and WASM timing without explicit stratification;
- do not edit exported JSON;
- keep fixture/product ground truth separately from privacy-safe evidence;
- treat same-brand wrong-size/wrong-flavour selection as incorrect, not “close enough”.

## Decision

End with one explicit human decision:

- **PROMOTE** — evidence supports production-oriented visual identity work;
- **REMEDIATE** — visual recognition looks useful but this zero-shot baseline is insufficient;
- **DEFER** — visual recognition does not currently justify the complexity.

Likely remediation if zero-shot labels cannot distinguish close variants:

> reference-image embedding retrieval or another bounded SKU-oriented recognizer.

Do not lower correctness standards merely to obtain a positive result.

## Production boundary

Even a positive benchmark does not authorize:

- silent ShoppingTrip mutation;
- inferred shelf price;
- automatic identity commitment;
- removal of barcode/manual fallback.

Any later production design must still produce a candidate and require explicit human confirmation.
