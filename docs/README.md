# Documentation map

The documentation is organized to minimize AI/contributor context while keeping current contracts explicit.

## Authority

Current implementation truth:

1. code + green executable tests.

Current intended behaviour:

2. authoritative documents listed below.

Rationale/history:

3. decisions, reference, research and archive.

If code and an authoritative contract disagree, reconcile the drift in the same change.

## Authoritative documents

| Document | Owns |
| --- | --- |
| [PRODUCT.md](./PRODUCT.md) | product job, principles, competitive strategy, feature decision rule |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | dependency boundaries, state ownership, architectural invariants |
| [DOMAIN.md](./DOMAIN.md) | current business concepts and invariants |
| [DESIGN.md](./DESIGN.md) | current production visual/interaction contract |
| [ROADMAP.md](./ROADMAP.md) | current evidence gates and future sequencing |
| [TESTING.md](./TESTING.md) | current quality/release contract |

Detailed executable specs:

- [specs/MONEY-SPEC.md](./specs/MONEY-SPEC.md)
- [specs/MVP-SPEC.md](./specs/MVP-SPEC.md)
- [specs/STATE-MACHINES.md](./specs/STATE-MACHINES.md)
- [specs/STORAGE-SCHEMA.md](./specs/STORAGE-SCHEMA.md)

Specialized contracts:

- [architecture/DATA-PERSISTENCE.md](./architecture/DATA-PERSISTENCE.md)
- [quality/ACCESSIBILITY.md](./quality/ACCESSIBILITY.md)

Cross-cutting durable decisions:

- [DECISIONS.md](./DECISIONS.md) — short ADR index; open only the relevant category file

## Read by task

| Task | Read |
| --- | --- |
| money/parser | PRODUCT → DOMAIN → MONEY-SPEC → affected tests |
| trip command/selector | PRODUCT → DOMAIN → STATE-MACHINES where relevant → tests |
| controller/lifecycle | ARCHITECTURE → STATE-MACHINES → controller tests |
| persistence/recovery | ARCHITECTURE → DATA-PERSISTENCE → STORAGE-SCHEMA → tests |
| UI/interaction | PRODUCT → DESIGN → ACCESSIBILITY → component/E2E tests |
| tests/CI | TESTING → workflow/config |
| new capability | PRODUCT → ROADMAP → relevant decision/research |
| premium/brand polish | PRODUCT → DESIGN → BRAND reference only if identity work |
| historical rationale | relevant DECISIONS/reference/archive only |

Do not read all docs for a narrow change.

## Supporting reference

Reference adds rationale or future planning; it does not redefine current implementation status.

- [reference/FUNCTIONALITY.md](./reference/FUNCTIONALITY.md)
- [reference/UX.md](./reference/UX.md)
- [reference/BRAND.md](./reference/BRAND.md)
- [reference/SCENARIOS.md](./reference/SCENARIOS.md)
- [reference/TECH-STACK.md](./reference/TECH-STACK.md)
- [reference/MARKETING.md](./reference/MARKETING.md)
- [reference/DESIGN-RATIONALE.md](./reference/DESIGN-RATIONALE.md)
- [reference/FUTURE-QUALITY-PLANS.md](./reference/FUTURE-QUALITY-PLANS.md)

## Evidence

Evidence documents define how claims become validated:

- [evidence/SPRINT-B-QUALITY-GATE.md](./evidence/SPRINT-B-QUALITY-GATE.md)
- [evidence/RETENTION-BETA.md](./evidence/RETENTION-BETA.md)
- [evidence/RETENTION-BETA-PLAYBOOK.md](./evidence/RETENTION-BETA-PLAYBOOK.md)
- [evidence/PHASE-4-DESIGN-VALIDATION.md](./evidence/PHASE-4-DESIGN-VALIDATION.md)

Automation does not substitute for explicitly required human/device evidence.

## Research / launch

Use only when the task depends on market evidence, alternatives or launch strategy:

- [research/COMPETITIVE-RESEARCH.md](./research/COMPETITIVE-RESEARCH.md)
- [research/PRODUCT-SUCCESS-STRATEGY.md](./research/PRODUCT-SUCCESS-STRATEGY.md)
- [research/TECHNOLOGY-RESEARCH.md](./research/TECHNOLOGY-RESEARCH.md)
- [research/MARKETING-RESEARCH.md](./research/MARKETING-RESEARCH.md)
- [marketing/LAUNCH-CHECKLIST.md](./marketing/LAUNCH-CHECKLIST.md)
- [marketing/STORE-LISTING-SPEC.md](./marketing/STORE-LISTING-SPEC.md)

## Historical material

[archive/](./archive/) is traceability only.

Archived files are never current instructions.

## Maintenance

When behaviour changes:

1. update code/tests;
2. update the smallest owning authoritative contract;
3. update a detailed spec only if its executable contract changed;
4. add a decision only for durable cross-cutting choices;
5. move useful rationale out of current contracts;
6. delete duplicated status narration.

Current docs use only:

- **IMPLEMENTED**
- **VALIDATED**
- **PLANNED / GATED**
- **HISTORICAL**
