# Barcode Paired Benchmark Decision Template

## Status

**FACILITATOR TEMPLATE.**

Use this template for issue #73 after collecting:

1. representative physical-phone barcode benchmark evidence from `/barcode-benchmark/`;
2. a quantitative manual-entry baseline from `/qa/` on the same representative device/context.

This template is not evidence by itself.

## Evidence files

Record the retained files without editing their JSON bodies.

- device/browser label:
- physical phone:
- orientation / viewport:
- lighting/context:
- barcode benchmark export filename:
- barcode `buildRevision`:
- barcode export `generatedAt`:
- manual timing export filename:
- manual `buildRevision`:
- manual export `generatedAt`:
- manual input method:

Do not place raw barcode values, product names, prices, store identity or participant PII in this decision sheet.

## Context consistency

Before comparing:

- [ ] both measurements use the same representative physical phone;
- [ ] browser/environment is materially comparable;
- [ ] portrait/orientation is fixed per retained session;
- [ ] lighting/context is documented;
- [ ] manual timing uses one consistent input method;
- [ ] manual evidence follows the documented EUR 4.79 / EUR 12.50 QA fixture;
- [ ] barcode timing measures scan → human confirm/reject/fallback rather than detector-only latency;
- [ ] neither export was manually edited;
- [ ] both exports contain valid full-Git-SHA `buildRevision` values;
- [ ] both exports use the same `buildRevision`; otherwise the comparison is invalid and must be repeated or kept separate;
- [ ] barcode evidence contains no raw barcode values.

If contexts are not comparable, mark the comparison as invalid and repeat rather than normalizing the data by hand.

## Minimum evidence

### Manual baseline

Use the structured QA path and retain:

- at least 10 EUR 4.79 ordinary adds;
- at least 10 EUR 12.50 ordinary adds;
- median;
- P75;
- maximum;
- exact device/browser and input method;
- relevant physical-context checklist.

### Barcode benchmark

Retain at minimum:

- 10+ confirmed scan → human-decision attempts;
- median confirmed duration;
- P75 confirmed duration;
- P90 confirmed duration;
- recognition-failure rate;
- correction/rejection rate;
- manual-fallback rate;
- detector/camera/permission failures when naturally encountered;
- repeated-use preference;
- cognitive-effort score.

Do not manufacture failure cases merely to improve coverage.

## Comparison

| Metric | Manual baseline | Barcode benchmark | Interpretation |
| --- | ---: | ---: | --- |
| Median end-to-end interaction |  |  |  |
| P75 |  |  |  |
| P90 | n/a if not available |  |  |
| Slowest / tail evidence |  |  |  |
| Recognition failure | n/a |  |  |
| Correction/rejection | manual typo/correction notes |  |  |
| Manual fallback | n/a |  |  |
| Permission/camera friction | n/a |  |  |
| Repeated-use preference |  |  |  |
| Cognitive effort |  |  |  |

Compare the end-to-end human interaction. Do not compare detector latency with a full manual interaction.

## Product boundary checks

A positive benchmark still does not authorize price automation.

Any future production barcode flow must preserve:

- barcode → product identity candidate only;
- explicit user confirmation;
- current shelf price entered/confirmed separately;
- complete manual fallback;
- provider/network failure cannot block the trip;
- no mandatory camera path.

## Decision

Choose one:

### PROMOTE TO PRODUCTION DESIGN

Use only when the physical evidence shows meaningful net interaction benefit and acceptable failure/correction/fallback cost.

Record:

- measured advantage:
- tail-risk assessment:
- user preference:
- cognitive-effort result:
- target-device support concerns:
- production constraints:

### REMEDIATE AND RE-TEST

Use when the hypothesis remains plausible but a specific benchmark problem is fixable.

Record:

- blocking issue:
- smallest remediation:
- what must remain unchanged:
- exact re-test criterion:

### DEFER BARCODE

Use when scan → human decision is not meaningfully better than manual entry, support is too narrow, or correction/permission/fallback cost removes the benefit.

Record:

- evidence against promotion:
- manual-flow strengths to preserve:
- whether any narrower scanner use case remains worth testing:

## Claim discipline

Do not claim:

- production barcode is faster from one successful scan;
- universal scanner support from one device;
- current-price accuracy from a barcode;
- product success from scanner preference;
- a quantitative advantage when the paired manual baseline is missing.

The repository should record the decision supported by evidence, not the outcome the team hoped to obtain.
