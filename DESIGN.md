# Design System and Product Storytelling

## Status

This document defines the target visual design system for the shopping budget companion.

Phase 4 A0 design validation is complete. **Calm Utility** is the selected production direction for the core shopping UI.

Decision evidence:

- docs/design/PHASE-4-DESIGN-VALIDATION.md

The default/public build still ships the Pulse Counter interface while the replacement shopping shell remains guarded behind `VITE_SHOPPING_SHELL=1`. Phase 4 and Phase 5 through B5 now implement the selected Calm Utility direction in that guarded shell. The shopping design must not be presented as the public/default product until Sprint B's final B6 quality gate and production-shell switch are complete.

This document complements:

- PRODUCT.md — product purpose and scope
- UX.md — interaction behaviour
- DOMAIN.md — business rules
- ARCHITECTURE.md — implementation boundaries
- docs/ACCESSIBILITY.md — accessibility contract

When visual preference conflicts with clarity, trust, accessibility, or task speed, those requirements win.

## Design objective

The interface should communicate its purpose before the user reads an explanation.

A shopper opening an active trip should immediately understand:

1. how much money is still safely available
2. how much of the budget is already in the cart
3. how to add another price

The desired emotional impression is:

> calm control, not financial anxiety

The desired product impression is:

> a small tool that has been designed unusually well for one job

## Design thesis

The visual concept is **remaining room**.

The product is not visually about:

- accounting
- charts
- banking
- spreadsheets
- grocery catalogues
- AI
- futuristic spectacle

It is about the amount of room still available inside a constraint.

That concept should appear consistently through:

- the dominant remaining amount
- the budget-progress visual
- spacing and composition
- subtle depletion/remaining-capacity motion
- concise language

The interface should feel more like a precise instrument than a finance dashboard.

## Evidence behind the direction

The design direction incorporates current platform and usability guidance.

### Apple Human Interface Guidelines

Relevant principles:

- focus on primary tasks and limit onscreen controls
- place frequently used controls in comfortable middle/bottom reach on iPhone
- use strong visual hierarchy
- use progressive disclosure for secondary details
- reserve prominent button styling for one or two primary actions
- use brand colour judiciously rather than colouring every control
- support both light and dark appearance
- use purposeful, brief motion rather than animation for its own sake
- use plain, action-oriented language

### Android / Material accessibility guidance

Interactive controls should provide at least a 48dp target for reliable touch interaction.

### Nielsen Norman Group

Relevant principles:

- progressive disclosure reduces complexity
- recognition is preferable to recall
- visible system status matters
- user control and easy recovery matter
- minimalist design should remove irrelevant information
- mobile forms should minimise physical and cognitive effort

### Baymard Institute

Mobile form research repeatedly shows that:

- touch typing is slow and error-prone
- the on-screen keyboard consumes substantial viewport space
- redundant fields materially hurt usability
- correct mobile keyboard/input behaviour matters
- users need important totals and context visible during transactional flows

These sources support a design that is simpler and more contextual than a conventional grocery app.

## Design personality

The product should feel:

- modern
- calm
- precise
- warm
- trustworthy
- lightly playful
- premium without looking expensive or exclusive

It should not feel:

- corporate
- childish
- gamified
- alarmist
- crypto/fintech
- cyberpunk
- neon-heavy
- overloaded
- aggressively “AI”

Working phrase:

> **Calm utility with a little delight.**

## Visual hierarchy

The active-trip screen has one dominant object.

When no safety buffer is active:

> **EUR 18.58 left**

When a safety buffer is active, the hero represents safe remaining:

> **EUR 16.58 safe to spend**

for the canonical EUR 50 / EUR 31.42 cart / EUR 2 reserve fixture.

Nominal remaining stays secondary when a reserve exists.

Everything else supports the safe shopping decision.

Hierarchy:

### 1. Hero — remaining amount

Largest type on the screen.

The amount is the visual anchor.

The label should clarify meaning:

- Left
- Safe to spend
- Remaining

Choose one final wording during usability testing and use it consistently.

### 2. Budget context

Directly under or integrated with the hero:

> EUR 31.42 of EUR 50.00

This is smaller but always available.

### 3. Capacity visual

A simple budget indicator reinforces the relationship between:

- cart total
- safe limit
- nominal limit

It must be understandable without relying on colour.

### 4. Primary action

One visually dominant action:

> Add price

### 5. Cart details

Recent items and corrections belong below the primary decision information.

### 6. Secondary tools

History, scanner options, settings, store, discounts, and advanced details are progressively disclosed.

## First screen: no explanation required

### New trip

The start screen should read approximately:

> How much can you spend today?

Then show a small set of quick values plus custom entry.

The visual story is:

> choose a limit → start shopping

Do not begin with:

- logo animation
- marketing carousel
- long value proposition
- account creation
- feature tour

### Active trip

Recommended conceptual structure:

~~~text
┌─────────────────────────────┐
│ Shopping               •••  │
│                             │
│          €18.58             │
│            LEFT             │
│                             │
│      €31.42 of €50.00       │
│      ━━━━━━━━━━━──────       │
│      Safe buffer €2         │
│                             │
│      [  + Add price  ]      │
│                             │
│ Recent                      │
│ €8.90                   ×1  │
│ €4.79                   ×1  │
│ €2.45                   ×2  │
└─────────────────────────────┘
~~~

This is a hierarchy model, not a pixel-perfect specification.

The first screen must not require scrolling to reach the primary Add action on common phone sizes.

## The budget visual

The visualisation should communicate remaining capacity, not create another dashboard metric.

Preferred order for prototyping:

### Option A — quiet linear capacity bar

**Selected for Phase 4 production direction.**

Advantages:

- instantly familiar
- visually compact
- works well with large text
- easy to make accessible
- does not compete with hero amount

### Option B — partial radial ring around the hero

**Rejected as the default Phase 4 production visual.** It remains a historical/prototype reference only.

Advantages:

- stronger visual identity
- naturally reuses some Pulse Counter DNA
- communicates finite capacity

Risks:

- can become decorative
- can resemble fitness/gamification products
- can reduce number legibility
- can be harder at large text sizes

Decision result:

The Phase 4 design validation selected the quiet linear capacity bar because it has lower comprehension, large-text, bright-store, and accessibility risk.

Do not keep the radial ring merely because the old counter already contains one.

See docs/design/PHASE-4-DESIGN-VALIDATION.md.

## Brand expression

Branding must be felt through the whole experience rather than repeated as a logo.

Brand expression comes from:

- typography
- spacing
- motion
- primary accent
- shape language
- microcopy
- the remaining-room visual metaphor

Avoid:

- persistent logo in the header
- branded splash screens
- decorative brand panels
- excessive accent-colour surfaces

The shopping information is the hero, not the brand mark.

## Colour strategy

### Principle

Use colour as punctuation, not wallpaper.

The product should use a largely neutral surface system with one recognisable brand accent and a small number of semantic colours.

Do not assign final hex/OKLCH values before testing prototypes in:

- bright store lighting
- dark mode
- increased contrast
- common forms of colour-vision deficiency

### Roles

Define tokens by role rather than hue name:

- surface-primary
- surface-secondary
- surface-elevated
- text-primary
- text-secondary
- border-subtle
- accent-primary
- status-comfortable
- status-attention
- status-over
- focus-ring

The same role can have different light/dark values.

### Accent

The brand accent should appear primarily on:

- Add price
- selected controls
- key progress/capacity detail
- focus/highlight moments

Do not make every button, icon, heading, and border the brand colour.

### Semantic status

Colour must never be the sole status signal.

Comfortable / near limit / over limit should also differ through:

- text
- icon or marker
- copy
- position/shape where useful

Avoid making normal spending states emotionally alarming.

An over-budget condition should be clear without creating a “danger dashboard.”

## Light and dark appearance

Support the system appearance by default.

Do not make the product dark-only simply to preserve Pulse Counter aesthetics.

### Light mode

Should feel:

- clean
- calm
- legible under bright supermarket lighting
- slightly warm rather than sterile

### Dark mode

Should feel:

- deep rather than pure black
- high contrast
- restrained in glow/saturation
- visually consistent with light mode

Dark mode is not a separate brand.

### System preference

Respect system appearance.

Avoid requiring the user to configure a separate app theme just to obtain a normal light/dark experience.

## Surface and depth

Use depth sparingly.

Preferred hierarchy:

1. page background
2. primary content plane
3. contextual sheet/dialog
4. temporary feedback

Avoid stacking many glass cards inside other glass cards.

The current Pulse Counter glass/spectral treatment can survive as a subtle material detail, but not as the dominant visual language.

Blur is decorative enhancement, never the only thing separating content layers.

## Shape language

Use a restrained rounded system.

Suggested starting points:

- large content panels: 20–28px radius
- primary button: capsule or generously rounded rectangle
- item rows: 14–20px radius where surfaced
- small chips: capsule

Do not give every element a different radius.

Shape consistency is more important than novelty.

## Spacing system

Use a consistent spacing scale.

Recommended base:

~~~text
4
8
12
16
20
24
32
40
48
64
~~~

Primary mobile page side padding should generally live around 16–24px depending on viewport.

Use generous spacing around the hero number.

The hero needs visual silence around it so the remaining amount is recognised instantly.

## Typography

Typography carries most of the hierarchy.

### Typeface strategy

Prefer a highly legible system or modern variable sans-serif.

If a custom brand font is eventually introduced:

- use it only where it materially strengthens identity
- keep body/control text extremely legible
- verify large-text behaviour
- avoid thin weights

Do not use multiple decorative typefaces.

### Numeric typography

Money values should use tabular numerals where available to prevent horizontal jitter as totals change.

The hero amount should use:

- strong weight
- compact line-height
- generous optical spacing
- enough size to dominate without forcing awkward wrapping

### Hierarchy

Conceptual scale:

- hero money: fluid approximately 48–72px on phones
- screen title: approximately 20–24px
- primary control: approximately 16–18px semibold
- body: approximately 16–17px
- metadata: approximately 13–15px, never dependent on ultra-light weight

Exact values should use responsive clamp rules and accessibility testing rather than fixed screenshots.

### Labels

Do not rely on placeholder text as labels.

Keep context visible while entering prices.

## Primary button

There should normally be one visually dominant button in the active-shopping view:

> Add price

Design:

- large touch area
- clear filled shape
- text + optional familiar plus symbol
- visible pressed state
- bottom-reachable
- inset from device edges/safe areas

Do not make:

- Scan
- Voice
- Barcode
- History

equally prominent.

They are alternative or secondary paths.

## Bottom sheet strategy

Use a bottom sheet for contextual, temporary actions that benefit from thumb reach.

Good candidates:

- add method
- manual price keypad
- item edit
- discount
- secondary scan actions

Do not put permanently necessary information in a bottom sheet.

The remaining amount must remain visible in the main interface.

Where practical, keep some budget context visible above or within the add sheet so the user does not lose orientation.

## Price-entry design

The keypad is a core product surface and deserves custom attention.

### Layout goals

- large numeric display
- currency always visible
- minimum 48px targets; prefer larger for numeric keys
- generous spacing
- clear backspace
- one dominant Add action
- projected remaining directly above the commit action

Example:

~~~text
       €4.79

After adding
€13.79 left

┌─────┬─────┬─────┐
│  1  │  2  │  3  │
├─────┼─────┼─────┤
│  4  │  5  │  6  │
├─────┼─────┼─────┤
│  7  │  8  │  9  │
├─────┼─────┼─────┤
│  .  │  0  │  ⌫  │
└─────┴─────┴─────┘

[ Add €4.79 ]
~~~

### Context preservation

The user should not need to remember:

- current budget
- remaining before entry
- expected result

Show the projected result during entry.

### Error prevention

Invalid or impossible input should be prevented or explained inline.

Do not wait for a modal error after pressing Add if the problem is already known.

## Cart item design

Rows should be scannable in under a second.

Primary row information:

- optional name
- line total
- quantity if more than one

Secondary:

- unit price
- remembered/scanned/estimated status
- store/freshness when relevant

Avoid exposing internal metadata by default.

### Unknown-name item

A nameless item is valid.

Example:

> €4.79

The product must never visually imply that unnamed means incomplete.

## Empty-state design

The empty state still displays the full budget context.

Example:

> €50.00 left  
> Nothing in the cart yet.

Primary action:

> Add first price

Do not replace the core screen with an illustration-only empty state.

## Near-limit design

The interface should become more informative, not more dramatic.

Example:

> €3.20 left

Secondary message:

> Close to your safe limit.

Avoid:

- shaking UI
- flashing
- red full-screen backgrounds
- repeated warnings

Attention should scale with consequence.

## Over-budget design

Factual information first:

> €2.14 over your limit

Then actions:

- Review cart
- Adjust limit

If a pending item causes the overage, preview that before commit.

Do not use shame or celebratory gamification.

## Success and delight

Delight should reward precision and clarity, not spending.

Good moment:

> Perfect landing. €0.00 left.

Good motion:

- brief number transition
- subtle capacity-settle animation
- small haptic where platform allows

Avoid:

- confetti after every purchase
- trophies
- streaks
- points
- “spending achievements”

This is a utility, not a game.

## Motion system

Motion should answer one of three questions:

1. What changed?
2. Where did it go?
3. Did my action work?

If motion answers none of those, remove it.

### Frequent actions

Use minimal duration and amplitude.

Adding a price is frequent; the animation should not demand attention every time.

### Major state changes

More expressive motion is acceptable for:

- starting a trip
- finishing a trip
- opening a contextual sheet
- switching between active and history state

### Reduced motion

Replace spatial movement with:

- opacity
- instantaneous state
- subtle emphasis

No critical meaning may depend on motion.

## Interaction feedback

Every tap should have a visible state.

For custom buttons:

- pressed state
- focus state
- disabled state where truly necessary
- loading only for genuinely asynchronous actions

Core local actions should not display spinners.

Optional haptics can support:

- successful price add
- warning threshold
- scanner detection

Haptics must never be the only feedback.

## Iconography

Use familiar symbols.

Examples:

- plus — add
- barcode — barcode
- camera — price tag scan
- microphone — voice
- trash/delete — remove
- ellipsis — secondary menu

Use text labels when an icon alone could be ambiguous.

Avoid custom abstract icons for basic actions.

## Navigation

MVP should not need a persistent bottom tab bar.

The primary flow is one task.

Recommended model:

- active trip as home when one exists
- start trip when none exists
- history/settings through secondary navigation
- scanning as an add method, not a top-level destination

Do not manufacture navigation complexity for visual sophistication.

## Progressive disclosure

Primary screen:

- remaining
- total / budget
- progress
- Add price
- recent cart

Secondary layer:

- edit item
- quantity
- discount
- scan options
- store

Tertiary settings only where necessary:

- tax mode
- auto-cents
- appearance/accessibility preferences
- export

Avoid more than two practical disclosure levels inside an active task.

## Information density

The product should feel spacious without wasting mobile space.

Rule:

> Large space around important information; compact space around related operational data.

Hero section can breathe.

Cart rows should be efficient.

Do not give every piece of metadata a separate card.

## Content design

Use sentence case.

Prefer verb-first controls:

- Add price
- Finish trip
- Edit item
- Use €1.39
- Enter current price

Prefer plain language over clever labels.

Humour belongs in secondary copy only.

Never make the user decode a branded term for a normal action.

## Internationalisation

The visual system must support:

- longer translated labels
- decimal separators
- currency symbol placement
- right-to-left layout
- different minor-unit rules
- larger text

Do not hard-code layouts around the short string “€18.58 LEFT”.

## Responsive strategy

### Mobile

Primary target.

Single-column.

Bottom-reachable primary action.

### Tablet / desktop

Do not simply stretch the phone card to full width.

Use a constrained content width.

Potential layout:

- budget/hero + controls in primary column
- cart details/history context in secondary area

Maintain the same information hierarchy.

## App icon direction

Do not use:

- a generic shopping cart with a euro symbol
- a calculator icon
- a bank card
- an AI sparkle

Preferred concept:

> a container with visible remaining space

Possible forms:

- open rounded shape with a remaining segment
- abstract basket/container cut by a capacity line
- simple letterform built around negative space

The icon should remain recognisable at small size and work without text.

Final branding/name should be validated separately before icon lock.

## Screenshot / portfolio direction

The portfolio hero screenshot should communicate the product in one frame.

Best candidate state:

- EUR 50 budget
- around EUR 31–37 cart total
- clear EUR remaining hero
- 3–5 recent items
- visible Add price action
- enough progress to show the capacity concept
- no modal or scanner open

A recruiter should understand the application without reading the README first.

Secondary screenshot:

- price-entry sheet showing projected remaining

Avoid screenshots that primarily showcase decorative effects.

## Prototype variants evaluated

Phase 4 A0 evaluated three intentionally different directions using the same canonical fixture. The selected direction is documented in docs/design/PHASE-4-DESIGN-VALIDATION.md:

### A. Calm utility

- neutral surfaces
- restrained accent
- linear capacity bar
- minimal depth

Purpose: strongest clarity baseline.

### B. Premium spatial

- subtle depth/glass
- partial radial capacity visual
- slightly more expressive transitions

Purpose: preserve selected Pulse Counter visual DNA.

### C. Warm everyday

- softer surfaces
- warmer neutral palette
- friendly shape language
- subtle illustration/empty-state personality

Purpose: test whether finance-like precision can feel more human.

Do not mix all three into one compromise before testing.

## Usability test questions for visual prototypes

Do not ask:

> Do you like this design?

Ask:

1. What is this app for?
2. How much money can you still spend?
3. What would you press to add a €3.79 item?
4. Is the cart currently close to the limit?
5. Which information feels most important?
6. Which control, if any, is confusing?
7. What do you think the progress visual means?
8. Would you be comfortable using this with one hand in a store?

Measure correctness and speed before aesthetic preference.

## Design acceptance criteria

A production design should pass all of these:

### Comprehension

A first-time viewer can identify the app's purpose within 3–5 seconds.

### Hierarchy

Remaining budget is the strongest visual signal.

### Action

Add price is the obvious primary action.

### Ergonomics

Frequent touch controls meet the product's 48px target standard and are thumb-reachable.

### Simplicity

No mandatory metadata appears in the basic add flow.

### Trust

Remembered/scanned/estimated values are visually distinct from confirmed prices.

### Adaptability

Works in light, dark, increased contrast, reduced motion, and 200% text zoom.

### Performance

Core state changes feel immediate and do not wait on network/scanner services.

### Brand restraint

The interface has identity without branding overpowering the shopping information.

## Design anti-patterns

Do not ship:

- neon cyberpunk finance styling
- glass-on-glass card stacks
- excessive gradients behind important text
- more than one or two primary-looking actions
- hidden remaining amount while shopping
- a permanent scanner-first camera UI
- tiny icon actions
- decorative charts
- gamified spending streaks
- red/green-only status
- forced dark mode
- mandatory onboarding
- full-screen brand splash
- constant orbital animation
- low-contrast secondary text
- placeholder-only form labels
- interaction that depends on swipe with no alternative
- AI sparkle iconography without actual AI value

## Design review checklist

For each visual implementation PR:

1. Is the product purpose obvious without explanation?
2. Is remaining budget still the strongest visual element?
3. Is Add price still the strongest action?
4. Did we add visual complexity without user value?
5. Can the screen be used one-handed?
6. Are secondary features progressively disclosed?
7. Does light mode work as well as dark mode?
8. Does the accent remain restrained?
9. Are money values stable and easy to scan?
10. Is uncertainty visible without creating noise?
11. Is motion purposeful and brief?
12. Does the design survive large text and reduced motion?
13. Are buttons recognisable and at least 48px in frequent-use contexts?
14. Does the design look like a focused shopping utility rather than a fintech dashboard?
15. Would a portfolio screenshot explain the product in one frame?

## Research references

Research reviewed for this design contract:

- Apple HIG — Design principles: https://developer.apple.com/design/human-interface-guidelines/design-principles
- Apple HIG — Designing for iOS: https://developer.apple.com/design/human-interface-guidelines/designing-for-ios
- Apple HIG — Layout: https://developer.apple.com/design/human-interface-guidelines/layout
- Apple HIG — Buttons: https://developer.apple.com/design/human-interface-guidelines/buttons
- Apple HIG — Typography: https://developer.apple.com/design/human-interface-guidelines/typography
- Apple HIG — Branding: https://developer.apple.com/design/human-interface-guidelines/branding
- Apple HIG — Color: https://developer.apple.com/design/human-interface-guidelines/color
- Apple HIG — Dark Mode: https://developer.apple.com/design/human-interface-guidelines/dark-mode
- Apple HIG — Motion: https://developer.apple.com/design/human-interface-guidelines/motion
- Apple HIG — Writing: https://developer.apple.com/design/human-interface-guidelines/writing
- Android Developers — Accessibility API defaults and 48dp touch targets: https://developer.android.com/develop/ui/compose/accessibility/api-defaults
- W3C — WCAG 2.2 target-size minimum: https://www.w3.org/TR/WCAG22/
- Nielsen Norman Group — Progressive Disclosure: https://www.nngroup.com/articles/progressive-disclosure/
- Nielsen Norman Group — 10 Usability Heuristics: https://www.nngroup.com/articles/ten-usability-heuristics/
- Nielsen Norman Group — Reducing cognitive load in forms: https://www.nngroup.com/articles/4-principles-reduce-cognitive-load/
- Nielsen Norman Group — Bottom Sheets: https://www.nngroup.com/articles/bottom-sheet/
- Baymard Institute — Mobile checkout and form usability: https://baymard.com/research-articles/mobile-ecommerce-checkout-forms
- Baymard Institute — Mobile ecommerce usability: https://baymard.com/research/mcommerce-usability

## Maintenance rule

If usability testing disproves a visual assumption, change this document.

Do not preserve a design choice because it is impressive, already implemented, or visually fashionable.

The product goal is not to look modern in a screenshot.

The goal is to feel obvious, calm, fast, and trustworthy every time someone uses it in a real store.
