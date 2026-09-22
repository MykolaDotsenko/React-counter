# Design rationale

## Status

**HISTORICAL / SUPPORTING REFERENCE.**

This file explains why the current `DESIGN.md` direction was selected. It is not a production contract and must not override current product/design rules.

## Evidence behind the direction

The design direction drew on platform/usability guidance:

### Apple HIG

Relevant themes:

- focus on primary tasks;
- strong hierarchy;
- comfortable mobile reach;
- progressive disclosure;
- limited prominent actions;
- restrained brand colour;
- light/dark support;
- purposeful motion;
- plain action-oriented language.

### Android / accessibility guidance

Frequent touch controls should provide reliable target size and accessible semantics.

### Nielsen Norman Group

Relevant themes:

- progressive disclosure;
- recognition over recall;
- visible system status;
- user control/recovery;
- reduced cognitive load;
- minimalist interfaces.

### Baymard

Relevant mobile-form lessons:

- touch typing is slow/error-prone;
- software keyboards consume viewport space;
- redundant fields add friction;
- appropriate input behaviour matters;
- key totals/context should remain visible during transactional flows.

## Prototype directions evaluated

Phase 4 A0 compared three directions on the same fixture.

### Calm Utility — selected

- neutral surfaces;
- restrained accent;
- linear capacity cue;
- minimal depth;
- strongest clarity baseline.

### Premium Spatial — not selected as default

- more depth/glass;
- more expressive capacity visual;
- stronger transitions.

Useful details may be retained only when they improve the shopping task.

### Warm Everyday — not selected as default

- warmer neutrals;
- softer surfaces;
- friendlier shapes;
- more expressive empty-state personality.

The current production contract combines Calm Utility clarity with restrained premium polish and warmth, without merging every prototype trait.

## Validation questions

Prefer task questions over aesthetic preference:

1. What is the app for?
2. How much can you still spend?
3. What would you press to add a price?
4. Is the cart close to the limit?
5. Which information feels most important?
6. Which control is confusing?
7. What does the capacity visual mean?
8. Would you use this one-handed in a store?

Measure correctness/speed before asking whether a design is liked.

## Historical acceptance themes

The selected direction required:

- immediate comprehension;
- remaining-first hierarchy;
- obvious Add price;
- one-hand ergonomics;
- no mandatory metadata;
- visible provenance uncertainty;
- light/dark/large-text/reduced-motion support;
- immediate local feedback;
- identity without brand spectacle.

## Research links

Use current official/reputable sources when revisiting design:

- Apple Human Interface Guidelines
- Android accessibility guidance
- WCAG 2.2
- Nielsen Norman Group usability heuristics/progressive disclosure
- Baymard mobile form/ecommerce usability research

The original Phase 4 evidence is in `../evidence/PHASE-4-DESIGN-VALIDATION.md`.

## Revisit rule

Reopen the design direction only when real usability/market evidence shows that another approach improves the combined outcome of:

- task speed;
- comprehension;
- premium quality;
- accessibility;
- competitive differentiation.
