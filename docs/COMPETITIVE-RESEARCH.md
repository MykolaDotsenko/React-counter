# Competitive Research

## Purpose

This document records external evidence used to shape the shopping budget companion.

It exists to prevent two recurring mistakes in product development:

1. rediscovering lessons already visible in competitor reviews
2. copying competitor feature breadth instead of understanding why users value or reject those features

Research is a product input, not a feature checklist.

## Research snapshot

Last reviewed: 2026-09-21

Primary sources reviewed:

- official App Store / Google Play listings
- verified store reviews where surfaced
- competitor product/pricing pages
- developer-authored public posts for qualitative signals, clearly marked as self-reported

Ratings, pricing, and feature sets change over time. Treat values below as a dated snapshot, not permanent facts.

## Evidence levels

### Level A — strong

Direct app-store listing, official product page, or verified store review.

Use for:

- current listed features
- current visible pricing
- review text
- ratings/download counts shown by the store at research time

### Level B — useful but self-reported

Developer blog, Reddit launch post, or product analytics published by the maker.

Use for:

- hypotheses
- qualitative direction
- possible retention/conversion signals

Do not treat self-reported analytics as independently verified benchmarks.

### Level C — inference

Our interpretation across multiple sources.

Useful for product decisions, but should be labelled as a conclusion rather than a competitor fact.

## Competitor: Total Plus — Shopping Calculator

Source:

https://apps.apple.com/us/app/total-plus-shopping-calculator/id914553629

### Snapshot

At research time the US App Store listing showed approximately:

- 4.6 / 5
- 2.3K ratings

Listed capabilities include:

- shopping total calculation
- budget-oriented use
- quantity and weight
- discounts
- tax calculation
- saved/reusable lists
- previous-price comparison
- no ads

### What users like

A particularly relevant verified review describes using the app on a fixed income specifically to avoid overspending during grocery runs.

Positive themes visible in reviews/listing:

- practical utility during real shopping
- easy learning curve
- stable/reliable feel
- quantity and tax support
- ability to retain lists for later reference
- inexpensive upgrade perceived as reasonable by at least some users

### Friction / requests

Review themes include:

- quantity limitations in the free/basic flow historically created repetitive entry
- users want photos or richer item recognition in some workflows
- keeping a calculator/keypad surface active can cause accidental numeric touches while walking/shopping
- tax treatment can be nuanced by item type and region

### Product lesson

Keep:

- simplicity
- reliability
- fast arithmetic
- quantity
- optional tax/discount support
- reuse

Improve:

- remaining-first hierarchy
- safer resting screen after price commit
- lower repeated typing
- stronger mobile one-hand ergonomics

Do not assume that “more automation” is automatically more useful than a stable calculator.

## Competitor: GroceryBudget

Sources:

https://apps.apple.com/us/app/grocery-budget-shopping-list/id6749287517

https://grocerybudget.app/pricing

https://grocerybudget.app/blog/is-grocerybudget-free

### Listed capabilities

The product has expanded rapidly and includes:

- real-time budget tracking
- budget bar
- unlimited carts/items in the free tier at research time
- price memory
- price history / store comparison
- offline use
- no account required for core use
- voice input
- AI label scanning
- receipt scanning
- templates
- sharing / family features
- spending insights

### Strong product signals

The product explicitly optimises around knowing spend before checkout rather than after.

Its release notes repeatedly improve:

- scanner speed
- scanner parsing of difficult price labels
- offline price history
- add-item button placement
- reordering/edit reliability
- price memory

This suggests that capture friction and in-store reliability are central problems, not edge cases.

### Self-reported analytics — caution

Public developer posts have claimed materially better retention/conversion among scanner users and described price memory as a surprisingly strong repeated-use feature.

Source example:

https://www.reddit.com/r/StartupSoloFounder/comments/1u92pns/typing_on_your_phone_while_pushing_a_grocery_cart/

Treat these numbers as Level B evidence: useful directional information, not an independent benchmark.

### Product lesson

Keep:

- live budget progress
- offline core
- no-account core
- price memory
- fast capture methods

Do not automatically copy:

- full grocery planning
- deep insight dashboards
- recurring-list complexity
- receipt-centric workflows

Our core job ends before checkout; receipt scanning is secondary.

## Competitor: CartBudget

Source:

https://apps.apple.com/us/app/cartbudget-shopping-budget/id6766228722

### Listed positioning

CartBudget explicitly promises:

- know the grocery total before paying
- set a budget
- track spending while shopping
- lists
- voice input
- barcode scanning
- budget alerts
- monthly reports

### Product lesson

The basic problem is clearly validated and not unique.

Therefore our differentiation cannot be:

> We also show a live shopping total.

It must be executional and behavioural:

- faster manual entry
- clearer remaining-first metric
- honest price-confidence model
- local-first reliability
- less setup and reporting overhead

## Competitor: Cart AI

Sources:

https://apps.apple.com/us/app/cart-ai-grocery-budget-list/id6742040639

https://apps.apple.com/ca/app/cart-ai-track-grocery-budget/id6742040639

### Listed capabilities

At research time store pages showed features such as:

- trip budget
- live cart total
- price scanning
- manual entry
- offline support
- many currencies
- travel conversion

### Trust lesson from reviews

A verified Canadian App Store review strongly criticised encountering a paywall before being able to meaningfully inspect/use the app and objected to a high weekly price at that time.

The US listing later showed different monetisation language/pricing, illustrating that commercial models change.

### Product lesson

The important signal is not one exact historical price.

The lesson is:

> A budgeting utility loses trust when it asks for money before delivering obvious first value.

Our portfolio product should let the user experience the complete core flow immediately.

If commercialisation happens later, monetisation must not undermine the trust proposition.

## Competitor: Shopping Calculator by MLZ

Source:

https://play.google.com/store/apps/details?id=mlz.shoppingcalculator.free

### Snapshot

At research time Google Play showed approximately:

- 4.1 stars
- 600+ reviews
- 100K+ downloads

Listed capabilities include:

- live total
- budget tracking
- shopping list/checking
- reorder items
- discounts
- optional sales tax
- history
- sharing / printing

### Positive review signals

Verified review examples praise:

- ease of use
- clear/pleasant interface
- usefulness for avoiding checkout overspend
- automatic tax support where relevant

### Requests / friction

At least one review requested per-item tax flexibility because food/non-food rules differ.

### Product lesson

Regional pricing/tax differences are real, but they should remain optional configuration rather than contaminate the default VAT-inclusive European workflow.

## Competitor: Cart Tracker — Grocery Budget

Source:

https://play.google.com/store/apps/details?id=com.jber.carttracker

### Snapshot

At research time Google Play surfaced a low rating with a small review count, so conclusions must be cautious.

One verified 2026 review is highly relevant: the user liked the idea of scanning barcodes to track potential spend but criticised having to type the price manually after scanning, saying this defeated the purpose.

### Product lesson

This is one of the clearest scanner rules for our product:

> Scanning is successful only when it removes meaningful interaction.

Barcode scanning alone cannot promise current price because normal retail barcodes primarily identify products.

Therefore our barcode flow should combine:

- identity
- remembered price/store context
- quick current-price confirmation

If it still asks for every piece of metadata, manual price entry is better.

## Cross-competitor pattern: what users value

Across the reviewed products, repeated positive themes are:

### 1. Knowing before checkout

Users want the total while they can still remove or swap products.

### 2. Fast input

Shopping is not a desk workflow.

Every extra text field competes with walking, holding a basket/cart, comparing products, and possibly managing children.

### 3. Reliability

A small stable utility earns more trust than a feature-rich app that loses or resurrects items.

### 4. Reuse

Price memory, reusable items, and remembered lists can remove repeated typing.

### 5. Offline/no account

Store connectivity can be weak; authentication should not stand between the user and a simple local calculation.

### 6. Visual budget progress

A running total plus a budget-progress cue helps users understand state quickly.

## Cross-competitor pattern: what creates frustration

### 1. Repeated typing

Re-entering product names, prices, quantities, and metadata every trip becomes work.

### 2. Scanner theatre

A scanner that still requires the same manual work is worse than a fast keypad.

### 3. Premature paywalls

Asking for subscription/payment before the user understands value damages trust.

### 4. Data-integrity bugs

Deleted items reappearing, purchases not restoring, or carts failing to persist are disproportionately harmful in a money-related workflow.

### 5. UI bloat

Lists, analytics, categories, meal planning, receipts, family sync, and store comparison can all be valuable — but putting them in the active shopping path damages speed.

### 6. Tax complexity

Tax requirements vary strongly by region and item type.

A universal default UI is likely to be wrong somewhere.

## Opportunity map

### Validated but crowded

- running cart total
- trip budget
- shopping list
- receipt scan
- barcode identification
- basic budget alerts

We should not claim novelty here.

### Strong execution opportunities

- remaining-first rather than spent-first hierarchy
- ultra-fast price-only manual entry
- auto-close keypad after commit
- one-tap undo
- safe buffer
- explicit price origin/freshness
- store-aware remembered price without pretending it is live
- exact local money arithmetic
- visible persistence health
- scanner confirmation boundaries
- zero-account/offline first use

### Potential differentiated system

Price confidence is the most promising cohesive idea.

Instead of pretending every cart number has equal certainty, track whether each price is:

- confirmed now
- remembered from a dated previous trip
- scanned candidate
- estimated

Then let the UI communicate when a safety buffer is prudent.

This is more aligned with the real problem than adding generic financial analytics.

## Competitive positioning

Do not position as:

> the grocery app with the most features

Do position as:

> the fastest, clearest way to stay under a shopping limit while you can still change the cart

Supporting ideas:

- no bank connection
- no account required for core use
- offline manual workflow
- exact arithmetic
- honest uncertainty

## Feature adoption rule

A competitor feature should only be adopted if it passes at least one of these tests:

1. removes repeated interaction
2. prevents a meaningful shopping-budget mistake
3. increases confidence in the pre-checkout total
4. protects data/reliability
5. is repeatedly requested or praised across credible evidence

Do not copy a feature solely because several competitors have it.

## Research gaps

Before implementing advanced features, gather more evidence for:

- real barcode usage versus shelf-label scanning
- weighted-product behaviour in Finnish/Nordic grocery contexts
- bottle-deposit handling
- user preference for auto-cents keypad
- acceptable price-memory freshness messaging
- whether users value trip-only budget more than monthly grocery budget
- accessibility needs for one-handed low-vision use

## Usability research plan

A small real-user study is more valuable now than additional desk research.

Suggested tasks:

1. Give the user a EUR 50 limit.
2. Simulate 10–15 shelf prices.
3. Ask them to maintain the cart while holding something in the other hand.
4. Include one quantity change.
5. Include one removed item.
6. Include one stale remembered price.
7. Include one item that would exceed the limit.

Measure:

- time per price entry
- entry errors
- accidental taps
- whether remaining amount is noticed without prompting
- whether price-origin labels are understood
- whether warnings feel helpful or obstructive

## Source list

Primary sources captured in this research snapshot:

- Total Plus App Store: https://apps.apple.com/us/app/total-plus-shopping-calculator/id914553629
- GroceryBudget App Store: https://apps.apple.com/us/app/grocery-budget-shopping-list/id6749287517
- GroceryBudget pricing: https://grocerybudget.app/pricing
- GroceryBudget free/offline explanation: https://grocerybudget.app/blog/is-grocerybudget-free
- GroceryBudget developer post (self-reported): https://www.reddit.com/r/StartupSoloFounder/comments/1u92pns/typing_on_your_phone_while_pushing_a_grocery_cart/
- CartBudget App Store: https://apps.apple.com/us/app/cartbudget-shopping-budget/id6766228722
- Cart AI App Store: https://apps.apple.com/us/app/cart-ai-grocery-budget-list/id6742040639
- Shopping Calculator Google Play: https://play.google.com/store/apps/details?id=mlz.shoppingcalculator.free
- Cart Tracker Google Play: https://play.google.com/store/apps/details?id=com.jber.carttracker

## Research maintenance rule

When new evidence changes a product decision:

1. add/update the evidence here
2. label evidence strength
3. update PRODUCT.md / UX.md / DOMAIN.md only if the product contract truly changes
4. record meaningful architecture decisions separately

Do not let competitor releases silently reshape the product.


## 2026 directional evidence — GroceryBudget retention and scanner signals

This section records **developer-reported directional evidence**, not independently audited analytics.

Treat it as hypothesis-strengthening evidence only.

### Reported retention

In April 2026, the GroceryBudget developer reported on Reddit that:

- about 42% of users who completed a first cart returned for another trip
- users who set a budget were reported as more likely to return
- camera-scan users were reported at 51.8% return versus 18.6% for non-scan users
- Price Memory was described as reducing repeated typing after a few trips

Source:

- https://www.reddit.com/r/iOSAppsMarketing/comments/1skm0ia/i_built_an_app_that_tracks_your_grocery_spending/
- https://www.reddit.com/r/ViralApps/comments/1ss4hs9/i_built_an_app_that_tracks_your_grocery_spending/

### Reported scanner interaction value

Later posts described scanner interaction dropping item-entry time from roughly 15–20 seconds of the developer's previous item+price typing flow to roughly 3–5 seconds in their camera workflow.

This is not directly comparable to our planned price-only manual baseline, which targets roughly 2–3 seconds.

Therefore the correct lesson is **not** “scanner is automatically faster.”

The correct lesson is:

> test scanner against our own optimized manual baseline.

Sources:

- https://www.reddit.com/r/apps/comments/1u2kaob/my_grocery_app_scans_the_shelf_price_tag_with/
- https://www.reddit.com/r/appledevelopers/comments/1tr1xzd/my_grocery_app_had_a_typing_problem_so_i_added_ai/

### Reported acquisition / monetisation scale

In June 2026, the developer reported approximately:

- 16,800 downloads
- 159 active subscribers
- 67 trials
- USD 154 MRR
- USD 594 revenue in the prior 28 days

A later June update reported higher active subscriptions and MRR while top-of-funnel growth cooled.

These figures are self-reported and not independently audited.

Lesson:

- meaningful organic download volume is plausible in this niche
- downloads do not automatically imply strong revenue
- retention and monetisation must be treated separately from acquisition

Sources:

- https://www.reddit.com/r/ProductHunters/comments/1u9yqg7/just_launched_an_app_called_grocerybudget_on/
- https://www.reddit.com/r/AppBusiness/comments/1ud3eg6/6_weeks_after_my_440_funnel_post_mrr_tripled_to/

### Mature-category evidence

Total Plus currently shows:

- roughly 2.3K App Store ratings
- 4.6/5 rating
- “Trusted by 40,000+ shoppers” in its listing
- reusable lists/items, quantity/weight, discounts, tax, and previous-price comparison

Source:

- https://apps.apple.com/us/app/total-plus-shopping-calculator/id914553629

### Product consequence

These signals strengthen four hypotheses:

1. pre-checkout spending control solves a real recurring problem
2. repeated-use acceleration such as Price Memory matters
3. camera capture may be a strong retention lever for some users
4. feature breadth alone is not a defensible strategy

They **do not** prove:

- our scanner should ship early
- scanner causes retention
- our users will match competitor cohorts
- our monetisation will resemble competitor monetisation

The roadmap therefore uses an early scanner benchmark without promoting production scanner breadth ahead of retention-first work.
