# Current context

**Checked:** 2026-11-14. Om PRs #1, #2 and #3 are merged into `develop`. Combined gateway
[PR #4](https://github.com/PATELOM925/TrendIE/pull/4) is also merged at
`56926a28833067cb1d20c2ce174bcfad44de0232`, containing reviewed runtime/documentation source
`9ffdba59b94d6991c7286686e822c6731d5f09ea` and Awais's published work through
`11a66a17d9aa454eb4430bfe844c03798b0254d5`. The final Opus verdict on `9ffdba5` was **SHIP for
local/test integration**, with no P0–P2 local merge blocker, and **HOLD for live/production**.
`main` remains unchanged. Later teammate commits require their own PR/review; no branch was reset
or force-pushed. See [team handoff](docs/team-handoff.md).

The original reviewed heads were QPE `7fe5e24`, AAT `a0d57e3`, GOAT `139e5da` and Awais `5a9d3d4`.
See the [review disposition](docs/reviews/2026-11-14-integration.md) for full pins and limitations.
The newer Awais source includes GOAT and cross-platform fixture work; it does not prove live
integration. No Tirth branch was visible at the latest remote inspection. Nassar's local frontend
implementation is on `nasar-frontend` and has not been merged or independently accepted.

The authorized workflow is contributor PRs into `develop` for combined checks and previews, then
an independently approved production PR to `main`. The owner has authorized this agent to merge
reviewed and fixed work into `develop`. Do not merge to `main`, deploy, apply database migrations or
write production under this authorization. See [the plan](docs/plan.md).

## Implementation and integration evidence

| Slice | Evidence at pinned head | Still needed |
|---|---|---|
| Person 1 / Awais gateway | Merged Fastify/Postgres gateway source includes policy, verify/consume, outcomes, audit/review routes and offline checks. Final local source passed 73 gateway tests; real SQL behavior remains unverified. | Contract alignment with QPE/GOAT, combined Postgres-backed tests against real local endpoints, auth/storage review and safe migration plan. |
| Person 2 / GOAT, Om | Testnet3 adapter and proposed authority interface; HTTP bridge now denies claims and reports checkpoint/outcome persistence unsupported without network calls. | Trusted durable gateway binding, checkpoint and owner-scoped recovery endpoints; configured test wallet, separately authorized bounded testnet action and checked receipt. |
| Person 3 / Qatom/QPE, Om | Node 22 npm workspace, contracts and read-only MCP client; paid checkout remains disabled by default. | Authenticated tool/schema evidence, exact atomic price binding, receipt semantics, and gateway alignment. |
| Person 4 / AAT, Om | Synthetic clean/malicious fixtures and local proposal/inspection/PDF integration fixtures. | Real model attack evidence (if authorized), combined gateway/Qatom integration and reproducible security comparisons. |
| Person 5 / Nassar | Local Next.js Guard Console and server-side gateway routes are implemented on `nasar-frontend`; synthetic proposal decisions use the local gateway, and the existing text scanner is called server-side. | Persisted proposal/evidence audit reconstruction, PDF upload/extraction UI, receipt integration, owner authentication, and end-to-end database verification remain open. |

The [integration matrix](docs/integration.md) separates the original reviewed defects from current
mitigations. Both legacy adapter HTTP authorities now deny claims and refuse writes before network
access. They cannot fabricate a trusted binding, report an unsaved outcome as success or substitute
an in-memory cache for durable recovery. This blocks unsafe execution; it does not implement the
missing shared authority API.

The candidate gateway now compares identity strings exactly, caps approval expiry by intent expiry,
revalidates human review, serializes audit append ordering and creates intents transactionally with
their audit entries. Local configuration uses loopback and an explicit CORS allowlist with distinct
service keys. Owner-scoped authentication, the complete shared proposal/approval contract and durable
adapter checkpoint/continuation endpoints remain open. Outcome integrity is implemented in the candidate with consumed-platform binding, checked state transitions and transactional write/audit regression coverage; it remains subject to re-review.

Stages 1–3 are not complete: the Person 5 frontend now covers local scaffolding, intent/proposal
screens, gateway decisions, and session evidence, but owner approval, aligned contracts, combined
local Postgres endpoint tests, model-based attack evidence, a GOAT receipt and authenticated Qatom
checkout remain outstanding. The frontend does not yet upload/extract PDF invoices or reconstruct
persisted proposal evidence after reload. Stage 4 security comparisons and Stage 5 demo verification
remain; Stage 6 escrow is optional stretch work. Merging to `develop` alone completes none of these
acceptance gates.

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

On the current `nasar-frontend` working tree, the Next.js web workspace and server-side BFF passed
`npm run web:build`, `npm run typecheck`, `npm run lint`, and `npm test` (79 tests) on Node 22.20.0.
The independent frontend review found no remaining blockers for this local slice. These checks use
local source and mocked HTTP responses; no gateway database, migration, provider, payment adapter,
wallet, or chain was exercised. `npm ci --ignore-scripts` reported two high-severity dependency
findings; see the dependency audit before any external use. The frontend has not been run against a
configured gateway/PostgreSQL instance or visually reviewed in a browser.

The earlier combined runtime source at `6ba9fcc4334f2eea5eeb0209311e6d8f9fb5ee99` passed root
typecheck, lint, build and 65 tests; separate gateway typecheck, lint, build and 60 offline tests;
and four Python PDF tests using `.venv-pdf`. This source includes the Qatom/GOAT safety boundaries,
policy/audit/expiry changes and outcome transaction regression coverage. Those checks used Node 25.8.1: the apparent node@22 Homebrew path pointed to Node 25.
Actual Node 22.23.4 is available through fnm and is used for subsequent checks. Prior Node 22
validation claims based solely on that path were incorrect. No database integration tests or migrations
were run; database durability, concurrency and SQL source remain unverified in PostgreSQL.

Latest runtime source `a1aecbc5bad32601582bd6658a8231f6880af2e4` passed root typecheck/lint/build,
69 root tests, separate gateway typecheck/lint/build and 73 offline gateway tests on verified
Node **22.23.4**, invoked with `fnm exec --using 22.23.4`. This includes Awais's published HMAC
verification and audit/list endpoints, sanitized errors, bounded schema fields, prototype-safe API
keys and strict GOAT executable arguments. It does not add PostgreSQL integration evidence.

The dependency audit retains the AgentKit/Zod high finding from the checked dependency baseline;
see [dependency audit](docs/dependencies.md). No paid calls or chain transactions have been made.

## Next owner actions

1. Use reviewed develop as the integration base; continue the open acceptance work below through focused PRs.
2. Align exact intent, approval, money/unit, execution, checkpoint, result, error and audit contracts
   across Awais, QPE and GOAT; preserve `unknown` whenever dispatch may have succeeded.
3. Keep later changes reviewed against current `develop`; run the
   separate root and gateway checks in [testing setup](docs/testing-setup.md). Never migrate or use
   production for these checks.
4. Obtain authenticated Qatom capabilities and verify price binding/receipt; obtain numeric paid
   authorization separately before any paid call. Configure an isolated GOAT test wallet and get a
   separate explicit testnet spend ceiling before a transaction.
5. Nassar completes the remaining frontend acceptance work. Rehearse only on an authorized test environment.

Open decisions and blockers: [docs/questions.md](docs/questions.md).
