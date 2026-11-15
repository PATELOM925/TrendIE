# Implementation plan

This plan preserves the original six stages and five role scopes from [Division.md](../Division.md). The docs foundation and local implementations are recorded separately from project-stage acceptance. QPE, AAT and GOAT have local code and synthetic tests, while all project stages remain open because owner, authenticated provider and live evidence gates remain. Product priorities remain in [PRD.md](../PRD.md).

## Pre-stage — Planning and docs foundation

The owner-approved 2026-11-14 workflow uses `develop` as the integration and preview branch and
reserves `main` for production. Om PRs #1–#3 and combined gateway PR #4 have been merged into
`develop`. The final exact-head review cleared source `9ffdba5` for local/test integration and held
live/production. New contributor work targets develop through focused PRs. This does not complete
contract alignment, live provider evidence, frontend delivery or a project stage. Release from
develop to main remains a separate owner gate. See [team handoff](team-handoff.md).

## Stage 1 — Foundation (pending)

| Role | Acceptance |
|---|---|
| Person 1 / Awais | Finalize schemas and policy logic. |
| Person 2 / GOAT, opportunistic | Configure a GOAT Testnet3 wallet. |
| Person 3 / Qatom / QPE, Om | Verify authenticated MCP access and available tools. |
| Person 4 / AAT, Om | Create clean and malicious listing fixtures. |
| Person 5 / Nassar | Scaffold frontend and shared deployment. **Local evidence:** Next.js App Router workspace under `apps/web`, bound to port 3001, with server-only gateway configuration and a local Guard Console. |

**Stage checkpoint:** Local implementation evidence includes the Person 5 Next.js scaffold. Live/owner evidence: authenticated Qatom tools are unverified (unauthenticated endpoint returned 401); no GOAT wallet was configured; Awais policy source and offline tests are merged, but shared contract acceptance remains open. Stage 1 remains pending. Exact-price P0 blocks Qatom checkout, not local development.

## Stage 2 — Core flow (pending)

| Role | Acceptance |
|---|---|
| Person 1 / Awais | Implement intent registration and deterministic verification. |
| Person 2 / GOAT, opportunistic | Make a standalone GOAT Testnet3 payment and verify its receipt. |
| Person 3 / Qatom / QPE, Om | Implement discovery and checkout subject to provider price-binding and spend gates. |
| Person 4 / AAT, Om | Build the purchasing agent and structured proposal generation. |
| Person 5 / Nassar | Connect intent and payment screens. **Local evidence:** intent registration/listing and synthetic proposal decisions use the local gateway; no payment executes from the UI. |

**Stage checkpoint:** Local implementation evidence: AAT proposal workflow and PDF inspection use local fixtures; GOAT native transfer compiles and its fake wallet path is tested; Qatom read-only client supports discovery shape; the Person 5 console displays gateway decisions and server-generated text inspection evidence. The frontend still lacks PDF upload/extraction and persistent proposal/evidence reconstruction. Live evidence: no GOAT transaction, no authenticated Qatom discovery and no approved numeric ceiling (user only said “keep it low”). Stage 2 remains pending. Qatom checkout stays disabled pending exact price binding, receipt facts, gateway and paid authorization.

## Stage 3 — Integration (pending)

| Role | Acceptance |
|---|---|
| Person 1 / Awais | Issue transaction-bound approvals and own authorization. |
| Person 2 / GOAT, opportunistic | Connect the GOAT adapter to the gateway using transaction-bound approvals. |
| Person 3 / Qatom / QPE, Om | Connect the Qatom adapter to the gateway using transaction-bound approvals. |
| Person 4 / AAT, Om | Implement injection inspection and PDF extraction. **Local evidence on `develop`:** paired attack comparison (G-06 closed) — Path A (vulnerable agent) vs Path B (protected gateway) — using the same malicious input, with live Gateway API execution. PDF demo runs against live PostgreSQL audit chain. | Reproducible execution evidence linking malicious input → blocked → same input → protected flow, with findings linked to the exact proposal and gateway decision record. Demo wording: consuming an approval is not payment settlement. |
| Person 5 / Nassar | Integrate decisions, receipts and audit views. **Local evidence:** transient PDF upload/inspection UI implemented; session-scoped decisions, scanner evidence, and audit entries displayed; labels correctly state history is session-only (G-07 partially, G-09 partial). | Owner-scoped persisted history (blocked on Person 1 APIs, G-08); real payment statuses/receipts; human-review controls; backend-connected browser tests. |

**Stage checkpoint:** G-06 (attack comparison) is closed on `develop`: Tirth's paired demo runs the
same malicious input through a vulnerable path (funds stolen) and the protected gateway path (blocked
with audit evidence). G-07 (PDF-to-audit) is closed: the PDF demo runs against the live Gateway API
and PostgreSQL audit chain. G-09 (replay demo) is partially closed: replay/expiry is verified end-to-end;
GOAT transaction remains explicitly labelled as simulated/read-only. G-08 (persisted UI history and human
review) remains open pending Person 1 owner-scoped APIs. Person 5 UI correctly labels session-only
state. Demo wording integrity: consuming an approval is not payment settlement — this must remain
labelled clearly in all printed or simulated outcomes. Combined gateway/adapter integration, real GOAT
receipt, and authenticated Qatom checkout remain outstanding. Stage 3 remains pending.

## Stage 4 — Security testing (pending)

Compare protected and intentionally unprotected attack scenarios, then cover mismatches, expiry, replay, concurrent duplicates, checkout authorization, provider failure and uncertain outcomes. Show that unauthorized proposals are blocked and legitimate proposals remain possible. Exercise reconciliation, malicious seller/provider output and resource-limited PDF inspection. A local QPE suite now covers contract behavior and fake-backed adapter boundaries; broader Awais gateway, Qatom live capability, AAT and GOAT security tests remain pending through public interfaces.

**Stage checkpoint:** G-06 is closed: a reproducible protected/unprotected attack comparison uses the same malicious input with live Gateway execution evidence. Demo wording: consuming an approval is not payment settlement. Remaining open: GOAT receipt, authenticated Qatom checkout, combined gateway/adapter integration, and broader security regressions through public interfaces.

## Stage 5 — Finalization (pending)

Validate audit and authorization integrity; verify receipts and recovery from uncertain outcomes; confirm actual Qatom functionality; run legitimate and malicious regressions; document dependencies and licenses; rehearse the demo using authorized test environments. Deploy only under Om's gate. Exact submission and pitch details remain unverified; see [hackathon notes](hackathon.md).

**Stage checkpoint:** The demo presents intent, proposal, decision, provider receipt and uncertain states truthfully, with verified dependencies and evidence. Current UI displayed a Nov 15 10:00 EST submission cutoff; organizer confirmation and pitch/judging requirements remain open. See [hackathon notes](hackathon.md).

## Stage 6 — Stretch: optional escrow (pending)

Escrow remains later than the protected core. It requires separate contract design, review, testnet verification and owner approval. Do not claim escrow is a GOAT direct-payment feature or part of Qatom checkout. No escrow code is in this foundation.

**Stage checkpoint:** Keep escrow out of core acceptance; proceed only after the protected core and separate escrow gates are satisfied.
