# Code Ownership and Contract Map

## Status

**SUPPORTING REFERENCE.**

Current executable contracts live in TypeScript source, tests, and the authoritative documentation set. This file is intentionally a map, not a second copy of interfaces that can drift.

Use it when you need to locate code/contract ownership quickly.

## Contract ownership

| Concern | Source |
| --- | --- |
| public application state/results, controller interface, shopping persistence/clock/id ports | `src/application/shopping-app-contracts.ts` |
| controller orchestration | `src/application/shopping-app-controller.ts` |
| completion use cases | `src/application/shopping-app-completion.ts` |
| controller helpers | `src/application/shopping-app-support.ts` |
| Price Memory port | `src/application/price-memory-port.ts` |
| session-only (write-refusing) ports | `src/application/session-only-persistence.ts` |
| camera, barcode-reader, product-lookup, barcode-link and price-tag ports | `src/application/camera-ports.ts`, `src/application/barcode-ports.ts`, `src/application/price-tag-ports.ts` |
| barcode reading stabilisation | `src/application/barcode-scan.ts` |
| exact money | `src/domain/money.ts` + `MONEY-SPEC.md` |
| trip public API | `src/domain/shopping-trip.ts` façade |
| trip model/validation | `src/domain/shopping-trip-model.ts` |
| trip selectors/projections | `src/domain/shopping-trip-selectors.ts` |
| trip commands/reducer | `src/domain/shopping-trip-reducer.ts` + `STATE-MACHINES.md` |
| Price Memory domain | `src/domain/price-memory.ts` |
| product codes (GTIN, store codes, coupons) | `src/domain/product-code.ts` |
| barcode links (remembered names) | `src/domain/barcode-link.ts` |
| shelf-price candidates | `src/domain/shelf-price.ts` |
| storage transactions | `src/infrastructure/storage/shopping-storage.ts` |
| storage codec/reconstruction | `src/infrastructure/storage/shopping-storage-codec.ts` |
| storage schemas | `src/infrastructure/storage/shopping-storage-schema.ts` + `STORAGE-SCHEMA.md` |
| shopping persistence port adapter | `src/infrastructure/storage/active-trip-persistence-port.ts` |
| Price Memory storage | `src/infrastructure/storage/price-memory-storage.ts`, `src/infrastructure/storage/price-memory-storage-schema.ts`, `src/infrastructure/storage/price-memory-persistence-port.ts` |
| barcode-link storage | `src/infrastructure/storage/barcode-link-storage.ts` |
| system clock and id generator | `src/infrastructure/runtime/browser-boundaries.ts` |
| camera build switches | `src/infrastructure/runtime/feature-flags.ts` |
| camera adapter | `src/infrastructure/camera/` |
| barcode readers (native detector, ZXing fallback) | `src/infrastructure/barcode/` |
| price-tag reader (Tesseract) | `src/infrastructure/price-ocr/` |
| product-name lookup (Open Food Facts) | `src/infrastructure/product-lookup/` |
| browser composition | `src/app/composition-root.ts` |
| product shell and overlay routing | `src/app/ShoppingAppShell.tsx` + `src/app/use-shopping-shell-focus.ts` |
| PWA update prompt | `src/app/PwaUpdateNotice.tsx` + `STATE-MACHINES.md` |
| appearance preference | `src/app/appearance.ts` + `src/app/AppearanceSwitcher.tsx` |
| deployed-surface storage scope | `src/infrastructure/runtime/deployment-surface.ts` + `src/infrastructure/storage/scoped-storage.ts`; evidence keys: `src/qa/evidence-storage.ts` |
| React subscription bridge | `src/application/react/use-shopping-app-state.ts` |
| price-entry interaction | `PRICE-ENTRY-CONTRACT.md` + feature tests |
| camera scan overlay | `src/features/shopping/ScanSurface.tsx` + `ScanBarcodeResult.tsx`, `ScanPriceResult.tsx`, `scan-copy.ts`, `scan-targets.ts` + `STATE-MACHINES.md` |
| recovery and damaged-history actions | `RecoveryScreen.tsx`, `HistoryIntegrityNotice.tsx` + `STATE-MACHINES.md` |
| evidence adapter boundary (`#shopping-evidence`) | `src/qa/shopping-evidence-contract.ts`; alias targets `src/qa/use-shopping-evidence.tsx` (public NoOp) and `src/qa/use-shopping-evidence-enabled.tsx` (guarded builds) |

## Public application boundary

The application layer exposes:

- immutable snapshot state;
- subscription;
- bootstrap;
- start/repeat trip;
- active-trip mutations and Undo;
- barcode identification (`identifyBarcode`);
- completion and dismissing the completed summary;
- checkout reconciliation;
- history/local-data controls;
- persistence retry;
- history re-read, set-aside of unreadable records and continue-without-saving.

Consumers should depend on public application contracts rather than controller implementation details.

## Domain boundary

Domain types/functions own:

- exact money;
- ShoppingTrip / CartItem invariants;
- projections/selectors;
- lifecycle-safe trip commands;
- provenance/confidence semantics;
- Price Memory learning/ranking rules;
- product codes, barcode links and shelf-price candidates.

Domain code must not depend on:

- React;
- DOM;
- storage;
- network;
- OCR/barcode SDKs;
- analytics/evidence;
- animation.

## Persistence boundary

Application ports express persistence needs.

Infrastructure implements:

- read/write/remove;
- DTO validation;
- domain reconstruction;
- loss-safe completion ordering;
- reconciliation;
- recovery/degraded issue mapping.

Storage DTOs are not domain types.

## Error ownership

### Domain errors

Represent invalid business/domain operations.

### Application errors

Represent invalid lifecycle/use-case operations.

### Persistence errors

Represent storage/durability failure.

### Capability/provider errors

Represent optional external capability failure.

Do not collapse these into one generic error that loses recovery meaning.

## Money boundary

Canonical money:

- integer EUR minor units;
- safe/product bounded;
- formatted only at presentation boundaries.

Never introduce a parallel decimal-money model.

## Price trust boundary

Price source and price confidence/currentness are independent.

Technology origin must never imply currentness automatically.

## React boundary

React owns:

- rendering;
- drafts;
- focus;
- overlays;
- interaction feedback.

React does not own canonical financial mutation rules.

## Composition boundary

Browser adapter construction belongs in the composition root.

Do not construct storage/provider singletons inside feature components.

## Future capability rule

A future backend/provider contract is not current product behaviour merely because a type or extension point exists. Camera, barcode, price-reading and product-lookup adapters live in `infrastructure/camera/`, `infrastructure/barcode/`, `infrastructure/price-ocr/` and `infrastructure/product-lookup/` and are composed in `app/composition-root.ts`.

Before adding an adapter:

1. the product/roadmap gate must permit it;
2. runtime payloads must be validated;
3. manual/local-first fallback must remain complete;
4. failure semantics must be explicit;
5. tests must protect the boundary.

## Review checklist

- Am I editing the true owning module?
- Am I duplicating an existing interface in documentation?
- Did domain code remain pure?
- Did React gain business-state authority?
- Did an infrastructure DTO bypass reconstruction?
- Did an optional provider become required for the core job?
- Did a future extension get mistaken for implemented capability?

If exact signatures are needed, read the current source instead of extending this document with copied TypeScript.
