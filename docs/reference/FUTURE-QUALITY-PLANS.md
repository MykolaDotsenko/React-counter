# Future quality plans

## Status

**PLANNED / GATED reference only.**

These test plans apply only after the corresponding capability is approved and implemented. They are intentionally outside current `TESTING.md` so AI contributors do not mistake future technology for current product scope.

## Installable PWA

When PWA work is approved, test:

- production base/scope under GitHub Pages;
- first successful online load caches required shell resources;
- subsequent offline launch opens the product;
- active trip/history remain correct;
- service-worker update does not discard committed state;
- Cache Storage never becomes business-state authority.

## Barcode identification

When barcode work is approved:

- test native-capability and fallback adapter paths;
- use deterministic fixtures for supported/unsupported barcode;
- product found/not found;
- provider timeout;
- malformed provider payload;
- offline/provider unavailable;
- manual current-price entry remains available.

Barcode tests must never imply barcode identity is authoritative current shelf price.

## Shelf-label OCR

When OCR work is approved, benchmark before locking a provider.

Use static fixtures before camera E2E:

- one obvious price;
- multiple prices;
- superscript cents;
- unit price + product price;
- discount + regular price;
- no valid price;
- malformed provider result.

Measure:

- candidate accuracy;
- latency;
- permission/camera friction;
- correction cost;
- end-to-end time versus manual entry.

A visually impressive scan flow that saves no interaction should not ship.

## Advanced price mechanics

For discounts, weighted goods or tax mechanics:

- define exact rounding/domain rules first;
- add deterministic money fixtures;
- test boundary values and multiplication/division semantics;
- ensure UI projection and persisted canonical values agree.

## Cross-device/backend features

If sync/auth/backend ever becomes approved:

- define ownership/conflict semantics before implementation;
- test offline/local edits against synchronization;
- never allow stale remote state to silently overwrite newer committed local shopping state;
- add explicit privacy/security tests for transmitted shopping data.

## Future capability accessibility

These requirements become current only when the corresponding capability ships.

### Installable PWA

Verify installed mode preserves:

- system text scaling;
- safe-area layout;
- keyboard/focus behaviour;
- screen-reader semantics;
- update/reload flows without trapping or losing the user.

Do not hide browser/platform accessibility affordances merely to imitate a native shell.

### Barcode / camera

Camera/scanning remains optional.

Provide:

- text-labelled controls;
- permission-denied recovery;
- complete manual fallback;
- no gesture-only critical action;
- review/confirmation state usable by keyboard and assistive technology where the platform permits it.

### Shelf OCR

Candidate review must expose:

- detected candidate values as text;
- ambiguity clearly;
- manual entry/edit;
- no auto-commit from visual recognition alone.

### Cloud / multi-device

Any future conflict/recovery UI must state:

- which version is current/local/remote;
- what will be overwritten;
- a safe user-controlled resolution path.

## Future state-machine rule

Do not add future capability states to the current `STATE-MACHINES.md` until the roadmap approves implementation.

Before shipping a new capability, define:

- idle/loading/review/failure/cancel states;
- manual fallback;
- durability ownership;
- accessibility recovery;
- explicit boundary between candidate data and canonical financial mutation.
