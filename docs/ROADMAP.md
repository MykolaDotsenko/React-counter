# Roadmap

## Purpose

This file describes **current validation gates and future sequencing**.

It is not a chronological implementation diary. The detailed phase-by-phase plan through repeat-trip engineering is preserved in [archive/ROADMAP-THROUGH-PHASE-8.md](./archive/ROADMAP-THROUGH-PHASE-8.md).

## Current status — 2026-09-22

The core Shopping Budget Companion engineering path is implemented:

- exact EUR money
- ShoppingTrip / CartItem domain
- local-first active-trip persistence and recovery
- remaining-first mobile UI
- fast manual price entry and projections
- Undo, edit/remove and budget/buffer correction
- loss-safe trip completion
- optional checkout reconciliation
- completed-trip history
- Shop again
- Recent Items
- Price Memory
- local-data controls
- privacy-safe timing QA and retention-beta evidence tooling
- Chromium / Firefox / WebKit quality coverage

Two product-evidence gates remain open:

1. representative human one-hand/timing/bright-store validation
2. real-shopper retention validation, including second- and third-trip behaviour

These gates are intentionally stronger than “CI is green”.

## Current priority

### 1. Close the human interaction evidence gate

Validate the manual price-entry path on representative physical devices.

Evidence must cover the structured conditions defined in:

- [evidence/SPRINT-B-QUALITY-GATE.md](./evidence/SPRINT-B-QUALITY-GATE.md)
- relevant decisions in [DECISIONS.md](./DECISIONS.md)

Required conclusion:

- either the manual path meets the release-quality interaction target
- or the product is adjusted and re-tested

Automated browser timing cannot substitute for this gate.

### 2. Run the real-store retention beta

Use the guarded beta evidence path defined in:

- [evidence/RETENTION-BETA.md](./evidence/RETENTION-BETA.md)
- [evidence/RETENTION-BETA-PLAYBOOK.md](./evidence/RETENTION-BETA-PLAYBOOK.md)

Primary early signal:

- second-trip rate

Also inspect:

- third-trip behaviour
- manual-entry abandonment
- repeated-item reuse
- current-price override behaviour
- qualitative trust/friction feedback

Do not reinterpret a weak retention result as an automatic request for more features.

## Work allowed while evidence is pending

The repository may continue to receive:

- correctness fixes
- accessibility fixes
- persistence/recovery hardening
- test/CI reliability improvements
- architecture simplification that preserves behaviour
- documentation drift cleanup
- evidence-tool integrity improvements
- small UX fixes that do not invalidate the evidence protocol
- dependency/security maintenance

Avoid broad product expansion that makes the retention result harder to interpret.

## Gate before new breadth

Do not treat the next capability as approved merely because implementation capacity exists.

Before adding a new major user-facing capability, answer:

1. What measured user problem does it solve?
2. Does it reduce shopping friction or increase pre-checkout confidence?
3. Can the manual/local-first fallback remain complete?
4. Does it preserve exact-money and persistence invariants?
5. Is the previous validation gate sufficiently resolved?

## Future sequence

### A. Installable offline PWA

**Status: gated / not implemented.**

Goal:

- make the already local-first product reliably launchable offline after installation/caching

Candidate implementation:

- Vite PWA tooling / Workbox only if it remains the smallest reliable solution
- application-shell asset caching
- explicit offline-install/reload tests

Must not:

- move canonical shopping state into the service worker
- hide stale/degraded local data
- introduce a backend requirement

Acceptance:

- installed shell launches offline
- active trip/history remain correct
- update/reload behaviour does not lose committed shopping state
- browser tests cover supported offline critical paths

### B. Barcode identification

**Status: gated / not implemented.**

Goal:

- reduce repeated product-identification friction when evidence shows the interaction actually saves work

Rules:

- barcode identifies product, not authoritative current price
- remembered price must retain freshness/store context
- current-price confirmation remains explicit
- manual entry remains available
- provider/network failure cannot block the core trip

Ship only if the end-to-end flow removes more interaction than it adds.

### C. Shelf-label price capture

**Status: gated / not implemented.**

Goal:

- capture the value the user actually needs: current shelf price

Rules:

- OCR output is a candidate
- ambiguous candidates require user choice
- no detected value commits automatically
- camera/OCR failure returns cleanly to manual entry

Evaluate latency, accuracy, permission friction and correction cost on real devices.

### D. Advanced price mechanics

Only after evidence demonstrates recurring need.

Examples may include:

- discounts
- weighted goods
- taxes/deposits where relevant
- more explicit store context
- confidence-aware buffer suggestions

Each mechanic must have an exact deterministic money contract before UI work.

### E. Launch / recruiter-grade proof

Build the case study from verified evidence, not claims.

Target proof:

- clear product problem and narrow scope
- exact-money architecture
- loss-safe local persistence
- cross-browser/accessibility evidence
- measured human interaction results
- retention evidence
- explicit decisions about features deliberately not built

## Explicitly not planned by default

Do not expand into:

- bank-linked personal finance
- net-worth dashboards
- investment/bill management
- meal planning
- nutrition tracking
- grocery delivery
- coupon marketplace
- retailer loyalty platform
- social features
- AI financial advice
- account/backend infrastructure without a validated requirement

A new request in these areas needs a product decision, not opportunistic implementation.

## Technical-debt policy

Fix debt when it creates a real cost in correctness, reviewability, testing or change speed.

Priorities:

1. correctness/data-loss risk
2. duplicated sources of truth
3. unclear ownership between layers
4. files/modules with multiple unrelated reasons to change
5. flaky/slow quality gates
6. stale authoritative documentation
7. cosmetic organization

Do not create abstractions solely to reduce line count.

## AI-development policy

AI-assisted changes should optimise for reasoning efficiency:

- load only task-relevant authoritative context
- inspect current code/tests before trusting status prose
- keep public contracts separate from implementation when that reduces context cost
- update the smallest owning document
- archive completed execution narration
- avoid duplicating status across multiple docs
- never claim human validation from automation
- make refactors behaviour-preserving unless the task explicitly changes product behaviour

For multi-file changes, prefer one coherent architectural intent per PR.

## Evidence-driven decision rule

A feature is normally allowed into the core product only when it:

- helps a shopper stay under the trip limit before checkout
- reduces interaction cost or increases confidence
- remains optional when possible
- preserves manual/local-first fallback
- does not weaken data integrity

If it fails the first criterion, it normally does not belong in this product.

## When to revise this roadmap

Revise the current roadmap when:

- a validation gate produces new evidence
- a major capability is approved or rejected
- architecture constraints materially change
- user research changes the core job
- a future capability becomes current implementation

When a section becomes historical execution detail, move it to `docs/archive/` rather than growing this file indefinitely.
