# Scenario Architecture

## Status

This document defines the target scenario model for the shopping budget companion.

The shipped application is Shopping Budget Companion. Scenarios below mix implemented and later-phase behavior; each scenario must retain its explicit implementation/evidence status.

This document is intentionally scenario-first: it tests whether the product remains coherent under normal use, interruption, uncertainty, mistakes, offline conditions, accessibility needs, and future scanning capabilities.

It complements:

- PRODUCT.md — product thesis and scope
- FUNCTIONALITY.md — feature behaviour
- UX.md — interaction principles
- DESIGN.md — visual system
- DOMAIN.md — business rules
- TESTING.md — quality contract

## Scoring model

Every scenario receives two 100-point scores.

### Scenario priority /100

How important it is to design and test deliberately.

Weighted dimensions:

- frequency / 30
- financial or trust impact / 25
- abandonment/friction risk / 20
- recurrence / 15
- portfolio/product differentiation / 10

### Proposed UX quality /100

How strong the current proposed solution is.

Weighted dimensions:

- clarity / 25
- speed / 25
- error prevention/recovery / 20
- resilience/accessibility / 20
- proportional complexity / 10

A score above 95 means the interaction is close to the desired product standard, not that it is proven perfect.

Any score below 90 is a signal to prototype, test, or simplify before implementation.

## Summary matrix

| # | Scenario | Priority | Proposed UX |
|---|---|---:|---:|
| 1 | First launch with a hard budget | 100 | 98 |
| 2 | Returning user repeats usual budget | 98 | 98 |
| 3 | Resume interrupted active trip | 100 | 98 |
| 4 | Basic manual price add | 100 | 99 |
| 5 | Rapid consecutive manual adds | 96 | 96 |
| 6 | Typo before commit | 97 | 98 |
| 7 | Typo after commit | 97 | 98 |
| 8 | Quantity greater than one | 94 | 97 |
| 9 | Quantity reduced to zero | 85 | 97 |
| 10 | Duplicate/repeated product | 78 | 91 |
| 11 | Optional product label | 63 | 96 |
| 12 | Discounted item | 83 | 94 |
| 13 | Multi-buy promotion | 77 | 92 |
| 14 | Weighted item with known price | 88 | 94 |
| 15 | Weighted item with uncertain price | 91 | 96 |
| 16 | Deposit / extra checkout charge | 82 | 92 |
| 17 | Safety buffer normal use | 95 | 98 |
| 18 | Cross safe limit but not budget | 93 | 98 |
| 19 | Pending item crosses nominal budget | 100 | 99 |
| 20 | User intentionally remains over budget | 92 | 98 |
| 21 | User edits budget mid-trip | 83 | 95 |
| 22 | Forgotten item added late | 88 | 99 |
| 23 | Known barcode + remembered price | 87 | 95 |
| 24 | Known barcode, no current price | 82 | 96 |
| 25 | Unknown barcode | 74 | 97 |
| 26 | Variable-measure / rich 2D barcode | 67 | 90 |
| 27 | Shelf scan finds one clear price | 86 | 96 |
| 28 | Shelf scan finds multiple prices | 92 | 98 |
| 29 | Loyalty/member price ambiguity | 88 | 95 |
| 30 | Camera permission denied | 84 | 99 |
| 31 | Product lookup/network unavailable | 91 | 99 |
| 32 | Storage write fails mid-trip | 99 | 96 |
| 33 | Reload/OS interruption after commit | 100 | 99 |
| 34 | PWA update during active trip | 88 | 95 |
| 35 | Multiple tabs edit same trip | 58 | 86 |
| 36 | Finish trip accidentally | 82 | 96 |
| 37 | Checkout total nearly matches | 72 | 97 |
| 38 | Checkout total differs materially | 91 | 95 |
| 39 | Reopen completed trip | 69 | 92 |
| 40 | Delete history / clear all | 70 | 95 |
| 41 | Offline launch | 96 | 98 |
| 42 | Screen-reader core flow | 96 | 97 |
| 43 | 200% text / large text | 91 | 96 |
| 44 | Reduced motion | 84 | 99 |
| 45 | Colour-vision / forced-colour mode | 86 | 98 |
| 46 | One-hand distracted use | 100 | 98 |
| 47 | Decimal comma / locale input | 91 | 96 |
| 48 | Currency with different minor units | 76 | 91 |
| 49 | Tax-exclusive shopping context | 72 | 90 |
| 50 | Optional smart feature is slower than manual | 90 | 98 |

## A. Entry and session scenarios

### 1. First launch with a hard budget

**User:** “I have EUR 50. I cannot spend more.”

**Optimal flow:**

1. app opens directly to budget setup
2. quick amounts + custom amount
3. currency is preselected from product preference/system context where safe
4. user chooses EUR 50
5. active trip opens immediately
6. hero shows EUR 50 left
7. Add price is obvious

**Do not:**

- show onboarding carousel
- request account
- require store/category
- ask notification permission

**Priority:** 100/100  
**Proposed UX:** 98/100

**Why not 100:** real usability testing is still required to validate quick-budget defaults and wording.

### 2. Returning user repeats usual budget

**User:** frequently shops with EUR 50.

**Optimal flow:**

> Shop again with EUR 50

Secondary:

> Choose another amount

Use local recency, not predictive AI.

This scenario is now part of the primary retention strategy rather than a secondary convenience. The repeated-trip path should be materially lighter than first-use setup.

**Priority:** 98/100  
**Proposed UX:** 98/100

### 3. Resume interrupted active trip

**Situation:** app was closed, OS reclaimed it, or user switched apps.

**Optimal flow:**

- open directly into restored active trip
- show remaining amount immediately
- no “resume?” modal in the normal healthy case
- preserve cart, budget, buffer, price origins

**Priority:** 100/100  
**Proposed UX:** 98/100

This is a trust-critical scenario.

## B. Manual entry and correction

### 4. Basic manual price add

**Flow:**

1. Add price
2. numeric input
3. projected remaining visible
4. Add
5. summary returns
6. Undo available

No product metadata required.

**Priority:** 100/100  
**Proposed UX:** 99/100

This is the reference interaction against which every smart input method is measured.

### 5. Rapid consecutive manual adds

**Situation:** user picks several items quickly.

**Optimal flow:**

- each commit closes numeric entry
- summary visibly updates
- Add price remains in same thumb-reachable location
- next add requires one predictable tap
- no celebratory animation that slows repetition

Potential accelerator after validation:

> Add another

but only if it is faster without increasing accidental input.

**Priority:** 96/100  
**Proposed UX:** 96/100

Needs real timing tests.

### 6. Typo before commit

**Example:** user enters EUR 89.00 instead of EUR 8.90.

**Optimal flow:**

- projected remaining immediately exposes implausible consequence
- backspace and Clear are easy
- no modal error
- optionally detect extreme outlier only as a subtle hint, never an automatic correction

**Priority:** 97/100  
**Proposed UX:** 98/100

Dynamic validation follows platform guidance: correct errors when they become visible, not after a long flow.

### 7. Typo after commit

**Optimal flow:**

- recently added item remains easy to reach
- tap item → edit price
- save → totals update
- Undo can recover the last mutation

**Priority:** 97/100  
**Proposed UX:** 98/100

No reset or delete/re-add workflow.

### 8. Quantity greater than one

**Example:** 3 yogurts at EUR 1.29.

**Optimal flow:**

- quantity defaults to 1
- minus / number / plus
- line total updates immediately
- projected remaining updates immediately
- large, separated controls

**Priority:** 94/100  
**Proposed UX:** 97/100

Baymard research specifically supports immediate summary updates and large plus/minus controls.

### 9. Quantity reduced to zero

**Optimal flow:**

- minus from 1 removes item
- toast/status: Item removed · Undo

If an editable numeric quantity exists, entering 0 follows the same rule.

**Priority:** 85/100  
**Proposed UX:** 97/100

### 10. Duplicate/repeated product

**Situation:** same barcode/product added again.

**Optimal flow:**

Offer:

> Increase quantity to 2?

Actions:

- Increase quantity
- Add separately

Do not auto-merge silently because separate packages can have different discounts/prices.

**Priority:** 78/100  
**Proposed UX:** 91/100

Needs prototype validation because the prompt itself may add friction.

### 11. Optional product label

**Optimal flow:**

Price-only item remains fully valid.

Label is optional and useful for:

- later recognition
- price memory
- barcode association

**Priority:** 63/100  
**Proposed UX:** 96/100

The best solution is mostly to stay out of the way.

## C. Real-world pricing scenarios

### 12. Discounted item

**Example:** EUR 4.99, -30%.

**Optimal flow:**

Secondary action:

> Discount

Then:

- 10%
- 20%
- 30%
- custom

Preview:

> Final EUR 3.49

**Priority:** 83/100  
**Proposed UX:** 94/100

Do not expose discount fields in every normal add.

### 13. Multi-buy promotion

**Examples:**

- 2 for EUR 5
- 3 for EUR 10

**Optimal MVP solution:**

Allow the user to enter the **effective line total** directly.

Optional quantity/label can describe the bundle.

Do not build a promotion rules engine.

Possible later shortcut:

> Bundle total

**Priority:** 77/100  
**Proposed UX:** 92/100

This is a good example of solving the user outcome instead of modelling retailer complexity.

### 14. Weighted item with known price

**Example:** scale label already shows EUR 2.36.

**Optimal flow:**

Enter/scan final payable amount.

If a supported variable-measure barcode directly contains payable amount, present it as a candidate and confirm.

**Priority:** 88/100  
**Proposed UX:** 94/100

### 15. Weighted item with uncertain price

**Example:** fruit will be weighed at checkout.

**Optimal flow:**

- enter approximate line total
- mark Estimated
- allow later correction
- safety buffer remains visible

Do not force a fake exact weight.

**Priority:** 91/100  
**Proposed UX:** 96/100

### 16. Deposit / extra checkout charge

**Example:** bottle/can deposit or other predictable extra.

**Optimal solution:**

Support a simple additional line item such as:

> Deposit · EUR 0.20 × 6

Do not create a separate tax/deposit subsystem in MVP.

If a local user repeatedly needs it, a remembered item can make it one-tap.

**Priority:** 82/100  
**Proposed UX:** 92/100

## D. Budget-limit scenarios

### 17. Safety buffer normal use

**Example:**

- nominal budget EUR 50
- buffer EUR 2
- safe limit EUR 48

Hero:

> EUR 12.40 safe to spend

Secondary:

> EUR 14.40 nominal remaining

**Priority:** 95/100  
**Proposed UX:** 98/100

### 18. Cross safe limit but not nominal budget

**Optimal wording:**

> Safety buffer reached.  
> EUR 1.40 remains in your nominal budget.

For a pending item:

> This item uses EUR 0.60 of your safety buffer.

**Priority:** 93/100  
**Proposed UX:** 98/100

Do not label this “over budget.”

### 19. Pending item crosses nominal budget

**Optimal flow:**

Before commit:

> This puts you EUR 3.41 over your limit.

Actions:

- Add anyway
- Cancel

**Priority:** 100/100  
**Proposed UX:** 99/100

This is one of the product's defining moments.

### 20. User intentionally remains over budget

**Optimal state:**

> EUR 3.41 over your limit

Secondary:

- Review cart
- Change budget

Do not disable Add price.

Do not shame.

**Priority:** 92/100  
**Proposed UX:** 98/100

### 21. User edits budget mid-trip

**Example:** budget changes from EUR 50 to EUR 40 while cart is EUR 42.50.

Preview:

> New budget EUR 40  
> You will be EUR 2.50 over.

Allow save.

**Priority:** 83/100  
**Proposed UX:** 95/100

### 22. Forgotten item added late

**Situation:** user notices an item was never entered.

**Optimal solution:**

Just Add price.

No chronology dependency.

The cart total is the product truth; entry order is secondary.

**Priority:** 88/100  
**Proposed UX:** 99/100

## E. Barcode and scanning scenarios

### 23. Known barcode + remembered price

**Optimal flow:**

1. scan
2. identify product
3. show last price, date, store
4. Use remembered price or Enter current price
5. commit

**Priority:** 87/100  
**Proposed UX:** 95/100

The value is repeated-use speed, not barcode novelty.

### 24. Known barcode, no current price

**Optimal flow:**

1. identify product
2. focus current-price entry immediately
3. optional save for future after commit

Do not ask for metadata already known from barcode lookup.

**Priority:** 82/100  
**Proposed UX:** 96/100

### 25. Unknown barcode

**Optimal flow:**

> Product not recognised.

Primary:

> Enter price

Optional later:

> Add label

Preserve scanned identifier locally only when useful for future association.

**Priority:** 74/100  
**Proposed UX:** 97/100

### 26. Variable-measure / rich 2D barcode

Modern GS1 2D and variable-measure structures can include fields such as:

- weight
- count
- payable amount
- price per unit

**Optimal architecture:**

- parse supported standard fields
- surface decoded payable amount/weight as candidate data
- show source clearly
- confirm before cart commit unless the specific data path is intentionally trusted
- fall back to normal product identity/manual price

**Priority:** 67/100  
**Proposed UX:** 90/100

The lower UX score reflects ecosystem variability and the need for implementation research.

### 27. Shelf scan finds one clear price

**Optimal flow:**

> Detected EUR 3.79

Actions:

- Add EUR 3.79
- Edit

Projected remaining stays visible.

**Priority:** 86/100  
**Proposed UX:** 96/100

### 28. Shelf scan finds multiple prices

Common label ambiguity:

- normal price
- loyalty price
- unit price
- old price
- discount price

**Optimal flow:**

> Which price applies?

Present candidates with nearby OCR context.

Never silently choose.

**Priority:** 92/100  
**Proposed UX:** 98/100

### 29. Loyalty/member price ambiguity

**Optimal solution:**

Ask only when needed.

Example:

> Member price EUR 3.49  
> Regular price EUR 4.19

Actions:

- I get member price
- Use regular price

Remember preference only if clearly beneficial, but never assume eligibility forever.

**Priority:** 88/100  
**Proposed UX:** 95/100

### 30. Camera permission denied

**Optimal response:**

> Camera access is off. You can still enter the price manually.

Primary:

> Enter price

Secondary:

> Try camera again

**Priority:** 84/100  
**Proposed UX:** 99/100

No dead end.

### 31. Product lookup/network unavailable

**Optimal response:**

> Product lookup is offline. Enter the price manually.

Do not block the whole app.

**Priority:** 91/100  
**Proposed UX:** 99/100

## F. Reliability and interruption

### 32. Storage write fails mid-trip

**Optimal behaviour:**

- keep valid in-memory state
- mark persistence degraded
- show persistent warning
- offer Retry
- offer copy/export when available
- never display Saved

**Priority:** 99/100  
**Proposed UX:** 96/100

The score remains below 100 until real browser failure modes are tested.

### 33. Reload / OS interruption after commit

Every committed item must already be durable.

On reopen:

- restore active trip directly
- recompute derived totals
- no duplicated item
- no lost item

**Priority:** 100/100  
**Proposed UX:** 99/100

### 34. PWA update during active trip

**Optimal strategy:**

- service worker never owns business data
- do not force reload mid-trip
- signal update discreetly if necessary
- activate new build safely on a natural boundary or explicit reload
- storage migration must handle old/new schema deliberately

**Priority:** 88/100  
**Proposed UX:** 95/100

### 35. Multiple tabs edit same trip

Low-frequency but technically possible.

**MVP decision:**

- last-writer-wins may be acceptable initially
- document limitation
- avoid pretending changes were merged

Potential later improvement:

- detect external storage update
- warn: Trip changed in another tab
- offer reload

Do not build distributed conflict resolution.

**Priority:** 58/100  
**Proposed UX:** 86/100

This is intentionally not over-engineered.

## G. Finish and checkout scenarios

### 36. Finish trip accidentally

Instead of a confirmation dialog before every finish:

- finish opens completed summary
- offer prominent Continue shopping / Reopen trip immediately

Because completion is locally reversible, recovery is better than interruption.

**Priority:** 82/100  
**Proposed UX:** 96/100

### 37. Checkout total nearly matches

Example:

- estimate EUR 46.37
- actual EUR 46.72
- +EUR 0.35

Show:

> Difference +EUR 0.35  
> Very close.

Do not gamify accuracy.

**Priority:** 72/100  
**Proposed UX:** 97/100

### 38. Checkout total differs materially

Example:

- estimate EUR 46.37
- actual EUR 50.80

**Optimal response:**

> Difference +EUR 4.43

Then provide useful diagnostic context, not blame:

- 2 estimated prices
- 3 remembered prices
- possible missed item

Possible action:

> Review uncertain items

Do not claim which item caused the difference unless known.

**Priority:** 91/100  
**Proposed UX:** 95/100

This is a strong use for the price-confidence model.

### 39. Reopen completed trip

**Optimal flow:**

Trip detail offers:

> Continue shopping

If reopened:

- completedAt clears
- actual checkout total is preserved only after an explicit decision or cleared with explanation
- history should not silently duplicate the trip

**Priority:** 69/100  
**Proposed UX:** 92/100

Needs a precise domain rule before implementation.

### 40. Delete history / clear all

Single-trip delete:

- delete
- Undo if reliably recoverable

Clear all:

- explicit destructive confirmation
- explain what is deleted
- do not delete active trip unless explicitly included

**Priority:** 70/100  
**Proposed UX:** 95/100

## H. Offline and platform scenarios

### 41. Offline launch

After successful installation/previous load:

Core works:

- active trip
- manual add
- edit/remove
- quantity
- undo
- buffer
- local history
- finish

Optional network services degrade individually.

**Priority:** 96/100  
**Proposed UX:** 98/100

web.dev recommends an offline-capable app experience rather than falling through to a generic browser error when functionality can remain local.

## I. Accessibility scenarios

### 42. Screen-reader core flow

User can:

1. understand remaining amount
2. open Add price
3. enter price
4. hear projected consequence
5. commit
6. hear new remaining amount
7. edit/remove
8. finish

Avoid duplicate live announcements.

**Priority:** 96/100  
**Proposed UX:** 97/100

### 43. 200% text / large text

Optimal layout:

- vertical reflow
- hero can wrap/grow
- controls remain full-size
- no hidden primary action
- metadata yields space before critical totals

**Priority:** 91/100  
**Proposed UX:** 96/100

### 44. Reduced motion

All behaviour remains identical.

Replace motion with:

- instant state
- subtle opacity/emphasis

**Priority:** 84/100  
**Proposed UX:** 99/100

### 45. Colour-vision / forced-colour mode

Budget states remain clear via:

- text
- labels
- shape/markers
- accessible progress semantics

No red/green-only communication.

**Priority:** 86/100  
**Proposed UX:** 98/100

### 46. One-hand distracted use

This is not an edge case; it is the primary physical context.

Design rules:

- Add near thumb zone
- large numeric controls
- immediate correction
- stable placement
- no tiny top-corner frequent actions
- no persistent active keypad after commit

**Priority:** 100/100  
**Proposed UX:** 98/100

## J. Internationalisation scenarios

### 47. Decimal comma / locale input

User may type:

- 4,79
- 4.79

according to locale/input method.

Domain receives exact minor units after parsing.

Display uses locale-aware currency formatting.

**Priority:** 91/100  
**Proposed UX:** 96/100

### 48. Currency with different minor units

Not every currency uses two decimal places.

Architecture must not hard-code cents everywhere.

Money metadata needs currency minor-unit precision.

Auto-cents must be currency-aware or disabled.

**Priority:** 76/100  
**Proposed UX:** 91/100

Needs careful domain implementation.

### 49. Tax-exclusive shopping context

In some markets shelf/subtotal treatment differs.

**Optimal strategy:**

Default to the simplest local pricing mode.

Optional setting:

- shelf price is final
- add tax

Do not surface tax fields to every user.

Per-item tax complexity belongs later and only with evidence.

**Priority:** 72/100  
**Proposed UX:** 90/100

## K. Meta-scenario: optional automation becomes worse than manual

### 50. Smart feature is slower than typing

Example:

- scanner takes 5 seconds
- manual entry takes 2 seconds

**Rule:**

Never force the smart path.

Measure optional features against the manual baseline.

If scanner/OCR does not reduce interaction cost or improve confidence, simplify, defer, or remove it.

**Priority:** 90/100  
**Proposed UX:** 98/100

This rule protects the product from technology-driven scope creep.

## Scenario tiers

### Tier 0 — must be flawless before release

These define trust and core value:

- 1 first launch
- 3 resume active trip
- 4 manual add
- 6/7 typo recovery
- 8 quantity
- 17 safety buffer
- 19 nominal over-budget preview
- 20 over-budget state
- 32 persistence failure
- 33 reload durability
- 41 offline launch
- 46 one-hand use

Target solution quality: **97+**

### Tier 1 — should be excellent for V1

- discounts
- weighted items
- deposits
- remembered prices
- barcode flows
- shelf scan
- loyalty-price ambiguity
- checkout reconciliation
- accessibility variants
- locale input

Target: **94+**

### Tier 2 — deliberately defer or simplify

- rich 2D barcode special cases
- multiple-tab conflicts
- reopen completed trip
- complex tax rules
- deep history management
- advanced adaptive suggestions

Target before implementation: **90+ or explicit reason to defer**

## Highest-risk unresolved scenarios

### 1. Duplicate/repeated product UX — 91/100

Risk:

The “increase quantity?” prompt may interrupt fast entry.

Prototype alternatives:

- always separate lines
- non-blocking merge suggestion
- automatic merge only for exact same confirmed current price and product identity

Recommended starting point:

**separate lines by default + optional non-blocking merge suggestion.**

### 2. Variable-measure 2D codes — 90/100

Risk:

Retailer/region formats vary.

Recommended:

Build scanner result types that can represent price/weight when standards expose them, but do not make this a release dependency.

GS1's current retail 2D guidance confirms that supported structures can encode count, weight, payable amount, and price per measure for variable-measure items.

### 3. Tax-exclusive contexts — 90/100

Risk:

Rules vary by jurisdiction and item category.

Recommended:

Keep the core model capable of an optional pricing strategy, but do not implement broad tax logic until a specific target market is selected.

### 4. Reopening completed trips — 92/100

Risk:

Completed and actual-checkout semantics can become ambiguous.

Recommended:

Defer until history exists. Define exact rules before implementation.

## Product-wide scenario rules

### Rule 1 — preserve context

Never make the user remember the previous remaining amount while entering a new price.

Show the projected consequence.

### Rule 2 — preserve entered data

If validation or optional lookup fails, keep what the user already entered.

Baymard's checkout research highlights preservation of form data on error as a strong usability pattern.

### Rule 3 — prevent before correcting

If an error can be predicted before commit, show it before commit.

Examples:

- over budget
- invalid money input
- OCR ambiguity

### Rule 4 — undo before confirm

For frequent reversible actions, prefer Undo.

For rare destructive actions, use confirmation.

### Rule 5 — optional intelligence never blocks core

Camera, barcode lookup, OCR, network, voice, haptics, and future AI features are enhancements.

Manual exact-money input is the universal fallback.

### Rule 6 — uncertainty is data

Do not hide whether a price is:

- current confirmed
- remembered
- scanned candidate
- estimated

This enables honest totals and useful reconciliation.

### Rule 7 — offline is a normal operating condition

Do not show a blocking offline page when the user's core task can continue.

### Rule 8 — user owns the limit

Budget and buffer are decision aids, not enforcement mechanisms.

Allow intentional overage.

### Rule 9 — local interactions feel instant

Never put loading states on pure local operations.

### Rule 10 — implementation complexity follows scenario value

A scenario with low frequency and low consequence does not justify a large subsystem.

## Aggregate evaluation

### Core concept after scenario analysis

**94/100**

Why not higher yet:

- real usability testing is still missing
- scanner performance is unproven
- duplicate-product interaction needs prototyping
- global tax/currency edge cases are intentionally not fully solved

### Core manual-shopping experience

**98/100 design potential**

This is the strongest part of the product:

- simple
- immediately understandable
- offline
- exact
- reversible
- low metadata burden

### Repeated-use experience with price memory

**96/100 potential**

Strong if price freshness and store context remain honest.

### Scanner-assisted experience

**93/100 current design potential**

High upside, but actual score depends on:

- camera speed
- barcode recognition
- product database coverage
- OCR quality
- number of false candidates
- whether it truly beats manual entry

### Reliability model

**97/100 target**

Strong architecture:

- local-first
- prompt persistence
- explicit degraded state
- no animation/network dependency

Needs real browser failure testing before 100.

### Accessibility model

**97/100 target**

Strong because camera, colour, motion, sound, and precise gestures are not required for the core flow.

### Scope discipline

**99/100**

The current documentation strongly resists becoming a generic finance/grocery super-app.

## Release gate

Do not call the shopping MVP “ready” until Tier 0 scenarios can be demonstrated end-to-end and automated tests cover the correctness-critical parts.

Minimum real scenario demo:

1. start EUR 50 trip
2. set EUR 2 buffer
3. add 8–12 prices
4. make and correct one typo
5. use quantity
6. remove and Undo
7. cross safe limit
8. preview a nominal over-budget item
9. cancel it
10. reload app
11. continue offline
12. finish trip
13. optionally enter real checkout total

If this feels calm and effortless, later smart features have a strong foundation.

## Research references

- Apple HIG — Entering Data: https://developer.apple.com/design/human-interface-guidelines/entering-data
- Nielsen Norman Group — 10 Usability Heuristics: https://www.nngroup.com/articles/ten-usability-heuristics/
- Nielsen Norman Group — UI Accelerators: https://www.nngroup.com/articles/ui-accelerators/
- Baymard — Quantity controls and Undo: https://baymard.com/research-articles/auto-update-users-quantity-changes
- Baymard — Checkout UX Best Practices: https://baymard.com/research-articles/current-state-of-checkout-ux
- Baymard — Mobile touch keyboards: https://baymard.com/research-articles/mobile-touch-keyboards
- web.dev — PWA assets/data and offline readiness: https://web.dev/learn/pwa/assets-and-data
- web.dev — PWA checklist: https://web.dev/articles/pwa-checklist
- GS1 — 2D Barcodes at Retail POS Implementation Guideline: https://ref.gs1.org/guidelines/2d-in-retail/

## Maintenance rule

Whenever a real bug, user test, or competitor review exposes a scenario not represented here:

1. add the scenario
2. score its priority
3. propose the smallest coherent UX
4. score the proposed UX
5. update FUNCTIONALITY.md / UX.md / DOMAIN.md only when the scenario changes a product contract
6. add automated regression coverage when implemented

The scenario matrix should become more evidence-driven over time, not merely longer.
