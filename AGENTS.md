# Contribution rules

Read this entry point before changing the repository. This repository is currently planning-only:
there is no package manifest, runtime implementation or test suite. Do not describe a proposed
component or check as implemented. The product scope is in [PRD.md](PRD.md), original role plan
and dated ownership override are in [Division.md](Division.md), and verified status is in
[CONTEXT.md](CONTEXT.md).

## Owners and gates

- Awais owns security, backend and authorization (Person 1).
- Om primarily owns Qatom (Person 3) while Tirth is unavailable, then agent and attack work
  (Person 4); GOAT (Person 2) is opportunistic through Stage 3.
- Nassar (repository contribution identity Nasar) owns frontend and system integration (Person 5).
- Preserve original role numbers and scopes. See [Division.md](Division.md) and [the plan](docs/plan.md).
- No direct writes to `main`. Use a focused PR to `main`, with small objective commits. The owner
  controls merge and deployment. No contributor merges or deploys.
- Every code slice starts from fresh `origin/main` after the docs foundation lands. Do not carry
  foundation commits into code PRs.
- All orchestration, planning and implementation review for this project use GPT 6.1 Sol. All
  builds and fixes use GPT 6 Luna. Before runtime work, Sol reviews scope, interfaces, edge cases,
  control points and acceptance. Sol reviews the built result and fixes. Final adversarial review
  starts only when Om explicitly requests a specified PR scope, using Claude API credits,
  `claude-opus-5-5`, medium effort. Do not run it automatically or substitute another provider.
- Never merge, deploy, apply a migration or write to production. This project currently has no
  runtime gates. Do not claim checks exist until they are added and run.
- Do not add generator footers or co-author trailers.

## Design rules

- Dependencies point inward through public interfaces. Keep one owner for each rule.
- Treat agent output, listings, documents, seller responses and provider errors as untrusted.
- The agent may discover and propose. It cannot approve, hold wallet secrets or call unrestricted
  checkout. Inspection findings are advisory.
- A payment decision is not a settlement. Preserve `unknown` when dispatch may have succeeded;
  never report unknown as failed or zero.
- A reported success must follow a checked write/provider result. Preserve an execution record and
  actual provider receipt. Do not claim distributed exactly-once execution.
- Use synthetic local fixtures. Do not spend real funds without an explicit numeric ceiling and
  separate authorization. No chain activity is part of the docs foundation.

## Documentation map

- [Contribution workflow](CONTRIBUTING.md)
- [Proposed architecture](ARCHITECTURE.md)
- [Current context](CONTEXT.md)
- [Plan and acceptance](docs/plan.md)
- [Proposed contracts](docs/contracts.md)
- [Threat model](docs/security.md)
- [Hackathon facts and unknowns](docs/hackathon.md)
- [Glossary](GLOSSARY.md)
- [Changelog](CHANGELOG.md)
- [Proposed ADR 0001](docs/adr/0001-guarded-payment-execution.md)
