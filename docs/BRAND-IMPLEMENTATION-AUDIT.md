# Brand Implementation Audit

## Status

Implementation audit for the guarded Shopping Budget Companion surfaces.

Last reviewed: 2026-09-22.

This document translates `BRAND.md` and `DESIGN.md` into concrete implementation evidence and drift checks. It does **not** lock the final commercial name, trademark, domain, or accent hue.

## Brand implementation principle

The product brand should be experienced primarily through:

- remaining-first hierarchy
- calm, exact money language
- restrained warm surfaces
- one dominant action
- the remaining-room capacity metaphor
- local-first trust
- predictable correction and recovery

A persistent logo is not required inside the shopping task. The shopping information remains the hero.

## Current implementation map

| Brand principle | Implementation evidence | Status |
| --- | --- | --- |
| Shopping budget companion, not generic finance app | Start flow asks “How much can you spend today?”; active flow is cart/remaining-first | ✅ aligned |
| Primary promise: know what remains before checkout | `StartTripScreen`, `ActiveTripScreen`, finish/reconciliation flows | ✅ aligned |
| Remaining-first hierarchy | hero uses `left` / `safe to spend` / exact over-limit amount | ✅ aligned |
| Remaining-space metaphor | quiet linear capacity bar + structural reserve zone | ✅ aligned |
| Calm Utility | warm neutral page/panel tokens, restrained depth, one primary accent | ✅ aligned |
| Exact / non-judgmental voice | factual over-limit, persistence, reconciliation and correction copy | ✅ aligned |
| Privacy as trust proof | local-first state + visible “No account” message + content-free beta evidence | ✅ aligned |
| Manual path remains universal | Add price is dominant; remembered prices never remove current-price entry | ✅ aligned |
| Brand mark uses remaining-room metaphor | `public/shopping-mark.svg` | ✅ provisional |
| Guarded browser identity is not Pulse Counter | shared guarded-build metadata transform + runtime title/description | ✅ aligned |
| Final product naming | commercial name remains intentionally unlocked | ⏳ pending evidence/legal checks |
| Final accent hue | current accent is implementation-provisional | ⏳ pending bright-store/recognition evidence |
| Localization | product copy remains English-first | ⏳ later launch work |
| Store/PWA icon family | only guarded favicon mark exists today | ⏳ after retention gate / PWA decision |

## Provisional shopping mark

The guarded shopping builds use:

`public/shopping-mark.svg`

The mark intentionally follows the approved visual metaphor:

> remaining space inside a boundary

Implementation constraints:

- rounded container
- open/right-side negative space
- no text
- no euro symbol
- no shopping cart symbol
- no calculator symbol
- no AI sparkle
- no gradient
- readable at favicon size
- visually compatible with Calm Utility

The current mark uses the current UI accent and warm panel tone. It is **provisional product identity**, not a final trademarked logo.

Do not add the mark persistently to the active-shopping header. `DESIGN.md` explicitly keeps the shopping information—not the brand mark—as the primary visual object.

## Browser identity boundary

The repository intentionally has two identity layers during migration.

### Public root

`/shopping-budget-companion/`

- still ships Pulse Counter
- may retain the legacy Pulse favicon and metadata until the public-shell switch
- must not be described as the released shopping product

### Guarded shopping builds

`/shopping-budget-companion/qa/`

`/shopping-budget-companion/beta/`

These must use:

- title family: `Shopping Budget Companion — …`
- application name: `Shopping Budget Companion`
- current warm theme colour
- `shopping-mark.svg`
- noindex/nofollow/noarchive
- shopping-specific description

They must not inherit the Pulse neon favicon or Pulse product title.

“Shopping Budget Companion” is a descriptive migration label. It does not supersede the naming work in `BRAND.md`.

## Naming guard

`CartRoom` remains a working codename only.

Do not:

- rename package/app metadata to CartRoom
- publish CartRoom as the final app name
- create store assets that imply trademark clearance

until the documented naming research, conflict checks, and user recognition testing are complete.

## Colour guard

Current light tokens include:

- page: `#f5f3ee`
- panel: `#fffdf9`
- accent: `#315f4f`

The current accent works well with Calm Utility, but `BRAND.md` explicitly says the final hue is not locked before evidence.

Therefore:

- do not churn the accent because of trend preference
- do not call the current green the final brand colour
- validate it in bright-store conditions and brand-recognition testing
- compare alternatives only if evidence shows grocery/finance misclassification

## Drift checks

A branding PR should fail review if it introduces any of the following without an explicit evidence-led decision:

- neon/spectral gradient as the shopping identity
- persistent Pulse Counter icon on guarded shopping builds
- piggy bank, bank card, wallet, calculator, euro-symbol or AI-sparkle primary logo
- scanner/AI messaging above the core remaining-budget promise
- guilt or moral judgement about spending
- multiple competing primary actions
- a persistent logo that competes with the remaining amount
- final-name claims without naming clearance
- final-colour claims without evidence
- marketing claims for unshipped or unvalidated features

## Automated brand-integrity coverage

`tests/guarded-build-branding.test.js` protects the highest-risk migration boundary:

- Pulse title is removed from guarded HTML
- Pulse favicon is replaced
- guarded robots metadata remains present
- application name is the neutral shopping migration label
- warm theme colour is applied
- the shopping mark has no legacy neon gradient
- the mark contains no euro symbol

QA and retention panel component tests also protect runtime title/description so React cannot silently reintroduce `Budget Cart` or Pulse identity after page load.

Automation protects implementation consistency. It does not validate final naming recall, brand recognition, or colour perception.

## Remaining evidence

Before locking public product identity:

1. complete representative B6 physical-device evidence
2. run the brand acceptance test from `BRAND.md`
3. test whether the current accent is read as calm utility rather than grocery/finance branding
4. complete final naming/domain/trademark/App Store conflict checks
5. only then generate the production icon family, manifest assets, store screenshots and localized listing identity
