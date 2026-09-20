# Data and Persistence Contract

## Purpose

This document defines how local shopping data is stored, restored, migrated, and reported as healthy or degraded.

The product is local-first. Persistence is therefore part of the core user experience, not an implementation detail.

## Status

Phase 3 implements the shopping active-trip persistence boundary:

- `budget-cart:active-trip` schema version 1
- strict Zod 4 validation of untrusted persisted DTOs
- validated DTO → Phase 2 domain reconstruction
- complete active-trip snapshot writes
- explicit `healthy` / `degraded` outcomes
- malformed and unsupported-future data preservation for recovery
- explicit safe retirement of `pulse-counter:state` and `counter` only after shopping-state bootstrap succeeds

The current Pulse Counter UI is intentionally not wired to the new adapter yet; that user-facing migration belongs to the core shopping UI/application phase.

History, settings, completion transactions, and price-memory persistence remain later slices.

The old numeric counter value is never interpreted as money.

## Persistence goals

The persistence layer must provide:

- immediate recovery after reload
- versioned schema
- deterministic validation/migration
- explicit failure reporting
- no false “saved” state
- offline operation
- simple inspectable data

## Storage technology decision

### MVP

Use localStorage for small structured shopping data.

Why:

- active cart data is small
- writes are simple
- synchronous restore is easy
- migrations are inspectable
- current project already has tested storage-adapter patterns

### Upgrade trigger for IndexedDB

Move selected data to IndexedDB only when requirements justify it, for example:

- receipt or product images
- large price-history datasets
- large OCR metadata
- large offline catalogues

Do not migrate storage merely because IndexedDB sounds more advanced.

## Storage boundaries

Only the persistence adapter may read/write browser storage.

React components and pure domain modules must not access localStorage directly.

Recommended logical records:

- active trip
- completed-trip history
- user settings
- price memory

Exact physical keys may evolve, but critical records must remain independently recoverable and versioned.

## Suggested keys

Names are provisional until implementation, but a consistent namespace is required.

Suggested:

- budget-cart:active-trip
- budget-cart:history
- budget-cart:settings
- budget-cart:price-memory

Every stored document carries its own schema version.

## Snapshot envelope

Every persisted document should have an explicit envelope conceptually equivalent to:

~~~text
{
  version: 1,
  data: ...
}
~~~

Optional metadata such as savedAt may be included if it has a real diagnostic or UX use.

Do not make timestamps authoritative for money calculations.

## Active-trip durability

The active trip is the highest-priority record.

Every committed mutation should trigger persistence promptly:

- add item
- remove item
- edit item
- change quantity
- change budget
- change safety buffer
- undo

A mutation is considered durable only after the persistence adapter reports success.

The UI may update optimistically, but it must know when durability failed.

## Persistence health

Application state should distinguish at least:

- healthy
- degraded

Potential future states:

- unavailable
- recovering

### Healthy

Latest committed canonical state was stored successfully.

### Degraded

Current in-memory state is valid, but the latest persistence attempt failed.

User-facing behaviour:

- continue calculations
- show clear warning
- do not show a “saved” indicator
- keep retry/recovery path available

## Failure message

Persistence failure is a serious state.

Recommended tone:

> This trip cannot be saved right now. Keep this page open until checkout.

No humour.

If available, offer:

- retry
- copy summary
- export

## Write strategy

Prefer writing complete validated snapshots for each logical record rather than patching nested storage values.

Advantages:

- simpler migrations
- easier corruption handling
- fewer partial-shape states

For active trip, one complete snapshot per committed mutation is acceptable at expected data sizes.

## Completion transaction strategy

Completing a trip touches active state and history.

localStorage does not provide a multi-key transaction.

Therefore use a loss-avoiding sequence:

1. validate completed trip
2. write completed history record/snapshot
3. verify write success through adapter result
4. clear/replace active-trip record

If step 2 fails, keep the active trip intact.

Prefer temporary duplication over data loss.

## Canonical storage

Persist canonical inputs only.

Persist:

- budget
- safety buffer
- cart items
- item unit prices
- quantities
- price origins
- trip currency
- lifecycle timestamps
- optional store
- optional checkout total

Do not persist as authoritative:

- cart total
- remaining
- safe remaining
- progress percentage
- over-budget flag

Those values are derived after restore.

## Validation on read

Never trust stored JSON merely because this application wrote it previously.

Restore pipeline:

1. read raw value
2. parse JSON safely
3. validate envelope/version
4. validate required domain fields
5. migrate supported old version if necessary
6. rebuild domain state
7. derive totals fresh

If validation fails, do not partially guess values into existence.

## Schema migrations

Migrations must be:

- explicit
- one-directional
- deterministic
- tested with fixtures

Example conceptual flow:

~~~text
v1 → v2 → current
~~~

Do not maintain arbitrary backward-write compatibility.

## Unsupported future versions

If stored version is newer than the running application understands:

- do not downgrade/overwrite it
- do not guess the schema
- surface a safe recovery state

This protects data if a user opens an older cached application build.

## Legacy Pulse Counter migration

Old keys:

- pulse-counter:state
- counter

Policy:

- do not transform count into money
- do not create a shopping trip from old count
- after shopping migration is safely established, legacy keys may be removed intentionally
- migration/removal must be tested

The old counter and new shopping data represent different domains.

## Malformed data

Malformed active-trip data must not crash application startup.

Recovery hierarchy:

1. preserve raw data where practical for diagnostics/export
2. refuse to treat invalid data as a valid cart
3. offer fresh-trip recovery

Never silently reinterpret malformed cents, quantities, or currency.

## Price-memory persistence

Price memory is advisory and independent from active-trip durability.

A record may include:

- product identity
- store identity
- currency
- price in minor units
- observedAt
- source

If price-memory persistence fails, the active cart must remain usable.

## Price-memory freshness

Persistence must retain observation time.

Freshness is a presentation/domain input, not inferred from write order alone.

A remembered price without a trustworthy observed date should be treated conservatively.

## History retention

MVP can retain a bounded or simple list of completed trips.

Before unbounded history growth, define:

- retention expectations
- size limits
- export/delete UX

Do not silently delete history merely to stay under storage limits.

## Settings persistence

Suitable local settings include:

- preferred currency
- preferred quick budgets
- auto-cents preference
- default safety buffer
- appearance preferences
- optional last-used store

Settings must not be required to decode canonical historical money data.

## Privacy

Local-first means shopping data stays on device by default.

Do not add telemetry containing:

- full item lists
- prices
- budget values
- store shopping history

without an explicit documented reason and privacy review.

## Export / backup

Export is P1 rather than required for the first cart implementation, but the schema should make export straightforward.

Export should use a documented, portable representation.

Do not expose internal implementation-only fields unless needed for round-trip restore.

## Service worker boundary

Service-worker caches are for application assets, not canonical shopping data.

Never use cache storage as the source of truth for active trips.

## Multiple tabs

MVP may initially support last-writer-wins local persistence, but cross-tab behaviour must be tested if multiple tabs can edit the same active trip.

Before adding BroadcastChannel or locking machinery, confirm the real user need.

A future cross-tab feature should detect conflicting active edits rather than silently merging money state.

## Storage quota

Expected MVP data is small.

Nevertheless tests should simulate setItem failure because:

- private/restricted environments can block storage
- quota may be exhausted by unrelated origin data
- browser behaviour can vary

The application contract is based on explicit failure handling, not an assumption that writes always succeed.

## Persistence test matrix

Required cases:

### Fresh start

- no keys
- creates no fake historical trip

### Normal restore

- active trip restores exactly
- derived totals recompute correctly

### Reload after mutation

- add survives
- edit survives
- remove survives
- undo survives

### Legacy data

- old Pulse state present
- no conversion to money

### Malformed JSON

- startup survives
- invalid data not accepted as cart

### Invalid business values

- negative quantity rejected
- invalid currency rejected
- non-safe-integer money rejected

### Write failure

- in-memory state correct — implemented and tested
- persistence health degraded — implemented and tested
- UI warned — pending shopping UI/application wiring

### Completion failure

- failed history write does not delete active trip — reserved for the checkout/history persistence phase

### Future version

- data not overwritten by older schema handler

## Migration discipline

Every schema change should include in one logical PR:

- schema/type change
- migration
- migration fixture/tests
- persistence docs update
- recovery behaviour review

Do not merge a schema change without its migration story.

## Persistence review checklist

1. What is canonical?
2. Which key owns it?
3. Is this write required for active-trip durability?
4. What happens if the write throws?
5. What happens after reload?
6. Can an older schema migrate deterministically?
7. Could an old app overwrite a future version?
8. Are derived totals being duplicated unnecessarily?
9. Is any scanner/network state accidentally becoming canonical?
10. Is user-facing save status truthful?
