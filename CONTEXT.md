# Current context

**Checked:** 2026-11-15. `develop` is at `9133094` (fetched and confirmed). This includes Tirth's
attack-comparison commit (`6c272f6`), Nassar's transient PDF upload work, replay/expiry live-Gateway
demo, and documentation reconciliation. `main` is at `0c08845`, which carries the same application
code as an earlier develop snapshot through PR #8. Om PRs #1–#3 and combined gateway PR #4 remain
the reviewed base. The agent team confirms **114 root tests and 83 gateway unit tests pass** on
Node 22.23.4 (`fnm exec --using 22.23.4`), along with root/gateway typecheck and lint. These do not
establish PostgreSQL integration, provider settlement or complete end-to-end acceptance.

The earlier reviewed heads were QPE `7fe5e24`, AAT `a0d57e3`, GOAT `139e5da` and Awais `5a9d3d4`.
See the [review disposition](docs/reviews/2026-11-14-integration.md) for full pins and limitations.

The authorized workflow is contributor PRs into `develop` for combined checks and previews, then
an independently approved production PR to `main`. The owner has authorized this agent to merge
reviewed and fixed work into `develop`. Do not merge to `main`, deploy, apply database migrations or
write production under this authorization. See [the plan](docs/plan.md).

## Implementation and integration evidence

> **Gap register:** `gaps.md` at `9133094` is the authoritative per-gap status. G-06 (attack
> comparison), G-07 (PDF-to-audit), and G-09 (replay demo) are marked closed or partially closed on
> `develop`. G-01, G-02, G-03, G-04, G-05, G-08, and G-10 remain open.

| Slice | Evidence at `9133094` | Still needed |
|---|---|---|
| Person 1 / Awais gateway | Gateway source (policy, verify/consume, outcomes, audit/review routes) in develop. 83 offline gateway unit tests pass on Node 22.23.4; replay/expiry demo runs against live Gateway API and PostgreSQL audit log. Real SQL durability, concurrency, and combined endpoint tests remain unrun. | **Shared binding contract** (owner identity, intent version, platform, chain, exact integer amount/asset/scale); owner-scoped history and review-list APIs; durable adapter checkpoint/recovery endpoints; safe migration and isolated DB test reset. |
| Person 2 / GOAT, Om | Active HTTP authority client in source; `demo-goat-live.mjs` explicitly labels transaction as simulated/read-only; signed/broadcast checkpoints are proposed but not verified against gateway. | Adapters must receive the **persisted gateway binding** rather than constructing authority locally. Isolated test wallet, explicit numeric testnet spend ceiling, one bounded Testnet3 transaction, and verified receipt. |
| Person 3 / Qatom/QPE, Om | Read-only MCP client; paid checkout disabled by default; replay/duplicate/expiry fixture suite covers contract behavior. | Authenticated tool/schema evidence, exact atomic price binding (Q004 P0 open), gateway-authorized checkout and verified receipt. Qatom checkout blocked until P0 is resolved. |
| Person 4 / AAT, Om + Tirth | Paired attack comparison demo implemented (`G-06` closed on develop): Path A (vulnerable) vs Path B (protected gateway). PDF demo runs against live Gateway API. | Reproducible execution evidence linking malicious input → attack blocked → same input → protected flow. Findings must link to exact proposal and gateway decision record. Demo wording: consuming an approval is not payment settlement. |
| Person 5 / Nassar | Transient PDF upload/inspection UI implemented; session-scoped decisions, scanner evidence, and audit entries displayed; labels correctly state history is session-only. | **Reloadable owner-scoped history** (blocked on G-08/Person 1 APIs), real payment statuses/receipts, human-review controls, platform-specific money handling, pagination, backend-connected browser tests. |

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

Agent team reports on `9133094` with verified Node **22.23.4** (`fnm exec --using 22.23.4`):
**114 root tests** and **83 gateway unit tests** pass, along with root/gateway typecheck and lint.
These do not establish PostgreSQL integration, provider settlement, or complete end-to-end acceptance.

The replay/expiry demo (`npm run demo:replay`) now runs against the live Gateway API and PostgreSQL
audit log. The PDF demo (`npm run demo:pdf`) also runs against the live Gateway and verifies the
cryptographic audit chain. The GOAT live demo script explicitly labels any transaction as
simulated/read-only. No funded provider calls, chain transactions, or external messages were used.

Earlier combined source at `a1aecbc5` passed root typecheck/lint/build, 69 root tests, gateway
typecheck/lint/build, and 73 offline gateway tests on verified Node 22.23.4. The dependency audit
retains the AgentKit/Zod high finding from the checked baseline; see
[dependency audit](docs/dependencies.md). No paid calls or chain transactions have been made.

## Next owner actions

1. **Shared contract (G-01, P0 — Awais + all adapters):** Agree and implement the complete
   proposal → approval → execution → outcome/recovery contract, explicitly including authenticated
   owner identity, intent version, platform, chain, and exact integer amount/asset/scale in the
   shared binding. Adapters must receive the persisted gateway binding; they must not construct
   authority locally.
2. **Gateway persistence and PostgreSQL (G-02, P0 — Awais):** Provision a disposable local
   PostgreSQL instance; fix the audit-log truncation reset conflict; run migrations and gateway
   endpoint tests at current-revision; record exact results.
3. **Adapter recovery (G-03, P0 — Awais + Om/Tirth):** Implement durable checkpoint and
   owner-scoped recovery endpoints on the gateway. Prove adapters checkpoint before dispatch and
   recover uncertain outcomes rather than dropping them.
4. **Bounded real payment (G-05, P0 — Om/Tirth):** Configure an isolated GOAT test wallet,
   obtain a separate explicit Testnet3 spend ceiling, run one bounded transaction, and verify the
   receipt and persisted outcome.
5. **Person 5 owner-scoped UI (G-08, P1 — Nassar, blocked on Awais APIs):** Once owner-scoped
   history and review-list APIs exist, add reloadable persisted history, real payment receipt
   display, human-review controls, and backend-connected browser tests.
6. **Demo wording integrity (G-09, ongoing):** Printed/simulated outcomes must stay clearly
   labelled. Consuming an approval is not payment settlement. GOAT live demo must continue to
   label transactions as simulated until a real receipt is verified.
7. Qatom authenticated checkout remains blocked on Q004 (atomic price binding). Do not enable
   until a provider capability or separately reviewed mitigation is verified and a numeric paid
   ceiling is separately authorized.

Open decisions and blockers: [docs/questions.md](docs/questions.md).
