# Testing

## Status

**IMPLEMENTED quality contract.**

Testing protects user outcomes and financial correctness, not implementation trivia.

Future capability test plans that are not yet part of the product live in [reference/FUTURE-QUALITY-PLANS.md](./reference/FUTURE-QUALITY-PLANS.md).

## Quality priorities

In order:

1. exact money;
2. loss-resistant persistence/recovery;
3. correct lifecycle and completion;
4. fast correction;
5. user-visible consequences;
6. accessibility;
7. repeat-trip / Price Memory semantics;
8. evidence integrity;
9. cross-browser reliability;
10. installable/offline-shell reliability;
11. performance/premium interaction quality.

## Definition of done

A code change is complete only when relevant checks pass:

- lint;
- strict TypeScript;
- unit tests;
- component tests;
- production build;
- affected Playwright flows;
- accessibility expectations;
- owning documentation when behaviour/contracts changed.

Critical money, persistence or recovery behaviour may not rely on “manual QA later”.

## Repository gate

```bash
npm ci
npm run check
npm run test:e2e
```

`npm run check` covers lint, typecheck, unit/component tests and production build.

CI builds one immutable site artifact containing the public app plus guarded QA/beta variants, the local cohort analyzer and the isolated barcode benchmark. Production browser tests run against the exact public build artifact; beta-, cohort- and barcode-benchmark-specific browser tests run separately against their guarded artifacts. Deployment may promote the artifact only after all browser gates succeed.

## Test layers

### Domain

Highest density.

Cover:

- parser/format rules;
- exact minor-unit arithmetic;
- budget/buffer invariants;
- quantity;
- line/cart totals;
- remaining/safe remaining;
- over-budget boundaries;
- ShoppingTrip commands;
- provenance/confidence;
- Price Memory selection/learning.

Use property-style tests where algebraic invariants are stronger than example-only coverage.

### Application

Cover:

- lifecycle;
- command acceptance/rejection;
- immutable snapshot semantics;
- one notification per state change;
- Undo;
- completion ordering;
- checkout reconciliation;
- history;
- recovery;
- Price Memory coordination;
- degraded durability.

### Persistence / infrastructure

Cover:

- valid DTO → domain reconstruction;
- malformed JSON;
- invalid business values;
- unsupported future versions;
- write/remove/read failure;
- history conflicts;
- loss-safe completion;
- stale active/completed reconciliation;
- legacy non-shopping key retirement;
- independent Price Memory persistence.

Never make schema validation the only domain validation.

### Components

Test user-visible semantics:

- start trip;
- add price;
- projected consequence;
- quantity;
- over-budget confirmation;
- edit/remove/Undo;
- budget adjustment;
- persistence warning;
- completion/history;
- Price Memory/recent item flows;
- local-data controls;
- focus restoration and announcements.

Prefer role/name queries over implementation selectors.

### Browser E2E

Protect critical real workflows across:

- Chromium;
- Firefox;
- WebKit.

At minimum cover:

1. clean start;
2. create trip;
3. add prices;
4. correct an item;
5. reload/restore;
6. finish;
7. history;
8. repeat trip / remembered value where applicable;
9. degraded/recovery cases covered by browser harness;
10. accessibility scans/critical keyboard paths;
11. install manifest/service worker and offline active-trip/history recovery.

## PWA / offline shell

Automation must prove:

- the public release artifact contains a valid install manifest, install icons and generated service worker;
- guarded QA/beta/cohort/barcode-benchmark builds do not create competing service workers;
- after one successful online install/cache pass, the shell opens when network requests are unavailable;
- an active trip restores offline with exact canonical values;
- completion/history persistence continues offline;
- history restores after a subsequent offline reload;
- Cache Storage/service-worker behaviour never becomes shopping-state authority.

Service-worker updates must remain prompt-based. Automated or runtime update logic must never force an active shopping trip to reload.\n\nCI runs the full browser-offline reload journey in Chromium and Firefox. WebKit CI verifies the manifest, service-worker registration and precached application entry; Playwright WebKit offline navigation is not treated as Safari/device evidence because its Web Inspector harness cannot reliably navigate once offline.

## Exact-money contract

Tests must prove:

- no canonical float arithmetic;
- comma/period input follows MONEY-SPEC;
- extra fraction digits reject rather than silently round;
- product bounds hold;
- quantity multiplication remains safe;
- format does not mutate canonical values;
- known floating-point regression cases never leak into displayed canonical money.

The complete parser matrix lives in `specs/MONEY-SPEC.md`; do not duplicate it here.

## Persistence contract

Tests must prove:

- committed active-trip mutations attempt persistence promptly;
- failed history write does not clear active state;
- history-durable + active-clear failure becomes cleanup-pending/degraded;
- startup reconciles stale completed copies safely;
- malformed/future data is preserved or rejected according to contract;
- convenience-state failure never masquerades as core durable success.

Detailed storage cases live in `architecture/DATA-PERSISTENCE.md` and `specs/STORAGE-SCHEMA.md`.

## Price Memory / repeat use

Tests must prove:

- only eligible completed confirmed observations are learned;
- remembered values remain remembered;
- stale memory is not presented as authoritative current price;
- reuse does not fabricate a new observation timestamp;
- deletion is independent from history;
- Price Memory failure does not invalidate completed-trip durability.

## Accessibility

Automation:

- axe A/AA checks where applicable;
- landmarks;
- accessible names;
- semantic controls;
- no obvious ARIA/contrast failures.

Interaction:

- keyboard start → add → edit → finish;
- focus restoration after overlays;
- committed remaining-value announcements;
- disabled state semantics;
- no colour-only reserve/over-budget meaning.

Manual/visual release checks when relevant:

- 200% / large text;
- reduced motion;
- forced colours;
- 320–390px compact widths;
- touch target sizing;
- bright-store readability.

## Motion / premium interaction quality

Test behaviour, not decorative frames.

Verify:

- add/undo/edit work with reduced motion;
- no financial commit depends on animation callbacks;
- motion failure cannot duplicate/drop a mutation;
- important controls remain responsive;
- layout does not shift unpredictably as money values change.

Selective visual regression is useful for stable states such as:

- empty active trip;
- normal budget;
- near-limit;
- over-budget;
- keypad;
- completion summary.

Do not create brittle screenshot tests for every animation frame.

## Evidence tooling

### Timing QA

Automation may verify the recorder and eligibility rules.

It may not claim the human timing target was passed.

The QA recorder must not mutate shopping state or fabricate physical evidence.

Timing-evidence tests must also prove:

- an excluded timing sample stays in evidence;
- each exclusion references a real sample ID and requires a bounded non-empty reason;
- documented external interruptions are omitted from timing KPIs without deleting the sample;
- malformed/unknown exclusion references and tampered derived gate summaries are rejected.

### Retention beta

Tests must prove:

- evidence remains local unless explicitly copied or downloaded by the facilitator;
- no prices, budgets, item names, product/store identities or checkout values enter the evidence schema;
- event history is bounded;
- trip ordinals are session-relative;
- milestones deduplicate;
- entry completion/abandonment remain distinguishable;
- remembered reuse/current-price override remain distinguishable;
- recorder/storage failure cannot alter shopping behaviour;
- beta UI cannot block the primary flow;
- retained events cannot predate the beta session start;
- export `generatedAt` cannot predate retained session evidence;
- export UI handles invalid device-clock chronology without crashing the beta panel;
- local JSON download uses a non-identifying session-timestamp filename and preserves the same privacy-safe export contract as clipboard copy;
- 7/14/30-day retention uses maturity-aware denominators so right-censored participants are not counted as failures;
- each window-specific cohort summary exposes its eligible participant count;
- the cohort analyzer keeps recruitment readiness (20–50 real shoppers) separate from 7/14/30-day interpretation readiness;
- a window is not marked ready for interpretation until at least 20 participants are eligible for that specific window;
- aggregate second-/third-trip shares are visibly labelled as observed-so-far rather than time-normalized retention;
- second-/third-trip metrics require contiguous chronological trip starts rather than ordinal gaps;
- orphan or pre-start finish events do not inflate completed-trip counts;
- partial interaction evidence remains available for friction analysis without being promoted to retention/completion evidence;
- the local cohort analyzer rejects invalid/tampered exports and implausibly future-dated observation timestamps before aggregation;
- a newer export from the same retained evidence session replaces an older one rather than double-counting it;
- analyzer state remains page-memory only and aggregate copy/download output excludes raw participant events and filenames;
- local aggregate download uses a non-identifying timestamp filename and the exact same aggregate payload contract as clipboard copy.

Real-store retention evidence remains a human/product-validation gate.


### Barcode interaction benchmark

Automation may verify benchmark evidence integrity and route isolation. It may not claim scanner value without representative physical-device data.

Tests must prove:

- the benchmark is a standalone guarded build with no shopping-state access or PWA/service worker;
- public production JavaScript contains no benchmark markers/storage key;
- raw barcode values never enter persisted/exported evidence;
- confirmed/rejected/timeout/manual-fallback/detector-error outcomes remain distinct;
- confirmed latency reports median/P75/P90 deterministically;
- capability/permission/camera failures remain distinguishable from timed attempts;
- duplicate/malformed/tampered evidence is rejected;
- timed sample/failure capacity fails closed instead of silently truncating earlier evidence;
- an unresolved detector call cannot extend the eight-second timeout;
- stale detector results arriving after fallback/stop/timeout cannot resurrect a candidate or create a second outcome;
- camera startup failure releases acquired media tracks;
- repeated identical capability failure clicks do not inflate retained failure evidence;
- a changed viewport cannot start another timed scan in the retained environment;
- stopping an active scan records a fallback rather than silently dropping the attempt;
- evidence copy/download/reset is unavailable while a timed attempt is still in flight;
- local benchmark download uses a non-identifying timestamp filename and contains no raw barcode value;
- export/clock failure remains inside the evidence UI instead of crashing the benchmark;
- production barcode promotion still requires representative mobile evidence plus a paired quantitative manual baseline.

The current benchmark intentionally tests native `BarcodeDetector` only. Unsupported target devices are evidence, not a reason to silently add a fallback dependency.

## Performance

Protect:

- fast initial product load;
- immediate local add/edit/undo response;
- stable bundle trend;
- no QA/beta/cohort/barcode-benchmark evidence markers in the public JavaScript bundle;
- public JS/CSS remain within the enforced bundle budgets;
- optional future capability isolation.

Do not accept a premium visual effect that materially slows the core aisle interaction.

## Security / privacy

Tests and fixtures must avoid real personal shopping data.

Verify local-data deletion paths and ensure evidence tooling does not accidentally collect content.

## Regression policy

When a bug affects a meaningful user outcome:

1. reproduce it at the lowest useful layer;
2. add a regression test;
3. fix the cause;
4. keep the test readable as a future contract.

## What not to test

Avoid brittle tests for:

- private implementation structure;
- exact DOM nesting without semantic reason;
- CSS class names;
- decorative animation frames;
- arbitrary internal helper calls.

Protect behaviour, invariants and user outcomes.

## Release checklist

Before a significant release:

- full quality gate green;
- no unresolved money/persistence regression;
- critical browser journeys green;
- accessibility contract checked;
- current docs match current behaviour;
- any required human/evidence gate is explicitly pass/fail/not-run;
- premium polish has not compromised speed, clarity or accessibility.
