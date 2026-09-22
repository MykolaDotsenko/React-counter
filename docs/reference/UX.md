# UX

> [!NOTE]
> **Documentation role: supporting reference.** Use [../README.md](../README.md) for the authority model. This file preserves detailed UX heuristics and edge-case guidance; current authoritative product/design/spec contracts take precedence if wording diverges.

## Status

This document defines the target user experience for the shopping budget companion.

The current interface is a task-focused shopping product. Preserve tactile feedback, accessibility, motion discipline, and responsive craft only where they improve the shopping workflow.

## UX north star

A shopper should understand the current budget situation at a glance while holding a basket, walking, and paying partial attention to the phone.

Optimise for:

- one hand
- short interactions
- imperfect connectivity
- distraction
- repeated use
- immediate recovery from mistakes

## First-impression test

Within 3–5 seconds of opening the active shopping view, a new user should understand:

1. this helps keep a shopping trip under a limit
2. the large number shows how much money remains
3. the primary action adds a price

If explanatory text is required to understand those three things, the screen is too complex.

## First-use flow

Do not show onboarding slides.

First useful question:

> How much can you spend today?

Offer optional quick values plus a custom amount.

After selection, immediately create the trip and open the active-shopping view.

Do not require an account, email, store, item categories, shopping list, tutorial, notification permission, or financial profile.

## Active-trip information hierarchy

### Level 1 — remaining amount

The dominant visual element.

Example:

> EUR 18.58 LEFT

### Level 2 — cart total and limit

Example:

> EUR 31.42 of EUR 50.00

### Level 3 — progress

A simple linear or radial representation gives peripheral awareness without requiring arithmetic.

### Level 4 — primary action

> ADD PRICE

Large, thumb-reachable, visually obvious.

### Level 5 — recent activity

Enough information to correct errors quickly without visually competing with the remaining amount.

## Remaining-first design

Do not design the active screen like an expense report.

The shopper's active question is not “How much have I spent?” It is “What can I still put in the cart?”

Cart total remains visible because it builds trust, but remaining amount gets the strongest hierarchy.

## One-hand ergonomics

Guidelines:

- minimum frequent-action target: 48 by 48 CSS pixels
- primary add control near the lower reachable region
- avoid frequent actions in top corners
- avoid tiny inline edit icons as the only edit path
- support portrait first
- no hover-only interaction

The target context is a phone around 390 by 844 CSS pixels, while remaining robust at narrower widths and increased text size.

## Manual price entry

Manual entry is the reference-quality interaction.

It must be offline, fast, deterministic, and usable without product metadata.

### Keypad

Requirements:

- prominent current value
- clear currency
- obvious backspace
- explicit commit
- quantity defaults to 1
- preview result before commit

Example:

> Price EUR 4.79
> After adding: EUR 13.79 left

### Auto-cents

For currencies with two fractional digits, an optional fast-entry mode may interpret 479 as EUR 4.79.

It must be consistent and obvious. Never introduce ambiguous automatic formatting silently.

### After commit

Close the keypad and return to the summary view.

Competitive reviews show that leaving a calculator surface active while walking can cause accidental taps. The resting screen should be summary-first and safe from unintended numeric entry.

## Add-price sheet

The primary Add action opens the preferred capture method.

Default:

> Price

Secondary capture methods can remain available without crowding the main screen:

- price
- barcode
- price tag
- voice

Do not put four equally dominant capture buttons on the active-trip screen.

## Quantity

Quantity is core arithmetic, not a premium convenience.

Default is 1.

Example:

> EUR 1.29
> Quantity: minus 3 plus
> Line total: EUR 3.87

Quantity changes update the remaining preview immediately.

## Weighted items

Weighted goods introduce uncertainty.

Target interaction may support unit price, known or estimated weight, calculated line total, and visible estimated state.

If the exact weight is unknown, allow an approximate direct price instead.

Never imply exactness when the value is estimated.

## Discounts

Discounts should be accessible but not permanently visible.

Useful quick actions may include 10%, 20%, 30%, and custom.

Show the effective price before commit.

Avoid turning every item entry into a pricing form.

## Tax modes

Default regional behaviour should minimise friction.

In VAT-inclusive contexts, shelf price is normally the consumer-facing final price.

For tax-exclusive contexts, support optional tax settings without forcing those controls into the core screen.

## Safety buffer

Safety buffer should feel protective, not punitive.

Example:

> Budget EUR 50
> Buffer EUR 2
> Safe limit EUR 48

When active, the primary hero should prefer safe remaining. Nominal remaining can remain available in secondary detail.

After the safe limit is crossed but the nominal budget is still intact, the safe-spend hero should floor at EUR 0.00 rather than show a negative “safe to spend” amount. Secondary copy should say that the safety buffer has been reached and show the exact nominal amount still available.

## Threshold states

Use progressive attention, not alarm fatigue.

Conceptual states:

- comfortable
- getting close
- at safe limit
- over safe limit
- over nominal budget

Do not rely on colour alone. Use copy, iconography, shape, and accessible text.

## Over-budget behaviour

If a pending item would exceed the limit, show that before commit.

Example:

> This puts you EUR 3.41 over your limit.

Actions:

- Add anyway
- Cancel

Do not block the user absolutely. The budget belongs to the user.

## Undo and correction

Undo is first-class.

After add:

> EUR 4.79 added · Undo

Requirements:

- one-action undo
- edit quantity
- edit price
- remove item
- confirmation only for destructive trip reset

Avoid modal confirmation for ordinary corrections that are easy to undo.

## Cart list

The list is operational, not archival.

Each row prioritises:

- price or line total
- quantity when above 1
- optional item name
- price-confidence cue when not confirmed

Optional metadata stays visually secondary.

## Price-confidence UI

The user must distinguish price origins.

Suggested language:

- Confirmed now
- Last paid 8 days ago
- Shelf scan — confirm
- Estimated

Do not use vague AI-confidence percentages unless a meaningful calibrated model exists.

Remembered prices always show age and, when known, store context.

## Barcode UX

Barcode scan is a product-identity shortcut.

Good flow:

1. scan
2. identify product if possible
3. show current-trip or remembered price context
4. confirm or enter current price
5. add

Bad flow:

1. scan
2. ask for name
3. ask for category
4. ask for store
5. ask for price
6. save

A scan that increases interaction has failed.

## Shelf-label scan UX

The goal is current-price capture.

Example:

> Detected EUR 3.79
> Add EUR 3.79

Product name is optional supplementary output.

Every detected price must be confirmed before it affects the cart.

If multiple candidate prices appear, present candidates rather than guessing silently.

## Price memory

Price memory exists to reduce repeated typing.

Useful suggestion:

> Milk 1L
> Last paid EUR 1.39 at Prisma · 8 days ago

Primary action:

> Use EUR 1.39

Secondary:

> Enter current price

Remembered prices must never look identical to prices confirmed on the current shelf.

## Store context

Store is optional.

Do not require store selection to start a trip.

If the user chooses a store, price memory may become store-aware.

Store context should improve suggestions, not become setup overhead.

## Checkout reconciliation

Finishing a trip should be lightweight.

Primary completion:

> Finish trip

Optional actual checkout total may then produce:

> Estimated EUR 46.37
> Actual EUR 46.72
> Difference +EUR 0.35

Use reconciliation to improve confidence and future buffer suggestions, not to build a finance dashboard.

## Trip history

History should answer practical questions:

- What was the last trip total?
- What did I pay for this item last time?
- How accurate are my estimates?
- Can I start a similar trip without re-entering the same spending plan?

History is a repeat-shopping accelerator, not a reporting dashboard.

A completed-trip card should prioritise:

1. completion time
2. tracked total and budget outcome
3. lightweight checkout comparison when available
4. one-action **Shop again**
5. progressive-disclosure item details
6. quiet destructive controls

Item details should expand inline rather than opening a new navigation layer when the information is small.

Local-data controls must distinguish completed-trip history from Price Memory. Clearing one must never visually imply that the other was deleted. Rare destructive actions use explicit inline confirmation with factual consequence copy.

Reachability is part of this contract: if trip history becomes empty while remembered prices remain, the start screen keeps a quiet **Manage remembered prices** entry point. If Price Memory is degraded with no valid records, that entry point becomes **Repair remembered prices** instead of disappearing. A destructive action or recovery state must not strand local data behind a navigation condition that no longer exists.

Avoid monthly cash-flow dashboards, category-budget systems, income tracking, net worth, financial scoring, or a persistent history tab.

## Empty states

Teach by invitation, not documentation.

Example:

> EUR 50.00 left
> Your cart is empty. Add the first price when you pick something up.

## Loading

Core local interactions should not display loading states.

Network-dependent helpers may load independently without blocking manual add, cart view, calculations, undo, or completion.

## Offline behaviour

Offline is a normal mode, not an error mode.

Core experience remains unchanged.

Network-dependent helpers should degrade locally and explain only the affected capability.

## Persistence failure

Data-integrity failures are serious. Do not use humour.

Example:

> This trip cannot be saved right now. Keep this page open until checkout.

Offer retry and recovery actions when possible.

## Motion

Motion communicates state change; it never owns state change.

Critical rule:

> State commit first, decorative feedback second.

Use View Transitions for remaining-number changes, trip start/finish, layout changes, or secondary panels.

Do not make a budget mutation depend on an animation callback.

Respect reduced motion.

## Visual direction

Preserve the strongest interaction qualities:

- tactile depth
- polished typography
- restrained spectral accents
- excellent dark-mode contrast
- high-quality motion
- responsive layout

Reduce decorative elements that compete with the remaining number, constant ambient motion, and effects without product meaning.

The visual metaphor should communicate remaining room or available capacity.

## Tone

Voice is concise, supportive, calm, and lightly witty.

Never shame, lecture, congratulate spending, or joke about data loss or financial distress.

Examples:

Comfortable:

> EUR 22 left. Plenty of room.

Near the limit:

> EUR 2.20 left. We have entered the snack-decision zone.

Precisely on target:

> Perfect landing. EUR 0.00 left.

Over:

> EUR 2.14 over your limit.

The over-budget state should not hide the factual message behind humour.

## Accessibility

Minimum requirements:

- 48px frequent-action targets
- full keyboard operability
- logical focus order
- visible focus
- screen-reader-friendly currency
- no colour-only states
- reduced-motion support
- forced-colours resilience
- 200% text zoom without loss of core actions
- accessible labels for edit/remove controls

Announcements should report committed remaining amounts, not animation frames.

## Performance perception

The app should feel instant.

Critical local interactions — start trip, add price, edit item, undo, remove item, update remaining — must not wait on external APIs.

## UX performance targets

Internal targets until measured:

- first useful trip setup: under 10 seconds
- manual price addition: roughly 3 seconds
- remembered-price addition: one or two actions
- undo: one action
- remaining amount: zero navigation
- resume active trip: immediate local restore

## UX anti-patterns

Do not introduce:

- onboarding carousels
- mandatory account walls
- persistent numeric keypad
- required item names
- required categories
- required store selection
- full-screen paywall before first value
- scanner-only workflows
- AI-generated advice in the critical path
- dashboard-first home screen
- excessive modal confirmation
- hidden current budget

## Review checklist for every UI PR

1. Is remaining budget still visually dominant?
2. Did the common path gain an extra tap?
3. Can the task be completed one-handed?
4. Does it work offline?
5. Is manual entry still available?
6. Can a distracted user recover from a mistake quickly?
7. Is uncertainty communicated honestly?
8. Does motion remain non-blocking?
9. Is the screen understandable at first glance?
10. Would this still be useful if every optional smart feature were unavailable?
