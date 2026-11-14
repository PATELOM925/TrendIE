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
| Person 4 / AAT, Om | Implement injection inspection and PDF extraction. |
| Person 5 / Nassar | Integrate decisions, receipts and audit views. **Local evidence:** decision/reason display, scanner evidence, session activity, and allowlisted intent-created audit entries are implemented. Provider receipt view and persisted proposal/evidence reconstruction remain open. |

**Stage checkpoint:** Public-export local fixtures compose AAT proposal output with Qatom using explicitly fake authority, transport, atomic-bound capability and receipt. They test valid synthetic settlement projection, seller variation denied before transport and concurrent duplicate claimed once. A second fixture exercises GOAT signed-only hash recovery with a read-only fake RPC and no signer/broadcast. These are not Awais's gateway. GOAT exposes a proposed authority port with atomic claim, durable signed/broadcast checkpoint and authenticated read-only reconciliation lookup. Awais's gateway branch has not demonstrated either aligned adapter contract in a combined local run. Last GOAT live evidence is a read-only chain `48816` / block `18260370` probe only; no signer or transaction. Qatom live price binding and combined gateway integration remain unverified. Stage 3 remains pending.

## Stage 4 — Security testing (pending)

Compare protected and intentionally unprotected attack scenarios, then cover mismatches, expiry, replay, concurrent duplicates, checkout authorization, provider failure and uncertain outcomes. Show that unauthorized proposals are blocked and legitimate proposals remain possible. Exercise reconciliation, malicious seller/provider output and resource-limited PDF inspection. A local QPE suite now covers contract behavior and fake-backed adapter boundaries; broader Awais gateway, Qatom live capability, AAT and GOAT security tests remain pending through public interfaces.

**Stage checkpoint:** Reproducible attack and failure evidence demonstrates protected/unprotected behavior and does not overstate simulated or unknown outcomes.

## Stage 5 — Finalization (pending)

Validate audit and authorization integrity; verify receipts and recovery from uncertain outcomes; confirm actual Qatom functionality; run legitimate and malicious regressions; document dependencies and licenses; rehearse the demo using authorized test environments. Deploy only under Om's gate. Exact submission and pitch details remain unverified; see [hackathon notes](hackathon.md).

**Stage checkpoint:** The demo presents intent, proposal, decision, provider receipt and uncertain states truthfully, with verified dependencies and evidence. Current UI displayed a Nov 15 10:00 EST submission cutoff; organizer confirmation and pitch/judging requirements remain open. See [hackathon notes](hackathon.md).

## Stage 6 — Stretch: optional escrow (pending)

Escrow remains later than the protected core. It requires separate contract design, review, testnet verification and owner approval. Do not claim escrow is a GOAT direct-payment feature or part of Qatom checkout. No escrow code is in this foundation.

**Stage checkpoint:** Keep escrow out of core acceptance; proceed only after the protected core and separate escrow gates are satisfied.
