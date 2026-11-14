# Contribution rules

Read this entry point before changing the repository. The reviewed `develop` integration contains
the Node 22 QPE/AAT/GOAT workspace, proposed shared contracts, a read-only Qatom MCP client, guarded
adapters, PDF inspection and offline integration fixtures. Awais gateway source through `11a66a1` is merged for local/test work; its full adapter authority
contract and real PostgreSQL behavior remain unverified. Nassar's frontend is implemented for
local/test use; authenticated provider schema evidence and verified live checkout are not recorded.
Project Stages 1–3 remain open. Read
[CONTEXT.md](CONTEXT.md) and do not describe fake-tested behavior as live.

## Owners and gates

- Awais owns security, backend and authorization (Person 1).
- Om primarily owns Qatom (Person 3) while Tirth is unavailable, then agent and attack work
  (Person 4); GOAT (Person 2) is opportunistic through Stage 3.
- Nassar (repository contribution identity Nasar) owns frontend and system integration (Person 5).
- Preserve original role numbers and scopes. See [Division.md](Division.md) and [the plan](docs/plan.md).
- `develop` is the authorized integration/preview branch; `main` is production-only. Use focused
  PRs with small objective commits. Om PRs #1–#3 and combined gateway PR #4 are merged. New work
  starts from current `origin/develop`; the owner controls integration/release authorization.
  Contributors do not deploy or merge to `main`. Do not auto-merge stack layers.
- The owner-approved 2026-11-14 stacked-work exception is recorded in [Division.md](Division.md):
  Om's AAT may build on QPE and GOAT may build on AAT while dependencies await owner merge. This
  does not imply Awais or Nassar accepted these contract shapes.
- All orchestration, planning and implementation review for this project use GPT 6.1 Sol. All
  builds and fixes use GPT 6 Luna. Before runtime work, Sol reviews scope, interfaces, edge cases,
  control points and acceptance. Sol reviews the built result and fixes. Final adversarial review
  starts only when Om explicitly requests a specified PR scope, using Claude API credits,
  `claude-opus-5-5`, medium effort. Do not run it automatically or substitute another provider.
- The user authorized reviewed/fixed integration merges into `develop` for this task. Never merge
  to `main`, deploy, apply a database migration or write to production. Report checks only when they exist
  and have been run on the head under discussion; local checks do not prove live capabilities.
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
- [QPE integration boundary](docs/integration.md)
- [Open questions](docs/questions.md)
- [Qatom runbook](docs/qatom-runbook.md)
- [Plan and acceptance](docs/plan.md)
- [Proposed contracts](docs/contracts.md)
- [Threat model](docs/security.md)
- [Hackathon facts and unknowns](docs/hackathon.md)
- [Glossary](GLOSSARY.md)
- [Changelog](CHANGELOG.md)
- [Proposed ADR 0001](docs/adr/0001-guarded-payment-execution.md)
