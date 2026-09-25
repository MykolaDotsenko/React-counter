# Storage Schema Specification

## Status

**IMPLEMENTED** localStorage contracts:

- active trip;
- completed history;
- Price Memory;
- versioned envelopes;
- strict runtime validation;
- domain reconstruction;
- malformed/future-version handling;
- historical non-shopping key retirement;
- loss-safe completion and startup reconciliation.

Settings/meta records are not current product state and are not defined here until a real requirement exists.

## Goals

- versioned and inspectable;
- canonical inputs only;
- deterministic validation;
- safe migration;
- loss-avoiding completion;
- no reinterpretation of historical non-shopping data;
- independent advisory Price Memory.

## Keys

```text
budget-cart:active-trip
budget-cart:history
budget-cart:price-memory
```

Historical counter keys must never be interpreted as shopping money.

### Deployed-surface scope

Every surface of this repository is served from one GitHub Pages origin, so they all share one `localStorage`. The public app uses the keys above unchanged. Guarded evidence builds (QA timing, retention beta, benchmarks) prefix every shopping and evidence key with the path they are served from:

```text
surface:<served path>|<key>
surface:/shopping-budget-companion/beta/|budget-cart:active-trip
surface:/shopping-budget-companion/study/<baseline>/beta/|budget-cart:qa:retention-v1
```

The scope is resolved at runtime from the relocatable base, so a copied immutable study baseline, the moving guarded route and the public app never read, overwrite or clear each other's records. The same scope applies to the tab-scoped QA timing evidence in `sessionStorage`. Appearance preference (`shopping-budget:appearance`) stays shared on purpose; it is convenience state. Study baselines published before scoping shipped keep the unscoped keys they were built with.

## Common envelope

Logical records use a versioned envelope:

```ts
interface StorageEnvelope<T> {
  schemaVersion: number
  savedAt: string
  data: T
}
```

Rules:

- schemaVersion is integer >= 1;
- savedAt is diagnostic metadata;
- runtime schema validation happens before domain reconstruction;
- domain validation still applies after DTO validation;
- derived totals are never storage authority.

## Active-trip v1

Key:

```text
budget-cart:active-trip
```

Stored only when an active trip exists.

Canonical content includes:

- trip id/status/currency;
- budget and safety buffer;
- startedAt;
- item ids/prices/quantities;
- optional labels;
- price source/confidence;
- item timestamps;
- supported identity/store context where schema permits it.

Must not contain derived authority such as:

- cartTotal;
- remaining;
- safeRemaining;
- progress;
- overBudget.

## History v1

Key:

```text
budget-cart:history
```

Stores completed-trip snapshots in a versioned envelope.

Each completed entry preserves canonical trip/item data plus:

- completedAt;
- optional actualCheckoutMinor.

Requirements:

- trip ids are unique;
- conflicting duplicate ids degrade rather than silently replace;
- invalid entries do not become domain objects;
- completion append is idempotent for the same shopping (trip identity, plan and cart lines; completion time and checkout total aside), and the recorded entry is kept;
- completion append of different shopping under a recorded id reports a history conflict and writes nothing; the application then records the trip under a new id.

## Price Memory v1

Key:

```text
budget-cart:price-memory
```

Independent from active/history persistence.

Records contain only fields required by the Price Memory domain contract, such as:

- memory id;
- normalized identity/label context;
- remembered minor-unit value;
- provenance/currentness metadata;
- observation timestamps;
- optional store context supported by the schema.

Price Memory is advisory.

A Price Memory write failure must not invalidate completed-trip durability.

## Validation order

For persisted input:

1. read raw string;
2. parse JSON;
3. validate envelope header/version;
4. validate DTO schema;
5. reconstruct through domain validators/constructors;
6. reject or recover on invariant failure.

Never cast untrusted JSON directly into branded domain types.

## Unsupported future versions

If an older build sees a newer unsupported schema:

- do not guess compatibility;
- do not overwrite the raw value;
- surface degraded/recovery semantics according to the persistence contract.

## Malformed data

Malformed/invalid raw active-trip data must not be silently replaced during bootstrap.

History may preserve valid entries while reporting invalid-entry degradation only where the contract explicitly allows that partial result.

## Set-aside backups

An unreadable record (malformed JSON, invalid envelope/data, unsupported version, invalid or conflicting history entries) leaves its canonical key only through an explicit user action. Before the canonical key is replaced or removed, the exact raw string is copied to a new backup key and read back:

```text
budget-cart:set-aside:<source>:<setAsideAt>[:<n>]
```

- `<source>` is `active-trip` or `history`;
- `<setAsideAt>` is the canonical ISO timestamp of the action;
- `:<n>` is appended when a backup with the same timestamp already exists, so an earlier backup is never overwritten.

Backup value:

```json
{
  "schemaVersion": 1,
  "setAsideAt": "2026-09-22T10:00:00.000Z",
  "sourceKey": "budget-cart:history",
  "reason": "invalid-history-entry",
  "raw": "<exact original string>"
}
```

If the backup cannot be written and read back, nothing else changes. A readable record is never set aside. Setting history aside rewrites it with exactly the readable trips the app already showed (none when the record could not be parsed). Backups are not read by the product; they remain on the device until site data is cleared.

## Write semantics

### Active trip

Committed mutations attempt immediate snapshot persistence.

A failed write produces degraded health while keeping the in-memory result explicit.

### Completion

Order is mandatory:

1. restore/validate history;
2. append completed trip safely;
3. write durable history;
4. only then clear active trip.

If history write fails:

- active trip remains;
- completion is not represented as safely finished.

If history succeeds but active clear fails:

- completion is durable;
- cleanup pending/degraded is exposed;
- startup reconciliation handles stale active copy.

### Completed update

Checkout reconciliation updates the matching completed trip.

Missing/conflicting history entry degrades rather than inventing a new relationship.

## Startup reconciliation

If the active trip is the same shopping as a durable completed history entry (same id, plan and cart lines):

- treat history as completion authority;
- attempt to clear stale active snapshot;
- never duplicate the completed trip;
- expose cleanup failure if clear fails.

An active trip that only shares the id is kept open; it was edited after that completion was recorded.

## Historical non-shopping keys

Historical counter data:

- is never interpreted as money;
- is retired only after shopping bootstrap is safe enough to do so;
- removal failure becomes explicit degradation where applicable.

## Migration discipline

A real schema version change requires in one coherent change:

- schema/type update;
- migration/compatibility logic;
- reconstruction rules;
- tests for old/current/future versions;
- documentation update.

Do not bump versions for code-only refactors.

## Data deletion

History deletion and Price Memory deletion are independent user actions.

Deletion must not silently affect the other subsystem.

Active-trip deletion/reset behaviour must remain explicit and safe.

## Privacy

Shopping state remains local in the current product.

Storage schemas must not grow analytics/evidence fields.

QA/retention evidence uses separate keys/contracts.

## Multiple tabs

No silent merge of concurrent financial edits.

If cross-tab editing becomes a real feature, define conflict semantics before adding synchronization.

## Storage quota

Current records are small enough for localStorage.

IndexedDB requires a demonstrated size/query/concurrency need, not architectural preference.

## Required tests

Cover:

- fresh start;
- valid restore;
- reload after mutation;
- malformed JSON;
- invalid DTO/business value;
- unsupported future version;
- storage unavailable;
- read/write/remove failure;
- history conflicts;
- idempotent completion;
- history-write failure;
- active-clear failure after durable completion;
- startup reconciliation;
- legacy retirement;
- Price Memory independence.

## Review checklist

- Is only canonical state persisted?
- Can an old build overwrite a future schema?
- Can completion lose the trip?
- Can invalid JSON become branded domain data?
- Is convenience state isolated from core durability?
- Are migration and tests included with a schema change?
- Did a speculative settings/meta record get added without a product need?
