# Phase 4 Design Validation

## Status

Decision record for Sprint A / A0.

This is a structured prototype review against the documented task criteria. It is **not** a substitute for real-user usability testing.

Selected production direction:

> **Calm Utility**

The selection is intentionally conservative: clarity, one-hand use, bright-store legibility, large-text resilience, and trust outrank visual novelty.

## Canonical comparison fixture

Every direction is evaluated against the same state:

- budget: EUR 50.00
- safety buffer: EUR 2.00
- cart total: EUR 31.42
- nominal remaining: EUR 18.58
- safe remaining: EUR 16.58
- several recent cart lines
- Add price visible

## Critical semantic decision

When a safety buffer is greater than zero, the hero value represents:

> **safe remaining**

For the canonical fixture the hero is therefore:

> **EUR 16.58 SAFE TO SPEND**

The nominal amount remains secondary:

> EUR 18.58 remains before the hard EUR 50 limit.

When safety buffer is zero, the hero may simplify to:

> **EUR 18.58 LEFT**

### Why

The product's primary job is to tell the shopper what they can still safely add to the cart.

Showing nominal remaining as the hero while a buffer exists would force the user to mentally subtract the reserve and would contradict the product's remaining-safe-spending thesis.

## Capacity visual decision

Selected:

> **quiet linear capacity bar**

Do not use the partial radial ring as the production default.

The bar communicates three concepts:

1. already in cart
2. safe room still available
3. reserved safety buffer

The buffer segment must remain identifiable without colour alone.

Exact amounts remain available in text, so the visual is reinforcement rather than the sole source of meaning.

## Prototype A — Calm Utility

### Composition

~~~text
┌─────────────────────────────┐
│ Shopping                ••• │
│                             │
│          €16.58             │
│       SAFE TO SPEND         │
│                             │
│    €31.42 of €50.00         │
│                             │
│  ███████████───────│··      │
│  Cart     Safe room Reserve │
│                    €2.00    │
│                             │
│      [ + Add price ]        │
│                             │
│ Cart                        │
│ €8.90                    ×1 │
│ €4.79                    ×1 │
│ €2.45                    ×2 │
└─────────────────────────────┘
~~~

### Characteristics

- neutral page and content surfaces
- restrained single accent
- strong tabular money typography
- linear capacity visual
- minimal depth
- generous hero whitespace
- one filled primary action
- cart rows visually quiet
- system light/dark appearance

### Strengths

- fastest expected comprehension
- easiest capacity semantics
- strongest 200% zoom resilience
- lowest visual competition with hero amount
- best fit for bright supermarket lighting
- easiest forced-colour/high-contrast adaptation
- strongest foundation for one-hand interaction
- least likely to read as fintech, fitness, or gamification

### Risks

- can become visually generic if spacing/type/motion are mediocre
- weaker immediate connection to the earlier experimental visual identity

### Mitigation

Preserve implementation-quality details rather than the old visual metaphor:

- precise motion
- tabular numerals
- excellent pressed/focus states
- subtle surface depth where useful
- disciplined spacing

Do not preserve the radial counter merely for continuity.

## Prototype B — Premium Spatial

### Composition

~~~text
┌─────────────────────────────┐
│ Shopping                ••• │
│                             │
│        ╭─────────╮          │
│       ╱  €16.58   ╲         │
│      │ SAFE TO    │         │
│      │   SPEND    │         │
│       ╲           ╱         │
│        ╰─────────╯          │
│    €31.42 of €50.00         │
│       Reserve €2.00         │
│                             │
│      [ + Add price ]        │
│                             │
│ ╭─────────────────────────╮ │
│ │ Recent cart lines       │ │
│ ╰─────────────────────────╯ │
└─────────────────────────────┘
~~~

### Characteristics

- restrained glass/depth
- partial radial capacity visual
- stronger animated transitions
- more obvious inheritance from the earlier experimental UI

### Strengths

- strongest visual identity
- highest continuity with earlier interaction work
- potentially excellent portfolio screenshot
- radial depletion can communicate finite capacity

### Risks

- ring can compete with the actual money answer
- resembles fitness/gamification products
- weaker at 200% text zoom
- more difficult forced-colour behaviour
- more surface effects to maintain in bright-store conditions
- greater risk of prioritising visual spectacle over task speed

## Prototype C — Warm Everyday

### Composition

~~~text
┌─────────────────────────────┐
│ Your shop                   │
│                             │
│          €16.58             │
│       safe to spend         │
│                             │
│    €31.42 of €50.00         │
│  ███████████───────│··      │
│  Keeping €2 in reserve      │
│                             │
│      [ + Add price ]        │
│                             │
│ In your cart                │
│ €8.90                    ×1 │
│ €4.79                    ×1 │
│ €2.45                    ×2 │
│                             │
│ Small friendly empty/detail │
│ personality where useful    │
└─────────────────────────────┘
~~~

### Characteristics

- warm neutral surfaces
- softer shape language
- linear capacity visual
- more conversational labels
- restrained empty-state personality

### Strengths

- approachable and human
- less finance-like
- strong one-hand and accessibility potential
- safe buffer explanation feels natural
- good fit for household/grocery context

### Risks

- friendliness can weaken instrument-like precision
- illustrations/personality can become noise
- less distinctive in a recruiter screenshot if pushed too far
- softer wording can become less scannable than concise task language

## Evaluation rubric

Weights are chosen for in-store utility, not aesthetic preference.

| Criterion | Weight |
|---|---:|
| Purpose understood in 3–5 seconds | 18 |
| Remaining amount recognised instantly | 18 |
| Add price recognised instantly | 14 |
| Capacity visual meaning | 10 |
| One-hand ergonomics | 10 |
| 200% zoom / accessibility resilience | 10 |
| Bright-store/light-mode resilience | 8 |
| Trust / precision | 5 |
| Visual differentiation | 4 |
| Prior-work/recruiter continuity | 3 |

## Heuristic prototype scores

These are design-review scores, not user-study results.

| Criterion | Calm Utility | Premium Spatial | Warm Everyday |
|---|---:|---:|---:|
| Purpose comprehension | 99 | 93 | 97 |
| Hero recognition | 100 | 94 | 98 |
| Add price recognition | 99 | 95 | 98 |
| Capacity meaning | 99 | 87 | 98 |
| One-hand ergonomics | 99 | 95 | 98 |
| Large-text resilience | 100 | 86 | 99 |
| Bright-store resilience | 99 | 89 | 98 |
| Trust / precision | 100 | 94 | 97 |
| Differentiation | 89 | 99 | 93 |
| Prior-work/recruiter continuity | 82 | 100 | 78 |

Weighted decision result:

- **Calm Utility — 98/100**
- **Warm Everyday — 97/100**
- **Premium Spatial — 92/100**

The one-point gap between Calm Utility and Warm Everyday is intentionally treated as small. Calm Utility wins because its advantages occur in the highest-risk contexts:

- exact hero interpretation
- high-attention competition in store
- large text
- capacity semantics
- visual restraint

## Final production direction

### Selected

> **Calm Utility**

### Not selected as base direction

Premium Spatial:

- reject the radial ring as the default capacity visual
- reject glass/depth as the dominant language
- reject spectacle-first transitions

Warm Everyday:

- do not use illustration/personality as a primary structural device
- do not soften key money labels until they lose scanning precision

### Allowed inheritance

The selected Calm Utility direction may retain small implementation qualities from earlier interaction work:

- refined motion
- subtle elevation
- polished pointer/press feedback where appropriate
- premium numeric typography

These are polish details, not a hybrid visual direction.

## Active-trip hierarchy lock

Production hierarchy for Phase 4:

1. **safe remaining hero**
2. cart total / nominal budget
3. linear capacity visual
4. safety-buffer explanation
5. Add price primary action
6. cart lines
7. secondary tools

When buffer is zero:

1. **nominal remaining hero**
2. cart total / budget
3. linear capacity visual
4. Add price
5. cart lines

## Copy lock for implementation

Initial recommended labels:

With safety buffer:

> **€16.58**  
> **SAFE TO SPEND**

Secondary:

> €31.42 of €50.00

Buffer context:

> €2.00 kept in reserve

Without safety buffer:

> **€18.58**  
> **LEFT**

Do not display both EUR 16.58 and EUR 18.58 at equal hierarchy.

## Start-screen direction

Use the Calm Utility language.

Primary question:

> **How much can you spend today?**

Quick values:

- €25
- €50
- €75
- €100

Secondary:

> Custom

A quick amount should start the trip directly.

Do not force safety-buffer setup before the first trip.

Buffer configuration can remain optional and progressively disclosed.

## Light-mode direction

Light mode is a first-class supermarket mode.

Requirements:

- high text/background contrast
- warm-neutral rather than sterile white where useful
- no faint glass borders needed for structure
- accent used primarily for Add price and selected state
- capacity visual remains legible in bright lighting

## Dark-mode direction

Dark mode uses the same hierarchy.

Requirements:

- deep neutral surfaces rather than pure-black spectacle
- restrained accent saturation
- no permanent glow around money values
- no glass effect required for comprehension

## Motion direction

Motion should explain state change.

Allowed:

- brief number transition
- small capacity-bar update
- short item insertion/removal transition
- pressed-state feedback

Avoid:

- continuous orbital motion
- hero ring animation
- decorative shimmer
- large spatial transforms during ordinary cart entry

Reduced-motion must remain fully understandable.

## One-hand layout rule

The first common phone viewport must show without scrolling:

- hero remaining
- budget context
- capacity visual
- Add price

Add price should live in a stable thumb-reachable lower-middle/bottom region without covering essential cart context.

## Accessibility lock

The chosen direction assumes:

- frequent targets at least 48 CSS px
- tabular money numerals
- semantic text for all status changes
- no colour-only capacity state
- visible focus
- 200% zoom resilience
- forced-colours compatibility
- reduced-motion equivalence

## Remaining empirical validation

A0 chooses the implementation direction.

It does **not** claim real-user validation.

During A6 and real-store beta, verify:

- 3–5 second comprehension
- safe-vs-nominal interpretation
- progress-bar meaning
- one-hand Add price reach
- bright-store readability
- whether SAFE TO SPEND or another concise label performs better

If users consistently misread the selected semantics, revise this decision rather than preserving the visual design.
