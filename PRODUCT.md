# Product

## Status

This document defines the target product direction for the repository.

The current implementation is still Pulse Counter. The target evolution is a focused, mobile-first shopping budget companion. Code, README copy, and architecture must not claim target features until they are implemented.

## Product thesis

Help a shopper stay under a hard spending limit while they can still change what is in the cart.

Primary promise:

> Set your limit. Add prices. Always know what is left.

The product should answer one question better and faster than general budgeting or grocery applications:

> How much can I still safely spend right now?

## Problem

A shopper may enter a store with a strict limit such as EUR 50, but the physical cart does not show a running total. Mental arithmetic becomes unreliable as the number of items grows, and discovering an overrun at checkout is late: the user is already at the register and may need to remove items under social and time pressure.

This is especially relevant for:

- shoppers on a fixed or constrained income
- students
- cash-envelope users
- gift-card users
- households making large grocery trips
- anyone intentionally setting a hard per-trip cap

Competitive review research confirms that users value knowing the total before checkout and use shopping calculators specifically to avoid overspending. The opportunity is not to prove that the problem exists; it is to remove more friction than existing tools.

## Job to be done

When I shop with a fixed spending limit, help me see what I can still afford as I add items, so I can adjust the cart before checkout instead of being surprised at the register.

## User outcome

A successful shopping trip means the user:

1. sets a limit in seconds
2. adds prices with very little interaction
3. always sees the remaining safe amount without navigating
4. can correct mistakes immediately
5. does not lose the active trip if the page reloads
6. reaches checkout already knowing approximately what the cart will cost
7. can optionally compare the estimate with the actual checkout total

## North-star product metric

### In-product decision metric

Remaining safe spending amount.

The interface may show cart total and budget progress, but the primary metric is what the user can still do, not what they have already done.

### Product-validation metric

The primary retention signal is:

> **Second-trip rate**

The product is not validated merely because a first trip works. It becomes meaningfully stronger when a shopper voluntarily returns and uses it on another real shopping trip.

Initial decision thresholds and the full retention strategy are defined in:

- docs/PRODUCT-SUCCESS-STRATEGY.md

## Product principles

### 1. Remaining beats spent

The primary screen answers “what is left?” before “what has been spent?”

### 2. Speed beats feature count

Frequent actions must be possible in seconds. A feature that makes the common path slower must justify itself with material user value.

### 3. Price first

A product name, category, photo, barcode, store, or note is optional unless required by the user’s chosen workflow.

The minimum useful input for an item is its price.

### 4. Manual entry must always work

Manual price entry is the baseline interaction and must remain available offline.

Scanning is an accelerator, never a dependency.

### 5. No surprise automation

Remembered, scanned, and estimated prices must be clearly distinguished from prices confirmed during the current trip.

The product must never present a stale remembered price as a current store price.

### 6. Local-first core

A shopper must be able to start and complete the core workflow without an account, bank connection, or network connection.

### 7. No shame

Going over a limit is information, not failure.

Use neutral language such as “EUR 3.41 over your limit,” never moralising language such as “You overspent again.”

### 8. Complexity must earn its tap

Every feature must either reduce entry friction, improve confidence before checkout, prevent data loss, or make a repeated shopping task materially faster.

Otherwise it does not belong in the core product.

### 9. Repeated use must get easier

The second and third shopping trips should require materially less effort than the first.

Prioritise:

- repeat previous budget
- Shop again
- Recent Items
- remembered prices with freshness
- one/two-action reuse

before adding scanner/OCR breadth.

### 10. Evidence beats feature race

After the core manual and repeat-trip flows are implemented, real-store retention evidence takes priority over adding more capabilities.

A low second-trip rate is a core product signal, not a request for more features.

## Core experience

### Start

The first useful question is:

> How much can you spend today?

Provide optional quick values plus custom entry.

Do not require an account, tutorial carousel, profile, category setup, or store selection.

### Shop

The active-trip screen always exposes:

1. remaining amount
2. cart total relative to the limit
3. clear progress
4. one primary add action
5. recent items and undo

### Add

Default flow:

1. tap Add price
2. enter the price using a large one-hand keypad
3. preview the remaining amount before committing
4. add

An optional auto-cents mode may allow 379 to resolve to EUR 3.79 when configured for a two-decimal currency.

### Correct

Editing, removing, and undoing must be immediate. A shopper changing their mind is normal behaviour, not an exceptional workflow.

### Checkout

The user may finish the trip with only the estimated total.

Optional reconciliation records estimated total, actual checkout total, and difference. This exists to improve confidence and future safety-buffer suggestions, not to become a full expense tracker.

## Safety buffer

The user may reserve part of the nominal budget.

Example:

- available money: EUR 50
- safety buffer: EUR 2
- safe spending limit: EUR 48

This protects against approximate weighted goods, bottle deposits, missed items, stale remembered prices, and small calculation differences.

## Price confidence

Every price has an explicit origin:

- confirmed — entered or confirmed during the current trip
- remembered — reused from a previous trip
- scanned — detected from a shelf label and awaiting or receiving confirmation
- estimated — intentionally approximate

The UI must make uncertainty visible without making the interface noisy.

## Input strategy

### P0 — manual price entry

Always available, offline, deterministic, and fast.

### P1 — repeat-trip acceleration and price memory

Repeat-trip acceleration is a retention feature, not merely a convenience.

Prioritise:

- repeat previous budget
- Shop again
- Recent Items
- remembered prices

Remembered values include freshness context such as “Last paid EUR 1.39 at Prisma, 8 days ago.”

This work should land before barcode/OCR because it reduces repeated friction without camera permissions, network dependency, recognition latency, or product-database coverage.

### P1 — barcode identification

A barcode primarily identifies a product; it does not normally contain an authoritative current shelf price.

Useful flow:

1. scan barcode
2. identify product if possible
3. show remembered store-specific price if available
4. require confirmation or current-price entry
5. remember the confirmed relationship for the future

A barcode scan that still forces unnecessary metadata entry has failed its purpose.

### P1/P2 — shelf-label scanning

Camera-assisted price-tag reading can be more valuable to the core job than barcode scanning because the user primarily needs the current price.

Detected values must always be previewed before commit.

### P2 — voice

Voice may reduce one-hand typing, but it is optional and never required for the core workflow.

## What we deliberately are not building

This product is not:

- a general personal-finance application
- a bank-linked expense tracker
- a net-worth dashboard
- an investment tool
- a bill manager
- a meal planner
- a nutrition tracker
- a grocery delivery service
- a coupon marketplace
- a retailer loyalty platform
- an AI financial adviser
- a household operating system
- a social network

These boundaries protect the central value proposition.

## Competitive strategy

We will not attempt to beat mature competitors by accumulating more features.

We compete on:

1. interaction speed
2. remaining-first information hierarchy
3. reliability
4. honest price confidence
5. local-first privacy
6. zero-friction first use
7. a calm, non-judgmental product personality

## Competitive lessons already validated

Research reviewed Total Plus, GroceryBudget, CartBudget, Cart AI, Shopping Calculator, and Cart Tracker.

Repeated positive signals:

- live totals are genuinely useful
- budget progress helps users change decisions before checkout
- quantity, discounts, taxes, reusable items, and price memory can remove real friction
- offline operation is valuable in stores
- no-account entry reduces barriers

Repeated negative signals:

- typing every field becomes tedious
- keeping a keypad active can cause accidental input
- scanners disappoint when scanning does not remove manual work
- aggressive paywalls before first value destroy trust
- data-loss or reappearing-item bugs are unacceptable
- feature growth can turn a simple utility into a cluttered grocery suite

## Tone and personality

The product should feel calm, helpful, optimistic, lightly witty, and never judgmental.

Humour belongs in low-stakes moments, not errors involving money or data integrity.

Appropriate:

> EUR 2.20 left. We have entered the snack-decision zone.

Appropriate after a precise finish:

> That was close. Nicely done.

Not appropriate:

> You overspent again.

## Business value

The product creates value by helping users avoid checkout surprises, stressful item removal at the register, repeated mental arithmetic, and accidental breaches of a hard spending cap.

The portfolio version should remain fully useful without monetisation.

If commercialised later, monetisation must not block the core budgeting workflow. Potential paid extensions must have real marginal cost or advanced value, such as cross-device household sync, large-scale OCR processing, advanced long-term price analytics, or retailer integrations.

## Success criteria

A first-time user can:

- understand the purpose from the first screen
- start a trip in under 10 seconds
- add a manual price in roughly 3 seconds
- see remaining budget with zero navigation
- undo the last addition in one action
- reload and resume without losing committed data
- complete the core workflow without an account or internet connection

These are internal targets until measured.

### Repeated-use success

After repeat-trip acceleration is implemented, validate the product with real shopping trips.

The highest-value early signal is second-trip rate.

Provisional interpretation:

- >=35% — very strong early signal
- 25–35% — promising; optimise recurring friction
- 15–25% — material retention problem
- <15% — revisit the core interaction/job before expanding features

These thresholds are decision heuristics, not established benchmarks. Real cohort evidence overrides them.

The common manual price-only flow should target a median of <=2.5 seconds in representative one-hand testing, with approximately 3 seconds or less as a minimum release-quality expectation.

See docs/PRODUCT-SUCCESS-STRATEGY.md for the full model.

## Product risks

### Input fatigue

If adding prices feels like bookkeeping, retention will collapse.

Mitigation: price-first flow, auto-cents, price memory, optional scanning, one-hand design.

### Scanner theatre

A scanner that looks impressive but saves no work harms trust.

Mitigation: measure scanner usefulness by interaction reduction, not technical novelty.

### Scope drift

Grocery apps naturally expand into recipes, lists, household planning, coupons, and finance.

Mitigation: every proposed feature must map to the core job.

### False precision

Remembered or estimated prices can differ from checkout reality.

Mitigation: price confidence, safety buffer, optional reconciliation.

### Data loss

An active trip is small data with high immediate importance.

Mitigation: persist every committed mutation and surface persistence failure.

## Decision rule for future features

Before accepting a feature, answer:

1. Does it help the shopper stay under the trip limit before checkout?
2. Does it reduce interaction cost or increase confidence?
3. Can it remain optional for users who want the simplest workflow?
4. Does it preserve offline/manual fallback?
5. Does it avoid turning the product into a general finance or grocery platform?

If the answer is no to the first question, the feature normally does not belong here.
