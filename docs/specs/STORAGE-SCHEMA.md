# Storage Schema Specification

## Status

The active-trip v1 portion of this localStorage schema is implemented in Phase 3.

Implemented now:

- `budget-cart:active-trip`
- common v1 envelope for active-trip snapshots
- strict Zod DTO validation
- domain reconstruction
- malformed/future-version recovery outcomes
- safe legacy Pulse-key retirement after successful shopping bootstrap

Implemented beyond the original Phase 3 baseline:

- completed-trip history
- loss-safe completion transaction/reconciliation
- independent Phase 8 price-memory record

Still target-only in this document:

- settings
- optional meta record

This document continues to define those later persistence slices before they are implemented.

## Goals

- versioned and inspectable
- no derived financial totals as authority
- safe migration
- deterministic validation
- loss-avoiding completion flow
- no reinterpretation of Pulse Counter data
- room for future price memory without polluting MVP records

## Namespace

Recommended keys:

~~~text
budget-cart:active-trip
budget-cart:history
budget-cart:settings
budget-cart:meta
~~~

Implemented Phase 8:

~~~text
budget-cart:price-memory
~~~

Do not reuse:

~~~text
pulse-counter:state
counter
~~~

## Common envelope

Every stored logical record uses an envelope.

~~~ts
interface StorageEnvelope<T> {
  schemaVersion: number
  savedAt: string
  data: T
}
~~~

Rules:

- schemaVersion is integer >= 1
- savedAt is diagnostic metadata only
- domain validation applies to data
- derived totals are recalculated after load

## Active-trip schema v1

Key:

~~~text
budget-cart:active-trip
~~~

Stored only when an active trip exists.

~~~json
{
  "schemaVersion": 1,
  "savedAt": "2026-09-21T12:00:00.000Z",
  "data": {
    "id": "trip-uuid",
    "status": "active",
    "currency": "EUR",
    "budgetMinor": 5000,
    "safetyBufferMinor": 200,
    "startedAt": "2026-09-21T11:30:00.000Z",
    "items": [
      {
        "id": "item-uuid",
        "unitPriceMinor": 379,
        "quantity": 1,
        "priceSource": {
          "kind": "manual"
        },
        "priceConfidence": {
          "kind": "confirmed",
          "confirmedAt": "2026-09-21T11:35:00.000Z"
        },
        "createdAt": "2026-09-21T11:35:00.000Z",
        "updatedAt": "2026-09-21T11:35:00.000Z"
      }
    ]
  }
}
~~~

Must not contain:

- cartTotal
- remaining
- safeRemaining
- overBudget
- progress

## History schema v1

Key:

~~~text
budget-cart:history
~~~

Use one snapshot list for MVP.

~~~json
{
  "schemaVersion": 1,
  "savedAt": "2026-09-21T12:30:00.000Z",
  "data": {
    "trips": [
      {
        "id": "trip-uuid",
        "status": "completed",
        "currency": "EUR",
        "budgetMinor": 5000,
        "safetyBufferMinor": 200,
        "startedAt": "2026-09-21T11:30:00.000Z",
        "completedAt": "2026-09-21T12:20:00.000Z",
        "actualCheckoutMinor": 4672,
        "items": []
      }
    ]
  }
}
~~~

History may retain full item lists.

Do not optimise into summary-only records until there is evidence storage size matters.

## Price-memory schema v1

Key:

~~~text
budget-cart:price-memory
~~~

Price Memory is a separate advisory snapshot:

~~~json
{
  "schemaVersion": 1,
  "savedAt": "2026-09-22T08:00:00.000Z",
  "data": {
    "records": [
      {
        "id": "memory:label%3Amilk%201l:*",
        "productId": "label:milk 1l",
        "label": "Milk 1L",
        "currency": "EUR",
        "unitPriceMinor": 139,
        "observedAt": "2026-09-20T08:00:00.000Z",
        "source": {
          "kind": "manual"
        }
      }
    ]
  }
}
~~~

Rules:

- one deterministic memory id represents one product/store context
- product identity is validated independently from display label
- `observedAt` is authoritative freshness context; storage `savedAt` is not
- malformed individual records are quarantined while valid records remain readable
- unsupported future versions are preserved and never overwritten
- duplicate deterministic ids are treated as integrity conflicts
- write failure is advisory and must not affect active-trip persistence health
- only safe transient write failure may be retried without first replacing unknown/corrupt raw data

## Settings schema v1

Key:

~~~text
budget-cart:settings
~~~

~~~json
{
  "schemaVersion": 1,
  "savedAt": "2026-09-21T12:30:00.000Z",
  "data": {
    "preferredCurrency": "EUR",
    "defaultSafetyBufferMinor": 0,
    "autoCents": false,
    "appearance": "system",
    "haptics": true
  }
}
~~~

Rules:

- settings cannot be required to decode historical trip money
- unsupported preference values fall back safely
- core trip restore must not fail because settings are malformed

## Meta schema v1

Key:

~~~text
budget-cart:meta
~~~

Optional but useful for migrations.

~~~json
{
  "schemaVersion": 1,
  "savedAt": "2026-09-21T12:30:00.000Z",
  "data": {
    "productStorageGeneration": 1,
    "legacyPulseKeysRetired": true
  }
}
~~~

Do not use meta as a second source of truth for trip data.

## Validation order

For each record:

1. storage getItem
2. if null, return empty/default state
3. JSON.parse
4. validate envelope object
5. validate schemaVersion
6. reject unsupported future version
7. run schema-level validation
8. run domain-level validation
9. convert validated numbers/strings into branded runtime types
10. derive totals fresh

Never brand first and validate later.

## Active-trip validation

Required:

- id non-empty
- status === active
- supported currency
- budgetMinor safe integer > 0 and <= 99_999_999
- buffer safe integer >= 0 and <= budget
- startedAt valid timestamp
- items is array

Each item:

- unique id
- unitPriceMinor safe integer > 0 and <= 99_999_999
- quantity safe integer from 1 through 999
- valid priceSource
- valid priceConfidence
- valid createdAt/updatedAt

Reject the entire active snapshot if required financial invariants are broken.

Do not partially remove “bad” items and continue without explicit recovery design.

## History validation

A malformed individual history entry should not automatically destroy all valid history.

Recommended recovery:

- validate each completed trip
- quarantine invalid entries in-memory for possible export/debug
- load valid entries
- surface non-blocking history-recovery warning if user-facing recovery is implemented

Active-trip reliability takes priority over perfect history recovery.

## Completion transaction

localStorage has no multi-key transaction.

Preferred sequence:

1. compute CompletedTrip in memory
2. load/validate history
3. append completed trip by unique trip id
4. write history envelope
5. only after history write success, remove active-trip key
6. update in-memory lifecycle to completed-summary

If step 4 fails:

- leave active key unchanged
- keep UI in active state
- persistence = degraded

If step 5 fails:

- history already contains completed trip
- active key still exists
- mark persistence degraded
- startup reconciliation must detect duplicate trip id

## Duplicate completion reconciliation

Deterministic rule proposal:

If the same trip id appears:

- once as active storage
- once as completed history

and completed history has completedAt:

Treat the completed history record as completion evidence.

Recovery flow:

1. do not append a second history copy
2. attempt to clear stale active key
3. if clear succeeds → normal completed/no-active state
4. if clear fails → preserve warning/degraded status
5. never convert completed record back to active automatically

This handles interruption after history write but before active clear.

Immediate Continue shopping is a separate explicit operation and must not rely on startup guessing.

## Idempotent history append

History save helper must not append duplicate trip ids.

Conceptually:

~~~ts
function upsertCompletedTrip(
  history: CompletedTrip[],
  trip: CompletedTrip,
): CompletedTrip[]
~~~

For normal completion, same id should replace an identical/interrupted record rather than duplicate it.

Unexpected conflicting completed records with same id should be treated as data-integrity error, not merged silently.

## Undo persistence

Undo metadata is not stored.

The result of an undo command is canonical and must be persisted like any other active-trip mutation.

After reload:

- restored cart reflects the undo result
- Undo button may be unavailable

## Legacy Pulse Counter policy

Keys:

~~~text
pulse-counter:state
counter
~~~

Rules:

- never parse count into budget
- never create a cart item from count
- first shopping-version startup may mark legacy keys as retired
- removal should happen only after new schema startup succeeds safely
- tests cover both keys

Conservative option:

Leave legacy keys untouched for one release and simply ignore them.

This is safer than destructive cleanup during the same migration that introduces new shopping state.

## Schema migration contract

Each version needs:

~~~ts
interface Migration<From, To> {
  from: number
  to: number
  migrate(data: From): Result<To, MigrationError>
}
~~~

Rules:

- migrate one version at a time
- no skipped implicit migrations
- migration never reads React state
- migration never contacts network
- migration is deterministic
- migrated result passes current domain validation before save

## Future version handling

If schemaVersion > CURRENT_SCHEMA_VERSION:

- do not overwrite
- do not clear
- return unsupported-version error
- show recovery/update guidance where appropriate

This protects against an older cached PWA build.

## Write semantics

Use complete envelope replacement.

For MVP:

~~~ts
localStorage.setItem(key, JSON.stringify(envelope))
~~~

A successful return means the browser accepted the write.

Do not expose “saved” UI if setItem threw.

## Parse/serialisation constraints

- JSON only
- no Date objects in storage
- timestamps are ISO strings
- no bigint unless storage design is revised
- no Map/Set
- no functions
- no derived selector cache

## Size strategy

MVP expected size is small.

Do not prematurely:

- compress
- shard every trip into separate keys
- move to IndexedDB
- introduce database libraries

Revisit when actual measured history/price-memory volume justifies it.

## Data deletion

### Delete one completed trip

- remove by trip id
- save full updated history snapshot
- report persistence failure if write fails

### Clear history

- requires explicit destructive confirmation in UI
- active trip remains untouched

### Reset app data

If introduced later, exact scope must be stated:

- active trip?
- history?
- settings?
- price memory?

No ambiguous “Reset” button.

## Storage schema test fixtures

Required fixture classes:

- fresh/no data
- valid active v1
- valid history v1
- malformed JSON
- missing data field
- unsupported future version
- invalid budget
- budget above product maximum
- buffer > budget
- zero item price
- item price above product maximum
- zero quantity
- quantity above 999
- duplicate item ids
- malformed price provenance
- legacy Pulse state only
- active + same completed id duplicate
- write failure

## Schema readiness score

**Active-trip v1 implementation: 100/100 against the Phase 3 scope.**

Full persistence design remains **98/100** because later history/completion concerns still need implementation evidence.

Remaining later-phase decisions:

- whether meta key is worth keeping in MVP
- exact history quarantine UX for partially invalid old history
- duplicate active/history reconciliation when completion persistence ships

The supported MVP currency is already locked to EUR.
