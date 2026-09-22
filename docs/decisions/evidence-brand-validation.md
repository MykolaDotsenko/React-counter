# Evidence, Brand and Validation Decisions

## Status

Accepted decision records. These explain durable choices but do not override current code/tests or authoritative current contracts.

Use [../DECISIONS.md](../DECISIONS.md) as the retrieval index.

## D-021 — CartRoom remains a working codename, not the locked product name

Date: 2026-09-21

Status: accepted

### Decision

Use CartRoom only as a working internal brand until final naming work includes:

- trademark/conflict review
- domain/handle checks
- App Store/Google Play checks
- recall/pronunciation testing
- international interpretation review

### Rationale

CartRoom fits the “remaining room” metaphor, but “cart” is saturated and “room” is generic. Current search did not surface a major shopping-budget app with the exact name, but search is not legal clearance.

### Consequence

Do not rename repository/package/store identity to CartRoom yet.

Marketing drafts may use [Brand] placeholders or identify CartRoom explicitly as a working name.

### Revisit when

Naming research is complete enough to make a durable public decision.

## D-039 — Human B6 gate is explicitly waived for continued development, not declared passed

Date: 2026-09-21

Status: accepted risk

### Decision

Continue development beyond the Sprint B human B6 gate without claiming that representative one-hand timing, physical reach, software-keyboard, or bright-store validation has passed.

The automated/code B6 gate remains valid and green. The human KPI remains **unverified**.

### Rationale

The project owner explicitly chose to continue implementation rather than pause roadmap work for a manual physical-device test.

This is a sequencing waiver, not evidence. Automated browser timing, Playwright, desktop emulation, or AI review must not be re-labelled as representative human interaction evidence.

### Consequence

- the public/default shell remains guarded unless a later explicit release decision changes that
- documentation must distinguish `automated-green` from `human-unverified`
- the <=2.5 second one-hand KPI must not be described as achieved
- Phase 6 correction/confidence work may proceed
- the experimental scanner benchmark is deferred because its meaningful comparison also depends on representative human interaction evidence
- future release/marketing work must revisit the human gate before making speed or physical-usability claims

### Revisit when

Representative physical-device evidence is recorded, or when the project owner explicitly changes the release-quality policy with documented rationale.

## D-043 — Structured physical evidence is required for B6 eligibility

Date: 2026-09-22

Status: accepted

### Decision

The B6 empirical timing gate must not infer physical test conditions from free-form notes.

QA timing schema v3 requires explicit structured evidence for:

- comparable input method
- one-handed primary timing use
- bright/store-like physical lighting
- default system text size
- primary device/browser
- compact-phone/equivalent spot-check

Dark appearance, 200%/large text, and reduced-motion physical checks are recorded independently as:

- `not-run`
- `pass`
- `fail`

A recorded secondary physical failure blocks B6 eligibility immediately.

A `not-run` value remains visible and must never be interpreted as a physical pass.

Valid v2 timing samples and device labels migrate to v3, but migration deliberately initializes the new physical-context fields as unverified.

### Rationale

The B6 KPI is a human physical-interaction gate.

Timing samples alone cannot prove:

- one-handed use
- store-like lighting
- default text conditions
- consistent real input method

Keeping these facts only in notes makes the release result too easy to overstate and too hard to audit.

Preserving valid v2 timing evidence avoids throwing away legitimate measurements while refusing to fabricate evidence that v2 never recorded.

### Consequence

- B6 remains human-unverified until the v3 primary context is explicitly completed
- the same input-method label must accompany comparable timing samples
- a migrated v2 session cannot become B6-eligible merely because its old checklist was complete
- secondary physical checks are optional to run where unavailable, but any recorded failure is a B6 blocker
- automation may verify the recorder and migration logic but still cannot prove the <=2.5 second human KPI

### Revisit when

The B6 physical-device protocol changes materially, or real testing shows that different structured context is needed to explain timing variance.

## D-044 — Guarded shopping builds use provisional product identity without locking the final brand

Date: 2026-09-22

Status: accepted

### Decision

Keep internal QA/beta browser metadata distinct from the public product context without creating a second product identity.

The guarded `/qa/` and `/beta/` builds use:

- the descriptive migration label `Shopping Budget Companion`
- a provisional remaining-room favicon/mark
- warm shopping theme metadata
- shopping-specific descriptions
- noindex/nofollow/noarchive

The public/default root is Shopping Budget Companion. QA and beta routes remain internal evidence surfaces.

The provisional mark must follow the brand metaphor rather than decorative spectacle:

- rounded boundary/container
- intentionally open/remaining space
- no gradient
- no euro symbol
- no cart/calculator/AI-sparkle cliché

This decision does not lock `CartRoom`, the current accent hue, or a final production icon family.

### Rationale

The guarded shopping experience already implements Calm Utility, remaining-first hierarchy, and local-first trust. Using an obsolete prototype favicon or inconsistent browser naming would create a visible identity contradiction.

At the same time, promoting a working codename or provisional colour to final commercial identity before naming and recognition evidence would create a different form of premature lock-in.

A migration-specific product label and provisional metaphor-led mark resolve the current drift while preserving reversibility.

### Consequence

- QA and beta builds inherit the same core product identity while specializing their internal title/description
- static post-build metadata and runtime React metadata must stay aligned
- the public root is the canonical Shopping Budget Companion
- future brand PRs use `docs/evidence/BRAND-IMPLEMENTATION-AUDIT.md` as the anti-drift checklist
- final naming, accent and production icon work remain evidence-gated
- the shopping mark should not be added persistently to active-trip UI where it would compete with the remaining amount

### Revisit when

Final naming/conflict checks are complete, or user evidence requires a different visual identity direction.

## D-047 — B6 timing evidence must be internally verifiable

Date: 2026-09-22

Status: accepted

### Decision

The B6 timing recorder treats empirical evidence as a validated artifact rather than a free-form clipboard dump.

Each timing sample must have:

- a non-empty unique sample ID
- a positive finite duration
- a positive integer minor-unit price
- a positive safe-integer quantity
- an exact safe-integer line total equal to unit price × quantity
- a positive budget and non-negative safety buffer
- a canonical ISO completion timestamp

Stored sessions reject duplicate sample IDs. Representative KPI summaries re-check sample integrity before counting a sample.

Copied evidence uses a versioned `shopping-timing-evidence` export. The export contains the validated QA session plus a derived B6 gate summary. Import validation recomputes the gate from the session and rejects a tampered derived summary.

The export privacy declaration is explicit: no network transmission, item names, or store history are included, while device metadata is intentionally present because physical-test context is part of the evidence.

A separate two-step **Start fresh QA session** action clears empirical QA state and recaptures the current environment. Resetting only timing samples deliberately preserves the existing environment and checklist context.

### Rationale

Human evidence is useful only if later reviewers can tell whether the recorded measurements are internally coherent and whether a copied summary was derived from the same underlying samples.

The previous recorder already separated QA state from product state, but it trusted several sample fields independently and exported an unversioned report. That left avoidable opportunities for malformed, duplicate, stale-environment, or manually altered evidence to look legitimate.

### Consequence

- invalid or mathematically inconsistent timing samples fail closed
- duplicate sample IDs cannot inflate a timing cohort
- stale environment metadata can be intentionally discarded without clearing browser product data
- copied evidence has a stable machine-readable envelope
- derived B6 status is never trusted independently from the validated session
- none of these checks substitutes for the required physical human test

### Revisit when

The empirical protocol, timing schema, or cross-device evidence model changes materially.
