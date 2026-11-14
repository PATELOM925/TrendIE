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
