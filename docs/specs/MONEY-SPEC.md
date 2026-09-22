# Money Specification

## Status

**IMPLEMENTED current exact-money contract** for parsing, validation, arithmetic, projection, formatting, and testing.

The current product supports EUR only.

## Goals

- exact arithmetic
- deterministic parsing
- locale-aware presentation
- zero floating-point drift
- explicit overflow handling
- predictable auto-cents
- accessible output
- safe future currency extension

## Current currency scope

Supported currency:

~~~ts
type SupportedCurrency = 'EUR'
~~~

Specification:

~~~ts
const EUR_SPEC = {
  code: 'EUR',
  fractionDigits: 2,
  minorUnitName: 'cent',
} as const
~~~

Canonical relationship:

~~~text
1 EUR = 100 minor units
EUR 4.79 = 479
EUR 50.00 = 5000
~~~

Unsupported currencies are rejected rather than guessed.

## Canonical numeric types

~~~ts
type Brand<T, B extends string> = T & { readonly __brand: B }

type MinorUnits = Brand<number, 'MinorUnits'>
type SignedMinorUnits = Brand<number, 'SignedMinorUnits'>
~~~

Use MinorUnits for non-negative canonical values:

- budget
- safety buffer
- unit price
- actual checkout total

Use SignedMinorUnits for derived values that may be negative:

- remaining
- safe remaining
- checkout difference
- overage calculations

## Safe-integer invariant

Every canonical and derived money integer must satisfy Number.isSafeInteger.

Operations that would leave the safe-integer range return an error.

No canonical money calculation may depend on binary floating-point decimal arithmetic.

## Raw user input

User input remains text until validated.

~~~ts
interface MoneyDraft {
  raw: string
  mode: 'decimal' | 'auto-cents'
}
~~~

A draft is ephemeral UI/application state, not canonical money.

## Decimal mode

Accepted examples:

~~~text
"4"       → 400
"4.7"     → 470
"4.79"    → 479
"4,79"    → 479
"0.05"    → 5
"50"      → 5000
~~~

## Separator policy

For MVP, accept both period and comma as decimal separators when the input is unambiguous.

Valid:

~~~text
4.79
4,79
~~~

Reject mixed/grouping forms:

~~~text
1,234.56
1.234,56
4,7.9
4.7,9
~~~

Do not infer thousands separators.

The shopping price field prioritises certainty over accounting-style input flexibility.

## Whitespace

Trim leading and trailing whitespace.

Internal whitespace is invalid.

~~~text
" 4.79 " → valid after trim
"4 79"   → invalid
~~~

## Euro symbol handling

The user never needs to type the euro symbol.

For paste friendliness, strip one known leading or trailing euro symbol plus adjacent whitespace before validating the numeric portion.

~~~text
"€4.79"  → 479
"4,79 €" → 479
~~~

Reject other symbols or textual currency labels.

~~~text
"$4.79"    → invalid
"EUR 4.79" → invalid in MVP
~~~

## Negative input

Budgets and item prices cannot be negative.

Reject negative signs rather than trying to reinterpret them.

## Fraction digits

EUR supports two fraction digits.

Accepted:

~~~text
4
4.7
4.79
~~~

Rejected:

~~~text
4.790
4.791
~~~

Do not silently round extra user-entered fraction digits.

## Leading zeroes

Leading zeroes are valid.

~~~text
"004.79" → 479
"0005"   → 500
~~~

## Incomplete drafts

Invalid for commit:

~~~text
""
"."
","
"4."
"4,"
~~~

During typing, incomplete values may remain visible.

Validation state should distinguish:

- incomplete
- valid
- invalid

Do not show an aggressive error for a normal intermediate keystroke.

## Values below one euro

Recommended MVP behaviour:

~~~text
.79 → 79
,79 → 79
~~~

Missing major digits are normalised to zero.

## Zero rules

### Budget

Must be greater than zero.

### Safety buffer

May be zero.

### Actual checkout total

May be zero.

### Item price

MVP rule: an item unit price must be greater than zero.

A zero item is treated as invalid/incomplete at the item-domain boundary. The generic money parser may still represent zero because zero is valid for other monetary concepts such as the safety buffer and actual checkout total.

If free promotional items later become a validated use case, revise D-019 and this specification deliberately.

## Decimal parser algorithm

Do not use:

~~~ts
Math.round(parseFloat(raw) * 100)
~~~

Recommended algorithm:

1. trim whitespace
2. strip one known euro symbol when present
3. determine decimal separator
4. validate full character structure
5. split major and fraction strings
6. normalise missing major part to zero
7. normalise fraction to exactly two digits
8. convert digit strings to integer components
9. compute major × 100 + fraction
10. enforce product maximum
11. enforce safe-integer invariant
12. return branded MinorUnits

Example:

~~~text
"12.5"
major = 12
fraction "5" becomes 50
result = 1250
~~~

No floating decimal enters canonical arithmetic.

## Accepted input grammar

Conceptually:

~~~text
DIGITS
DIGITS[.,]DIGIT
DIGITS[.,]DIGIT DIGIT
[.,]DIGIT
[.,]DIGIT DIGIT
~~~

Implementation may use a small parser or a carefully tested regular expression.

Prefer clarity over a clever single regex.

## Auto-cents mode

Auto-cents is optional and should be off by default until usability testing proves it improves speed.

Digits represent minor units:

~~~text
"4"    → EUR 0.04
"47"   → EUR 0.47
"479"  → EUR 4.79
"1250" → EUR 12.50
~~~

Restrictions:

- digits only
- no decimal separator
- no negative sign
- empty invalid
- product maximum applies
- safe-integer invariant applies

The mode must be visibly obvious.

Never switch into auto-cents silently.

## Formatting

All display formatting goes through one presentation boundary.

~~~ts
function formatEur(
  amount: SignedMinorUnits | MinorUnits,
  locale: string,
): string
~~~

Use Intl.NumberFormat for presentation.

Legitimate locale outputs may differ:

~~~text
€4.79
4,79 €
~~~

Do not manually concatenate the currency symbol in production UI.

## Test locale discipline

Tests must pass explicit locale values.

Do not rely on the machine default locale.

If runtime implementations differ only in non-breaking-space details, normalise that known presentation difference rather than weakening monetary assertions.

## Accessible money output

Visible compact currency must still have semantic context.

Example accessible meaning:

> Remaining budget: 18 euros and 58 cents.

Do not expose an isolated amount without its role.

## Arithmetic

Core MVP arithmetic consists of:

- integer addition
- integer subtraction
- multiplication by integer quantity

### Quantity multiplication

~~~text
lineTotal = unitPriceMinor × quantity
~~~

Requirements:

- quantity is a safe integer
- quantity is within product bound
- multiplication result remains a safe integer

## No generic division in current core

The MVP does not need division.

Do not add generic percentage or decimal arithmetic without an explicit product/domain requirement and rounding contract.

Future features that require rounding include:

- discounts
- tax
- weighted calculations
- unit-price calculations

Their rounding policy must be specified before implementation.

## Future rounding policy

A future percentage feature should:

- use integer numerator arithmetic where possible
- round only once to a minor unit
- define a specific tie-breaking rule before coding

No unused generic rounding helper is needed in MVP.

## Derived values

~~~text
cartTotal = sum(unitPriceMinor × quantity)

remaining = budgetMinor - cartTotal

safeLimit = budgetMinor - safetyBufferMinor

safeRemaining = safeLimit - cartTotal

checkoutDifference = actualCheckoutMinor - estimatedCartTotal
~~~

Remaining values and checkout difference may be negative.

## Over-budget semantics

Do not persist an over-budget boolean.

Derive it from signed remaining:

~~~text
remaining < 0
~~~

Nominal overage:

~~~text
max(0, -remaining)
~~~

Apply the same principle to safe-limit overage.

## Product-level maximum

Technical safe-integer limits are far above meaningful grocery values.

Use a lower product guardrail:

~~~text
EUR 999,999.99
~~~

~~~ts
const MAX_MVP_MONEY_MINOR = 99_999_999
~~~

Apply to user-entered:

- budget
- item unit price
- actual checkout total

Safety buffer is also constrained by budget.

Derived cart totals may exceed the single-input maximum but must remain safe integers.

## Quantity bound

MVP quantity bound:

~~~text
1 through 999
~~~

This is intentionally generous while preventing accidental runaway values.

## Copy and paste

Typed and pasted values share the same parser.

~~~text
"€4,79"    → valid
" 12.50 "  → valid
"EUR 4.79" → invalid
"$4.79"    → invalid
~~~

Never silently reinterpret a non-euro amount.

## Error taxonomy

~~~ts
type MoneyInputErrorCode =
  | 'empty'
  | 'incomplete'
  | 'invalid-format'
  | 'negative-not-allowed'
  | 'too-many-fraction-digits'
  | 'unsupported-currency'
  | 'above-product-limit'
  | 'unsafe-integer'
~~~

Presentation maps error codes to contextual copy.

Do not leak parser implementation messages directly to users.

## Error copy examples

Budget zero:

> Enter an amount greater than €0.

Too many decimals:

> Use no more than 2 decimal places.

Wrong currency:

> This version supports euros only.

Above maximum:

> Enter an amount below €1,000,000.

Avoid generic messages such as:

> Invalid value.

## Domain API proposal

~~~ts
function parseEurDraft(
  draft: MoneyDraft,
): Result<MinorUnits, MoneyInputError>

function minorUnits(
  value: number,
): Result<MinorUnits, MoneyError>

function signedMinorUnits(
  value: number,
): Result<SignedMinorUnits, MoneyError>

function addMoney(
  a: SignedMinorUnits,
  b: SignedMinorUnits,
): Result<SignedMinorUnits, MoneyError>

function subtractMoney(
  a: SignedMinorUnits,
  b: SignedMinorUnits,
): Result<SignedMinorUnits, MoneyError>

function multiplyMoney(
  unitPrice: MinorUnits,
  quantity: number,
): Result<MinorUnits, MoneyError>

function formatEur(
  amount: SignedMinorUnits | MinorUnits,
  locale: string,
): string
~~~

Exact signatures may simplify if TypeScript ceremony exceeds value, but the invariants cannot.

## Parser test matrix

### Valid decimal input

~~~text
0.01       → 1
0,01       → 1
.79        → 79
,79        → 79
1          → 100
1.2        → 120
1,2        → 120
1.23       → 123
001.23     → 123
€4.79      → 479
4,79 €     → 479
999999.99  → 99_999_999
~~~

### Invalid decimal input

~~~text
empty
.
,
-
-1
1.234
1,234
1,234.56
1.234,56
abc
EUR 4.79
$4.79
1000000.00
~~~

The input 1,234 is deliberately rejected as three fractional digits rather than guessed as a thousands-separated integer.

### Auto-cents

~~~text
1    → 1
01   → 1
47   → 47
479  → 479
1250 → 1250
~~~

Reject every non-digit.

## Arithmetic test matrix

~~~text
379 + 1250 + 799 = 2428
129 × 3 = 387
5000 - 2428 = 2572
5000 - 200 - 4300 = 500
5000 - 5200 = -200
4672 - 4637 = 35
~~~

## Property-style invariants

For valid generated carts:

~~~text
remaining + cartTotal = budget
safeRemaining + cartTotal = budget - buffer
~~~

For mutations:

~~~text
cartTotal after add - cartTotal before = added line total
cartTotal after remove = previous total - removed line total
~~~

For persistence:

~~~text
restored canonical money = identical original integer values
~~~

## Floating-point regression cases

Include decimal-looking source strings that commonly expose binary floating-point bugs.

~~~text
"0.10" → 10
"0.20" → 20
"0.30" → 30
"1.10" → 110
"2.20" → 220
~~~

Exact assertions:

~~~text
10 + 20 = 30
110 + 220 = 330
~~~

No epsilon/tolerance assertions are permitted for canonical money.

## Dependency policy

No decimal/money library is required for MVP.

Reasons:

- integer-cent arithmetic is sufficient
- parser is intentionally narrow
- no percentage arithmetic
- no arbitrary precision requirement

Add a dependency only if a later feature introduces complexity that is demonstrably safer with one.

## Future currency extension checklist

Before another currency becomes user-selectable:

1. add it explicitly to SupportedCurrency
2. define fraction digits
3. define parser behaviour
4. define auto-cents semantics
5. add formatter fixtures
6. add accessibility wording checks
7. add persistence validation
8. update UI
9. verify existing EUR storage remains unchanged
10. update product/docs scope

Do not add generic ISO currency acceptance first and correctness later.

## Money implementation review checklist

1. Does any decimal number enter canonical state?
2. Is parsing string-based?
3. Are extra fraction digits rejected rather than rounded?
4. Is every canonical result a safe integer?
5. Are user-entered values bounded?
6. Is locale formatting outside the domain?
7. Is auto-cents explicit?
8. Does any code use parseFloat for canonical money?
9. Are negative derived values modelled explicitly?
10. Are tests exact rather than tolerance-based?

## Review summary

The implemented model is intentionally narrow:

- EUR only;
- integer cents;
- no FX;
- no generic percentage arithmetic;
- no decimal dependency;
- explicit input grammar;
- explicit product bounds.

That narrowness is a reliability advantage. Future currency or advanced-price mechanics require an explicit contract extension rather than genericising the current money model pre-emptively.
