# Domain and Adapter Contracts

## Status

Target technical contract for the shopping-budget implementation.

This document defines stable boundaries. Exact file names may change, but implementations should preserve the semantics unless an architecture decision supersedes them.

## Contract principles

- expected business failures are data, not exceptions
- domain logic is pure
- browser capabilities enter through adapters
- ids and time are supplied from boundaries for deterministic tests
- money parsing/formatting is separate from money arithmetic
- canonical shopping state never contains unresolved scanner candidates
- source and confidence of price are separate concepts

## Core utility types

Recommended shape:

~~~ts
type Brand<T, B extends string> = T & { readonly __brand: B }

type MinorUnits = Brand<number, 'MinorUnits'>
type CurrencyCode = Brand<string, 'CurrencyCode'>
type TripId = Brand<string, 'TripId'>
type ItemId = Brand<string, 'ItemId'>
type StoreId = Brand<string, 'StoreId'>
type ProductId = Brand<string, 'ProductId'>
type IsoTimestamp = Brand<string, 'IsoTimestamp'>

type Result<T, E> =
  | { ok: true; value: T }
  | { ok: false; error: E }
~~~

Branding is intended to prevent accidental mixing, not to replace runtime validation.

## Currency contract

Do not accept arbitrary ISO-looking strings unless the application actually knows how to parse/format their minor-unit precision.

Recommended:

~~~ts
type SupportedCurrency =
  | 'EUR'
  // add explicitly supported currencies here

interface CurrencySpec {
  code: SupportedCurrency
  fractionDigits: 0 | 2 | 3
  localeFallback: string
}
~~~

MVP may support EUR only.

The architecture must be extensible, but implementation should prefer explicit support over pretending all currencies are already correct.

## Minor-unit construction

No raw number should become MinorUnits without validation.

~~~ts
function minorUnits(value: number): Result<MinorUnits, MoneyError>
~~~

Validation:

- Number.isSafeInteger(value)
- value >= 0 for ordinary price/budget values
- signed derived values may use a separate helper/type if needed

For clarity, derived remaining/overage values may be signed safe integers.

## Money draft contract

Price input is ephemeral UI/application state.

Recommended shape:

~~~ts
interface MoneyDraft {
  raw: string
  mode: 'decimal' | 'auto-cents'
}
~~~

Parsing:

~~~ts
function parseMoneyDraft(
  draft: MoneyDraft,
  currency: SupportedCurrency,
  locale: string,
): Result<MinorUnits, MoneyInputError>
~~~

Rules:

- no parseFloat-based canonical conversion
- locale decimal separator supported where configured
- grouping separators are either explicitly supported or explicitly rejected
- excess fraction digits produce a validation error, not silent rounding
- overflow produces an error
- empty draft is invalid for commit

## Price provenance

### Source

~~~ts
type PriceSource =
  | { kind: 'manual' }
  | { kind: 'price-memory'; memoryId: string }
  | { kind: 'shelf-scan'; captureId?: string }
  | { kind: 'encoded-barcode'; symbology: string }
  | { kind: 'retailer-feed'; provider: string }
~~~

MVP only needs manual.

### Confidence

~~~ts
type PriceConfidence =
  | { kind: 'confirmed'; confirmedAt: IsoTimestamp }
  | { kind: 'remembered'; observedAt: IsoTimestamp; storeId?: StoreId }
  | { kind: 'estimated'; reason?: 'weighted' | 'unknown' | 'other' }
~~~

Important:

- shelf-scan + confirmed is valid
- manual + estimated is valid
- price-memory + remembered is valid

Do not collapse source and confidence into one enum.

## Cart item contract

~~~ts
interface CartItem {
  id: ItemId
  unitPriceMinor: MinorUnits
  quantity: number
  label?: string
  priceSource: PriceSource
  priceConfidence: PriceConfidence
  createdAt: IsoTimestamp
  updatedAt: IsoTimestamp
}
~~~

Invariants:

- quantity is safe integer >= 1
- unitPriceMinor is valid
- label, if present, is trimmed and length-bounded
- updatedAt >= createdAt by application convention
- canonical item never contains an unresolved OCR/barcode candidate

## Trip contract

Use a discriminated union.

~~~ts
interface TripBase {
  id: TripId
  currency: SupportedCurrency
  budgetMinor: MinorUnits
  safetyBufferMinor: MinorUnits
  items: CartItem[]
  startedAt: IsoTimestamp
}

interface ActiveTrip extends TripBase {
  status: 'active'
}

interface CompletedTrip extends TripBase {
  status: 'completed'
  completedAt: IsoTimestamp
  actualCheckoutMinor?: MinorUnits
}

type ShoppingTrip = ActiveTrip | CompletedTrip
~~~

Invariants:

- budget > 0
- buffer <= budget
- item ids unique
- completedAt only exists on completed trip
- actual checkout only exists on completed trip
- one trip has one currency

## Derived selectors

Recommended pure functions:

~~~ts
function lineTotal(item: CartItem): SignedMinorUnits
function cartTotal(trip: ShoppingTrip): SignedMinorUnits
function safeLimit(trip: ShoppingTrip): SignedMinorUnits
function remaining(trip: ShoppingTrip): SignedMinorUnits
function safeRemaining(trip: ShoppingTrip): SignedMinorUnits
function nominalOverage(trip: ShoppingTrip): SignedMinorUnits
function safeOverage(trip: ShoppingTrip): SignedMinorUnits
function itemCount(trip: ShoppingTrip): number
~~~

Derived values are recomputed after restore.

## Projection contract

Pending entry must be previewable without mutation.

~~~ts
interface AddItemDraft {
  unitPriceMinor: MinorUnits
  quantity: number
  label?: string
  priceSource: PriceSource
  priceConfidence: PriceConfidence
}

interface TripProjection {
  lineTotalMinor: SignedMinorUnits
  cartTotalMinor: SignedMinorUnits
  remainingMinor: SignedMinorUnits
  safeRemainingMinor: SignedMinorUnits
  crossesSafeLimit: boolean
  crossesNominalBudget: boolean
  nominalOverageMinor: SignedMinorUnits
}

function projectAddItem(
  trip: ActiveTrip,
  draft: AddItemDraft,
): Result<TripProjection, DomainError>
~~~

Projection cannot mutate trip.

## Domain commands

Recommended discriminated union:

~~~ts
type TripCommand =
  | { type: 'add-item'; item: CartItem }
  | { type: 'update-item'; itemId: ItemId; patch: EditableItemPatch; now: IsoTimestamp }
  | { type: 'remove-item'; itemId: ItemId }
  | { type: 'set-budget'; budgetMinor: MinorUnits }
  | { type: 'set-buffer'; safetyBufferMinor: MinorUnits }
  | { type: 'complete-trip'; completedAt: IsoTimestamp }
  | { type: 'set-actual-checkout'; actualCheckoutMinor: MinorUnits }
~~~

MVP immediate-reopen may be handled as application-level recovery until exact historical semantics are finalised.

Pure reducer:

~~~ts
function reduceTrip(
  trip: ShoppingTrip,
  command: TripCommand,
): Result<ShoppingTrip, DomainError>
~~~

Rules:

- no I/O
- no random ids
- no current-time lookup
- no React
- no localStorage
- no animation

## Editable item patch

~~~ts
interface EditableItemPatch {
  unitPriceMinor?: MinorUnits
  quantity?: number
  label?: string | null
  priceSource?: PriceSource
  priceConfidence?: PriceConfidence
}
~~~

If trust/provenance changes, caller must change it explicitly.

Do not silently promote remembered/estimated to confirmed.

## Application state contract

Canonical trip and application reliability state are separate.

~~~ts
type PersistenceHealth =
  | { status: 'healthy' }
  | { status: 'degraded'; error: PersistenceError; since: IsoTimestamp }

interface ShoppingAppState {
  activeTrip: ActiveTrip | null
  completedTrips: CompletedTrip[]
  persistence: PersistenceHealth
  undo: UndoState | null
}
~~~

Ephemeral UI state is not part of ShoppingAppState canonical data:

- open sheet
- keypad draft
- scanner candidate
- animation phase
- toast visibility

## Undo contract

Recommended MVP:

~~~ts
interface UndoState {
  previousTrip: ActiveTrip
  description: 'add' | 'edit' | 'remove'
}
~~~

Rules:

- one-level undo
- not persisted
- new undoable mutation replaces previous undo
- undo restores previous canonical active trip then persists it

This is the preferred MVP choice because it is easy to reason about and test.

## Repository ports

### Active trip repository

~~~ts
interface ActiveTripRepository {
  load(): Result<ActiveTrip | null, PersistenceReadError>
  save(trip: ActiveTrip): Result<void, PersistenceWriteError>
  clear(): Result<void, PersistenceWriteError>
}
~~~

### History repository

~~~ts
interface HistoryRepository {
  loadAll(): Result<CompletedTrip[], PersistenceReadError>
  saveAll(trips: CompletedTrip[]): Result<void, PersistenceWriteError>
}
~~~

MVP can use full-snapshot writes.

### Settings repository

~~~ts
interface SettingsRepository {
  load(): Result<AppSettings, PersistenceReadError>
  save(settings: AppSettings): Result<void, PersistenceWriteError>
}
~~~

## Boundary services

### Clock

~~~ts
interface Clock {
  now(): IsoTimestamp
}
~~~

### Id generator

~~~ts
interface IdGenerator {
  tripId(): TripId
  itemId(): ItemId
}
~~~

Production:

- crypto.randomUUID()
- new Date().toISOString()

Tests inject deterministic values.

## Application command service

Recommended synchronous MVP contract because localStorage is synchronous.

~~~ts
interface ShoppingSessionService {
  startTrip(input: StartTripInput): AppCommandResult
  dispatch(command: TripCommand): AppCommandResult
  undo(): AppCommandResult
  finishTrip(): AppCommandResult
}
~~~

Conceptual result:

~~~ts
interface AppCommandResult {
  state: ShoppingAppState
  durability: 'persisted' | 'memory-only'
}
~~~

Important ordering:

1. calculate valid next canonical state
2. attempt persistence
3. update application state with healthy/degraded status
4. render
5. optional motion

The UI must never independently repeat the domain command to “retry an animation.”

## Completion orchestration

Because active trip and history are separate localStorage documents, completion is application orchestration rather than one domain reducer call.

Preferred sequence:

1. domain converts active → completed
2. write new history snapshot
3. if history write succeeds, clear active-trip storage
4. update application state
5. if history write fails, keep active trip intact and report degraded state

Prefer duplicate data over lost data.

## Persistence errors

~~~ts
type PersistenceErrorCode =
  | 'unavailable'
  | 'read-failed'
  | 'write-failed'
  | 'malformed-data'
  | 'unsupported-version'
  | 'validation-failed'
~~~

~~~ts
interface PersistenceError {
  kind: 'persistence'
  code: PersistenceErrorCode
  message: string
  cause?: unknown
}
~~~

Do not expose raw exception text directly to users.

## Domain errors

Suggested codes:

~~~ts
type DomainErrorCode =
  | 'invalid-budget'
  | 'invalid-buffer'
  | 'invalid-price'
  | 'invalid-quantity'
  | 'unsafe-integer'
  | 'item-not-found'
  | 'trip-not-active'
  | 'trip-not-completed'
  | 'unsupported-currency'
~~~

Expected invalid input returns Result failure.

Programming invariant violations may throw/assert in development if they indicate impossible internal state.

## Capability adapter contract

Future optional capabilities should share a predictable failure shape.

~~~ts
type CapabilityErrorCode =
  | 'unsupported'
  | 'permission-denied'
  | 'unavailable'
  | 'timeout'
  | 'invalid-result'
  | 'network'

interface CapabilityError {
  kind: 'capability'
  code: CapabilityErrorCode
  message: string
}
~~~

Optional capability errors do not modify canonical trip.

## Barcode adapter

Future P1 contract:

~~~ts
interface BarcodeCandidate {
  rawValue: string
  symbology: string
  parsed?: {
    productId?: string
    payableAmountMinor?: MinorUnits
    weightGrams?: number
  }
}

interface BarcodeScanner {
  scan(): Promise<Result<BarcodeCandidate, CapabilityError>>
}
~~~

If a standard barcode encodes payable amount, the value is still candidate data until application rules confirm it.

## Product lookup adapter

~~~ts
interface ProductLookup {
  findByBarcode(
    rawValue: string,
  ): Promise<Result<ProductIdentity | null, CapabilityError>>
}
~~~

Current price is not part of ProductIdentity unless a specific trusted price provider is intentionally modelled.

## Shelf scan adapter

~~~ts
interface PriceCandidate {
  amountMinor: MinorUnits
  surroundingText?: string
  semanticHint?: 'item-price' | 'unit-price' | 'member-price' | 'old-price' | 'unknown'
}

interface ShelfPriceScanner {
  scan(): Promise<Result<PriceCandidate[], CapabilityError>>
}
~~~

No candidate directly enters ShoppingTrip.

## Price-memory adapter

Future P1:

~~~ts
interface PriceMemoryRepository {
  find(productId: ProductId, storeId?: StoreId): Result<PriceMemoryRecord[], PersistenceReadError>
  remember(record: PriceMemoryRecord): Result<void, PersistenceWriteError>
}
~~~

## React adapter rules

React may own:

- rendering
- current sheet/dialog
- price draft
- focus
- transient feedback
- invoking application service

React must not own:

- cart arithmetic
- domain validation
- storage schema parsing
- scanner result trust decisions
- currency precision rules

## Spec review checklist

Before implementing a new module:

1. Is this domain, application, adapter, or UI?
2. What data is canonical?
3. What failure type is expected?
4. Does the function perform I/O?
5. Can it be deterministic in a unit test?
6. Does it preserve exact minor-unit arithmetic?
7. Is optional capability data still untrusted?
8. Does React remain outside business rules?
9. Are ids/time injected where determinism matters?
10. Are source and confidence still separate?
