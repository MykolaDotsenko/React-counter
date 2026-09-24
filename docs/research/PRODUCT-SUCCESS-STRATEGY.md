# Product Success and Retention Strategy

## Status

**SUPPORTING RESEARCH STRATEGY.** This document contains retention hypotheses, decision heuristics, and evidence framing. Current product scope and shipped behaviour remain owned by authoritative contracts.

This document complements:

- ../PRODUCT.md — product thesis and scope
- ../ROADMAP.md — current sequencing and evidence gates
- ../specs/RELEASE-SPEC.md — current release behaviour
- ../reference/MARKETING.md — acquisition/growth guidance
- ../reference/SCENARIOS.md — scenario challenge matrix
- ../DECISIONS.md — durable product decisions

The percentages in this document are **decision heuristics, not measured forecasts**. They exist to compare risk and sequencing. Real retention data overrides them.

## Current product-success thesis

The largest unresolved product risk is not technical correctness.

It is:

> Will a shopper willingly add enough prices during a real trip, and will they come back and do it again on the next trip?

Phase 1–3 materially reduced execution risk:

- exact money is reliable
- trip/cart rules are explicit
- active-trip persistence is versioned and recoverable

They do **not** yet prove:

- in-store interaction is fast enough
- the user completes a full 10–30 item trip
- repeated entry remains tolerable
- remembered prices actually reduce enough friction
- a user returns for a second real trip

Therefore future prioritisation must reduce **usage and retention risk** before feature breadth.

## Current heuristic probability

At the current stage:

> **approximately 43–50% chance of strong niche product success**

Definition of strong niche product success:

- used by real shoppers, not only demo users
- meaningful repeated usage
- organic acquisition potential
- hundreds to low-thousands of recurring users becomes plausible
- product can justify continued indie development or monetisation

This is not a probability of a venture-scale breakout.

## Probability ladder

These ranges are directional and overlapping; percentage-point gains must not be added mechanically.

### Current foundation

Phase 1–3 complete:

> **43–50%**

### After excellent Phase 4–5 core interaction

Conditions:

- remaining-first UI understood in seconds
- one-hand manual entry works in a real store
- common item entry reaches approximately 2–3 seconds
- persistence degradation is visible
- correction is immediate

Target range:

> **52–60%**

### After repeat-trip acceleration

Conditions:

- Shop again / repeat budget
- Recent Items
- basic Price Memory
- one/two-action remembered-item reuse
- repeated trip materially faster than first trip

Target range:

> **60–68%**

### After an early scanner benchmark that proves real interaction value

Conditions:

- manual core is already stable
- scanner is tested only as an experimental accelerator
- scan -> confirm is measurably faster or lower-friction than manual entry for representative cases
- failure immediately falls back to manual
- scanner remains outside the critical product path

Target range:

> **63–71%**

This is not permission to ship a production scanner early. It is permission to test the hypothesis earlier.

### After focused real-store beta

If 20–50 real shoppers demonstrate:

- meaningful full-trip use
- second-trip rate around 35% or better
- healthy third-trip behaviour
- no major trust/data-loss issue
- manual entry is not the dominant abandonment reason

Target range:

> **68–75%**

If second-trip rate reaches roughly 45% or better and third-trip behaviour remains healthy:

> **74–80%**

### After validated distribution

If retention is credible and the product then adds:

- high-quality store listing
- tested creative
- App Store / Google Play distribution or equivalent install trust
- organic demo content
- ASO
- repeatable acquisition hooks that do not degrade product trust

Target range:

> **78–83%**

### Upper-confidence rule

Do not assign materially higher confidence than the ranges above before there are:

- hundreds of real users
- several months of retention data
- stable third-trip behaviour
- credible organic/store conversion evidence

Scanner usage alone is never proof of product success.

## Primary product-success metric

### Second-trip rate

The primary product validation metric is:

> **the percentage of activated users who start another real shopping trip**

This is more important than:

- downloads
- account creation
- page views
- social impressions
- Product Hunt ranking
- scanner usage
- number of implemented features

The exact cohort window should follow observed shopping cadence, but initial analysis should include at least:

- second trip within 7 days
- second trip within 14 days
- second trip within 30 days

For interpretation discipline, do not apply a time-window retention conclusion until at least 20 participants are eligible for that specific window. Imported cohort size alone is insufficient because newer participants may still be right-censored.

The aggregate share of activated users who have started a second or third trip is still useful as descriptive “observed so far” evidence, but it is not a time-normalized retention rate.

## Retention interpretation bands

These are provisional internal decision thresholds until enough real data exists. They are not claimed as industry benchmarks.

### >= 45% second-trip rate

**Exceptional early signal**

Action:

- preserve the core interaction
- validate third-trip behaviour
- improve distribution carefully
- test monetisation only after trust remains strong

### 35–45%

**Strong**

Action:

- preserve the main interaction model
- optimise repeat friction
- proceed cautiously with validated accelerators and distribution

### 25–35%

**Viable / promising**

Action:

- optimise recurring friction
- inspect where repeated entry is slow
- improve Recent Items / Price Memory
- avoid broad feature expansion

### 15–25%

**Problematic**

Action:

- freeze feature expansion
- study real trips
- improve manual interaction and repeat flows
- do not respond by adding scanner/OCR automatically

### < 15%

**Core product-risk signal**

Action:

- stop feature race
- revisit the interaction model and/or job-to-be-done
- identify whether manual entry, value perception, trip frequency, or trust is the limiting factor

A low second-trip rate cannot be fixed by marketing alone.

## Supporting activation metrics

Track privacy-safe behaviour such as:

- trip_started
- first_item_added
- fifth_item_added
- tenth_item_added
- trip_finished
- trip_restored
- second_trip_started
- third_trip_started
- manual_entry_abandoned
- remembered_item_used
- quick_cart_started later
- scan_started in benchmark cohorts
- scan_confirmed in benchmark cohorts
- scan_fallback_to_manual in benchmark cohorts

Do not send monetary or shopping content by default.

Avoid collecting:

- budget values
- item prices
- item names
- store history
- camera content

unless a later privacy-reviewed feature explicitly requires it.

## Critical UX performance target

### Price-entry speed

The common manual flow must feel faster than mental arithmetic overhead.

Target:

> **median common price add <= 2.5 seconds in representative one-hand usability testing**

Minimum release-quality expectation:

> approximately 3 seconds or less for an ordinary price-only item

Measure from intentional Add action to committed item.

Do not count pre-filled remembered-item taps as manual price-entry performance.

## Repeat-trip principle

The second and third shopping trips should be materially easier than the first.

Target principle:

> **A repeated trip should feel 2–3x lighter than the first trip for familiar items.**

Mechanisms:

1. repeat previous budget
2. one-tap Shop again
3. Recent Items
4. remembered prices with freshness
5. optional store context
6. one/two-action reuse
7. current-price override always available

The app should accumulate useful recognition, not configuration burden.

## Recommended repeat-trip entry

After a completed trip, offer:

> **Shop again with EUR 50**

On a later launch, prefer:

> Last trip: EUR 50  
> **Start with EUR 50 again**

No setup wizard.

No required store/category configuration.

## Recent Items strategy

Recent Items should optimize recognition over recall.

Example:

- Milk — last paid EUR 1.39
- Bread — last paid EUR 2.49
- Eggs — last paid EUR 3.15

A remembered item can be one/two actions when appropriate.

The user must still be able to enter the current price immediately.

Recent Items must not turn the start screen into a catalogue.

## Price Memory priority

Price Memory is a retention feature, not merely a smart convenience.

It should arrive before barcode/OCR because it reduces friction for the exact products a user repeatedly buys without:

- camera permission
- network dependency
- recognition latency
- product-database coverage
- OCR ambiguity

Remembered price remains explicitly remembered until the user confirms it as current.

## Early scanner benchmark, production scanner later

The production scanner remains later because it must never become a core dependency before the manual and repeat-trip loops are proven.

However, after the Phase 5 manual flow is stable, run a **small scanner benchmark prototype** before the broader retention beta.

Purpose:

- test whether camera capture is a real interaction accelerator
- compare it directly against the manual baseline
- identify whether scanner value is speed, lower cognitive load, or neither

This prototype must be isolated:

- experimental branch or clearly gated code path
- no production dependency for the core product
- no product roadmap promotion unless benchmark evidence is positive
- no scanner-only state
- immediate manual fallback

A scanner is valuable only if it beats the manual baseline.

Release/retention rule:

> **Do not keep or promote a scanning workflow that is slower or less trustworthy than manual entry.**

Benchmark against:

> digits -> Add

Representative cases:

- clear standard shelf label
- dark shelf
- yellow discount sticker
- loyalty/member price
- regular + unit price
- superscript cents
- price/kg
- multiple nearby prices
- camera permission denial
- offline/provider failure

If:

- scan + confirm takes 5 seconds
- manual entry takes 2–3 seconds

then scanning does not improve the product.

Technical novelty does not override interaction cost.

### Recommended benchmark metrics

Compare manual vs scan -> confirm:

- median seconds per item
- P75/P90 latency
- recognition failure rate
- correction rate
- fallback-to-manual rate
- user preference after repeated use
- cognitive effort reported after 10+ items

A positive scanner result can justify a later production implementation. A negative result should simplify or defer scanning.

## Safety Buffer as differentiation

Safety Buffer should be treated as a **branded core differentiation layer**, not hidden as an obscure settings feature.

It addresses uncertainty that normal calculators pretend does not exist:

- weighed produce
- bottle deposits
- missed items
- stale remembered prices
- unclear promotions
- small checkout differences

Brand/product idea:

> **Do not pretend to be more precise than the real store.**

Example:

Budget:

> EUR 50

Buffer:

> EUR 2

Safe state:

> **EUR 17.40 safe to spend**

At the safety limit:

> Safety buffer reached.  
> EUR 2 remains in your nominal budget.

This is materially different from a generic running-total calculator.

## Price confidence as differentiation

Price confidence is a trust feature.

Default presentation should stay quiet.

Prefer contextual confidence such as:

> **EUR 16.40 safely left**  
> Includes 2 remembered prices

Detailed counts may appear on demand:

> Estimated cart EUR 46.30  
> 9 confirmed  
> 2 remembered  
> 1 estimated

Rules:

- remembered != current
- scanner candidate != confirmed
- estimate != exact
- confidence is never hidden to create a prettier number

The product can be intelligent without pretending uncertainty does not exist.

## Privacy as differentiation

The strongest trust posture remains:

> No bank connection. No mandatory account. Core shopping data stays local.

This differentiates the product from finance-heavy or cloud-first tools.

Analytics must not silently invalidate that promise.

If telemetry is introduced, collect event structure rather than shopping content.

## Narrow acquisition wedge

Primary acquisition story:

> **You have EUR 50 for groceries. How much can you still afford?**

Avoid broad positioning such as:

- grocery management
- AI shopping platform
- finance assistant

The product should first own:

> **remaining-first shopping under a hard limit**

before broadening to adjacent use cases.

## Quick Cart

Potential later acquisition feature:

> **Quick total**

Purpose:

- let a user track a running total without setting a budget
- provide an easier entry point for calculator-intent users

Priority:

> **92/100 as a later acquisition experiment, not a current core priority**

Constraints:

- must remain secondary
- must not replace the hard-limit brand promise
- should not delay retention validation

## Distribution sequence

Do not scale acquisition before repeat value is credible.

Recommended order:

1. polished core interaction
2. early scanner benchmark prototype after the manual baseline is stable
3. Repeat Trip / Recent Items / Price Memory
4. 20–50 real-store beta users
5. retention analysis
6. fix core friction
7. store-ready packaging/listing
8. organic short-form product demos
9. ASO/store experiments
10. meaningful paid acquisition only after retention/LTV evidence

## Native store packaging

PWA is suitable for beta and portfolio use.

If retention is validated, native-store distribution can materially improve:

- discovery
- review trust
- home-screen presence
- camera permission UX
- store-page experiments

A thin wrapper such as Capacitor may be evaluated later without rewriting the web domain/core.

Do not introduce native packaging before the web experience proves repeated value.

## Feature-freeze gate

After core UI, fast manual entry, correction/completion, and basic repeat-trip acceleration are implemented:

> **freeze non-critical feature development long enough to run real-store beta.**

During this gate:

Do not add merely because they are available:

- OCR
- barcode
- voice
- cloud sync
- family sharing
- advanced analytics
- retailer integrations

Exceptions:

- blocker bug
- data integrity issue
- accessibility failure
- a repeatedly observed missing capability preventing the core job

## Retention beta evidence harness

A guarded local-first beta build is implemented at:

> `/shopping-budget-companion/beta/`

Its purpose is to make the real-store validation gate measurable without introducing a production analytics platform.

Recorded locally:

- trip start ordinal and whether the start used repeat acceleration
- trip completion
- 1 / 5 / 10 item milestones
- completed manual-entry duration
- manual-entry abandonment
- remembered-item reuse
- current-price override starts

Explicitly excluded from the evidence schema:

- budget values
- item prices
- line totals
- item names
- product IDs
- memory IDs
- store IDs/history
- checkout totals
- camera content

No evidence is transmitted over the network. The tester/researcher manually copies a privacy-safe JSON report from the beta panel.

The harness is an **instrument**, not evidence by itself. Second-trip and third-trip conclusions require real shoppers using the app in real shopping contexts.

## Guarded retention-beta evidence harness

Phase 8 now includes a guarded internal beta build at the repository's `/beta/` Pages path.

The harness is intentionally local-first:

- no analytics SDK
- no network telemetry
- no budget values
- no item prices
- no item names
- no product or memory identifiers
- no store history
- no camera content

It records only validation structure:

- trip started: new / repeat / resume
- trip restored
- trip finished
- item milestones: 1 / 5 / 10
- manual entry completed / abandoned
- manual-entry duration
- remembered item used
- current-price override started
- timestamps needed for 7 / 14 / 30 day second-trip analysis

Evidence is stored locally on the beta device and copied manually as JSON for cohort analysis.

Reset is blocked during an active trip so event ordinals cannot become detached from the current trip.

This instrumentation supports the retention gate; it does **not** pass the gate by itself.

## Real-store beta

Minimum recommended cohort:

> **20–50 real shoppers**

Where practical, structure the beta as directional cohorts:

### Cohort A — manual-first

Core manual experience only.

### Cohort B — manual + repeat acceleration

Manual core plus:

- Shop again
- Recent Items
- Price Memory

### Cohort C — manual + experimental scanner

Manual core plus the benchmark scanner path.

Cohorts are not a statistically powered experiment at this size. They are directional evidence designed to expose large interaction differences.

Compare:

- full-trip completion
- tenth-item reached
- median seconds per item
- second-trip rate
- third-trip rate
- scanner fallback rate
- reported fatigue
- trust in remaining amount

The test is not:

> “Can you click through this prototype?”

It is:

> “Use this during a real shopping trip.”

Ask after actual trips:

1. Did you use it throughout the trip?
2. At what item did entry begin to feel tedious?
3. Did it change a purchase decision?
4. Did you trust the remaining number?
5. Did you use Undo/edit?
6. What slowed you down?
7. Would you use it on your next trip?
8. Did you actually use it on your next trip?

Observed behaviour outranks stated enthusiasm.

## Feature decision rule

For any proposed feature, estimate its effect on:

1. first-trip activation
2. seconds per item
3. second-trip rate
4. confidence/trust
5. distribution
6. maintenance complexity

A feature that increases breadth but does not materially improve one of the first five should normally be deferred.

## Monetization guardrail

Do not paywall the habit-forming core before retention is proven.

Keep the core product broadly useful without payment:

- manual tracking
- hard budget
- Safety Buffer
- basic repeat-trip flow
- basic Price Memory
- offline/local-first core

Potential paid extensions later, if retention and user need justify them, should stay local-first where possible:

- high-volume scanning after a positive scanner gate
- deeper local price history
- recurring local templates
- richer local export/reporting
- evidence-backed advanced pricing mechanics

Monetization must amplify retained value, not block the behaviour needed to create retention.

## Anti-feature-race rule

Do not attempt to beat broader grocery apps by matching every capability.

Avoid becoming:

> a smaller competitor with fewer versions of the same features

Preferred strategy:

> **less product, better core job**

Win through:

- faster price entry
- clearer remaining-first hierarchy
- easier repeated shopping
- honest uncertainty
- local-first reliability
- calm UX

## Highest-ROI sequence

Current ranked priorities:

| Priority | Initiative | Score |
|---|---|---:|
| 1 | One-hand manual flow <= 2–3 sec | 100/100 |
| 2 | Repeat Trip + Recent Items + Price Memory | 100/100 |
| 3 | Real-store beta + second/third-trip gate | 100/100 |
| 4 | Early scanner benchmark prototype | 97/100 |
| 5 | Narrow hard-limit positioning | 96/100 |
| 6 | Safety Buffer as branded differentiation | 96/100 |
| 7 | Local-first/privacy trust | 94/100 |
| 8 | Quick Cart acquisition experiment | 92/100 |
| 9 | Store distribution after retention proof | 92/100 |
| 10 | More feature breadth without evidence | 45/100 |

The ordering is deliberate.

Production scanner/OCR breadth remains lower priority than manual speed and repeated shopping. The early benchmark exists to test the hypothesis cheaply, not to pre-commit the product to scanning.

## Maintenance rule

Revise this strategy when real evidence arrives.

Real cohort data may override every percentage or threshold in this file.

Do not revise the strategy simply because a new technology or competitor feature looks attractive.
