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
