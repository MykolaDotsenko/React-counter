# Product Success and Retention Strategy

## Status

Authoritative product-success strategy for increasing the probability that the shopping-budget product becomes a repeatedly used consumer utility rather than only a technically strong portfolio project.

This document complements:

- PRODUCT.md — product thesis and scope
- FUNCTIONALITY.md — user-facing behaviour
- ROADMAP.md — implementation order
- MARKETING.md — acquisition and growth
- SCENARIOS.md — scenario priorities
- docs/DECISIONS.md — durable product decisions

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

> **approximately 42–48% chance of strong niche product success**

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

> **42–48%**

### After excellent Phase 4–5 core interaction

Conditions:

- remaining-first UI understood in seconds
- one-hand manual entry works in a real store
- common item entry reaches approximately 2–3 seconds
- persistence degradation is visible
- correction is immediate

Target range:

> **52–58%**

### After repeat-trip acceleration

Conditions:

- Shop again / repeat budget
- Recent Items
- basic Price Memory
- one/two-action remembered-item reuse
- repeated trip materially faster than first trip

Target range:

> **60–66%**

### After focused real-store beta

If 20–50 real shoppers demonstrate:

- meaningful full-trip use
- second-trip rate around 30–35% or better
- no major trust/data-loss issue
- manual entry is not the dominant abandonment reason

Target range:

> **68–75%**

### After validated distribution

If retention is credible and the product then adds:

- high-quality store listing
- tested creative
- App Store / Google Play distribution or equivalent install trust
- organic demo content
- ASO

Target range:

> **72–78%**

### With genuinely friction-reducing scanning

Only if barcode/OCR benchmarking demonstrates that it improves speed or confidence over manual entry in real supermarket conditions:

> **approximately 75–80%**

Do not assign a higher confidence before there are hundreds of users and several months of retention evidence.

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

## Retention interpretation bands

These are provisional decision thresholds until enough real data exists.

### >= 35% second-trip rate

**Very strong early signal**

Action:

- preserve the core interaction
- improve distribution
- cautiously add accelerators
- test monetisation only after trust remains strong

### 25–35%

**Promising / viable**

Action:

- optimise recurring friction
- inspect where repeated entry is slow
- improve Recent Items / Price Memory
- avoid broad feature expansion

### 15–25%

**Material retention problem**

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
- manual_entry_abandoned
- remembered_item_used
- scan_fallback_to_manual later

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

## Why scanner/OCR stays later

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

## Safety Buffer as differentiation

Safety Buffer should be treated as a core differentiation layer.

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

Potential summary:

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

> **86/100 later, not current core priority**

Constraints:

- must remain secondary
- must not replace the hard-limit brand promise
- should not delay retention validation

## Distribution sequence

Do not scale acquisition before repeat value is credible.

Recommended order:

1. polished core interaction
2. Repeat Trip / Recent Items / Price Memory
3. 20–50 real-store beta users
4. retention analysis
5. fix core friction
6. store-ready packaging/listing
7. organic short-form product demos
8. ASO/store experiments
9. meaningful paid acquisition only after retention/LTV evidence

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

## Real-store beta

Minimum recommended cohort:

> **20–50 real shoppers**

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
| 3 | Real-store beta + second-trip gate | 100/100 |
| 4 | Narrow hard-limit positioning | 97/100 |
| 5 | Local-first/privacy trust | 95/100 |
| 6 | Store distribution after retention proof | 94/100 |
| 7 | Privacy-safe product analytics | 96/100 |
| 8 | Scanner/OCR only if faster/better than manual | 86/100 |

The ordering is deliberate.

Scanner/OCR may be visually impressive but is lower expected ROI than making repeated shopping dramatically easier.

## Maintenance rule

Revise this strategy when real evidence arrives.

Real cohort data may override every percentage or threshold in this file.

Do not revise the strategy simply because a new technology or competitor feature looks attractive.
