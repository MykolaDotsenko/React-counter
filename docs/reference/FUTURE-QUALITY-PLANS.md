# Future quality plans

## Status

**PLANNED / GATED reference only.**

These test plans apply only after the corresponding capability is approved and implemented. They are intentionally outside current `TESTING.md` so AI contributors do not mistake future technology for current product scope.

## Visual product recognition

The provider-neutral benchmark harness is implemented, but a concrete model/provider remains gated by issue #88.

Before production recognition:

- test a named adapter/model against representative retail fixtures and physical devices;
- separate top-1 from top-3 accuracy;
- include same-brand/different-size and same-design/different-flavour confusions;
- include glare, angle, partial occlusion and low-light conditions;
- measure capture → human-decision latency rather than model-only inference;
- verify timeout, cancellation, late-result suppression and manual fallback;
- verify candidate labels and images never enter retained evidence;
- document any remote-image boundary explicitly;
- require human confirmation before any product identity is accepted.

A generic category classifier is not evidence of SKU-level product recognition.

## Shelf-label OCR

Production price tag reading shipped by owner decision (D-055); issue #90 now validates it after release.

For the post-release evidence:

- test one named OCR adapter/engine on static fixtures before physical camera evidence;
- include comma/dot decimals, split cents, unit price + product price, loyalty/regular prices, multi-buy, percentage discount and no-valid-price cases;
- verify the parser always routes accepted money through the existing exact-money contract;
- verify bare OCR digits do not gain an invented decimal separator;
- measure top-1/top-3 correct-candidate rate and capture → human-decision latency;
- verify timeout, cancellation, late-result suppression and manual fallback;
- verify raw OCR text, images and parsed prices never enter retained benchmark evidence;
- document any remote-image boundary explicitly;
- require human confirmation before any price can become canonical shopping money.

A visually impressive scan flow that saves no interaction or reduces trust should not ship.

## Advanced price mechanics

For discounts, weighted goods or tax mechanics:

- define exact rounding/domain rules first;
- add deterministic money fixtures;
- test boundary values and multiplication/division semantics;
- ensure UI projection and persisted canonical values agree.

## Future capability accessibility

These requirements become current only when the corresponding capability ships.

### Shelf OCR

Candidate review must expose:

- detected candidate values as text;
- ambiguity clearly;
- manual entry/edit;
- no auto-commit from visual recognition alone.

## Future state-machine rule

Do not add future capability states to the current `STATE-MACHINES.md` until the roadmap approves implementation.

Before shipping a new capability, define:

- idle/loading/review/failure/cancel states;
- manual fallback;
- durability ownership;
- accessibility recovery;
- explicit boundary between candidate data and canonical financial mutation.
