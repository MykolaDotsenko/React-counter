# Future quality plans

## Status

**PLANNED / GATED reference only.**

These test plans apply only after the corresponding capability is approved and implemented. They are intentionally outside current `TESTING.md` so AI contributors do not mistake future technology for current product scope.

## Visual product recognition

Production recognition remains gated by issue #88; the guarded CLIP benchmark was retired (D-056).

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

## Price tag reading field evidence

Production price tag reading shipped by owner decision (D-055), and [../TESTING.md](../TESTING.md) owns its automated contract. Its field evidence remains open as issue #90, whose gate is defined in [../ROADMAP.md](../ROADMAP.md).

That post-release evidence should measure the top-1/top-3 correct-candidate rate and capture → human-decision latency on physical devices and real shelf labels, covering comma/dot decimals, split cents, a unit price beside the product price, loyalty/regular prices, multi-buy, percentage discounts and tags with no valid price.

If reading tags saves no interaction or reduces trust, price reading is switched off rather than manual entry weakened (D-055).

## Advanced price mechanics

For discounts, weighted goods or tax mechanics:

- define exact rounding/domain rules first;
- add deterministic money fixtures;
- test boundary values and multiplication/division semantics;
- ensure UI projection and persisted canonical values agree.

## Future state-machine rule

Do not add future capability states to the current `STATE-MACHINES.md` until the roadmap approves implementation.

Before shipping a new capability, define:

- idle/loading/review/failure/cancel states;
- manual fallback;
- durability ownership;
- accessibility recovery;
- explicit boundary between candidate data and canonical financial mutation.
