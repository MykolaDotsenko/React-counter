# Retention Study Log Template

## Status

**FACILITATOR TEMPLATE.**

This file is a template for running issue #72. It is not app evidence and must never be committed with real participant data.

The authoritative behavioural evidence remains the privacy-safe JSON exported from the guarded beta and the aggregate summary produced by the local cohort analyzer.

## Purpose

Keep participant uniqueness, observation timing and qualitative notes outside the app evidence payload without introducing names, email addresses or shopping content into the recorder.

## Privacy rules

- use an external study code such as `P001`;
- never add the study code to the app evidence JSON;
- never record names, email addresses, phone numbers, store names, budgets, prices or shopping lists in this template;
- if contact details are needed for scheduling, keep them in a separate private system outside the repository and outside exported evidence;
- do not commit completed participant logs to the public repository;
- downloaded beta JSON must remain unchanged;
- a facilitator may rename the local file with the external study code, but must not edit the JSON body.

## Standard participant instruction

Use the same neutral framing for each participant before the first real trip:

> This app is intended to help track a shopping-trip budget while you shop. Please use it naturally during a real shopping trip. There is no correct way to use it, and we are evaluating the product rather than you. Use or ignore features as you normally would. If you choose to use it again on a later real trip, do so only because it is useful to you — not because the study expects you to return.

Do not tell participants that the primary metric is second-trip retention before the observation window closes. Do not frame Recent Items, Price Memory or any other feature as something they are expected to use.

## Facilitator neutrality protocol

During the study:

- do not coach participants toward a particular workflow, feature or outcome;
- do not prompt a participant to reuse the app merely to create a second-trip event;
- do not remind a participant to use Recent Items or Price Memory during a trip;
- answer genuine operational questions briefly and neutrally, without recommending a feature;
- record any material facilitator intervention in the private notes so the affected session is interpretable;
- intervene immediately for safety or a blocking technical problem; study purity never outranks participant safety;
- if compensation is used, keep it independent of return behaviour, feature usage and whether the product result is positive;
- do not silently reset evidence after a failure; preserve/export what is valid, record the exclusion reason if needed, then follow the documented reset path.

Follow-up contact may ask for the latest evidence export or whether the app was actually used again. It must not instruct the participant to create another shopping trip for the sake of the study.

## Missing follow-up and attrition

Treat missing evidence conservatively:

- a participant's latest valid export is observed only through its `generatedAt` timestamp;
- if the latest export is still inside a 7/14/30-day window, that participant remains right-censored for that window even if later follow-up is missing;
- no response to a follow-up message is not evidence of non-retention;
- a participant who cannot provide a later export must not be manually upgraded to a failure beyond the last valid observation time;
- preserve invalid/excluded-session reasons separately from product outcomes;
- do not replace a missing participant with a new study code and then describe the final set as if there were no attrition.

Report recruitment count, analyzable participant count and window-specific eligible denominators separately. For a convenience sample, describe it as such rather than generalizing the result to all shoppers.

## Cohort identity log

Copy this table into a private facilitator document.

| Study code | First real trip | Latest export filename | `buildRevision` | Latest `generatedAt` | Import status | 7-day due/known | 14-day due/known | 30-day due/known |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| P001 | YYYY-MM-DD | P001-retention.json | 40-char Git SHA | ISO timestamp | valid / replace / exclude | date / known | date / known | date / known |

Rules:

- one real person = one study code;
- one study code = one retained beta session in the final cohort;
- newer exports from the same retained session replace older exports;
- invalidated/reset sessions are excluded rather than counted as new participants;
- synthetic fixtures and manually constructed JSON never enter the real cohort;
- all participants interpreted in one cohort must have the same `buildRevision`; keep different revisions in separate analyses.

## Per-participant qualitative notes

Capture these outside the app evidence after a real trip:

- Did remaining budget make sense immediately?
- Did manual price entry interrupt normal shopping?
- Was one-handed use comfortable?
- Did the shopper trust totals and persistence?
- Did Recent Items or Price Memory reduce effort?
- What was the biggest friction moment?
- Was any correction/Undo needed?
- Would the shopper choose to use the app on the next real trip?
- On follow-up: did they actually use it on the next real trip?

Keep notes short and behavioural. Do not copy shopping content into the notes.

## Recruitment / observation checklist

Before interpreting the cohort:

- [ ] 20–50 unique real shoppers have been recruited.
- [ ] Every included participant used the app on at least one real shopping trip.
- [ ] Each included participant has exactly one current retained session in the final analysis.
- [ ] Current-schema exports are preserved unchanged.
- [ ] Invalid/tampered exports are excluded and recorded as exclusions.
- [ ] Duplicate/stale exports are replaced rather than double-counted.
- [ ] The cohort analyzer invalid/duplicate/replacement/revision-mismatch counters were reviewed.
- [ ] Every included export has the same source `buildRevision`.
- [ ] The aggregate summary was downloaded and preserved.
- [ ] Qualitative notes remain separate from app evidence.
- [ ] No participant PII was added to app JSON or committed to the repository.

## Interpretation readiness

Imported participant count is not enough to interpret a time window.

Do not interpret:

- 7-day retention until at least 20 participants are eligible for the 7-day window;
- 14-day retention until at least 20 participants are eligible for the 14-day window;
- 30-day retention until at least 20 participants are eligible for the 30-day window.

Participants still inside a window are right-censored, not failures.

Use `docs/research/PRODUCT-SUCCESS-STRATEGY.md` only as a provisional internal interpretation aid. It is not an industry benchmark and real cohort evidence overrides it.

## Decision record

When a window becomes interpretable, record:

### Evidence snapshot

- cohort participants:
- activated participants:
- second-trip participants:
- observed second-trip share:
- third-trip participants:
- observed third-trip share:
- 7-day eligible / retained:
- 14-day eligible / retained:
- 30-day eligible / retained:
- trip completion:
- manual-entry abandonment:
- median completed manual-entry duration:
- participants using remembered items:
- current-price overrides:

### Qualitative themes

- strongest value signal:
- most repeated friction:
- trust/persistence concerns:
- repeat-use acceleration signal:
- unexpected behaviour:

### Decision

Choose one and explain with evidence:

- **continue core / preserve interaction**
- **remediate core friction and re-test**
- **defer new feature breadth**

Do not convert a small directional cohort into causal claims or a market-size claim.
