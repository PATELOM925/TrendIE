# Integration review disposition — 2026-11-14

## Original reviewed heads

- Om QPE PR #1: `7fe5e24c1668ee674223f0849a84f39150310966`
- Om AAT PR #2: `a0d57e3580a565e00d5037a1d4241ed84db204d4`
- Om GOAT PR #3: `139e5dab964bb77e47a8290d5e9cd880de7a03a8`
- Awais gateway: `5a9d3d4283e680ed8aa68de00fe8a677889af1be`

Original disposition: local Om slices **SHIP**; Awais gateway **HOLD** pending gateway/payment
authority fixes. Om PR #1/#2/#3 are now merged to `develop` at `b576c12`. The latest pinned Awais
candidate is `0b7d110`; this combination does not change the earlier verdict or grant new
adversarial clearance.

The Qatom legacy HTTP path remains fail-closed. Current local root and gateway checks are tracked
separately in the implementation handoff. Database integration tests were not run because they
apply migrations and truncate tables. Neither local checks nor fake fixtures establish live
provider behavior.

## Implementation disposition before re-review

This records fixes and remaining gates; it is not a new adversarial verdict.

| Original finding | Current disposition |
|---|---|
| 1–3, 12–13: HTTP save failures, fabricated bindings, lossy units, missing authority endpoints and timeout | Both legacy HTTP bridges are disabled before network access. Trusted full-contract endpoints, bounded supported HTTP transport and durable recovery remain open. |
| 4–5: outcome transitions and orphan/platform writes | Candidate uses a locked consumed approval with recorded platform, checked status transitions, immutable known references and transactional writes/audit. New offline route tests cover rejection, idempotency and rollback; real PostgreSQL remains unrun. |
| 6: authenticated owner scope | Open; service roles alone are insufficient. Blocks external and end-to-end use. |
| 7: root lint/gateway coverage | Root ignores nested package scanning and exposes separate gateway checks, which are run independently. |
| 8: expiry and stale human review | Approval expiry is capped by intent expiry; consume checks active intent; review locks and revalidates stored proposal/inspection/current intent. Offline helper tests pass; real race behavior remains unverified. |
| 9: identity normalization | Exact string comparisons and hashing replace trim/case/NFC normalization. Historical hash/approval compatibility needs a reviewed migration or fresh disposable environment. |
| 10: audit ordering and transactionality | Advisory transaction lock and same-client intent/audit transaction implemented. TRUNCATE protection exists only in unapplied migration source. No real concurrency or DBA immutability claim. |
| 11: destructive test target | Dedicated test URL and test mode required, including direct Vitest use; query/path overrides rejected. Legacy SQL fixture reset strategy still needs repair before running. |
| 14–15: continuation preclaim controls and binding provenance | Static gates run before claiming; both bridges refuse fabricated authority. Stored binding provenance remains a server obligation. |
| 16: numeric model budget | Authorization callback remains a gate rather than exact USD metering. Paid model calls remain disabled without numeric authorization. |
| 17: PDF interpreter selection | Low-risk trusted-operator interpreter configuration remains; no live sandbox security claim. |
| 18: AgentKit/Zod advisory | Open upstream dependency risk, tracked in dependencies.md and Q007. |
| 19: CORS and duplicate keys | Explicit CORS origins and distinct service keys required; loopback default. Offline tests cover configuration and origin behavior. |

## Combined pre-review verification

Runtime source: `6ba9fcc4334f2eea5eeb0209311e6d8f9fb5ee99`. Root typecheck/lint/build and
65 tests passed; gateway typecheck/lint/build and 60 offline unit tests passed; Python PDF suite
passed four tests with `.venv-pdf`. Outcome route tests use a database double and verify rejected
writes, platform binding, idempotency, reference bounds, transitions and audit-failure rollback.
No PostgreSQL integration suite, migration or provider call was executed. A fresh adversarial
review of the complete candidate is required before merging this integration PR.

## Second adversarial verdict and runtime correction

Opus re-reviewed exactly `3cffe2249e65583d89e64b303bf026169b46dbfc` and returned **SHIP for
local/test integration into develop**, with no P0–P2 local merge blockers, and **HOLD for live and
production**. It independently reran root 65 tests and gateway 60 tests plus both packages'
typecheck/lint/build. It identified that the Homebrew path named node@22 resolves to Node 25.8.1;
earlier reports calling those runs Node 22 were incorrect. Actual Node 22.23.4 is installed via fnm.

P3 follow-ups address bounded gateway schemas and sanitized route errors, prototype-safe API-key
lookup, unused GOAT executable metadata and conflicting root package-manager signals. Awais then
published HMAC verification and audit/list endpoints at `11a66a1`; that source is merged into the
candidate, preserving the local expiry/platform controls. HMAC verification now rejects malformed
signatures and pagination rejects invalid bounds. These later changes require fresh review.

## Latest delta before final review

Runtime source `a1aecbc5bad32601582bd6658a8231f6880af2e4` includes Awais `11a66a1` and the
P3 follow-up fixes. On actual Node 22.23.4 (`fnm exec --using 22.23.4`), root typecheck/lint/build
and 69 tests passed; gateway typecheck/lint/build and 73 offline tests passed. The HMAC and new
HTTP follow-up tests use fake data and mocked database access. No database was contacted.
The earlier SHIP verdict remains pinned to `3cffe22`; the latest delta awaits its own verdict.

## Final exact-head disposition and integration

The final delta review of `9ffdba59b94d6991c7286686e822c6731d5f09ea` returned **SHIP for
local/test develop integration**, with no confirmed or plausible P0–P2 local merge blocker, and
**HOLD for live/production**. The reviewer independently reran the 69 root and 73 gateway tests,
plus both packages' typecheck/lint/build on actual Node 22.23.4. It did not rerun Python PDF or
Markdown link validation; those passed separately in the parent check run.

PR #4 merged that exact reviewed head into develop at
`56926a28833067cb1d20c2ce174bcfad44de0232`. The merge tree matches the reviewed tree. Awais
source `11a66a1` is an ancestor; main was not changed. Remaining P3 audit-operation and route-test
follow-ups are tracked as Q011. No new approval applies to live use or later runtime commits.
