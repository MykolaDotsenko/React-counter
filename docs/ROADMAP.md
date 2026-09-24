# Roadmap

## Purpose

This file describes **current validation gates and future sequencing**.

It is not a chronological implementation diary. The detailed phase-by-phase plan through repeat-trip engineering is preserved in [archive/ROADMAP-THROUGH-PHASE-8.md](./archive/ROADMAP-THROUGH-PHASE-8.md).

## Current status — 2026-09-24

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
- installable offline PWA shell
- privacy-safe timing QA and retention-beta evidence tooling
- local-only retention cohort analyzer
- guarded native barcode interaction benchmark harness (not a production scanner)
- Chromium / Firefox / WebKit quality coverage

The representative physical-phone interaction gate was accepted by explicit repository-owner/user attestation on 2026-09-24. The check was reported as responsibly completed with no blocking usability problem.

That attestation closes the manual physical-usability blocker for this validation cycle, but no machine-verifiable timing JSON was retained. Therefore the repository must **not** quote an exact human median/P75/max or claim the <=2.5 s KPI from this cycle.

One product-evidence gate remains open:

1. real-shopper retention validation, including second- and third-trip behaviour

This gate is intentionally stronger than “CI is green”.

## Current priority

### 1. Run the real-store retention beta

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
2. Does it reduce shopping friction, increase confidence or improve repeat use?
3. Does it strengthen premium quality or meaningful competitive differentiation?
4. Can the manual/local-first fallback remain complete?
5. Does it preserve exact-money, persistence and accessibility invariants?
6. Is the previous validation gate sufficiently resolved?

## Future sequence

### A. Installable offline PWA

**Status: IMPLEMENTED.**

The public product now ships a Vite/Workbox-generated installable application shell:

- manifest + 192/512 install icons;
- application-shell precaching;
- GitHub Pages-aware scope/base;
- prompt-based service-worker updates;
- no forced reload during an active shopping lifecycle;
- canonical trip/history/Price Memory state remains in localStorage rather than Cache Storage;
- guarded `/qa/`, `/beta/`, `/cohort/` and `/barcode-benchmark/` evidence builds remain outside PWA registration.

Automated browser coverage verifies active-trip restore, offline completion/history persistence and a second offline history restore.

The physical-phone usability gate was accepted for the current cycle by owner attestation; exact quantitative timing remains unclaimed. Real-shopper retention remains open.

### B. Barcode identification

**Production status: PLANNED / GATED. Experimental native benchmark harness: IMPLEMENTED; empirical result pending.**

The isolated benchmark lives at `/barcode-benchmark/` and is governed by [evidence/BARCODE-BENCHMARK.md](./evidence/BARCODE-BENCHMARK.md). It measures native camera scan → human decision latency, timeout/correction/manual-fallback behaviour and structured repeated-use preference without adding scanner code to the production shopping path.

The benchmark does not include product lookup, current-price lookup or the D-031 WASM fallback. Production barcode work remains gated until representative mobile benchmark evidence and a paired quantitative manual baseline show meaningful benefit.

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
- reduces interaction cost, increases confidence or improves repeat use
- strengthens premium quality or meaningful differentiation without adding recurring friction
- remains optional when possible
- preserves manual/local-first fallback
- does not weaken data integrity or accessibility

If it fails the first criterion, it normally does not belong in this product.

## When to revise this roadmap

Revise the current roadmap when:

- a validation gate produces new evidence
- a major capability is approved or rejected
- architecture constraints materially change
- user research changes the core job
- a future capability becomes current implementation

When a section becomes historical execution detail, move it to `docs/archive/` rather than growing this file indefinitely.
