# State Machines

## Status

**IMPLEMENTED current behavioural contract.**

This file defines current application/persistence/interaction transitions. Planned scanner/OCR/PWA capability states are kept out of the current contract until they ship.

## Principle

Canonical shopping lifecycle and ephemeral UI state are separate.

Do not encode dialogs, focus, animation or optional capability loading inside ShoppingTrip.

## Application lifecycle

```text
BOOTING
  ├─ valid active trip ───────────────→ ACTIVE
  ├─ no active trip ─────────────────→ IDLE
  └─ unsafe persisted active state ──→ RECOVERY
```

### IDLE

Meaning:

- no active trip;
- history/Price Memory may exist.

Transitions:

- START_TRIP(valid) → ACTIVE;
- START_TRIP(invalid) → IDLE + validation error;
- SHOP_AGAIN(valid completed source + safe persistence) → ACTIVE with a fresh empty trip;
- OPEN_HISTORY → IDLE + history overlay state.

### ACTIVE

Meaning:

- exactly one active trip;
- active-trip mutations are allowed.

Transitions:

- ADD_ITEM / EDIT_ITEM / REMOVE_ITEM / UNDO → ACTIVE;
- SET_BUDGET / SET_BUFFER → ACTIVE;
- FINISH_TRIP(success) → COMPLETED_SUMMARY;
- FINISH_TRIP(history-write failure) → ACTIVE + persistence DEGRADED;
- FINISH_TRIP(stored history unreadable) → ACTIVE + history integrity DEGRADED; nothing is written and the active trip stays durable;
- active-state write failure → ACTIVE + persistence DEGRADED.

### COMPLETED_SUMMARY

Meaning:

- current trip is completed;
- active-trip mutations are not allowed.

Transitions:

- SET_ACTUAL_CHECKOUT → COMPLETED_SUMMARY;
- SHOP_AGAIN(valid completed source) → ACTIVE with a new trip id and empty cart;
- DISMISS_SUMMARY → IDLE.

Reopening the same completed trip is **PLANNED / GATED** and is not a current transition.

### RECOVERY

Meaning:

Persisted active data cannot safely become a valid ShoppingTrip: the active record is unreadable, or browser storage cannot be read at all.

Only the active record enters RECOVERY. Damaged history, a failed stale-copy cleanup and failed legacy-key retirement degrade instead.

Allowed behaviour:

- RETRY_READ → re-run bootstrap;
- SET_ASIDE_ACTIVE (unreadable record with raw material only) → back up the exact raw record, remove it, re-run bootstrap;
- CONTINUE_WITHOUT_SAVING → IDLE with persistence and Price Memory DEGRADED(`session-only`): every write is refused for the rest of the session, so unreadable stored data is never overwritten. Trips still finish into an in-memory summary, the summary can be dismissed and Shop again works; nothing survives a reload, which returns to RECOVERY;
- preserve raw recovery material where the persistence contract requires it.

RECOVERY never invents prices/budgets from malformed data.

## Persistence health

Persistence health is orthogonal to lifecycle.

```text
HEALTHY
  └─ required durability failure → DEGRADED

DEGRADED
  ├─ successful canonical retry/write → HEALTHY
  └─ continued failure ──────────────→ DEGRADED
```

### HEALTHY

Latest required durable state is known to be persisted.

### DEGRADED

In-memory state may be newer than durable storage, or cleanup/recovery requires attention.

Requirements:

- visible warning;
- no false “saved” claim;
- arithmetic/UI can remain usable where safe;
- retry/recovery remains explicit.

Do not create a generic blocking ERROR lifecycle for ordinary storage failure.

## History integrity

History integrity is orthogonal to lifecycle and to write health.

```text
READABLE
  └─ stored history unreadable (bootstrap, finish attempt) → DAMAGED

DAMAGED
  ├─ SET_ASIDE_HISTORY (backup, keep readable trips) → READABLE
  ├─ RETRY_HISTORY_READ succeeds (read failures only) → READABLE
  └─ otherwise ──────────────────────────────────────→ DAMAGED
```

While DAMAGED:

- starting, tracking and correcting trips work;
- readable completed trips stay visible and can seed Shop again;
- finishing, deleting a trip and clearing history are refused, because each would overwrite the unreadable record;
- a successful active-trip write never hides the history warning;
- the shown trips are exactly those a set-aside would keep;
- if history becomes unreadable while a finished-trip summary is open, the summary can still be closed; repair is offered once it is.

Deleting a trip or clearing history always re-reads durable history first and never writes from a stale in-memory list, so trips this session never loaded cannot be dropped. After a successful re-read, an open copy of a trip that history already holds is reconciled exactly as at startup.

## Add-price interaction

Ephemeral UI state:

```text
CLOSED
  └─ OPEN_ADD → EDITING

EDITING
  ├─ valid draft ─────────────→ VALID
  ├─ invalid/incomplete ──────→ EDITING
  └─ CANCEL ──────────────────→ CLOSED

VALID
  ├─ COMMIT within nominal budget ─→ COMMITTING
  ├─ COMMIT over nominal budget ───→ OVER_WARNING
  ├─ edit draft ───────────────────→ EDITING
  └─ CANCEL ───────────────────────→ CLOSED

OVER_WARNING
  ├─ ADD_ANYWAY → COMMITTING
  └─ CANCEL/EDIT → EDITING

COMMITTING
  ├─ application command accepted → CLOSED
  └─ rejected/failure → remain/recover according to application result
```

Crossing only the safety buffer is informational, not a second confirmation step.

Projection never mutates canonical trip state.

## Undo

```text
NO_UNDO
  └─ undoable mutation → UNDO_AVAILABLE

UNDO_AVAILABLE
  ├─ UNDO → NO_UNDO
  ├─ new undoable mutation → UNDO_AVAILABLE (replace snapshot)
  ├─ finish trip → NO_UNDO
  └─ reload → NO_UNDO
```

Undo is intentionally bounded/ephemeral.

## Finish-trip orchestration

```text
ACTIVE
  └─ FINISH_REQUEST
       ↓
CREATE_COMPLETED_DOMAIN_STATE
       ↓
WRITE_HISTORY
  ├─ fail → ACTIVE + DEGRADED
  └─ success
       ↓
CLEAR_ACTIVE_STORAGE
  ├─ fail → COMPLETED_SUMMARY + DEGRADED + cleanup pending
  └─ success → COMPLETED_SUMMARY
```

Invariant:

> durable history before active cleanup

A history-write failure must not destroy the active trip.

If history succeeds and active cleanup fails, duplicated durable state is safer than lost state.

## Shop again

Shop again is not historical reopen.

```text
IDLE or COMPLETED_SUMMARY
  └─ SHOP_AGAIN(completedTripId)
       ↓
validate completed source
       ↓
copy budget + safety buffer
       ↓
new trip id + start time
       ↓
persist fresh empty ACTIVE trip
       ↓
ACTIVE
```

Reject the transition when persistence/recovery state makes the source unsafe.

The completed history record remains unchanged.

## Checkout reconciliation

From COMPLETED_SUMMARY:

```text
SET_ACTUAL_CHECKOUT
  ↓
validate completed trip transition
  ↓
persist matching completed history entry
  ↓
COMPLETED_SUMMARY
```

This changes optional checkout reconciliation only; item prices remain historical observations.

## History / local-data state

History UI is ephemeral presentation state over canonical completed history.

Deleting one/all completed trips:

- requires safe application state;
- persists the new history snapshot;
- does not implicitly clear Price Memory.

Clearing Price Memory:

- is independent;
- does not mutate completed history.

## Overlay state

Avoid multiple unrelated booleans for mutually exclusive primary surfaces.

Prefer one discriminated UI state, conceptually:

```ts
type OverlayState =
  | { kind: "none" }
  | { kind: "add-price" }
  | { kind: "edit-item"; itemId: ItemId }
  | { kind: "budget-settings" }
  | { kind: "finish-trip" }
  | { kind: "history" }
```

Overlay state is UI state, not ShoppingTrip lifecycle.

## Startup reconciliation

Startup:

1. restore active-trip state;
2. restore history;
3. validate envelopes/data/domain invariants;
4. detect stale active copy of an already completed trip;
5. reconcile safely;
6. derive application lifecycle;
7. render.

If the same valid trip id exists in completed history and as stale active state:

- completed history is durability authority;
- attempt to clear stale active storage;
- do not duplicate history;
- if clear fails, expose cleanup-pending/degraded state.

Conflicting history is not guessed into one record.

Malformed/unsupported history is not used as permission to delete active data.

## Forbidden states

Implementation should reject/prevent:

- active trip with completedAt;
- completed trip without completedAt;
- zero/invalid quantity;
- safety buffer > budget;
- two primary overlays open simultaneously;
- persistence marked healthy after the latest required write failed;
- completed trip mutated with active-trip commands;
- remembered/candidate price silently represented as confirmed current price;
- completed history cleared as a side effect of Price Memory deletion.

## Planned transitions

Not current behaviour:

- reopen/continue the same completed trip;
- scanner lifecycle;
- barcode provider lookup lifecycle;
- shelf-OCR candidate review;
- PWA update/install lifecycle;
- cloud/multi-device conflict resolution.

Define and test these only when the roadmap approves the capability.

## Review checklist

- Is this state canonical product state or ephemeral UI state?
- Can two lifecycle states accidentally be true at once?
- Can a failure path misrepresent durability?
- Is completion still history-first?
- Did a planned capability leak into current lifecycle?
- Did UI state enter the domain model unnecessarily?
