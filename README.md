# TrendIE — Agentic Payment Guard

**Status:** local QPE, AAT and GOAT libraries and offline integration fixtures are implemented.
Awais has a published gateway branch that is not yet integrated or verified against these
contracts. No Nassar frontend, authenticated Qatom schema or verified live payment integration is
recorded. Project Stages 1–3 remain open.

Start with:

- [Contribution rules and ownership](AGENTS.md)
- [Current status and next work](CONTEXT.md)
- [Product requirements](PRD.md)
- [Team roles](Division.md)
- [Implementation plan](docs/plan.md)
- [Architecture and implementation boundary](ARCHITECTURE.md)
- [Shared contracts](docs/contracts.md)
- [QPE integration boundary](docs/integration.md)
- [Open questions](docs/questions.md)
- [Dependency audit and release risk](docs/dependencies.md)
- [Qatom runbook](docs/qatom-runbook.md)
- [Threat model](docs/security.md)
- [Hackathon facts and unknowns](docs/hackathon.md)
- [Local test and provider setup](docs/testing-setup.md)
- [Unsent sponsor and organizer questions](docs/sponsor-questions.md)
- [Glossary](GLOSSARY.md)
- [Changelog](CHANGELOG.md)

The version 1 contracts and gateway ports remain proposals until their owners align on them.
Integration and preview work is authorized on `develop`; `main` remains production-only. Local
fixture authority is test-only. Local checks are not evidence of live payment, gateway controls or
production settlement. See [current context](CONTEXT.md) for stage-by-stage evidence and next steps.
