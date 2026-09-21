# Sprint B Quality Gate Evidence

## Status

B6 code and automated evidence are implemented in PR #28 on the guarded shopping shell.

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

The empirical human timing/device section below is still pending and remains a production-switch blocker.

This document separates:

- automated product/engineering evidence
- empirical human interaction evidence

The two must not be conflated.

The default/public shell must remain Pulse Counter until the B6 automated gate is green **and** the required representative one-hand/manual checks are recorded.

## Contract

Authoritative sources:

- PRODUCT.md
- FUNCTIONALITY.md
- SCENARIOS.md
- UX.md
- DESIGN.md
- TESTING.md
- docs/ACCESSIBILITY.md
- docs/CORE-UI-EXECUTION-BRIEF.md
- ROADMAP.md

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

The public/default GitHub Pages root remains Pulse Counter.

A separate guarded empirical build is published at:

> **https://mykoladotsenko.github.io/React-counter/qa/**

Build flags:

- `VITE_SHOPPING_SHELL=1`
- `VITE_SHOPPING_QA_TIMING=1`

The QA build:

- is not the public/default product
- injects `noindex,nofollow,noarchive`
- stores timing evidence only in tab-scoped `sessionStorage`
- never writes timing evidence into ShoppingTrip or production persistence DTOs
- records a sample from intentional **Add price** activation until the canonical summary has rendered again
- automatically calculates median, P75 and maximum for the two required ordinary price-only tasks
- provides a manual one-hand/bright-store checklist
- can copy the raw evidence as JSON

The small **QA n/20** tab is fixed outside document layout. Keep the panel closed while measuring so it does not cover the shopping UI.

### Clean timing setup

For the 20 ordinary speed samples:

1. open the guarded QA URL on the physical phone
2. reset timing samples from the QA panel
3. start a **custom EUR 500 budget**
4. use **no safety buffer**
5. close the QA panel
6. perform 10 ordinary adds of EUR 4.79
7. perform 10 ordinary adds of EUR 12.50
8. use the same input method for all comparable samples
9. do not intentionally trigger nominal over-budget confirmation in the timing set
10. open the QA panel and record/copy the results

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
- input method used

### Decision thresholds

Target:

> median <= 2.5 seconds

Minimum release-quality floor:

> approximately 3 seconds or less

Interpretation:

- <=2.5 s median: target met
- >2.5 s and <=3.0 s median: usable release floor, but optimize before calling the speed target achieved
- >3.0 s median: B6 speed gate fails; do not switch the public shell

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
10. no release blocker from docs/CORE-UI-EXECUTION-BRIEF.md remains

Until then:

- keep `VITE_SHOPPING_SHELL=1` gating
- do not make the shopping shell the default/public build
- do not rewrite README as though the shopping product is shipped
- do not claim the <=2.5 second KPI has been achieved
