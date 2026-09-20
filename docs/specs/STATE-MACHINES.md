# State Machines

## Status

Target behavioural state specification.

These state machines make transitions explicit so UI logic does not grow into scattered boolean combinations.

## Principle

Canonical trip lifecycle and ephemeral UI/capability state are separate machines.

Do not encode:

- open dialogs
- scanner loading
- animation phases
- toast visibility
- focus state

inside ShoppingTrip.

## 1. Application lifecycle

~~~text
BOOTING
  ├─ valid active trip found ───────────────→ ACTIVE
  ├─ no active trip ───────────────────────→ IDLE
  └─ unrecoverable/malformed active data ─→ RECOVERY
~~~

### IDLE

Meaning:

- no active trip
- user may start one
- completed history may exist

Events:

- START_TRIP(valid) → ACTIVE
- START_TRIP(invalid) → IDLE + validation error
- OPEN_HISTORY → IDLE with history UI state

### ACTIVE

Meaning:

- exactly one active trip
- all shopping mutations operate here

Events:

- ADD_ITEM → ACTIVE
- EDIT_ITEM → ACTIVE
- REMOVE_ITEM → ACTIVE
- UNDO → ACTIVE
- SET_BUDGET → ACTIVE
- SET_BUFFER → ACTIVE
- FINISH_TRIP(success) → COMPLETED_SUMMARY
- FINISH_TRIP(history-write-failure) → ACTIVE + persistence degraded
- STORAGE_WRITE_FAILURE → ACTIVE + persistence degraded

### COMPLETED_SUMMARY

Meaning:

- trip has completed
- no active-trip mutation is permitted

Events:

- SET_ACTUAL_CHECKOUT → COMPLETED_SUMMARY
- START_NEW_TRIP → ACTIVE
- DISMISS_SUMMARY → IDLE
- CONTINUE_SHOPPING → ACTIVE only through the explicitly defined immediate-recovery path

### RECOVERY

Meaning:

Stored active data cannot safely become a valid ShoppingTrip.

Allowed actions:

- discard invalid active record and continue to IDLE
- export/copy raw recovery data if supported
- retry read if failure was capability-related

RECOVERY must never invent prices/budgets from malformed data.

## 2. Persistence health

Persistence health is orthogonal to application lifecycle.

~~~text
HEALTHY
  └─ write/read durability failure → DEGRADED

DEGRADED
  ├─ later successful canonical write → HEALTHY
  └─ continued failure ───────────────→ DEGRADED
~~~

### HEALTHY

Latest canonical state that requires durability is known to have persisted successfully.

### DEGRADED

In-memory state may be newer than durable storage.

Requirements:

- warning visible
- no “saved” claim
- local arithmetic remains usable
- retry on subsequent mutations or explicit Retry action

Do not introduce a global blocking ERROR state for storage failure.

## 3. Add-price interaction

Ephemeral state machine:

~~~text
CLOSED
  └─ OPEN_ADD → EDITING

EDITING
  ├─ valid draft ─────────────→ EDITING_VALID
  ├─ invalid draft ───────────→ EDITING_INVALID
  └─ CANCEL ──────────────────→ CLOSED

EDITING_VALID
  ├─ COMMIT within limits ────→ COMMITTING
  ├─ COMMIT crosses safe ─────→ SAFE_WARNING
  ├─ COMMIT crosses nominal ──→ OVER_WARNING
  ├─ edit draft ──────────────→ EDITING*
  └─ CANCEL ──────────────────→ CLOSED

SAFE_WARNING
  ├─ ADD_ANYWAY ──────────────→ COMMITTING
  └─ CANCEL/EDIT ─────────────→ EDITING_VALID

OVER_WARNING
  ├─ ADD_ANYWAY ──────────────→ COMMITTING
  └─ CANCEL/EDIT ─────────────→ EDITING_VALID

COMMITTING
  ├─ domain valid + save ok ──→ CLOSED
  └─ domain valid + save fail → CLOSED + persistence DEGRADED
~~~

Note:

For localStorage MVP, COMMITTING should be extremely brief and should not require a loading spinner.

## 4. Undo state

~~~text
NO_UNDO
  └─ undoable mutation → UNDO_AVAILABLE

UNDO_AVAILABLE
  ├─ UNDO → NO_UNDO
  ├─ new undoable mutation → UNDO_AVAILABLE (replace snapshot)
  ├─ finish trip → NO_UNDO
  └─ reload → NO_UNDO
~~~

Undo state is intentionally ephemeral.

## 5. Finish-trip orchestration

~~~text
ACTIVE
  └─ FINISH_REQUEST
       ↓
CREATE_COMPLETED_SNAPSHOT
       ↓
WRITE_HISTORY
  ├─ fail → ACTIVE + DEGRADED
  └─ success
       ↓
CLEAR_ACTIVE_STORAGE
  ├─ fail → COMPLETED_SUMMARY + DEGRADED + duplicate-safe recovery required
  └─ success → COMPLETED_SUMMARY
~~~

Important:

A history-write failure must never destroy the active trip.

If history succeeds but active clear fails, duplicated durable state is safer than lost state. Startup reconciliation must prefer preserving information and avoiding duplicate history insertion.

## 6. Immediate continue-shopping recovery

This is intentionally narrow.

From COMPLETED_SUMMARY, before leaving the summary context:

~~~text
COMPLETED_SUMMARY
  └─ CONTINUE_SHOPPING
       ↓
convert completed snapshot back to active
       ↓
persist active
       ↓
remove/reconcile completed history record
       ↓
ACTIVE
~~~

Because this touches two persistence records, implementation must define rollback/reconciliation before shipping.

If that complexity threatens reliability, MVP may instead require starting a new trip and defer Continue shopping. The UI must not promise a reversible finish until the persistence operation is safe.

## 7. Scanner capability state (future)

Scanner state is not canonical.

~~~text
UNAVAILABLE
AVAILABLE_IDLE
  └─ START_SCAN → REQUESTING_PERMISSION / SCANNING

REQUESTING_PERMISSION
  ├─ granted → SCANNING
  └─ denied → FAILED(permission-denied)

SCANNING
  ├─ candidate(s) → REVIEW
  ├─ cancel → AVAILABLE_IDLE
  └─ failure → FAILED

REVIEW
  ├─ confirm candidate → CLOSED / return to add draft
  ├─ edit manually → CLOSED / manual draft
  └─ rescan → SCANNING

FAILED
  ├─ ENTER_MANUALLY → CLOSED / manual draft
  └─ TRY_AGAIN → SCANNING
~~~

No scanner state directly changes ShoppingTrip.

## 8. Barcode lookup state (future)

Detection and lookup are separate.

~~~text
BARCODE_DETECTED
  ↓
LOOKUP_PENDING
  ├─ product found → PRODUCT_KNOWN
  ├─ not found → PRODUCT_UNKNOWN
  └─ service failure → LOOKUP_FAILED
~~~

All three terminal branches offer manual current-price entry.

PRODUCT_KNOWN may additionally surface remembered price data.

## 9. Shelf OCR review state (future)

~~~text
SCAN_PENDING
  ├─ no price → NO_CANDIDATE
  ├─ one candidate → SINGLE_CANDIDATE
  └─ multiple → MULTIPLE_CANDIDATES
~~~

Rules:

- no candidate → manual fallback
- one candidate → still requires confirmation
- multiple → user selects or enters manually
- candidate never commits automatically

## 10. UI sheet/navigation state

Avoid boolean soup such as:

~~~ts
isAddOpen
isEditOpen
isHistoryOpen
isSettingsOpen
~~~

Prefer one discriminated state:

~~~ts
type OverlayState =
  | { kind: 'none' }
  | { kind: 'add-price' }
  | { kind: 'edit-item'; itemId: ItemId }
  | { kind: 'history' }
  | { kind: 'settings' }
  | { kind: 'persistence-help' }
~~~

This prevents impossible combinations.

## 11. App startup reconciliation

Startup sequence:

1. read active-trip envelope
2. read history envelope
3. validate versions
4. validate domain data
5. reconcile obvious duplicate-completion edge case if the exact same trip id is both active and completed
6. derive application lifecycle state
7. render

Reconciliation rule for duplicate id:

- if active record exists and same id is in completed history due an interrupted completion transaction, preserve both raw records until deterministic rule resolves them
- do not silently delete either based only on timestamp guesswork

A specific deterministic reconciliation algorithm must be defined before completion transaction ships.

## 12. Forbidden states

Implementation should make these impossible or immediately reject them:

- active trip with completedAt
- completed trip without completedAt
- zero-quantity cart item
- buffer > budget
- scanner candidate stored as cart item before confirmation
- two simultaneously open primary sheets
- persistence status “healthy” after a failed latest write
- canonical item with unsupported currency-specific interpretation
- completed trip mutated through active-trip commands

## State-machine readiness score

**97/100**

Remaining uncertainty:

- exact safe rollback/reconciliation for Continue shopping after completion
- exact duplicate active/history recovery algorithm after partial completion transaction

Those should be solved before implementing trip completion persistence.
