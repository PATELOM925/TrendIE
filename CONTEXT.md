# Current context

**Checked:** 2026-11-14. Om PR #1/#2/#3 are merged to `develop` at `b576c12`. This candidate combines
that integration with pinned Awais source `0b7d110` and scoped gateway test-safety changes. Awais
remains HOLD pending gateway/payment authority fixes; this candidate is not a live checkout or
adversarial clearance. Qatom legacy HTTP behavior is fail-closed. Current published heads recorded for this integration
are Om PR #1 QPE `7fe5e24c1668ee674223f0849a84f39150310966`, PR #2 AAT
`a0d57e3580a565e00d5037a1d4241ed84db204d4`, PR #3 GOAT
`139e5dab964bb77e47a8290d5e9cd880de7a03a8`, and Awais branch
`origin/awais/security-backend` `5a9d3d4283e680ed8aa68de00fe8a677889af1be`. All three Om PRs are
open. Awais's branch has no PR recorded here. Nassar's frontend and a Tirth branch are not visible.
No new adversarial clearance is recorded; see [integration review](docs/reviews/2026-11-14-integration.md).

The owner-approved workflow is to combine the reviewed/fixed branches on `develop`, resolve and
preview integration there, and keep `main` for production. PR #1 targets `develop`; #2 remains based
on QPE and #3 on AAT until the owner handles sequential merge/retargeting. Do not merge to `main`,
deploy, apply migrations, or write production under this workflow. See [the plan](docs/plan.md).

## Implementation and integration evidence

| Slice | Evidence at pinned head | Still needed |
|---|---|---|
| Person 1 / Awais gateway | Published branch contains Fastify/Postgres intent, policy, verify/consume, result, audit and review routes, tests and a Qatom HTTP bridge. This establishes submitted source, not passing tests or live behavior. | Contract alignment with QPE/GOAT, combined Postgres-backed tests against real local endpoints, auth/storage review and safe migration plan. |
| Person 2 / GOAT, Om | Testnet3 adapter and proposed authority interface; native transfer path locally compiled and fake-tested. | Gateway contract alignment, configured test wallet, separately authorized bounded testnet action and checked receipt. |
| Person 3 / Qatom/QPE, Om | Node 22 npm workspace, contracts and read-only MCP client; paid checkout remains disabled by default. | Authenticated tool/schema evidence, exact atomic price binding, receipt semantics, and gateway alignment. |
| Person 4 / AAT, Om | Synthetic clean/malicious fixtures and local proposal/inspection/PDF integration fixtures. | Real model attack evidence (if authorized), combined gateway/Qatom integration and reproducible security comparisons. |
| Person 5 / Nassar | No frontend branch visible. | UI and system integration against aligned public interfaces. |

The source-level contract matrix is in [integration](docs/integration.md). It records concerns in
the Qatom bridge (USD-TDN mapped to USDC, local binding/expiry fabrication, and unchecked outcome
HTTP status) as items to resolve in review, not as a completed review verdict. Existing offline
tests are local evidence only. Do not infer that the gateway test files passed.

Stages 1–3 are not complete: local slices exist across Persons 1–4, but owner approval, aligned
contracts, combined local Postgres endpoint tests, model-based attack evidence, a GOAT receipt and
authenticated Qatom checkout are outstanding. Stage 4 security comparisons and Stage 5 demo
verification remain; Stage 6 escrow is optional stretch work. Merging to `develop` alone completes
none of these acceptance gates.

## Setup and live boundaries

Qatom and Backboard dashboard tabs were visible in the user's browser, but page content was not
readable. Sign-in, plan, credits, API keys, wallet and buyer funding are **not verified**. The
BuilderBase event page UI displayed “Live, submissions close tomorrow at 10:00 EST” on Nov 14,
implying Nov 15 10:00 EST; confirm this with the organizer before treating it as the cutoff. The
event end is listed separately as Nov 15 at 5 PM EST. See [hackathon facts](docs/hackathon.md).

Use [the local setup guide](docs/testing-setup.md) for reproducible build steps and distinct
provider gates. No production database, paid provider call, chain transaction or external message
was used for this documentation task. No numeric paid-call ceiling is approved; paid execution
remains zero by default (Q003).

## Current local checks

The recorded Om integrated-head checks were 60 Vitest tests and 4 PDF tests, plus typecheck, lint,
build and dependency audit. They apply only to the stated Om head, not Awais's branch or a combined
`develop` head. See [dependency audit](docs/dependencies.md) for unresolved release risks. Do not
claim checks on another head until run there.

## Next owner actions

1. Complete the pinned adversarial review and fix any accepted findings on their owning branches.
2. Align exact intent, approval, money/unit, execution, checkpoint, result, error and audit contracts
   across Awais, QPE and GOAT; preserve `unknown` whenever dispatch may have succeeded.
3. After review/fixes, integrate the authorized slices on `develop`; resolve conflicts and run the
   separate combined local checks in [testing setup](docs/testing-setup.md). Never migrate or use
   production for these checks.
4. Obtain authenticated Qatom capabilities and verify price binding/receipt; obtain numeric paid
   authorization separately before any paid call. Configure an isolated GOAT test wallet and get a
   separate explicit testnet spend ceiling before a transaction.
5. Nassar implements the frontend when available. Rehearse only on an authorized test environment.

Open decisions and blockers: [docs/questions.md](docs/questions.md).
