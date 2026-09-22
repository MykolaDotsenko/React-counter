# Core Shopping Execution Brief — Phase 4–5

## Status

Authoritative execution brief for the next two delivery sprints.

Scope:

- Sprint A — Phase 4: Core Budget Cart UI
- Sprint B — Phase 5: Ultra-fast Manual Price Entry

This brief operationalizes:

- PRODUCT.md
- ../specs/RELEASE-SPEC.md
- SCENARIOS.md
- UX.md
- DESIGN.md
- ARCHITECTURE.md
- TECH-STACK.md
- TESTING.md
- docs/research/PRODUCT-SUCCESS-STRATEGY.md
- ROADMAP.md

It does not replace those contracts.

## Mission

Turn the technically complete Phase 1–3 foundation into the first real, usable shopping product without weakening:

- exact money
- domain purity
- persistence reliability
- accessibility
- one-hand mobile use
- retention-first sequencing

The product must stop feeling like a counter and start feeling like:

> **A calm shopping companion that tells you how much you can still afford before checkout.**

## Non-goals for both sprints

Do not add:

- barcode scanning
- OCR
- Open Food Facts
- voice input
- PWA/service worker
- Price Memory
- Recent Items
- cloud sync
- family sharing
- backend/auth/database
- analytics platform
- native wrapper
- tax engine
- retailer integrations

Do not rename the public product while the final brand-name gate remains unresolved.

## Delivery rules

1. One responsibility per PR.
2. Every PR leaves main deployable.
3. Domain state is canonical; React UI never invents money/business state.
4. Persistence attempt happens immediately after committed state changes.
5. Animation never owns correctness.
6. No mandatory metadata in the basic add flow.
7. No visual redesign may weaken accessibility or one-hand ergonomics.
8. No optional feature may slow the manual path.
9. Remove compatibility code only when the shopping path is fully covered.
10. README must not advertise target-only behaviour before it ships.

# Sprint A — Phase 4: Core Budget Cart UI

Current progress:

- A0 — **complete**, Calm Utility selected
- A1 — **complete via PR #15**
- A2 — **complete via PR #17**
- A3 — **complete via PR #18**
- A4 — **complete via PR #19**
- A5 — **complete via PR #20**
- A6 — **complete via PR #21**

## Sprint objective

A first-time user can:

1. open the app
2. choose a budget
3. start shopping
4. immediately understand how much is left
5. see cart total / budget / safety-buffer context
6. reload and resume the same active trip
7. understand when saving is degraded

No manual keypad yet beyond the minimum shell required to expose Add price.

## Sprint exit statement

A new user should be able to look at the active screen for 3–5 seconds and correctly answer:

- what the app is for
- how much money remains
- how much has been added
- what to press to add another price

## Sprint A dependency graph

~~~text
A0 Design decision gate
      ↓
A1 ShoppingAppController + React bridge
      ↓
A2 App bootstrap / restore state
      ↓
A3 Start Trip screen
      ↓
A4 Remaining-first active screen
      ↓
A5 Persistence health UX
      ↓
A6 Mobile/a11y/E2E hardening
~~~

A0 and A1 may be developed in parallel only if the UI prototype does not require changing domain/application contracts.

## A0 — Design validation and final direction

Status: **complete**

Selected:

> **Calm Utility**

Decision record:

- docs/evidence/PHASE-4-DESIGN-VALIDATION.md

Priority: **100/100**

### Deliverables

Prototype the three documented directions:

- Calm Utility
- Premium Spatial
- Warm Everyday

Use the same canonical fixture in all three:

- budget EUR 50.00
- safety buffer EUR 2.00
- cart EUR 31.42
- safe remaining EUR 16.58
- nominal remaining EUR 18.58
- 3–5 cart items
- Add price visible

### Test questions

A first-time viewer must answer:

1. What is this app for?
2. How much can you still safely spend?
3. How much is in the cart?
4. What would you press to add EUR 3.79?
5. Are you close to the limit?
6. What does the progress visual mean?
7. Can you comfortably reach the primary action one-handed?

### Decision rule

Choose the direction with the best task comprehension and ergonomics.

Do not choose based on visual novelty.

### Done when

- one direction is explicitly selected
- rejected alternatives are documented
- hierarchy is fixed
- capacity visual semantics are fixed
- light/dark treatment is defined
- touch hierarchy works at compact mobile width
- no unresolved ambiguity remains about the hero number

## A1 — Shopping application controller

Status: **complete via PR #15**

Implementation evidence:

- plain TypeScript ShoppingAppController
- immutable/cached application snapshot
- useSyncExternalStore React bridge
- booting / idle / active / recovery lifecycle
- healthy / degraded persistence health
- injected persistence / clock / id ports
- rejected/no-op commands do not persist or notify
- failed writes keep committed in-memory state
- later canonical writes can heal degraded persistence
- live state cannot be clobbered by repeated bootstrap
- 21 controller tests + 2 React-bridge tests
- full PR suite: 151 tests
- Chromium / Firefox / WebKit / accessibility green

Priority: **100/100**

### Goal

Connect the Phase 1–3 pure layers to React without moving business rules into components.

### Required API

A small plain-TypeScript controller should own one canonical application snapshot.

Responsibilities:

- bootstrap persistence
- expose current active trip
- expose persistence health
- start trip
- apply trip commands
- persist committed state
- notify subscribers
- preserve valid in-memory state after write failure

React reads it through:

> useSyncExternalStore

### Must not

- depend on UI components
- compute money with floats
- duplicate the trip in React state
- persist through passive useEffect timing
- silently convert degraded persistence to healthy

### Tests

Cover:

- immutable/cached getSnapshot identity between changes
- one notification per committed state change
- no notification for rejected/no-op command
- successful start persists
- successful command persists
- failed write retains committed in-memory state
- failed write exposes degraded health
- restore returns exact active trip
- future/corrupt snapshot remains recovery state

### Done when

- controller tests are deterministic
- React receives one canonical snapshot
- components require no storage knowledge
- Phase 3 adapter is the only shopping persistence implementation

## A2 — App bootstrap and restore states

Priority: **100/100**

### States

The application shell must distinguish:

- booting
- no active trip
- active trip restored
- degraded persistence / recovery required

Do not flash the start screen before restore completes.

### Done when

- reload with active trip opens directly into that trip
- no resume modal is required
- corrupted/future-version data does not crash the app
- degraded persistence is visible and actionable
- historical non-shopping state is never rendered as money

## A3 — Start Trip screen

Priority: **99/100**

### Primary question

> How much can you spend today?

### Quick choices

- EUR 25
- EUR 50
- EUR 75
- EUR 100
- Custom

### Safety buffer

Keep optional and low-friction.

Do not force buffer configuration before starting.

### Interaction target

A user who wants EUR 50 should enter the active shopping screen in one obvious action.

### Must not include

- account
- store selection
- categories
- onboarding carousel
- notification permission
- scanner permission
- item setup

### Done when

- EUR 50 starts immediately
- Custom budget uses the exact-money parser
- invalid budget cannot become canonical state
- keyboard and touch both work
- focus moves logically
- screen works at 360px width and 200% zoom

## A4 — Remaining-first active shopping screen

Status: **complete via PR #19**

Priority: **100/100**

### Required hierarchy

Primary:

> **EUR 18.58 LEFT**

If a safety buffer is active, the design must make clear whether the hero number is nominal or safe remaining.

The selected design contract must not make the user infer this.

Secondary:

> EUR 31.42 of EUR 50.00

Then:

- quiet capacity/progress visual
- safety-buffer context
- Add price primary action
- cart items / empty state

### Empty active trip

Must still be useful:

> EUR 50.00 LEFT  
> Nothing in your cart yet.

Primary action:

> Add price

### Capacity visual

Must:

- encode remaining capacity
- not depend only on colour
- not look like a decorative fitness ring without meaning
- preserve readable exact numbers

### Done when

- remaining is visually dominant
- cart total/budget is immediately discoverable
- safety buffer is understandable
- Add price is the only primary-looking action
- no horizontal overflow at compact mobile widths
- large values do not break layout
- light/dark/forced-colour/reduced-motion states remain coherent

## A5 — Persistence health UX

Status: **complete via PR #20**

Priority: **100/100**

### Healthy state

Do not create noisy “Saved” chrome after every mutation.

### Degraded state

Show a persistent, calm warning such as:

> This trip is not being saved right now. Keep this page open until checkout.

Provide Retry when technically meaningful.

Never display a false saved state.

### Recovery-required startup

Do not overwrite the raw invalid/future data automatically.

Provide a controlled path that can later support export/recovery.

### Done when

- simulated write failure is visible
- active cart remains usable
- reload risk is explained accurately
- UI does not imply persistence succeeded
- warning is accessible and not colour-only

## A6 — Sprint A quality gate

Status: **complete via PR #21**

Priority: **100/100**

### Required automated coverage

- start EUR 50 trip
- start with safety buffer
- restore active trip after reload
- degraded write state
- corrupted/future storage startup
- mobile no-overflow
- keyboard navigation
- 200% zoom
- reduced motion
- axe
- Chromium
- Firefox
- WebKit

### Required manual verification

Representative phone-size viewport:

- 360×800-class
- 390×844-class

Check one-hand reach and bright/light-mode readability.

### Sprint A stop/go gate

**Historical result: the shopping shell passed this implementation gate.**

Evidence:

- first-time purpose is explicit on the start screen
- hero remaining semantics are unambiguous with and without a safety buffer
- Add price remains the single visually primary action
- active trips restore exactly after reload
- degraded persistence is visible and recovery data is never overwritten
- 360×800 and 390×844 layouts have no horizontal overflow
- 200% text sizing is resilient after an A6 regression fix
- reduced-motion behavior is verified across engines
- axe WCAG A/AA scans pass on start and active-trip screens
- Chromium, Firefox, and WebKit pass the browser matrix

Historical note: A6 kept the then-current public shell stable because Sprint A did not yet implement functional manual price entry. That compatibility path has since been retired after the shopping flow became fully covered.

The automated viewport evidence proves layout behavior at the documented dimensions; it does not by itself prove physical one-hand reach or bright-store readability on real hardware. Those empirical checks remain required before the production-shell switch and should be recorded alongside B6/manual timing evidence.

Do not begin Sprint B if:

- first-time purpose is unclear
- hero remaining number is ambiguous
- Add price is visually secondary
- reload/restore is unreliable
- persistence degradation is hidden
- compact mobile layout is unstable

# Sprint B — Phase 5: Ultra-fast Manual Price Entry

## Sprint objective

Make the most frequent action fast enough that entering 15–30 prices in a real shop is plausible.

Primary KPI:

> **median common price-only add <= 2.5 seconds**

Minimum release-quality expectation:

> approximately 3 seconds or less

## Sprint B dependency graph

~~~text
B0 Entry interaction contract
      ↓
B1 Price-entry surface/keypad
      ↓
B2 Live projection
      ↓
B3 Over-budget / buffer crossing
      ↓
B4 Quantity
      ↓
B5 Commit / return / feedback
      ↓
B6 Correction minimum + timing/a11y/E2E
~~~

## B0 — Price-entry interaction contract

Status: **complete via PR #22**

Priority: **100/100**

Before implementation, lock:

- decimal mode behaviour
- auto-cents mode behaviour
- which mode is default
- locale comma behaviour
- backspace
- clear
- leading zeroes
- paste
- incomplete decimal state
- invalid input copy
- Add disabled/enabled rules

The parser remains the Phase 1 money parser.

No UI-specific parser fork.

### Done when

Every keypad/input state maps to one documented money-draft state.

## B1 — One-hand price-entry surface

Status: **complete via PR #22**

Priority: **100/100**

### Required content

- large current price
- large touch keypad or equally fast native strategy
- backspace
- clear
- Add action
- obvious close/cancel path

### Ergonomics

- frequent targets >=48 CSS px
- primary digits reachable by thumb
- Add has stable position
- no accidental double-add
- no required item name/category

### Done when

A basic EUR 4.79 add can be completed without scrolling or secondary metadata.

## B2 — Live projected remaining

Status: **complete via PR #23**

Priority: **100/100**

During input show consequence before commit:

> After adding: EUR 13.79 left

With buffer, distinguish:

- nominal remaining
- safe remaining

Projection must use:

> projectAddItem()

Do not duplicate projection arithmetic in components.

### Done when

- preview updates instantly
- preview never mutates canonical trip
- invalid draft has no fake projection
- exact cents match post-commit state

## B3 — Threshold and over-budget states

Status: **complete via PR #24**

Priority: **100/100**

### Crossing safety buffer only

Example:

> This item uses EUR 1.25 of your safety buffer.

User may continue.

### Crossing nominal budget

Example:

> This puts you EUR 3.41 over your limit.

Actions:

- Cancel
- Add anyway

No shame language.

No hard block.

### Done when

- safe-limit crossing and nominal overage are distinct
- Add anyway emits the exact validated price that produced the reviewed projection
- Cancel preserves the previous trip exactly
- no confirmation appears for ordinary within-budget adds

Canonical commit/persistence equality remains a B5 acceptance criterion because B3 deliberately owns threshold interaction semantics rather than application mutation.

## B4 — Quantity

Status: **complete via PR #25**

Priority: **95/100**

Support:

> EUR 1.29 × 3 = EUR 3.87

Quantity updates projection immediately.

Rules remain Phase 2 rules:

- integer
- 1–999
- exact cents
- no floating quantity in standard item flow

### Done when

- quantity cannot create invalid canonical state
- line total equals domain projection result
- projected cart values update exactly
- controls remain one-hand usable
- validated handoff carries the exact reviewed quantity into B5

## B5 — Commit, persist, return

Status: **complete via PR #26**

Priority: **100/100**

Commit order:

1. validate intent
2. domain commit
3. persistence attempt
4. render canonical result
5. optional visual feedback

After successful in-memory commit:

- return to summary
- keypad closes
- focus goes to a predictable safe target
- brief feedback may show:
  > EUR 4.79 added

Persistence failure:

- item remains in valid in-memory cart
- degraded warning becomes visible

### Done when

- no committed item is lost from in-memory state because animation/storage failed
- repeat tapping does not double-submit
- summary immediately reflects exact total/remaining
- reduced-motion path remains complete
- UI does not construct canonical CartItem metadata
- persisted item matches the exact reviewed unit price and quantity
- failed add persistence returns to summary with the item intact and degraded warning visible
- keyboard commit returns focus to the canonical Add price action

## B6 — Minimum correction and quality gate

Status: **automated/code gate implemented via PR #28; representative human timing and physical one-hand/bright-store evidence remains unverified under D-039 sequencing waiver**

Evidence protocol:

- docs/evidence/SPRINT-B-QUALITY-GATE.md

Priority: **99/100**

Although full correction is Phase 6, Sprint B must not ship an unusable mistake trap.

Minimum:

- obvious Cancel before commit
- backspace/clear
- one-action Undo after add if feasible without compromising Phase 5
- otherwise Phase 6 must begin immediately after Sprint B

Do not add confirmation dialogs for reversible mistakes.

### Timing test

Measure at least:

- EUR 4.79
- EUR 12.50
- repeated consecutive prices
- one typo corrected before commit

Representative one-hand users/devices should target:

- median <=2.5 sec for ordinary price-only add
- <=3 sec release-quality floor

### Automated E2E flagship

1. clean launch
2. EUR 50 budget
3. EUR 2 buffer
4. add EUR 3.79
5. add EUR 12.50
6. add EUR 1.29 × 3
7. verify exact remaining
8. enter typo and correct
9. preview safety-buffer crossing
10. preview nominal overage
11. cancel overage
12. add valid item
13. reload
14. exact trip restored
15. continue adding

### Done when

Automated/code requirements:

- all exact-money assertions pass
- no duplicate commit under rapid input
- mobile no-overflow remains green
- keyboard/focus tests pass
- axe passes
- Chromium/Firefox/WebKit pass
- reduced motion works
- no network is required for the loaded manual core

Empirical requirements before Sprint B is declared complete:

- representative one-hand timing is recorded
- ordinary price-only median is interpreted against the <=2.5 second target and <=3 second release floor
- physical one-hand reach is checked on representative compact/modern phone sizes
- bright/light-mode readability is checked
- the real mobile software keyboard does not obscure the critical flow

# PR decomposition

Recommended PR sequence:

## PR A1

> feat: add shopping application controller

Pure application orchestration + tests.

## PR A2

> feat: add trip bootstrap and start flow

Bootstrap states + start trip.

## PR A3

> feat: build remaining-first active shopping screen

Selected design direction + cart summary.

## PR A4

> feat: surface persistence health in shopping UI

Degraded/recovery UX.

## PR A5

> test: harden core shopping UI across mobile and browsers

Accessibility/E2E/performance cleanup.

## PR B1

> feat: add one-hand price entry

Entry contract + keypad.

## PR B2

> feat: preview exact remaining before add

Projection + buffer/over-budget states.

## PR B3

> feat: add quantity and stable commit flow

Quantity + persist + return.

## PR B4

> test: validate fast manual shopping loop

Timing, mobile, browser, a11y, regression hardening.

Do not combine all of Phase 4–5 into one giant PR.

# Ownership boundaries

Even for one developer/AI agent, treat these as separate ownership concerns.

## Domain

Owns:

- money
- trip invariants
- projections
- selectors
- commands

Must not know React/storage UI.

## Application

Owns:

- orchestration
- controller snapshot
- persistence attempt ordering
- health state
- dependency injection

Must not own CSS/layout.

## Infrastructure

Owns:

- storage DTO/schema
- localStorage adapter
- future external provider adapters

Must not invent domain rules.

## UI

Owns:

- rendering
- ephemeral drafts
- focus
- overlays
- accessibility
- interaction feedback

Must not compute canonical totals independently.

# Release blocker list

A blocker in Sprint A/B includes:

- wrong cent calculation
- data loss after committed add
- false saved state
- active trip not restored
- Add action unreachable at compact mobile size
- user cannot tell what hero number means
- over-budget state silently rejected
- safe and nominal remaining conflated
- price add routinely exceeds 3 seconds due to UI ceremony
- required item metadata
- keyboard trap
- inaccessible modal/sheet
- colour-only status
- WebKit interaction instability
- reduced-motion flow incomplete

# Expected product impact

These are heuristic planning ranges, not measured forecasts.

Current product-success range after Phase 1–3:

> **43–50%**

If Sprint A/B meet their usability targets:

> **52–60%**

If the experimental scanner benchmark demonstrates a material interaction advantage:

> **63–71%** after repeat-trip acceleration, before full retention validation

The next major probability increase should come from:

> **stable manual core -> cheap scanner hypothesis test -> Trip completion -> Shop again -> Recent Items -> Price Memory -> real-store retention validation**

The scanner benchmark is evidence gathering, not production scanner breadth.

# Sprint handoff

After Sprint B:

Proceed only if the fast manual core is stable.

D-039 waives the unresolved human B6 evidence only as a development-sequencing blocker. Because the Experimental Scanner Benchmark Gate depends on representative human timing evidence for a meaningful manual-vs-scan comparison, defer that spike rather than replacing it with automation.

Phase 6 correction/confidence is implemented via PR #37:

- robust one-level Undo across add/edit/remove
- price and quantity correction
- explicit remove including quantity 1 -> zero removal
- source/confidence presentation and provenance-preserving quantity edits

Next implement:

- Phase 7 trip completion/history/reconciliation

Then Phase 8:

- Shop again
- Recent Items
- Price Memory

Then:

> **feature freeze + 20–50 real-store beta**

Where practical:

- Cohort A — manual-first
- Cohort B — manual + repeat acceleration / Price Memory
- Cohort C — manual + experimental scanner only if the benchmark was positive

Only after the retention gate should Phase 9+ production breadth proceed.
