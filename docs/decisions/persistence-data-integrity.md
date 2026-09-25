# Persistence and Data Integrity Decisions

## Status

Accepted decision records. These explain durable choices but do not override current code/tests or authoritative current contracts.

Use [../DECISIONS.md](../DECISIONS.md) as the retrieval index.

## D-007 — localStorage before IndexedDB

Date: 2026-09-21

Status: accepted

### Decision

Use versioned localStorage for MVP shopping state while the data remains small and text-only.

### Rationale

The simpler storage model is proportionate, inspectable, testable, and already aligned with the current repository.

### Consequence

Do not add IndexedDB for prestige.

### Revisit when

The product needs images, large receipt data, large price history, offline catalogues, or another data shape that materially exceeds localStorage's practical fit.

## D-008 — Persistence failure must be visible

Date: 2026-09-21

Status: accepted

### Decision

Shopping persistence failure must be surfaced to the user rather than silently degrading to ephemeral memory.

### Rationale

Losing an active budget/cart during shopping is user-impacting financial data loss.

### Consequence

The application needs persistence-health state and truthful save messaging.

### Revisit when

Never for the core flow; exact UI may evolve.

## D-009 — No backend for MVP

Date: 2026-09-21

Status: accepted

### Decision

The core product has no mandatory backend, authentication, or cloud database.

### Rationale

The primary job is single-user, local, privacy-friendly, and benefits from offline operation.

### Consequence

Do not create server infrastructure before a feature such as cross-device sync, family sharing, or retailer integration requires it.

### Revisit when

A validated multi-device or collaboration requirement appears.

## D-012 — Event sourcing is not justified

Date: 2026-09-21

Status: accepted

### Decision

Use ordinary canonical trip state plus a bounded undo mechanism instead of an append-only event ledger.

### Rationale

The shopping cart does not currently need audit-grade history. Event sourcing would add complexity without proportional user value.

### Consequence

Undo may use a previous-state snapshot, command stack, or reducer history.

### Revisit when

A genuine audit/history requirement appears that cannot be served by completed-trip history and normal state transitions.

## D-027 — Zod validates untrusted boundaries, not the domain

Date: 2026-09-21

Status: accepted

### Decision

Use Zod 4 for:

- persisted DTOs
- migrations
- external API responses
- future provider/scanner DTOs

Pure domain code must not depend on Zod.

### Rationale

TypeScript types cannot validate runtime JSON.

Zod materially reduces persistence/API corruption risk, while keeping it outside the domain preserves framework/library independence.

### Consequence

Infrastructure maps validated DTOs into domain constructors/branded types.

### Revisit when

A smaller/safer runtime validator materially improves the system without reducing schema clarity or migration reliability.

## D-034 — localStorage remains MVP persistence despite adding runtime validation

Date: 2026-09-21

Status: accepted

### Decision

Keep versioned localStorage as MVP canonical persistence and add Zod validation at its boundary.

Do not move to IndexedDB/Dexie merely because the product is becoming more complex.

### Rationale

Canonical shopping state remains small text data, and synchronous write semantics are useful for the durability contract.

### Consequence

Upgrade storage only for actual data-volume/query/media requirements.

### Revisit when

Images, large price history, large offline datasets, or indexed-query requirements appear.

## D-040 — Repeat budget derives from completed history, not duplicate settings state

Date: 2026-09-22

Status: accepted

### Decision

The first Phase 8 repeat-trip accelerator derives its source from validated completed-trip history.

Shop again copies only:

- budget
- safety buffer

into a newly created active trip with a fresh trip id, fresh start timestamp, and empty cart.

Do not introduce a separate persisted `recentBudget` or repeat-settings record for this slice.

### Rationale

Completed history is already:

- versioned
- runtime validated
- durable
- locally available
- the factual source of the user's previous spending plan

Persisting the same plan again would create two sources of truth and a synchronization/migration problem without user value.

A fresh trip is also materially safer than reopening a completed trip because it does not require a two-record history/active rollback transaction.

### Consequence

- later-launch recent-budget UI selects the newest valid completed trip
- completed history remains immutable when Shop again is used
- cart items and actual checkout totals are never copied into the new trip
- repeat is rejected while history durability is degraded or completion cleanup is pending
- Continue shopping remains a separate deferred capability
- a dedicated settings record is added only if future adaptive defaults require state that cannot be derived safely from history

### Revisit when

Recent-budget preferences must intentionally diverge from completed history, or user research demonstrates a need for persistent defaults independent of the latest completed trip.

## D-042 — Retention beta evidence stays local and content-free

Date: 2026-09-22

Status: accepted

### Decision

Use a guarded beta build with a separate local evidence record:

~~~text
budget-cart:qa:retention-v1
~~~

The evidence schema may contain only behavioural structure required for the retention gate:

- trip ordinal
- new/repeat trip start
- trip finish
- 1/5/10 item milestones
- manual-entry completion duration
- manual-entry abandonment
- remembered-item reuse
- current-price override start

It must not contain:

- budgets
- prices or line totals
- item names
- product/memory/store identifiers
- checkout totals
- camera content

The application sends no beta telemetry. Evidence export is an explicit manual action.

### Rationale

The retention question can be answered from behavioural structure without collecting shopping content. A remote analytics platform would add privacy, consent, operational, and architectural complexity before product retention is proven.

Keeping evidence separate from shopping persistence also prevents validation infrastructure from becoming business-state authority.

### Consequence

- beta evidence failure never affects the active shopping trip
- old shopping history does not define beta trip ordinals
- starting evidence collection mid-trip does not fabricate a trip start
- a guarded `/beta/` build may be published while the default public shell remains unchanged
- human beta evidence is still required before Phase 9 breadth

### Revisit when

A later validated product needs aggregate telemetry across a larger cohort and has an explicit privacy/consent design.

## D-045 — Retire the compatibility shell and publish one product

Date: 2026-09-22

Status: accepted

### Decision

Shopping Budget Companion is the only application shell in the repository and the canonical public GitHub Pages root.

Remove the obsolete prototype UI, its feature directory, presentation CSS, persistence implementation, component/model/storage tests, alternate favicon, and shell-selection feature flag.

Keep only the minimal historical-storage retirement safeguard required to prevent unrelated old numeric state from being interpreted as shopping money.

QA and retention-beta routes reuse the same shopping application. Their flags enable evidence instrumentation only; they do not select a different product.

### Rationale

Maintaining two products in one repository created avoidable cost:

- the public demo did not represent the actual product work
- README and architecture documentation needed migration disclaimers
- CI built and deployed a product that was no longer the repository's purpose
- legacy UI code, CSS, tests, branding, and feature flags obscured the architecture for reviewers
- future contributors could accidentally preserve or extend compatibility code that had no product value

The shopping implementation is already independently covered by exact-domain tests, application/controller tests, component tests, persistence/recovery tests, and the Chromium/Firefox/WebKit browser matrix.

Retaining the old UI therefore adds noise without adding meaningful release safety.

### Consequence

- `src/App.jsx` always composes Shopping Budget Companion
- no product-shell selection feature flag remains
- the public root, QA route, and beta route share one product identity
- the repository structure exposes only current product features
- historical storage keys remain implementation details solely for safe retirement
- B6 physical timing and Phase 8 retention evidence remain explicitly unverified and must not be fabricated or inferred from automation

### Revisit when

Only if a genuinely separate product shell becomes a validated product requirement. A demo or migration convenience is not sufficient reason to reintroduce one.

---

## D-051 — Damaged local data always leaves the shopper a safe exit

Date: 2026-09-25

Status: accepted

### Decision

Only an unreadable active-trip record (or unreadable storage) enters RECOVERY. Damaged completed history is a separate history-integrity state that never blocks starting, tracking or correcting a trip.

Every unreadable state has an explicit exit that never destroys data:

- **Continue without saving** — the session refuses every write, so unreadable stored data is never overwritten;
- **Set aside** — the exact raw record is copied to a new `budget-cart:set-aside:*` backup key and read back before the canonical key is replaced (history) or removed (active record);
- **Try again** — for read failures that may be transient.

Operations that would overwrite unreadable history (finishing, deleting a trip, clearing history) are refused until the shopper sets it aside.

### Rationale

Before this decision any history problem with no active trip forced RECOVERY, whose only action was "try reading again". One damaged or newer-version history entry therefore locked the shopper out permanently; with an active trip, finishing failed forever and the warning disappeared after the next successful save. The only escape was clearing site data, which destroyed the valid trips, Price Memory and the unreadable record itself.

Every GitHub Pages surface of this repository (public app, guarded routes, immutable `/study/<baseline>/` copies) shares one origin. With strict schemas, the first schema change on `main` would have produced exactly this state in older study copies.

Backing the raw record up before replacing it keeps D-008 (visible failure) and the "never silently discard" rule intact while restoring the core promise that manual shopping always works.

### Consequence

- `ShoppingAppState.historyIntegrity` is separate from `persistence`;
- completion reports a `history-read` stage and the application error `history-unreadable`;
- session-only mode is an explicit application state, not a silent fallback; trips finish into an in-memory summary so the shopper can keep shopping;
- every history rewrite re-reads durable history and never writes from a stale in-memory list;
- backups are local, are not read by the product and remain until site data is cleared.

### Revisit when

A real schema migration ships: it should read set-aside backups it understands, and may make a backup's recovery visible in the product.

## D-052 — Each deployed evidence surface keeps its own storage

Date: 2026-09-25

Status: accepted

### Decision

Guarded evidence builds prefix every shopping and evidence storage key with the path they are served from (`surface:<served path>|<key>`). The public app keeps its original unscoped keys.

### Rationale

The public app, the moving `/qa/` and `/beta/` routes and every immutable `/study/<baseline>/` copy share one origin and therefore one `localStorage`. Without scoping, a participant's public-app trips and Price Memory leaked into beta sessions (confounding repeat-trip evidence), and a frozen study copy shared records with newer code on `main`. Study copies are byte-identical to the tested artifact, so the scope must be resolved at runtime from where the copy is served rather than at build time.

### Consequence

- a beta or study session starts from its own empty shopping state;
- moving guarded routes no longer see data written by the public app;
- appearance preference stays shared;
- baselines published before this decision keep their unscoped keys.

### Revisit when

The evidence protocol needs a participant's existing public-app history inside the study; that would require an explicit, consented import rather than shared keys.
