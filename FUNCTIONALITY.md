# Functionality and User Experience Contract

## Status

This document defines the target functional behaviour of the shopping budget companion.

The current shipped application is still Pulse Counter. Nothing in this file should be represented as implemented until the corresponding code lands.

This document answers:

- what the user can do
- in what order
- what the system should show
- what happens when something goes wrong
- which features are core versus optional
- how the experience becomes faster with repeated use

It complements:

- PRODUCT.md — problem, positioning, and scope
- UX.md — interaction principles
- DESIGN.md — visual system
- DOMAIN.md — business rules
- ARCHITECTURE.md — software boundaries
- TESTING.md — quality contract

## Experience principle

The product should feel useful before it feels powerful.

The user should never have to “set up the system” before receiving value.

The default journey is deliberately short:

> Set budget → add price → see what is left → repeat → finish

Everything else exists to make that loop faster, safer, or more trustworthy.

## Core user state model

At the product level, a user is normally in one of four states:

### 1. No active trip

The user needs to start a shopping session.

Primary action:

> Start shopping

### 2. Active trip — comfortable

The user is shopping within the safe budget range.

Primary action:

> Add price

### 3. Active trip — near/over limit

The user still controls the trip, but the application increases clarity around the remaining constraint.

Primary actions remain:

- add/cancel pending item
- edit/remove items
- adjust budget if intentional

### 4. Completed trip

The user has finished shopping.

Primary actions:

- view summary
- optionally enter actual checkout total
- start another trip

The application should not introduce additional lifecycle states unless a real workflow requires them.

## First launch

### Goal

Reach first useful state in under 10 seconds.

### Flow

1. open app
2. choose or enter spending limit
3. optionally set safety buffer
4. start trip

No mandatory onboarding.

No account.

No financial profile.

No notification permission.

No store selection.

No tutorial carousel.

### Quick budgets

The start screen may offer common values such as:

- EUR 25
- EUR 50
- EUR 75
- EUR 100

These are accelerators, not assumptions.

Custom entry remains obvious.

Over time, quick budgets may adapt to the user's recent choices locally.

Do not require a settings screen to change them.

## Starting a trip

Required:

- budget
- currency

Optional:

- safety buffer
- store

### Default behaviour

If a preferred currency exists locally, preselect it.

If a default safety buffer exists, show it transparently rather than silently hiding spendable money.

Store selection must never delay trip creation.

### Validation

Reject:

- zero budget
- negative budget
- invalid money input

Explain the correction inline.

Example:

> Enter an amount greater than EUR 0.

Do not use generic messages such as “Invalid input.”

## Active-trip dashboard

The active screen is not a dashboard in the analytical sense.

It is a live decision surface.

Always visible:

1. safe remaining amount when a safety buffer is active, otherwise nominal remaining
2. cart total / budget
3. remaining-capacity visual
4. primary Add price action
5. recent cart items or empty-state guidance

Available but secondary:

- edit budget
- edit safety buffer
- finish trip
- history
- settings
- alternate add methods

## Add item: manual price

Manual entry is the reference flow.

### Happy path

1. tap Add price
2. numeric input opens
3. enter price
4. optional quantity adjustment
5. projected remaining updates live
6. tap Add
7. item commits
8. app returns to active summary
9. brief confirmation with Undo appears

### Functional target

A common single-price item should require:

- one tap to open entry
- numeric entry
- one tap to commit

No required name, category, photo, or store.

### Projected result

While entering:

> After adding: EUR 13.79 left

If safety buffer is active, preview safe remaining first.

This prevents the user from having to calculate the consequence mentally.

## Numeric input behaviour

### Input mode

Use a numeric-appropriate keyboard/input strategy.

Apple guidance recommends matching keyboard type to the content, and Baymard research shows numeric-optimised keyboards reduce errors and effort on mobile.

### Locale

Parsing must respect locale conventions.

Examples may include:

- 4.79
- 4,79

The app should format the committed value according to the selected currency/locale.

Do not force US formatting globally.

### Auto-cents

Optional accelerator.

For a two-decimal currency:

- 4 → 0.04
- 47 → 0.47
- 479 → 4.79

Only enable when the interaction clearly communicates the rule.

Do not silently guess between “479 euros” and “4.79 euros.”

### Clear/backspace

The user must be able to:

- remove one digit
- clear the entire value quickly

Do not force repeated delete taps for a full reset.

## Add item: quantity

Quantity defaults to 1.

The quantity control should update:

- line total
- projected remaining
- warning state

immediately.

Preferred interaction:

- minus
- current quantity
- plus

For larger quantities, an editable numeric quantity can be offered.

Baymard research supports immediate cart-summary updates and large quantity controls, and recommends an undo path when quantity reaches removal. 

### Quantity zero

If the user decrements from 1 to 0:

- interpret as remove
- show Undo

Do not silently keep a zero-quantity item.

## Add item: optional label

Product name is optional.

The app may allow adding a label before or after commit.

Use cases:

- easier later editing
- price memory
- barcode association

Do not block the Add action if label is empty.

A price-only item is complete.

## Add item: remembered price

### Trigger

The app recognises a previously used product identity or the user selects a recent/favourite item.

Show:

- item label
- remembered price
- observed date
- store if known

Example:

> Milk 1L  
> Last paid EUR 1.39 at Prisma · 8 days ago

Actions:

- Use EUR 1.39
- Enter current price

### Rule

Selecting the remembered price adds an item whose origin remains remembered unless the user explicitly confirms it as current.

This allows the final cart to communicate uncertainty honestly.

## Add item: barcode

Barcode scanning is optional.

### Known barcode + remembered price

1. scan
2. identify product
3. show remembered price context
4. allow one-tap reuse or current-price entry
5. commit only after user action

### Known barcode, no price history

1. scan
2. identify product
3. focus current-price entry
4. user enters price
5. optionally remember price for future

### Unknown barcode

1. scan
2. explain product was not recognised
3. preserve barcode identifier locally if useful
4. jump directly to price entry
5. optional label later

Do not turn unknown barcode handling into a multi-field setup form.

### Scanner failure

If:

- camera denied
- scanner unsupported
- product service unavailable
- lookup times out

show a concise explanation and offer:

> Enter price instead

Manual flow remains one tap away.

## Add item: shelf-price scan

This is potentially more useful than barcode for the core job because it can capture the current price.

### Flow

1. open Price tag scan
2. camera sees label
3. scanner returns candidate prices
4. user confirms one candidate
5. projected remaining appears
6. add

### One candidate

Example:

> Detected EUR 3.79

Actions:

- Add EUR 3.79
- Edit

### Multiple candidates

Example:

> Which price is the item price?

- EUR 3.79
- EUR 7.58/kg
- EUR 4.49

Never silently choose when ambiguity is known.

### OCR principle

Scanner confidence is not user confidence.

The product should prefer one extra confirmation tap over silently corrupting the cart total.

## Add item: discounts

Discount support is secondary but useful.

Entry may offer:

- 10%
- 20%
- 30%
- custom

The effective final price must be shown before commit.

Example:

> EUR 4.99  
> -30%  
> Final EUR 3.49

The cart stores the effective exact price plus any metadata needed to explain it.

Do not require discount fields on normal items.

## Weighted goods

Two valid flows:

### Exact/known weight

- price per unit
- weight
- calculated line total

### Approximate price

The user enters an approximate total directly.

Mark as:

> Estimated

The app must not pretend estimated fruit/vegetable totals are exact before checkout.

## Safety buffer

Safety buffer protects against uncertainty.

The user may:

- set at trip start
- change during active trip
- disable

Example:

- budget EUR 50
- buffer EUR 2
- safe limit EUR 48

Primary remaining metric becomes:

> EUR 7.20 safe to spend

Secondary detail can expose nominal remaining.

### Buffer suggestions

Future feature.

If enough reconciliation history exists, the app may suggest a buffer.

Example:

> Your recent checkout differences were usually under EUR 0.60. Consider a EUR 1 buffer.

Rules:

- explain basis
- never silently enable
- never silently change
- do not overclaim from a tiny sample

## Near-limit experience

The product should increase information, not stress.

### Safe limit approaching

Show:

- remaining value
- concise status
- progress state

Example:

> EUR 3.20 safe to spend  
> Close to your safety buffer.

### At safe limit but under nominal budget

Example:

> Safety buffer reached.  
> EUR 2.00 remains in your nominal budget.

Do not describe this as overspending.

## Pending item over safe limit

Before commit:

> This item uses EUR 1.25 of your safety buffer.

Actions:

- Add anyway
- Cancel

The user owns the buffer.

## Pending item over nominal budget

Before commit:

> This puts you EUR 3.41 over your limit.

Actions:

- Add anyway
- Cancel

If Add anyway is chosen, the app moves to an over-budget state without scolding.

## Over-budget state

Primary information:

> EUR 3.41 over your limit

Useful secondary actions:

- Review cart
- Change budget

Do not force either action.

Do not disable adding more items.

The app provides control, not enforcement.

## Editing an item

Tap an item to open edit context.

Editable:

- price
- quantity
- optional label
- discount
- price-confidence state when meaningful

Changes update totals immediately after commit.

### Editing price origin

If a remembered or estimated item is manually verified against the shelf:

> Mark as confirmed current price

This changes origin explicitly.

Never upgrade trust state silently.

## Removing an item

Removal should be fast.

Preferred:

- visible remove action in item edit
- optional swipe accelerator

Swipe must never be the only removal path.

After remove:

> Item removed · Undo

Baymard and NN/g both support undo-based recovery for frequent reversible actions rather than adding confirmation dialogs to every ordinary action.

## Undo

Undo should restore the full previous item state, including:

- price
- quantity
- label
- origin
- relevant metadata

At minimum, support the latest add/remove/edit mutation.

A future bounded multi-step undo can be considered if real usage shows value.

Do not add event-sourcing complexity solely to extend undo depth.

## Duplicate/repeat items

If the user adds the same remembered/barcoded product again during the current trip, the app may offer:

> Increase quantity to 2?

This should be an accelerator, not automatic behaviour.

If there is any ambiguity, create a separate item rather than silently merging.

## Recent items / quick repeat

Repeated shoppers benefit from recognition rather than recall.

A lightweight recent-item picker may show:

- label
- last price
- store context
- freshness

This is P1 after the manual flow is excellent.

Do not turn the home screen into a grocery catalogue.

## Store context

Optional.

Ways to set:

- at trip start
- during trip
- remembered from recent trip

Benefits:

- better price-memory suggestions
- clearer history

No core function depends on it.

If store is unknown:

- price memory still works generically
- manual add remains unchanged

## Budget edit

During active trip, the user may change budget.

Show impact immediately.

Example:

> Current cart EUR 42.50  
> New budget EUR 40.00  
> You will be EUR 2.50 over.

Allow save.

Do not force a restart.

## Currency edit

If cart is empty, currency can be changed directly.

If items exist:

- explain that numeric values cannot safely be reinterpreted
- offer start-new-trip / clear-cart path

Do not convert existing item values automatically unless a future explicitly designed FX feature exists.

## Active-trip recovery

When reopening the app with an active trip:

- restore directly to active trip
- do not show start screen first
- show current remaining immediately

If persistence is healthy, no dialog is needed.

The user's interrupted shopping session is the priority.

## Persistence degraded state

If write fails:

- keep in-memory cart usable
- show persistent but non-blocking warning
- no false saved indicator
- offer retry
- offer copy/export if available

Example:

> This trip is not being saved right now. Keep this page open until checkout.

Do not show humour.

## Offline behaviour

Offline should feel normal.

Works offline:

- open previously installed/cached app
- active-trip restore
- manual add
- quantity
- edit/remove
- undo
- safety buffer
- finish trip
- local history

May be unavailable offline:

- remote barcode product lookup
- remote OCR if chosen architecture requires server processing
- cloud sync
- retailer integrations

If an optional service is unavailable:

> Product lookup is offline. Enter the price manually.

Do not display a generic “You are offline” blocking screen when the core app can still function.

web.dev recommends that PWA functionality that does not require connectivity remain usable offline, with service workers treated as an enhancement rather than a dependency for correctness.

## Finish trip

### Default

Tap:

> Finish trip

Show summary:

- estimated cart total
- budget
- remaining/overage
- item count
- number of uncertain prices if any

Then offer:

> Enter checkout total

as optional.

Do not force checkout reconciliation.

## Checkout reconciliation

If actual total is entered:

Show:

- estimated
- actual
- difference

Example:

> Estimated EUR 46.37  
> Checkout EUR 46.72  
> Difference +EUR 0.35

Tone:

> Very close.

No accuracy “score.”

No shame.

### Learning from reconciliation

Later features may use the data for:

- suggested safety buffer
- price-memory updates
- estimated-item calibration

Any derived suggestion remains explainable.

## Completed-trip history

History is lightweight.

Each trip:

- date/time
- optional store
- budget
- estimated total
- actual total if entered
- remaining/over
- item count

Useful actions:

- view details
- repeat budget
- start similar trip

Not included:

- income
- bills
- monthly financial planning
- net worth
- broad spending categories

## Repeat-trip shortcut

After previous usage, first launch with no active trip may offer:

> Shop again with EUR 50

and:

> Choose another amount

This reduces setup without hiding user control.

## History deletion

Users should be able to:

- delete one completed trip
- clear all history

Destructive history clearing should require confirmation because Undo may not be durable across reload.

Deleting a single trip may use Undo if technically reliable.

## Settings

Keep settings small.

Good candidates:

- preferred currency
- default safety buffer
- auto-cents
- quick-budget values
- theme: system/light/dark if manual override is offered
- haptic feedback
- data export/delete

Avoid a giant preference surface.

Defaults should work well without configuration.

## Notifications

Not part of MVP.

The product's main job occurs while open in the store.

Do not ask notification permission without a concrete user-initiated feature.

Possible future notification:

- none is currently important enough to justify permission

Therefore the default product design should assume zero notifications.

## Haptics

Optional enhancement.

Potential events:

- successful add
- threshold crossing
- scanner capture

Rules:

- subtle
- user-controllable
- never required to understand state
- avoid repeated warning vibration for every item near the limit

## Sound

No default sound effects.

A supermarket is a public context.

Do not create social friction.

## Smart suggestions

The application may become faster through deterministic suggestions:

- recent budget
- recent store
- recent item
- remembered price
- safety-buffer suggestion

These should be:

- local where possible
- explainable
- dismissible
- never required

Do not use an AI model where simple recency/frequency rules solve the same problem.

## Search

Not required for MVP.

Search becomes useful only when price memory/history grows enough to justify it.

If introduced, search should find:

- saved/recent products
- historical trips

Do not add a global search icon before there is meaningful content to search.

## Empty states

### No trip

> How much can you spend today?

### Empty cart

> EUR 50.00 left  
> Add the first price when you pick something up.

### No history

> Finished trips will appear here.

Do not use empty states to advertise unrelated features.

## Error strategy

### Prevent where possible

Examples:

- numeric input prevents letters
- projected total catches over-budget before commit
- scanner ambiguity is resolved before commit

### Correct inline

Examples:

- invalid budget
- invalid quantity
- malformed price

Apple recommends dynamic validation when it helps users correct errors immediately rather than forcing them to return later.

### Undo frequent reversible actions

Examples:

- add
- remove
- quantity change where practical

### Confirm rare destructive actions

Examples:

- clear entire active trip
- delete all history
- change currency on non-empty trip

Do not use confirmation dialogs for every normal correction.

## Loading strategy

Core local interactions:

- no spinners
- no skeletons
- no artificial delay

Optional network actions may show local progress.

Example:

> Looking up product…

with immediate:

> Enter price instead

Never trap the user behind a scanner lookup.

## Performance experience contract

The user should experience:

### Instant

- add/remove/edit
- remaining recalculation
- quantity changes
- undo
- history opening from local data

### Fast but asynchronous

- product lookup
- OCR
- optional remote services

Heavy optional features should load lazily.

## Accessibility functional equivalence

Every core task must work without:

- camera
- colour perception
- animation
- precise swipe
- network
- sound
- haptics

Manual price flow is the universal baseline.

## Privacy experience

Core use requires no account and no bank connection.

The user should not need to understand a privacy policy before performing basic arithmetic.

If external product/OCR services are added later, clearly communicate when camera/data leaves the device.

Do not silently upload shopping history.

## Functional analytics

For the portfolio product, analytics are optional.

If product analytics are later added, useful privacy-conscious metrics would be aggregate interaction measures such as:

- trip started
- trip completed
- manual vs scanner add method
- undo used
- scanner fallback used

Do not collect actual:

- budgets
- item prices
- product lists
- stores

without a strong reason and explicit privacy review.

## Key user stories

### Story 1 — hard cash limit

> I have EUR 50 and cannot exceed it.

Flow:

- start EUR 50 trip
- add prices
- remaining is always visible
- pending over-budget item warns before commit
- finish under limit

### Story 2 — cautious shopper

> I have EUR 50 but want EUR 2 spare.

Flow:

- EUR 50 budget
- EUR 2 buffer
- safe remaining drives hero
- app warns when buffer begins being consumed

### Story 3 — repeated weekly shop

> I buy many of the same products every week.

Flow:

- start previous budget quickly
- scan/select remembered item
- see last price/date/store
- confirm or update current price
- fewer keystrokes over time

### Story 4 — scanner fails

> Product lookup is unavailable in this store.

Flow:

- scan fails
- one-tap manual fallback
- budget workflow never breaks

### Story 5 — distracted mistake

> I entered EUR 8.90 instead of EUR 6.90.

Flow:

- tap recent item
- edit price
- total updates immediately
- no trip reset

### Story 6 — checkout discrepancy

> My app said EUR 46.37 but the register says EUR 46.72.

Flow:

- finish trip
- enter actual total
- see +EUR 0.35 difference
- future buffer suggestion may learn from repeated differences

## Feature priority

### P0 — complete core value

- start trip
- budget
- safety buffer
- remaining-first active screen
- manual price input
- projected remaining
- quantity
- item list
- edit
- remove
- undo
- over-limit preview
- local persistence
- visible persistence failure
- finish trip
- mobile accessibility

### P1 — make repeated use materially faster

- completed-trip history
- repeat previous budget
- price memory
- optional item labels
- optional store context
- barcode identity
- price-tag scanning
- weighted goods
- discounts
- data export
- PWA offline installation

### P2 — only after evidence

- voice input
- receipt import
- cross-device sync
- household sharing
- deeper price trends
- retailer integrations
- adaptive buffer suggestions

## Explicitly rejected as core functionality

Do not add to the main product loop:

- bank sync
- expense categories
- monthly budgeting dashboard
- income tracking
- bills
- savings goals
- meal planning
- recipes
- nutrition
- shopping delivery
- coupons marketplace
- loyalty-card management
- AI chat
- financial coaching
- social feed
- achievements/streaks

## Functional acceptance test

A target MVP is functionally coherent when a first-time user can:

1. open the app
2. set EUR 50
3. add several prices
4. change quantity
5. see exact remaining amount
6. remove one item and undo
7. attempt an item that exceeds the limit and understand the consequence
8. reload without losing committed state
9. continue offline
10. finish the trip
11. optionally reconcile checkout total

without:

- creating an account
- naming products
- selecting categories
- connecting a bank
- learning a special workflow
- using a scanner

## Functional review checklist

Before accepting a feature:

1. Does it reduce time, uncertainty, or error in the pre-checkout workflow?
2. Does it preserve manual/offline fallback?
3. Is it discoverable without cluttering the main screen?
4. Does it avoid requiring new metadata?
5. Can the user undo or recover from mistakes?
6. Does it preserve exact money arithmetic?
7. Does it preserve price-confidence honesty?
8. Does it degrade gracefully if an optional API fails?
9. Does it remain accessible without gestures/camera?
10. Does it improve repeated use enough to justify its complexity?
11. Is it P0/P1/P2 according to this contract?
12. Would the app still be excellent if this feature disappeared?

If the answer to question 1 is no, the feature should normally be rejected.

## Research references

- Apple HIG — Entering Data: https://developer.apple.com/design/human-interface-guidelines/entering-data
- Apple HIG — Text Fields: https://developer.apple.com/design/human-interface-guidelines/text-fields
- Nielsen Norman Group — 10 Usability Heuristics: https://www.nngroup.com/articles/ten-usability-heuristics/
- Nielsen Norman Group — Accelerators: https://www.nngroup.com/articles/ui-accelerators/
- Baymard — Cart Quantity Controls and Undo: https://baymard.com/research-articles/auto-update-users-quantity-changes
- Baymard — Mobile Touch Keyboards: https://baymard.com/research-articles/mobile-touch-keyboards
- Baymard — Mobile Form Usability: https://baymard.com/research-articles/mobile-form-usability-single-input-fields
- web.dev — PWA optimal checklist: https://web.dev/articles/pwa-checklist
- web.dev — Service workers: https://web.dev/learn/pwa/service-workers
