# Contributing

The integrated local QPE/AAT/GOAT workspace has shared runtime schemas, adapters and offline checks.
There is no gateway application or live provider checkout. Read [AGENTS.md](AGENTS.md),
[CONTEXT.md](CONTEXT.md), and [the plan](docs/plan.md) before work.

## Branches and pull requests

- Work only on the branch assigned to your slice. Current branches are `om/QPE` (Qatom Payment
  Execution), `om/AAT` (Agent and Attack Testing) and `om/GOAT` (GOAT integration).
- `main` is the PR base. Do not commit directly to it. The owner merges and deploys.
- Follow the dated stacked-work exception in [Division.md](Division.md) for Om's QPE, AAT and GOAT
  dependencies. The planned PR chain is #1 QPE → `main`, #2 AAT → QPE, #3 GOAT → AAT. The owner
  retargets and merges dependencies; do not auto-merge. This does not imply other owners accepted
  shared contracts.
- Keep each PR to one coherent slice. Use small commits with one objective each.
- State behavior, evidence, risks, and what remains unverified in the PR description. Link relevant
  contracts and acceptance criteria. Do not claim a test or check ran unless it exists and you ran
  it on that head.
- Use the repository [PR template](.github/pull_request_template.md). For docs-only changes,
  validate Markdown links, run `git diff --check`, and read the full diff. Do not invent runtime
  checks for a documentation change.
- Keep changes within owned files and modules. Do not revert another contributor's work.
- Do not merge, deploy, apply migrations or write to production. Migrations must be additive and
  are applied only by the owner after a separate gate.
- No AI-generator footers or co-author trailers.

## Review sequence

For runtime work, GPT 6.1 Sol first reviews scope, interfaces, edge cases, control points and
acceptance. GPT 6 Luna builds and fixes. Sol reviews the built result and fixes. Final adversarial
review is a separate explicit Om trigger for the specified PR scope only, using Claude API credits,
`claude-opus-5-5`, medium effort. Do not automatically start that review or use another provider.

Current local checks are `npm ci --ignore-scripts`, `npm run typecheck`, `npm run lint`, `npm test`,
`npm run build`, and `. .venv-pdf/bin/activate && npm run test:pdf`. Vitest includes the 39 baseline
package/service tests, 18 GOAT tests, and 3 public-export integration tests. Record exact commands
and exit results for the actual head. These checks do not establish live Qatom capabilities or
gateway integration. Never infer a green check on one head proves a later head.
