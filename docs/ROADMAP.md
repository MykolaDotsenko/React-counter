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
- guarded provider-neutral visual product recognition benchmark harness (no model/provider bundled)
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

## Execution sequence

The active roadmap is intentionally narrow and local-first.

### A. Current validation gates

1. **Repository governance — issue #58**
   - protect `main`;
   - require pull requests and current branches;
   - require the full quality/browser/CodeQL matrix;
   - block force pushes and deletion;
   - automatically remove merged head branches.

2. **Real-shopper retention — issue #72**
   - recruit 20–50 real shoppers;
   - preserve one retained beta session per participant;
   - interpret 7/14/30-day retention only when each window has at least 20 eligible participants;
   - use repeat use, abandonment, Price Memory/reuse and trust/friction evidence to decide whether the core flow needs remediation.

3. **Physical barcode benchmark — issue #73**
   - collect representative phone evidence from the isolated benchmark;
   - collect a same-device quantitative manual-entry baseline;
   - compare end-to-end human decision time, failures, corrections, fallback, preference and cognitive effort.

4. **Visual product recognizer evidence — issue #88**
   - keep the provider-neutral camera/evidence harness isolated from shopping state;
   - select one explicit experimental recognizer/model adapter rather than a generic demo;
   - declare whether image bytes remain local or cross a remote boundary;
   - benchmark representative retail products and same-brand/similar-package confusions;
   - compare ranked accuracy, end-to-end human decision time, corrections and fallback against manual interaction.

These gates are not replaceable by automated fixtures or green CI.

### B. Production barcode — only after positive physical evidence

**Production status: PLANNED / GATED. Experimental native benchmark harness: IMPLEMENTED.**

If issue #73 demonstrates meaningful net interaction benefit, implement production barcode in small layers:

1. product-identity domain contracts;
2. provider-neutral `BarcodeScanner` application port;
3. native `BarcodeDetector` adapter;
4. lazy fallback only if target-device evidence requires it;
5. provider-neutral `ProductLookup` port;
6. runtime-validated product-identity adapter;
7. scan → identity candidate → explicit user confirmation;
8. permission/error/manual-fallback UX;
9. production barcode release gate.

Barcode identifies **product identity only**. It never supplies authoritative current shelf price. Manual current-price entry remains complete and always available.

### C. Visual product recognition — concrete adapter evidence before production

**Harness status: IMPLEMENTED. Recognizer/model evidence: PLANNED / GATED. Production recognition: PLANNED / GATED.**

The guarded benchmark owns camera capture, timeout/cancellation, ranked candidate review, privacy-safe evidence and adapter boundaries. It deliberately ships no concrete recognition model.

Use issue #88 to evaluate one explicit adapter/model on representative retail products before production work.

Production visual recognition, if approved, must preserve:

1. provider-neutral `VisualProductRecognizer` application boundary;
2. explicit model/provider identity;
3. explicit `local-only` or `remote-image` data boundary;
4. transient image handling with no image persistence in shopping/evidence storage;
5. ranked candidates rather than silent auto-selection;
6. explicit human confirmation before product identity reaches shopping state;
7. manual fallback at every failure/low-confidence point;
8. lazy loading so recognizer code/model does not enter the critical initial bundle;
9. barcode and visual identity fusion without making either source authoritative shelf price.

Category-only recognition is not sufficient when the intended interaction needs SKU-level identity.

### D. Shelf-label OCR — benchmark before production

OCR remains **GATED / NOT IMPLEMENTED**.

First build an isolated benchmark:

1. controlled shelf-label fixture corpus;
2. accuracy/latency/correction metrics;
3. worker-based experimental OCR adapter;
4. deterministic shelf-price candidate parser;
5. benchmark candidate-selection UI;
6. real-device quality gate.

Only a positive result may authorize production OCR. Production OCR must preserve:

- OCR output is a candidate, never canonical money;
- ambiguous candidates require explicit user choice;
- user confirmation precedes a ShoppingTrip mutation;
- slow/failing OCR returns cleanly to manual entry;
- OCR code remains lazy and outside the critical initial bundle.

### E. Evidence-selected advanced pricing

Advanced pricing is not a package to implement wholesale. Add one mechanic at a time only after repeated real-user need.

Candidate order:

1. weighted goods;
2. unit-price comparison;
3. discounts;
4. refundable deposits.

Tax-exclusive consumer pricing is outside the active roadmap unless a concrete use case appears.

Every accepted mechanic requires:

- an exact deterministic money contract;
- property/unit tests before UI;
- persistence compatibility;
- application orchestration;
- focused UX;
- browser/accessibility regression coverage.

### F. Completed-trip reopen — optional

Do not add reopen semantics unless real-user evidence shows recurring need.

If approved, reopening must derive a **new active trip** from immutable completed history. A completed history record must never be mutated back into an active transaction.

### G. Launch / recruiter-grade proof

Build the final case study from verified evidence:

- clear product problem and deliberately narrow scope;
- exact-money architecture;
- loss-safe local persistence;
- offline/PWA reliability;
- accessibility and cross-browser evidence;
- real retention evidence;
- barcode/OCR go/no-go decisions;
- explicit examples of capabilities deliberately rejected or deferred.

## Explicit product non-goals

The active product is intentionally:

> **local-first · offline-first · account-free · no mandatory network**

Do not add the following to the active roadmap:

- backend/account infrastructure;
- authentication;
- cloud sync;
- shared-shopping collaboration;
- bank-linked personal finance;
- net-worth dashboards;
- investment/bill management;
- AI financial advice;
- retailer loyalty/social-platform breadth.

A future external product-identity lookup may use a narrowly scoped network adapter, but network failure must never block the core trip and remote state must never become canonical shopping authority.

Receipt scanning, voice input and a global store-price database are also outside the active execution roadmap until real-user evidence identifies a recurring problem they uniquely solve.

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
