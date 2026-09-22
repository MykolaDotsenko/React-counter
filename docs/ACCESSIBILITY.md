# Accessibility Contract

## Purpose

Accessibility is part of the core shopping workflow, not a post-release polish task.

The product is used while moving through a store, often one-handed, under distraction, and potentially with large text, reduced motion, low vision, motor constraints, or assistive technology.

The accessibility goal is not merely “zero axe violations.” The goal is equivalent task completion.

## Scope

This contract applies first to the critical path:

1. start a trip
2. understand remaining budget
3. add a price
4. change quantity
5. edit/remove/undo
6. understand warnings
7. finish the trip

Optional scanners and advanced features must not weaken this path.

## Interaction targets

Frequent touch targets should be at least 48 by 48 CSS pixels.

This includes:

- Add price
- keypad controls
- quantity controls
- undo
- remove/edit triggers
- warning actions
- finish trip

Do not rely on tiny icon-only hit areas.

## One-handed use

Primary frequent actions should remain in reachable regions on compact phone screens.

Do not force the user to stretch repeatedly to top-corner controls during active shopping.

One-handed usability benefits many users, including users with temporary or permanent motor limitations.

## Keyboard support

Every core action must be reachable and operable by keyboard.

Requirements:

- logical tab order
- visible focus
- Enter/Space activation for buttons
- no keyboard traps
- Escape closes non-destructive overlays where appropriate
- focus returns to a meaningful control after sheet/dialog close

Do not preserve Pulse Counter arrow shortcuts if they conflict with natural shopping-form interaction.

## Focus management

Opening a price-entry sheet/dialog should move focus to the first meaningful input.

Closing it should return focus to the Add price trigger or the most contextually relevant control.

After destructive confirmation, focus should move to a stable location rather than disappear.

## Screen-reader information hierarchy

The visible hero may show:

> EUR 18.58 LEFT

Accessible naming should communicate meaning, not typography.

Prefer semantic output equivalent to:

> Safe remaining: 18 euros and 58 cents.

When no safety buffer is active:

> Remaining budget: 18 euros and 58 cents.

Do not require the user to infer the meaning of an unlabeled number.

## Live announcements

Announce meaningful committed changes, not animation frames.

After adding an item, a polite announcement might communicate:

> EUR 4.79 added. EUR 13.79 remaining.

Avoid announcing every intermediate keystroke unless the input control naturally does so.

Avoid repeated announcements from both the keypad and summary that create duplicate speech.

## Currency speech

Currency formatting must remain understandable to assistive technology.

Do not rely on visually abbreviated symbols alone when the accessible label could be ambiguous.

Test at least the primary target currency and architecture for other ISO currencies.

## Colour

No state may rely on colour alone.

Examples:

Near-limit state should combine:

- colour
- text
- icon or shape

Over-budget state should explicitly say:

> EUR 2.14 over your limit.

Do not expect the user to interpret a red ring without text.

## Contrast

Meet WCAG AA contrast for text and meaningful controls.

The existing spectral visual language can remain decorative, but critical text and boundaries must not depend on translucent low-contrast effects.

Glass/backdrop treatments require explicit contrast checks against every supported background state.

## Forced colours

Core workflow must remain understandable when browser/OS forced-colour mode overrides visual styling.

Test:

- hero amount
- progress representation
- Add button
- keypad
- warning state
- item actions
- focus

Decorative gradients may disappear without loss of meaning.

## Reduced motion

Respect prefers-reduced-motion.

Reduced-motion mode must:

- keep every state change functional
- avoid large movement/parallax
- remove unnecessary looping/ambient animation
- preserve immediate confirmation through static or minimal feedback

Financial state updates must never depend on animation regardless of preference.

## Text scaling

At 200% text zoom / equivalent large-text conditions:

- remaining amount remains visible
- primary Add action remains reachable
- no horizontal scrolling for the core page
- keypad remains usable
- warning copy does not overlap actions
- item rows can grow vertically rather than truncate essential values

Do not lock critical containers to fixed heights that assume default text size.

## Compact viewport

Test at least a 320px-class width plus a modern 390px-class phone width.

The product should prioritise vertical flow over shrinking controls below usable size.

## Price keypad

The keypad needs:

- real button semantics or an equally robust native input strategy
- large targets
- clear current value
- accessible backspace label
- explicit Add action
- predictable decimal/auto-cents behaviour

If a custom keypad is used, do not remove native keyboard accessibility without replacement.

## Quantity control

Minus and plus controls require accessible names that include context when necessary.

Example:

- Decrease quantity for Milk
- Increase quantity for Milk

If no item label exists, use stable list-position or price context carefully without creating verbose repetitive speech.

## Item list actions

Edit/remove actions must not exist only as swipe gestures.

Swipe may be an enhancement, but equivalent visible/focusable controls are required.

Undo feedback must be reachable and announced appropriately.

## Warnings and dialogs

Over-budget warning must:

- have a clear heading/message
- state the amount of overage
- provide explicit actions
- not trap focus incorrectly
- not close accidentally through ambiguous gestures

Example:

> This item puts you EUR 3.41 over your limit.

Actions:

- Add anyway
- Cancel

## Safety-buffer communication

Do not create a confusing experience where screen-reader users hear one remaining value while sighted users interpret another.

When safe remaining is primary, label it explicitly.

Nominal remaining can be exposed as secondary detail.

## Price origin and uncertainty

Remembered/scanned/estimated status must be available to assistive technology.

Example:

> EUR 1.39, remembered price, last paid 8 days ago at Prisma.

Avoid icon-only confidence states.

## Barcode/camera accessibility

Scanning is optional.

Users who cannot or do not want to use the camera must retain the complete manual workflow.

Camera permission denial must not create a dead end.

Scanner controls require text labels, not icon-only camera glyphs.

## Error handling

Errors must be:

- associated with the relevant control where possible
- stated in text
- announced when they prevent progress
- recoverable without losing entered data

Persistence failure is a page/application-level state and should be announced once clearly, not on every render.

## Humour and accessibility

Humour must not obscure the factual message.

Good:

> EUR 2.20 left. We have entered the snack-decision zone.

The amount remains first and explicit.

Bad:

> Uh-oh, snack danger!

without stating the actual remaining amount.

## Semantic structure

Target page semantics should include:

- one main landmark
- clear heading hierarchy
- form labels
- buttons for actions
- output/status semantics only where appropriate
- lists for cart items when semantically useful

Do not add ARIA where native HTML already provides the correct semantics.

## Progress visualisation

If a progress bar/ring is meaningful rather than decorative, expose an accessible equivalent.

For example:

- current cart total
- budget maximum
- percentage only if useful

Do not force screen-reader users to navigate a decorative SVG.

## PWA/installability

Installed mode must preserve:

- system font scaling
- focus behaviour
- screen-reader operation
- safe-area layout

Do not hide browser accessibility affordances for the sake of a “native-looking” shell.

## Automated checks

Keep axe checks in Chromium and expand tags/tooling as dependencies support newer WCAG criteria.

Automated checks cover representative states and primary correction surfaces:

- start and active-trip screens
- manual price entry
- item correction
- active-trip budget adjustment
- nominal over-budget review
- finish-trip confirmation
- completed summary
- trip history

Near-limit semantics are additionally asserted through active-trip and price-projection tests.

## Manual checks

For major UI releases, manually verify:

- keyboard-only flow
- VoiceOver/TalkBack or equivalent spot-check of primary flow
- 200% zoom
- reduced motion
- forced colours/high contrast where available
- compact viewport
- touch-target sizing

Automated testing cannot validate usability of spoken order, verbosity, or one-handed physical interaction.

## Accessibility acceptance criteria for MVP

A user must be able to complete a trip without:

- colour perception
- precise pointer input
- animation
- default text size
- camera
- network

The manual price flow is the accessibility baseline.

## Review checklist

For each user-facing PR ask:

1. Can the new action be reached by keyboard?
2. Is its accessible name meaningful?
3. Is state expressed in text as well as colour?
4. Does focus go somewhere predictable?
5. Does large text break the flow?
6. Does reduced motion preserve feedback?
7. Is camera/scanning optional?
8. Are live announcements concise and non-duplicative?
9. Is the critical number labelled by meaning?
10. Can a user recover from error without precision gestures?
