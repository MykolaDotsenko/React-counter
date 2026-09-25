# OCR Paired Benchmark Decision Template

## Status

**FACILITATOR TEMPLATE.**

Use this template for issue #90 after collecting:

1. representative physical-phone OCR benchmark evidence from the concrete Tesseract route;
2. structured manual-entry timing evidence from `/qa/` on the same physical device/build context.

This template is not evidence by itself.

## Local paired analyzer

Use the guarded facilitator route:

> `/shopping-budget-companion/ocr-paired-analyzer/`

The analyzer imports exactly one structured manual-timing export and one shelf-label OCR benchmark export in page memory.

It:

- runtime-validates both source payloads;
- rejects edited/tampered derived OCR summaries/privacy metadata;
- requires full immutable Git SHA revisions;
- requires matching `buildRevision`, user agent, viewport and normalized device label;
- validates the two manual timing fixtures;
- requires at least 10 timed OCR attempts;
- requires at least 10 human candidate decisions;
- requires repeated-use preference and cognitive effort;
- derives manual P90 from retained valid non-excluded fixture samples;
- compares median/P75/P90 of all human candidate decisions descriptively;
- reports OCR accuracy/failure/correction/fallback metrics;
- never chooses PROMOTE / REMEDIATE / DEFER.

Its aggregate export contains no raw timing samples, OCR samples, images, raw OCR text, shopping prices, device labels or source filenames.

## Evidence files

Preserve source JSON without editing.

Record separately:

- physical device:
- browser:
- orientation / viewport:
- lighting/context:
- OCR benchmark export filename:
- OCR `buildRevision`:
- OCR `generatedAt`:
- OCR engine ID:
- OCR data boundary:
- manual timing export filename:
- manual `buildRevision`:
- manual `generatedAt`:
- manual input method:
- paired aggregate filename:

Do not put shelf-label text, product/store identity, exact tested price values or personal data in this sheet.

## Context consistency

Before comparing:

- [ ] same physical phone;
- [ ] same browser/user-agent family;
- [ ] same portrait viewport/orientation;
- [ ] same exact full-Git-SHA `buildRevision`;
- [ ] manual timing uses one documented input method;
- [ ] manual physical-context checklist is complete;
- [ ] OCR export came from the intended concrete engine baseline;
- [ ] OCR decision timing covers capture → OCR → parse → human decision for confirmed and rejected candidate decisions;
- [ ] OCR worker/model preparation time is documented separately;
- [ ] source JSON was not edited;
- [ ] ground-truth correctness notes are preserved separately from privacy-safe app evidence.

If these conditions are not comparable, repeat or keep the data separate rather than normalizing by hand.

## Minimum evidence

### Manual interaction references

Retain:

- at least 10 valid low-price reference-fixture samples;
- at least 10 valid high-price reference-fixture samples;
- median;
- P75;
- derived P90;
- exact device/browser/input-method context.

These fixed prices are interaction-time references. They do not claim the OCR shelf labels contain the same values.

### OCR benchmark

Retain at minimum:

- 10+ timed attempts;
- 10+ human candidate decisions (top-1 / rank 2–3 / reject);
- top-1 correct-candidate rate;
- top-3 correct-candidate rate;
- median/P75/P90 capture → human-decision time across confirmed + rejected decisions;
- no-candidate / timeout / OCR / parser / capture failures;
- correction/rejection rate;
- manual-fallback rate;
- permission/camera friction naturally encountered;
- repeated-use preference;
- cognitive-effort score.

Do not manufacture failures solely to improve coverage.

## Comparison

| Metric | Manual reference | OCR benchmark | Interpretation |
| --- | ---: | ---: | --- |
| Median end-to-end interaction |  |  |  |
| P75 |  |  |  |
| P90 | derived by paired analyzer |  |  |
| Tail / slowest reference |  |  |  |
| Top-1 correct candidate | n/a |  |  |
| Top-3 correct candidate | n/a |  |  |
| OCR/parser/no-candidate failure | n/a |  |  |
| Correction/rejection | manual correction notes |  |  |
| Manual fallback | n/a |  |  |
| Camera/permission friction | n/a |  |  |
| Repeated-use preference |  |  |  |
| Cognitive effort |  |  |  |

Do not interpret a faster median as sufficient when accuracy, correction cost or tail latency is unacceptable.

## Decision

Choose exactly one.

### PROMOTE TO PRODUCTION DESIGN

Use only when representative physical evidence shows meaningful net benefit with acceptable accuracy, correction, fallback, latency and subjective cost.

Record:

- measured interaction benefit:
- top-1/top-3 result:
- tail-risk assessment:
- failure/correction/fallback assessment:
- user preference:
- cognitive effort:
- target-device concerns:
- production constraints:

### REMEDIATE AND RE-TEST

Use when OCR remains plausible but a concrete fix is required.

Record:

- blocking evidence:
- smallest remediation hypothesis:
- invariants that must remain unchanged:
- exact re-test criterion:
- whether a new immutable study baseline is required:

### DEFER OCR

Use when OCR does not reduce enough friction/trust burden to justify production complexity.

Record:

- evidence against promotion:
- strengths of manual entry to preserve:
- whether a narrower OCR use case remains worth testing:

## Production boundary

A PROMOTE decision still does not authorize silent price mutation.

Production OCR must retain:

- provider-neutral application boundary;
- transient raw OCR text;
- deterministic exact-money candidate parser;
- explicit user confirmation;
- complete manual fallback;
- lazy worker/model loading;
- cancellation/dispose lifecycle;
- no image/OCR persistence;
- no OCR code in critical initial startup bundle.

## Claim discipline

Do not claim:

- OCR is faster from one successful label;
- OCR is accurate from parser fixtures alone;
- universal phone support from one device;
- shelf price correctness from OCR confidence alone;
- product success from OCR preference;
- an interaction advantage without the paired manual baseline.

The repository records the result the evidence supports, not the result the implementation team prefers.
