# Price Entry Interaction Contract

Status: **Phase 5 / B0 locked**

This contract defines the manual price-entry draft behavior before the UI is allowed to commit shopping data.

It complements:

- `docs/specs/MONEY-SPEC.md`
- `FUNCTIONALITY.md`
- `docs/archive/CORE-UI-EXECUTION-BRIEF.md`

The Phase 1 money parser remains authoritative. The price-entry UI must not implement a second money parser.

## Default mode

Default:

> **decimal**

Reason:

A raw `479` must mean **EUR 479.00** unless the user explicitly opts into auto-cents.

The app must never silently guess whether `479` means EUR 479.00 or EUR 4.79.

## Decimal mode

Examples:

- `4` → EUR 4.00
- `4.7` → EUR 4.70
- `4.79` → EUR 4.79
- `4,79` → EUR 4.79
- `.79` → EUR 0.79
- `,79` → EUR 0.79

The on-screen keypad inserts `.` as its separator.

Hardware keyboard and paste may use either `.` or `,`.

## Auto-cents mode

Auto-cents is an **explicit opt-in accelerator**.

Examples:

- `4` → EUR 0.04
- `47` → EUR 0.47
- `479` → EUR 4.79
- `1250` → EUR 12.50

Rules:

- digits only
- no decimal separator
- the mode control is available only while the draft is empty
- switching modes never reinterprets a non-empty draft
- the mode label must explain the example before the user starts typing

## Draft states

Every raw draft maps to exactly one UI state:

### empty

Examples:

- `""`
- whitespace-only paste after parser trimming

Behavior:

- Add disabled
- no error message

### incomplete

Examples:

- `.`
- `,`
- `4.`
- `4,`

Behavior:

- Add disabled
- draft stays visible
- no aggressive error message

### valid

The Phase 1 parser succeeds and the parsed item price is greater than zero.

Behavior:

- Add enabled
- formatted preview may be shown

### invalid

Examples:

- mixed separators
- more than two fraction digits in decimal mode
- negative values
- unsupported symbols/text
- value above product limit
- zero item price

Behavior:

- Add disabled
- concise corrective copy is shown

Zero is a parser-valid money amount but is not a valid MVP item price. Price entry therefore applies the existing item-context rule after parsing without changing the money parser.

## Keypad contract

Digits:

- append one digit to the raw draft
- leading zeroes are allowed
- no canonical normalization occurs while typing

Decimal separator:

- available only in decimal mode
- inserts `0.` when the draft is empty
- inserts nothing if the draft already contains `.` or `,`

Backspace:

- removes exactly one final Unicode code point
- empty remains empty

Clear:

- resets raw draft to empty in one action

## Native input / paste

The visible amount is also a real text input.

Required:

- decimal or numeric `inputMode` appropriate to the selected mode
- hardware keyboard support
- paste support
- comma support in decimal mode
- no required euro symbol
- no blocking of intermediate invalid/incomplete text before parsing

The UI stores the raw text. Canonical money exists only after `parseEurDraft()` succeeds.

## Add rules

Add is enabled only when:

1. the Phase 1 parser succeeds
2. parsed value is greater than zero
3. parsed value remains within the existing product limit

B1 may emit a validated price intent to a parent callback.

Canonical cart mutation remains owned by later Sprint B application/commit work.

## Accessibility

- keypad digit targets >= 48 CSS px
- Clear and Backspace have text/accessible names
- Add has a stable location
- Cancel is always available
- focus-visible styles remain present
- hardware keyboard use must not be blocked
- status/error copy must not rely on colour alone

## B0 decision

**Locked and ready for B1.**

No unresolved parsing rule remains before implementing the one-hand surface.
