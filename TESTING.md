# Testing

## Purpose

Testing protects the product promise, not just implementation details.

The target shopping budget companion handles money under real-time, distracted use. The quality bar therefore prioritises:

- exact arithmetic
- persistence reliability
- fast correction
- mobile usability
- accessibility
- graceful degradation of optional capabilities

The current repository already has Vitest, React Testing Library, Playwright, axe, and a multi-browser CI matrix. Preserve that foundation while replacing counter-specific scenarios with shopping-domain coverage.

## Scenario-driven quality gates

SCENARIOS.md is the authoritative scenario matrix.

Before a release or significant feature merge:

- Tier 0 scenarios must have explicit test coverage or a documented manual verification path when automation is not yet practical
- any implemented scenario with proposed UX below 90/100 must be treated as unresolved product risk
- bugs discovered in a scenario must add regression coverage at the lowest useful layer
- optional smart features must be tested against the manual baseline they are supposed to improve

The flagship MVP E2E should exercise the Tier 0 shopping journey end to end, not merely isolated controls.

## Definition of done

A feature is not complete until:

- lint passes
- TypeScript typecheck passes once migration begins
- relevant unit tests pass
- relevant component tests pass
- production build passes
- affected Playwright flows pass
- accessibility expectations remain satisfied
- target documentation is updated when behaviour or contracts change

No feature may rely on “manual QA later” for a critical money or persistence rule.

## Quality layers

### 1. Domain unit tests

Highest density of tests.

Cover pure rules without React or browser dependencies.

Primary areas:

- money parsing
- minor-unit arithmetic
- currency constraints
- line totals
- quantity
- cart total
- remaining and safe remaining
- safety buffer
- over-budget boundaries
- discount rounding once implemented
- reconciliation difference
- price-source transitions
- price-confidence transitions

### 2. Persistence tests

Cover schema and failure behaviour.

Primary areas:

- fresh state
- active-trip restore
- completed-trip restore
- malformed JSON
- missing fields
- legacy Pulse Counter keys
- supported schema migration
- unsupported future version
- storage unavailable
- quota/write failure
- immediate persistence after committed mutation

### 3. Component tests

Test user-visible semantics and interaction contracts.

Primary areas:

- start trip
- price input
- projected remaining preview
- quantity change
- over-budget warning
- add anyway
- undo
- edit/remove
- safety-buffer changes
- price-origin labels
- persistence warning

Prefer role/name queries over implementation selectors.

### 4. Browser E2E tests

Protect critical real workflows.

Primary browsers remain:

- Chromium
- Firefox
- WebKit

Add mobile-focused projects when the product UI migration reaches a stable state.

## Canonical money scenarios

These values should appear in tests as readable fixtures.

### Basic exact arithmetic

Budget: EUR 50.00

Items:

- EUR 3.79
- EUR 12.50
- EUR 7.99

Expected:

- cart total: EUR 24.28
- remaining: EUR 25.72

### Quantity

Budget: EUR 20.00

Item:

- EUR 1.29 × 3

Expected:

- line total: EUR 3.87
- remaining: EUR 16.13

### Safety buffer

Budget: EUR 50.00

Buffer: EUR 2.00

Cart: EUR 43.00

Expected:

- nominal remaining: EUR 7.00
- safe remaining: EUR 5.00

### Safe-limit crossing

Budget: EUR 50.00

Buffer: EUR 2.00

Current cart: EUR 47.00

Pending item: EUR 2.00

Expected after commit:

- cart total: EUR 49.00
- nominal remaining: EUR 1.00
- safe remaining: -EUR 1.00
- safe limit exceeded
- nominal budget not exceeded

### Nominal over-budget

Budget: EUR 50.00

Current cart: EUR 48.00

Pending item: EUR 4.00

Expected projection:

- EUR 2.00 over nominal budget
- user can cancel or explicitly add anyway

## Invariants to property-test where practical

For valid trip states:

- cartTotal equals the sum of line totals
- remaining + cartTotal equals budget
- safeRemaining + cartTotal equals budget - buffer
- removing an item decreases total by exactly that line total
- add then undo restores the previous canonical total
- serialise then restore preserves canonical state

Use fast-check for property-style coverage of money and selector invariants once Phase 1 TypeScript work begins.

Randomised/property-style tests are more valuable here than many hand-picked examples alone because the domain exposes algebraic invariants.

## Money correctness rules

All MVP money tests must comply with docs/specs/MONEY-SPEC.md.

MVP currency scope is EUR only.

Tests must prove:

- canonical money never depends on binary decimal addition
- canonical parsing never uses parseFloat + multiplication
- comma and period EUR decimal input follow MONEY-SPEC.md
- extra fraction digits are rejected rather than silently rounded
- values such as 0.1 + 0.2 cannot introduce user-visible drift
- formatting does not mutate canonical values
- quantity multiplication remains a safe integer
- rounding policy is explicit for every future percentage calculation

A useful portfolio proof point is a large deterministic cart with zero rounding drift.

The parser test matrix in MONEY-SPEC.md is mandatory Phase 1 coverage, including valid, invalid, auto-cents, product-limit, and floating-point regression cases.

## Critical E2E journey

This journey operationalises the highest-priority scenarios from SCENARIOS.md.

The minimum flagship browser scenario:

1. open app with clean storage
2. choose EUR 50 budget
3. add EUR 3.79
4. add EUR 12.50
5. change quantity on an item
6. verify remaining amount
7. reload page
8. verify cart and budget restored exactly
9. add an item that crosses safe limit
10. undo
11. add an item that crosses nominal budget
12. cancel warning
13. finish trip
14. optionally enter actual checkout total
15. verify completed summary

## Reload and interruption testing

Stores are distracting environments. The app must survive interruption.

Test:

- reload immediately after add
- reload after edit
- reload after undo
- close/reopen simulated browser context with persisted storage where practical
- resume after offline launch

A committed item must not disappear because an animation or asynchronous helper had not finished.

## Persistence failure tests

Simulate storage exceptions.

Expected behaviour:

- valid in-memory state remains usable
- persistence-health state becomes degraded
- UI shows a clear warning
- core arithmetic remains correct
- no false “saved” status appears

The current Pulse Counter silently falls back to memory. Shopping behaviour must explicitly test the new visible-failure contract.

## Price-origin tests

### Remembered price

When a remembered price is suggested:

- age is available to the UI
- optional store is available
- cart does not change until selection/confirmation
- origin remains remembered unless explicitly confirmed current

### Scanned price

Scanner candidate:

- cannot change cart before confirmation
- can be rejected
- supports multiple candidate resolution

### Estimated price

Estimated status survives:

- edit
- persistence round trip
- cart summary derivation

## B6 physical-evidence QA tests

The guarded timing QA is human-evidence infrastructure, not a machine benchmark.

Tests must prove:

- only the documented EUR 500 / zero-buffer EUR 4.79 and EUR 12.50 quantity-1 samples count toward the timing KPI
- v2 QA evidence migrates to v3 without losing valid samples or device labels
- migration never fabricates the new physical-context evidence
- release eligibility requires:
  - primary device/browser label
  - compact-phone/equivalent label
  - explicit comparable input-method label
  - phone-like portrait viewport
  - light appearance for the primary pass
  - one-handed confirmation
  - bright/store-like physical lighting confirmation
  - default system text size confirmation
  - complete one-hand/correction/stability checklist
- dark appearance, 200%/large-text, and reduced-motion physical spot-checks remain explicitly `not-run`, `pass`, or `fail`
- `not-run` does not fabricate evidence
- a recorded secondary spot-check failure blocks release eligibility immediately
- resetting timing samples does not silently erase the structured device/context checklist
- QA evidence persistence failure cannot alter shopping state
- component tests cover the structured physical-evidence controls

Automation can verify this recorder contract. It cannot prove the human ≤2.5 s KPI.

## Retention beta evidence tests

The guarded retention beta must prove:

- evidence stays local unless the user explicitly copies it
- the schema contains no prices, budgets, item names, product/store identity, or checkout values
- trip ordinals are relative to the beta evidence session, not pre-existing shopping history
- starting the recorder mid-trip does not fabricate a `trip_started` event
- item milestones are deduplicated per trip
- manual entry completion and abandonment are distinguishable
- remembered-price reuse and current-price override are distinguishable
- malformed beta evidence falls back safely without affecting shopping state
- the event log is bounded
- the beta panel cannot block the primary mobile Add price control
- the beta build is noindex and independently build-gated in CI

The beta recorder is QA/validation infrastructure. Failure to save beta evidence must never affect active-trip persistence or money correctness.

## Technology-specific test policy

### Application controller

The selected custom ShoppingAppController + useSyncExternalStore architecture requires tests that prove:

- immutable/cached snapshot identity between changes
- one notification per committed application-state change
- no notification for rejected/no-op command
- persistence failure still publishes degraded in-memory state
- React adapter observes the same canonical snapshot as controller.getSnapshot()

### Zod boundaries

Phase 3 implements this boundary. Tests must continue to prove:

- valid storage DTO maps to domain state
- invalid DTO never becomes branded domain data
- unsupported versions fail before domain reconstruction
- malformed/future raw active-trip data is preserved rather than overwritten
- schema validation and domain invariant validation remain separate test concerns
- legacy Pulse values are never converted into shopping money

### PWA

When vite-plugin-pwa lands:

- production base/scope works under the GitHub Pages subpath
- offline shell opens after first successful load
- update prompt does not force active-trip reload
- Cache Storage never becomes business-state authority

## Barcode adapter tests

Do not make camera hardware the only way to test barcode behaviour.

Native BarcodeDetector support is incomplete, so tests must exercise both:

- native-capability adapter branch
- lazy WASM fallback branch

Use deterministic adapter fixtures for:

- supported barcode result
- unsupported barcode
- product found
- product not found
- service timeout
- malformed remote response

All failures must preserve manual price entry.

## OCR/price-scan tests

Tesseract.js is only the first benchmark candidate, not a locked provider.

Before retaining it as a production dependency, benchmark on representative mobile hardware and shelf-label fixtures against the manual-entry baseline.

Use static fixtures before camera E2E.

Cases should include:

- one obvious price
- multiple prices on one label
- superscript cents
- unit price plus product price
- discount and regular price
- no valid price
- malformed scanner response

The product must never silently pick a risky candidate when ambiguity is known.

## Accessibility tests

Automated axe checks are necessary but not sufficient.

Automated checks:

- WCAG A/AA axe scan
- landmarks
- accessible names
- no obvious contrast/ARIA violations

Interaction tests:

- keyboard-only start → add → edit → finish
- focus restoration after modal/sheet close
- announcement of committed remaining value
- disabled states when applicable
- no colour-only over-budget state

Manual/visual checks before major release:

- 200% text zoom
- reduced motion
- forced colours
- 320–390px width
- large text
- touch target sizing

## Motion tests

Reduced-motion mode must preserve all behaviour.

Test that:

- add works with reduced motion
- undo works with reduced motion
- no financial commit depends on View Transition callback
- animation failure does not duplicate or drop a mutation

The strongest lesson from the existing Pulse Counter remains: decorative capability failure must not alter domain correctness.

## Mobile/browser matrix

Target stable matrix:

- Desktop Chromium
- Desktop Firefox
- Desktop WebKit
- mobile Chromium viewport/device profile
- mobile WebKit viewport/device profile

Do not multiply CI projects before stable product flows exist. Add coverage when it protects a distinct browser/input risk.

## Offline/PWA tests

Once PWA work lands:

Test:

- first online visit installs required shell resources
- subsequent offline launch reaches the active trip
- adding/editing/removing items works offline
- network-dependent scanning/product lookup explains unavailability without breaking core UI
- service-worker update does not discard shopping state

## Visual regression

Use selectively.

Good candidates:

- empty active trip
- comfortable budget state
- near-limit state
- over-budget warning
- mobile keypad
- reduced-motion layout if visually distinct

Do not create a brittle full-app screenshot suite for every animation frame.

## Retention-beta evidence tests

The guarded retention beta must remain a validation tool rather than a hidden analytics product.

Test at unit/component/browser levels that:

- malformed retained evidence falls back safely
- event history is bounded
- trip ordinals are session-relative rather than derived from shopping history
- 1 / 5 / 10 item milestones deduplicate per trip
- second-trip 7 / 14 / 30 day windows derive from timestamps only
- reset is blocked during an active trip
- a repeated-trip browser journey records new → finish → repeat → remembered reuse
- the retention storage/export contains no money, item-name, product-id, memory-id, store-id, or checkout-total fields
- recorder/storage failures never alter shopping behaviour
- beta UI remains collapsed and accessible by default

The beta harness must never be interpreted as a substitute for real-store observation, interviews, or cohort analysis.

## Performance checks

Critical interactions should remain local and immediate.

Measure where useful:

- time to interactive on production build
- bundle size trend
- input-to-render responsiveness for add/undo
- scanner bundle isolation/lazy loading

Optional scanner libraries must not penalise the initial manual-entry path unnecessarily.

## Security/privacy tests

If remote services are introduced later:

- no financial or shopping data is transmitted without documented reason
- API keys are not exposed in client code when secrecy is required
- camera permission denial is handled
- user content is not retained remotely beyond documented need

## Regression policy

Every confirmed production bug should gain the smallest durable automated regression test at the appropriate layer.

Examples:

- arithmetic bug → domain unit test
- migration bug → persistence test
- focus bug → component/E2E test
- browser-specific scanner bug → adapter/browser test

## Test naming

Test names should express behaviour and consequence.

Prefer:

> restores the active cart after reload without changing the remaining amount

Over:

> works correctly

## Test data

Use obviously synthetic products and stores in automated tests.

Avoid personal financial data and real user shopping history in fixtures.

## Phase 1 money acceptance

Before the exact-money foundation is considered complete:

- every MONEY-SPEC parser fixture passes
- arithmetic/property invariants pass
- unsupported currencies are rejected
- product maximum is enforced
- quantity multiplication is exact
- no epsilon-based assertions are used for canonical money
- formatter tests use explicit locale values

## CI target

Target command shape after TypeScript migration:

~~~text
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
~~~

The exact scripts may evolve, but CI should make the complete quality contract easy to run locally.

## What not to test

Avoid tests that only reproduce implementation details such as:

- internal hook call order
- exact CSS class names without semantic reason
- private reducer helper structure
- decorative particle positions unless visually contractual

Protect behaviour, invariants, and user outcomes.

## Release checklist

Before a significant release:

- all quality gates green
- active-trip persistence verified
- money invariants verified
- mobile primary flow verified
- offline behaviour verified where implemented
- accessibility scan green
- reduced-motion flow works
- no known silent data-loss path
- docs match shipped behaviour
- SCENARIOS.md Tier 0 coverage reviewed
- README does not advertise target-only features as completed
