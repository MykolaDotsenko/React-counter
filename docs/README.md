# Documentation map

This directory contains product contracts, implementation contracts, evidence protocols, research, and historical execution material.

The purpose of this index is to make **authority explicit**. A document being detailed does not make it a competing source of truth.

## Current authoritative documents

These define the current product and implementation direction:

| Document | Authority |
| --- | --- |
| [PRODUCT.md](./PRODUCT.md) | product thesis, scope, principles, success criteria |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | dependency boundaries, ownership, architectural invariants |
| [DOMAIN.md](./DOMAIN.md) | business concepts, money rules, domain invariants |
| [DESIGN.md](./DESIGN.md) | current visual and interaction-system direction |
| [ROADMAP.md](./ROADMAP.md) | sequencing, evidence gates, future breadth |
| [TESTING.md](./TESTING.md) | quality strategy and release verification |

Detailed executable contracts live in [specs/](./specs/). Specialized contracts such as [DATA-PERSISTENCE.md](./architecture/DATA-PERSISTENCE.md) and [ACCESSIBILITY.md](./quality/ACCESSIBILITY.md) refine the authoritative documents; they do not replace them.

Architecture and product decisions that materially change these contracts belong in [DECISIONS.md](./DECISIONS.md).

## Supporting reference

These documents preserve useful detail, scenario reasoning, language, or research context, but **must not independently redefine current product status**:

- [FUNCTIONALITY.md](./reference/FUNCTIONALITY.md) — extended functional catalogue and edge-case reference
- [UX.md](./reference/UX.md) — detailed UX heuristics and interaction reference
- [BRAND.md](./reference/BRAND.md) — brand, voice, naming, and messaging reference
- [SCENARIOS.md](./reference/SCENARIOS.md) — scenario inventory and risk analysis
- [TECH-STACK.md](./reference/TECH-STACK.md) — technology rationale and future candidates
- [MARKETING.md](./reference/MARKETING.md) — acquisition/positioning strategy, not implementation status

If a supporting document conflicts with a current authoritative contract, the authoritative contract wins and the reference document should be reconciled.

## Evidence and validation

- [SPRINT-B-QUALITY-GATE.md](./evidence/SPRINT-B-QUALITY-GATE.md) — physical timing and one-hand evidence contract
- [RETENTION-BETA.md](./evidence/RETENTION-BETA.md) — retention instrumentation contract
- [RETENTION-BETA-PLAYBOOK.md](./evidence/RETENTION-BETA-PLAYBOOK.md) — real-store retention study protocol
- [BRAND-IMPLEMENTATION-AUDIT.md](./evidence/BRAND-IMPLEMENTATION-AUDIT.md) — implementation audit evidence
- [design/PHASE-4-DESIGN-VALIDATION.md](./evidence/PHASE-4-DESIGN-VALIDATION.md) — design validation evidence

Automated tests are evidence of implementation behavior; they are not substitutes for explicitly required human/device evidence.

## Research and launch material

- [COMPETITIVE-RESEARCH.md](./research/COMPETITIVE-RESEARCH.md)
- [PRODUCT-SUCCESS-STRATEGY.md](./research/PRODUCT-SUCCESS-STRATEGY.md)
- [tech/TECHNOLOGY-RESEARCH.md](./research/TECHNOLOGY-RESEARCH.md)
- [marketing/RESEARCH.md](./research/MARKETING-RESEARCH.md)
- [marketing/LAUNCH-CHECKLIST.md](./marketing/LAUNCH-CHECKLIST.md)
- [marketing/STORE-LISTING-SPEC.md](./marketing/STORE-LISTING-SPEC.md)

Research informs decisions; it does not silently override current contracts.

## Historical execution material

Completed sprint/task decomposition belongs under [archive/](./archive/).

Historical documents remain available for traceability, but they are not current implementation instructions.

## Maintenance rule

When a behavior changes:

1. update the smallest authoritative document that owns the rule;
2. update the corresponding detailed spec/test if applicable;
3. record a material architectural/product decision in `DECISIONS.md`;
4. reconcile supporting reference only where it would otherwise become misleading;
5. do not duplicate current-status checklists across multiple documents.

This authority model is intended to keep the documentation useful as the repository grows instead of turning every planning document into a permanent source of truth.
