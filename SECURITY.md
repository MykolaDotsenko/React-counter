# Security Policy

## Supported code

Security fixes target the current `main` branch.

This is a local-first browser application with no production backend, account system or remote analytics dependency. Security work should preserve that small attack surface.

## Reporting a vulnerability

Do not publish exploit details, private user data or sensitive reproduction material in a public issue.

Prefer GitHub's private vulnerability-reporting / security-advisory flow when it is available for this repository. If that option is unavailable, open a minimal public issue asking the maintainer for a private reporting channel and omit exploit details.

Include, when relevant:

- affected commit/version;
- impact;
- minimal reproduction steps;
- browser/platform;
- whether stored shopping data can be read, altered or lost;
- suggested mitigation if known.

## Security expectations

Changes must preserve:

- runtime validation at persistence boundaries;
- exact-money invariants;
- no unsafe HTML injection;
- least-privilege GitHub Actions permissions;
- dependency lockfile integrity;
- no secrets committed to the repository;
- manual/local-first functionality without mandatory third-party providers.
