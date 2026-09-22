# Documentation map

This directory contains current product/engineering contracts, specialized executable contracts, supporting reference, evidence protocols, research, and historical material.

The goal is to keep **authority and reading scope explicit** so a contributor or AI agent can load only the context required for the task.

## Authority

Current behaviour is established by code + executable tests. Product intent and allowed behaviour are established by the authoritative contracts below.

If code and an authoritative contract disagree, treat it as documentation or implementation drift and reconcile the owning sources in the same change.

## Authoritative documents

| Document | Owns |
| --- | --- |
| [PRODUCT.md](./PRODUCT.md) | product thesis, scope, principles, success criteria |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | current dependency boundaries, state ownership, architectural invariants |
| [DOMAIN.md](./DOMAIN.md) | money, trip, item, provenance and domain invariants |
| [DESIGN.md](./DESIGN.md) | current visual/interaction system and accessibility-oriented design direction |
| [ROADMAP.md](./ROADMAP.md) | current evidence gates and future capability sequencing |
| [TESTING.md](./TESTING.md) | quality strategy, regression expectations and release verification |

Detailed executable contracts live in [specs/](./specs/). Specialized contracts refine the authoritative documents; they do not override them.

Important specialized contracts:

- [architecture/DATA-PERSISTENCE.md](./architecture/DATA-PERSISTENCE.md)
- [quality/ACCESSIBILITY.md](./quality/ACCESSIBILITY.md)
- [specs/MONEY-SPEC.md](./specs/MONEY-SPEC.md)
- [specs/MVP-SPEC.md](./specs/MVP-SPEC.md)
- [specs/STATE-MACHINES.md](./specs/STATE-MACHINES.md)
- [specs/STORAGE-SCHEMA.md](./specs/STORAGE-SCHEMA.md)

Cross-cutting, expensive or reversibility-sensitive decisions belong in [DECISIONS.md](./DECISIONS.md).

## Read by task

Use the smallest relevant set.

| Task | Read first |
| --- | --- |
| money/parser/quantity | PRODUCT → DOMAIN → MONEY-SPEC → tests |
| ShoppingTrip command/selector | PRODUCT → DOMAIN → relevant spec → tests |
| controller/lifecycle | ARCHITECTURE → STATE-MACHINES → controller tests |
| persistence/recovery/history | ARCHITECTURE → DATA-PERSISTENCE → STORAGE-SCHEMA → storage/controller tests |
| price memory/repeat trip | PRODUCT → DOMAIN → relevant decisions/specs → tests |
| UI/interaction | PRODUCT → DESIGN → ACCESSIBILITY when relevant → component/E2E tests |
| CI/testing | TESTING → workflow/config files |
| new feature / sequencing | PRODUCT → ROADMAP → relevant DECISIONS/research |
| brand/marketing | PRODUCT first, then reference/research material |

Do not load research or archive material unless the task actually needs historical rationale or external evidence.

## Supporting reference

These are useful context but are not independent sources of current implementation status:

- [reference/FUNCTIONALITY.md](./reference/FUNCTIONALITY.md)
- [reference/UX.md](./reference/UX.md)
- [reference/BRAND.md](./reference/BRAND.md)
- [reference/SCENARIOS.md](./reference/SCENARIOS.md)
- [reference/TECH-STACK.md](./reference/TECH-STACK.md)
- [reference/MARKETING.md](./reference/MARKETING.md)

If supporting reference conflicts with an authoritative contract, the authoritative contract wins.

## Evidence and validation

Evidence documents define how claims become validated:

- [evidence/SPRINT-B-QUALITY-GATE.md](./evidence/SPRINT-B-QUALITY-GATE.md)
- [evidence/RETENTION-BETA.md](./evidence/RETENTION-BETA.md)
- [evidence/RETENTION-BETA-PLAYBOOK.md](./evidence/RETENTION-BETA-PLAYBOOK.md)
- [evidence/BRAND-IMPLEMENTATION-AUDIT.md](./evidence/BRAND-IMPLEMENTATION-AUDIT.md)
- [evidence/PHASE-4-DESIGN-VALIDATION.md](./evidence/PHASE-4-DESIGN-VALIDATION.md)

Automated tests prove implementation behaviour. They do not substitute for explicitly required human/device evidence.

## Research and launch material

Research informs decisions; it does not silently redefine the product:

- [research/COMPETITIVE-RESEARCH.md](./research/COMPETITIVE-RESEARCH.md)
- [research/PRODUCT-SUCCESS-STRATEGY.md](./research/PRODUCT-SUCCESS-STRATEGY.md)
- [research/TECHNOLOGY-RESEARCH.md](./research/TECHNOLOGY-RESEARCH.md)
- [research/MARKETING-RESEARCH.md](./research/MARKETING-RESEARCH.md)
- [marketing/LAUNCH-CHECKLIST.md](./marketing/LAUNCH-CHECKLIST.md)
- [marketing/STORE-LISTING-SPEC.md](./marketing/STORE-LISTING-SPEC.md)

## Historical material

[archive/](./archive/) contains completed execution plans and superseded status-heavy material kept for traceability.

Archived files are never current instructions.

## Maintenance rule

When behaviour changes:

1. update code and executable tests;
2. update the smallest authoritative document that owns the changed rule;
3. update specialized specs only where the contract changed;
4. record a material cross-cutting decision in `DECISIONS.md`;
5. archive completed execution detail instead of keeping stale phase narration in current docs;
6. avoid duplicating the same current-status checklist in multiple files.

Prefer present-tense contracts over chronological implementation narration.
