# Sprint B Quality Gate Evidence

## Status

B6 code and automated evidence are implemented in PR #28 on the shopping product.

The automated code head has passed:

- production dependency audit
- lint
- strict TypeScript
- unit/component tests
- production build
- Chromium browser/a11y suite
- Firefox browser suite
- WebKit browser suite

The first expanded B6 browser run exposed a real 360×800 price-entry overflow: the Add action ended below the viewport. The compact layout was corrected without reducing frequent controls below the 48 CSS px product target, and the subsequent browser matrix passed.

The empirical human timing/device section below is still pending. Under D-039, it is explicitly waived as a **development-sequencing blocker only** so Phase 6 implementation may continue. It remains unverified evidence and must not be described as passed.

The QA evidence recorder now treats empirical evidence as a strict contract rather than a free-form note:
- only EUR 4.79 / EUR 12.50 quantity-1 samples captured under the documented EUR 500, zero-buffer fixture count toward timing
- the timing viewport must be phone-like portrait width
- the captured appearance must be light for the bright-store primary pass
- both the primary timing device/browser and compact-phone/equivalent spot-check are named
- the comparable timing input method is recorded explicitly
- one-handed use, bright/store-like lighting, and default system text size are structured primary-context requirements
- typo correction, five consecutive adds, consistent input method, and compact spot-check are structured checklist requirements
- dark appearance, 200%/large text, and reduced-motion physical spot-checks are recorded independently when available
- a recorded secondary spot-check failure blocks B6 eligibility; not-run remains visible and does not pretend that a physical check happened
- samples outside the fixture remain visible as excluded evidence rather than silently contaminating the KPI
- QA schema v3 preserves valid v2 samples/device labels through migration but intentionally requires the new physical-context evidence before B6 eligibility
- every timing sample is integrity-checked: non-empty unique ID, positive finite duration, canonical ISO completion time, positive exact minor-unit price, safe integer quantity, and exact unit-price × quantity line-total consistency
- duplicate sample IDs and mathematically inconsistent samples are rejected instead of entering evidence summaries
- copied evidence uses a versioned `shopping-timing-evidence` export with a recomputed B6 summary; tampered exported summaries fail parser validation
- exports explicitly disclose that device metadata is present while item names/store history are absent and no network transmission occurs
- **Start fresh QA session** clears all QA evidence and recaptures the current viewport/appearance/environment so a changed physical setup cannot inherit stale environment metadata

This document separates:

- automated product/engineering evidence
- empirical human interaction evidence

The two must not be conflated.

The public Shopping Budget Companion may ship while this evidence remains pending, but the B6 human speed/usability target must stay labelled unverified until the required representative one-hand/manual checks are recorded.

## Contract

Current contract inputs:

- docs/PRODUCT.md
- docs/DESIGN.md
- docs/TESTING.md
- docs/quality/ACCESSIBILITY.md
- docs/ROADMAP.md
- docs/specs/RELEASE-SPEC.md

Supporting scenario/rationale inputs:

- docs/reference/SCENARIOS.md
- docs/reference/UX.md
- docs/archive/CORE-UI-EXECUTION-BRIEF.md

## Automated B6 evidence

The automated gate must prove:

### Correction

- backspace works before commit
- Clear works in one action
- Cancel preserves the active trip
- the most recent add has one-action Undo
- Undo restores the exact previous canonical trip
- Undo attempts persistence immediately
- failed Undo persistence keeps the restored in-memory trip and marks durability degraded
- reload clears ephemeral Undo state

### Exact shopping flow

Flagship journey:

1. clean launch
2. EUR 50 nominal budget
3. EUR 2 safety buffer
4. add EUR 3.79
5. add EUR 12.50
6. add EUR 1.29 × 3 = EUR 3.87
7. verify exact canonical total and safe remaining
8. enter an obvious typo and correct it before commit
9. cross the safety-buffer boundary without a second confirmation
10. preview a nominal-budget overage
11. cancel nominal-overage review without mutating the trip
12. add a valid item
13. reload
14. restore the exact canonical trip
15. continue adding

### Accessibility

Automated checks cover:

- start screen
- active-trip screen
- price-entry surface
- nominal-over-budget review
- keyboard focus return
- decision-focused projected-result semantics
- forced-colours critical controls
- reduced-motion add and Undo behavior
- no colour-only reserve boundary

Axe is necessary evidence, not sufficient evidence.

### Mobile / large text

Automated checks cover:

- 360 × 800-class viewport
- 390 × 844-class viewport
- common EUR 4.79 price-only flow without price-sheet scrolling at default text size
- no horizontal overflow
- 200% text sizing
- over-budget actions remain reachable at 200%
- frequent controls remain at least the documented 48 CSS px target by CSS contract

### Network independence

After the application shell is loaded, the manual core must continue to:

- start a trip
- add a price
- update exact remaining state
- Undo

with the browser network offline.

This does **not** claim offline cold-launch/installability. That remains the later PWA phase.

## Real-device QA build

The public/default GitHub Pages root is Shopping Budget Companion.

A separate guarded empirical build is published at:

> **https://mykoladotsenko.github.io/shopping-budget-companion/qa/**

Build flags:

- `VITE_SHOPPING_QA_TIMING=1`

The QA build:

- is not the public/default product
- injects `noindex,nofollow,noarchive`
- stores timing evidence only in tab-scoped `sessionStorage` under the versioned QA-only key `budget-cart:qa:timing-v3`
- reads legacy `budget-cart:qa:timing-v2` evidence and migrates valid timing samples without granting the new v3 physical-context requirements automatically
- never writes timing evidence into ShoppingTrip or production persistence DTOs
- records a sample from intentional **Add price** activation until the canonical summary has rendered again
- automatically calculates median, P75 and maximum for the two required ordinary price-only tasks using only the documented EUR 500 / zero-buffer measurement fixture
- provides a manual one-hand/bright-store checklist
- can copy a versioned, parseable evidence export as JSON; the derived B6 gate is recomputed from the validated session instead of trusted as free-form data
- offers a two-step **Start fresh QA session** action that clears QA evidence and recaptures environment metadata

The small **QA n/20** tab is fixed outside document layout. Keep the panel closed while measuring so it does not cover the shopping UI.

### Clean timing setup

For the 20 ordinary speed samples:

1. open the guarded QA URL on the physical phone
2. if the physical setup, appearance, viewport, or device changed, use **Start fresh QA session** so environment metadata is recaptured; otherwise reset only timing samples
3. start a **custom EUR 500 budget**
4. use **no safety buffer**
5. close the QA panel
6. perform 10 ordinary adds of EUR 4.79
7. perform 10 ordinary adds of EUR 12.50
8. use the same input method for all comparable samples
9. do not intentionally trigger nominal over-budget confirmation in the timing set
10. complete one obvious typo-correction check and five consecutive ordinary adds
11. record the compact-phone / equivalent spot-check label
12. record the exact input method used for comparable samples
13. confirm the structured one-handed, bright/store-like, and default-text primary context
14. confirm all one-hand, software-keyboard, correction, stability, and compact-device checklist items
15. record dark appearance, 200%/large-text, and reduced-motion physical spot-checks where available
16. open the QA panel and record/copy the results

EUR 500 is a measurement fixture, not a product recommendation. It prevents threshold confirmation from contaminating the ordinary price-entry timing sample while preserving the real production interaction path.

Run the documented typo-correction, one-hand, bright-light, software-keyboard and other qualitative checks separately and record them in the panel checklist/notes.

## Human timing protocol

### Why this is manual

The <=2.5 second target is a human interaction KPI.

A browser automation duration would measure machine input and test-runner scheduling, not representative one-hand shopping behavior.

Do not report the target as achieved from Playwright timings.

### Measurement boundary

For an ordinary manual add:

**Start:** the user intentionally activates **Add price** from the resting active-trip summary.

**Stop:** the committed item is visible in the canonical summary and the Add price control is available again.

This includes:

- opening price entry
- entering the price
- committing
- returning to summary

### Representative tasks

Measure at least:

1. EUR 4.79
2. EUR 12.50
3. five consecutive ordinary price adds
4. one obvious typo corrected before commit

### Device / context

At minimum record:

- one modern ~390 × 844-class phone
- one compact ~360 × 800-class phone or equivalent viewport/device
- portrait orientation
- one-handed use
- default text size
- system light appearance in bright indoor/store-like lighting

Also spot-check:

- dark appearance
- 200% text / large text
- reduced motion where available

### Samples

For ordinary price-only timing:

- at least 10 measured EUR 4.79 adds
- at least 10 measured EUR 12.50 adds
- discard only clearly documented interruptions unrelated to the app
- record all other attempts, including corrections

Report:

- median
- P75
- slowest observed attempt
- device/browser
- input method used consistently across comparable samples
- explicit comparable input-method label
- explicit one-handed / bright-store-like / default-text primary context
- primary timing device/browser label
- compact-phone / equivalent spot-check label
- phone-like portrait viewport and light appearance evidence

### Decision thresholds

Target:

> median <= 2.5 seconds

Minimum release-quality floor:

> approximately 3 seconds or less

Interpretation:

- <=2.5 s median: target met
- >2.5 s and <=3.0 s median: usable release floor, but optimize before calling the speed target achieved
- >3.0 s median: B6 speed gate fails; do not mark B6 as passed or expand input breadth based on the speed claim

### One-hand / bright-store checklist

Record pass/fail for:

- Add price is comfortably thumb reachable
- numeric keys are comfortably reachable
- Cancel is reachable without destabilizing grip
- projected remaining is readable before commit
- reserve/over-budget state is understandable without relying on colour
- Add does not move unpredictably between ordinary entries
- keypad closes after commit
- summary is readable in bright light
- no essential control is obscured by the mobile software keyboard
- repeated add flow does not require scrolling in the ordinary price-only case
- one obvious typo can be corrected before commit
- five consecutive ordinary adds remain stable and understandable
- the same input method is used for comparable timing samples
- the compact ~360 × 800 phone/equivalent spot-check is recorded

## B6 exit rule

B6 can be marked complete only when:

1. CI quality gate is green
2. Chromium is green
3. Firefox is green
4. WebKit is green
5. flagship E2E is green
6. accessibility checks are green
7. automated mobile/200%/reduced-motion/offline-runtime checks are green
8. human timing results are recorded
9. one-hand and bright-store checks are recorded
10. no unresolved B6 blocker from docs/archive/CORE-UI-EXECUTION-BRIEF.md remains

Until then:

- keep the human B6 result labelled unverified
- do not claim the <=2.5 second KPI has been achieved
- do not use automation as a substitute for physical one-hand evidence
- D-039 permits Phase 6 implementation to continue, but does not itself prove release quality
