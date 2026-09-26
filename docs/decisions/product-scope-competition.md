# Product, Scope and Competition Decisions

## Status

Accepted decision records. These explain durable choices but do not override current code/tests or authoritative current contracts.

Use [../DECISIONS.md](../DECISIONS.md) as the retrieval index.

## D-001 — Pivot from generic counter to shopping budget companion

Date: 2026-09-21

Status: accepted

### Decision

Build a focused shopping budget companion for people shopping under a hard per-trip spending limit.

### Rationale

The counter implementation has strong interaction engineering but weak product value. Shopping-under-a-limit is a validated recurring problem, while still matching the existing project's core interaction pattern: quick numeric input, immediate feedback, local persistence, and mobile use.

### Rejected alternatives

- generic multi-counter
- field observation recorder
- AI/data audit tool
- queue analysis tool
- event/traffic funnel tracker
- recording moment marker
- photography shot marker
- stockout predictor as the primary product

Many alternatives were interesting, but either required more explanation, duplicated domains already represented in the portfolio, were more niche, or weakened the direct evolution from the current interaction model.

### Consequence

The product must optimise first for grocery/retail shopping budget control, not for general finite-resource tracking.

### Revisit when

Real-user validation shows that the shopping problem is materially weaker than another validated use case.

## D-002 — Remaining amount is the primary metric

Date: 2026-09-21

Status: accepted

### Decision

The active-trip hero shows what the shopper can still safely spend, not just the amount already spent.

### Rationale

The user's actionable question in the aisle is “What can I still add?”

Spent amount remains visible as supporting context.

### Consequence

UI hierarchy and copy must remain remaining-first.

### Revisit when

Usability testing consistently shows that users misunderstand the remaining-first model.

## D-003 — Manual price entry is the baseline

Date: 2026-09-21

Status: accepted

### Decision

Manual price entry is always available and must remain a first-class, offline-capable path.

### Rationale

Barcode and OCR capabilities are inconsistent, may need network access, and can add friction when they fail. A fast keypad is deterministic and universal.

### Consequence

Scanner work cannot block MVP or degrade manual entry.

### Revisit when

A platform-native scanning path becomes more reliable and measurably faster without harming fallback usability.

## D-014 — Core product remains free of mandatory smart features

Date: 2026-09-21

Status: accepted

### Decision

Manual budgeting, cart arithmetic, quantity, undo, persistence, and completion cannot depend on AI, OCR, barcode services, or subscription-only capability.

### Rationale

Competitor reviews show that paywalls and unreliable “smart” capture can damage trust. The basic problem should remain solvable immediately.

### Consequence

Optional smart features must degrade gracefully.

### Revisit when

No planned revisit for the portfolio product.

## D-015 — Product does not expand into general personal finance

Date: 2026-09-21

Status: accepted

### Decision

Do not add bank sync, income/bill management, investments, net worth, or generic monthly financial dashboards.

### Rationale

The product differentiates through focus on the in-store pre-checkout moment.

### Consequence

History and analytics must remain directly relevant to faster/more confident shopping.

### Revisit when

Only if the product thesis itself is intentionally replaced.

## D-016 — Competitive advantage is execution, not feature count

Date: 2026-09-21

Status: accepted

### Decision

Do not chase parity with every feature in Total Plus, GroceryBudget, CartBudget, Cart AI, Shopping Calculator, or other grocery apps.

### Rationale

The category is validated but crowded. Feature breadth is not a defensible portfolio story. A faster, clearer, more reliable experience is.

### Consequence

Feature proposals require a friction, confidence, or reliability rationale.

### Revisit when

Real user evidence shows a missing feature is repeatedly blocking the core job.

## D-020 — Brand promise is pre-checkout remaining control

Date: 2026-09-21

Status: accepted

### Decision

The primary brand promise is:

> Know what you can still afford before checkout.

The product must not position itself primarily as a generic budgeting app, expense tracker, shopping list, or AI scanner.

### Rationale

The category is crowded, but the timing difference is distinctive and directly tied to the user's actionable moment: before payment, while the cart can still change.

Competitor evidence repeatedly validates “know before checkout” language, while general finance positioning would create expectations the product intentionally does not meet.

### Consequence

Landing pages, App Store screenshots, social hooks, README product story, and future paid creative should lead with the pre-checkout remaining problem.

Advanced features such as scanning or price memory are proof/mechanism, not the brand promise.

### Revisit when

Only if user research consistently shows a different job drives adoption and repeated use.

## D-022 — Organic proof before meaningful paid acquisition

Date: 2026-09-21

Status: accepted

### Decision

Prioritize:

1. real-user beta
2. App Store/Play Store conversion quality
3. organic short-form/demo content
4. SEO/build-in-public
5. only then meaningful paid acquisition

### Rationale

The product does not yet have measured activation, second-trip retention, or lifetime value.

Paid acquisition before retention proof risks buying installs for a product whose repeat value is still unknown.

### Consequence

Do not recommend material paid-ad spend as a launch requirement.

Store-listing experiments and organic creative tests should establish message/conversion signals first.

### Revisit when

The product has credible activation, second-trip retention, conversion, and monetization data.

## D-023 — Monetization must preserve core shopping trust

Date: 2026-09-21

Status: accepted

### Decision

The core manual shopping loop should remain free if the product is commercialized.

Avoid a weekly subscription or surprise paywall before first value.

Potential paid value should come from advanced or ongoing-cost features such as:

- heavy OCR/scanning
- cross-device sync
- family sharing
- advanced price history
- retailer integrations

### Rationale

The target audience is explicitly budget-conscious. Category evidence shows that transparent/no-subscription positioning can itself become a trust signal.

### Consequence

Marketing copy must never bait users with a free promise that hides the basic trip workflow behind payment.

### Revisit when

Real service economics make a different model necessary, with explicit user-value evidence.

## D-035 — Repeat-trip acceleration precedes scanner breadth

Date: 2026-09-21

Status: accepted

### Decision

After the core manual/correction/completion flow is stable, prioritise:

1. Shop again / repeat previous budget
2. Recent Items
3. basic Price Memory

before:

- barcode scanning
- shelf OCR
- voice capture
- broader smart-shopping features

PWA/installability may follow the retention gate, but must not displace repeat-trip validation.

### Rationale

The largest unresolved product risk is not capture technology. It is whether users tolerate repeated entry and voluntarily return for another real shopping trip.

Repeat-trip acceleration reduces friction for products the user already buys without introducing:

- camera permission
- network dependency
- recognition latency
- OCR ambiguity
- external product-database coverage

This directly targets retention rather than feature breadth.

### Consequence

ROADMAP.md must keep Repeat Trip / Recent Items / Price Memory ahead of barcode/OCR work.

Scanner/OCR work cannot be justified merely because competitors have it.

### Revisit when

Real-store evidence shows another capability is repeatedly blocking the core job before repeat-trip acceleration can help.

## D-036 — Second-trip rate is the primary early product-validation signal

Date: 2026-09-21

Status: accepted; threshold bands refined by D-038

### Decision

Use second-trip rate as the primary early product-success signal after the repeat-trip flow is implemented.

Provisional internal decision bands:

- 35% or higher — very strong early signal
- 25–35% — promising; optimise recurring friction
- 15–25% — material retention problem
- below 15% — revisit the core interaction/job before expanding features

These thresholds are heuristics, not external market benchmarks.

### Rationale

Downloads, first launches, feature usage, and stated intent can all look healthy while the product fails to become a real shopping habit.

A second real shopping trip is a much stronger signal that the product creates repeated value.

### Consequence

After Repeat Trip / Recent Items / Price Memory are implemented, freeze non-critical feature expansion long enough to run a focused real-store beta with approximately 20–50 shoppers.

Do not respond to weak retention by automatically adding OCR, barcode, voice, cloud sync, or more analytics.

### Revisit when

Enough real cohort data exists to replace these provisional thresholds with observed product-specific baselines.

## D-038 — Refine retention thresholds and include third-trip behaviour

Date: 2026-09-21

Status: accepted

### Decision

Keep second-trip rate as the primary early retention signal, but refine the provisional internal decision bands to:

- 45% or higher — exceptional early signal
- 35–45% — strong
- 25–35% — viable/promising
- 15–25% — problematic
- below 15% — core product-risk signal

Also track third-trip behaviour before assigning high confidence to retention.

These thresholds are internal heuristics, not claimed industry benchmarks.

### Rationale

A single return trip is a strong signal, but healthy third-trip behaviour better distinguishes a one-time novelty/revisit from a forming habit.

The stricter upper band creates a more demanding internal bar before scaling distribution or monetisation.

### Consequence

Product-success, roadmap, beta, and launch documentation must use the refined bands.

High-confidence product-success estimates require:

- strong second-trip behaviour
- healthy third-trip behaviour
- no major trust/data-loss issue

### Revisit when

Enough product-specific cohort data exists to replace heuristic bands with observed baselines.

## How to add a decision

Add a new numbered entry when a decision:

- changes a cross-cutting product rule
- changes a major architecture boundary
- chooses one expensive/reversibility-sensitive approach over another
- intentionally rejects a likely future suggestion

Do not record trivial implementation details here.

## How to supersede a decision

Do not silently rewrite historical rationale.

Instead:

1. mark old decision as superseded
2. add the new decision
3. explain evidence that changed
4. update authoritative product/domain/architecture docs
