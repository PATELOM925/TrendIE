# Implementation plan

This plan preserves the original six stages and five role scopes from [Division.md](../Division.md). The docs foundation and local implementations are recorded separately from project-stage acceptance. QPE, AAT, GOAT, gateway, and frontend source exists, while the project stages remain open where owner, authenticated provider, end-to-end, database, or live evidence gates remain. Product priorities and the overall Definition of Done are in [PRD.md](../PRD.md); detailed per-feature acceptance criteria and statuses are tracked in [feature_list.json](../feature_list.json).

## Pre-stage — Planning and docs foundation

The owner-approved 2026-11-14 workflow uses `develop` as the integration and preview branch and
reserves `main` for production. The current reviewed branch base is `origin/develop` at `497db86`;
Nasar's frontend commits are included there through the later integration history. Earlier exact-head
review cleared source `9ffdba5` for local/test integration and held live/production; it is not a
verdict on `497db86`. New contributor work targets develop through focused PRs. This does not
complete contract alignment, live provider evidence, or a project stage. Release from develop to
main remains a separate owner gate. See [team handoff](team-handoff.md).

## PRD product expectations and acceptance map

The PRD contains a product-level **Definition of Done** in Section 12 and cross-product **success
criteria** in Section 9. It does not provide a separate detailed acceptance checklist for every
feature row. The product expectations below restate the PRD and map each tracked feature to the
acceptance evidence needed to call it complete. Detailed requirements are in [feature_list.json](../feature_list.json);
role ownership follows [Division.md](../Division.md).

| Feature | Expected product behavior | Accountable owner | Evidence required for completion |
|---|---|---|---|
| F-001 — Trusted intent registration (P0) | A trusted user registers seller, product, maximum amount, currency/asset, destination, expiry, owner, and use limit; the original authorization remains outside agent control. | Person 1 / Awais | Create and read the intent through the app and gateway; verify persisted owner/constraints in isolated PostgreSQL; prove agent-supplied data cannot replace the trusted record. Person 5 owns the UI contribution. |
| F-002 — Deterministic verification and authorization (P0) | The gateway compares the exact proposal with the active intent, returns approve/reject/review with reasons, and issues only a proposal-bound, expiring, single-use approval. | Person 1 / Awais | Endpoint tests cover valid and invalid fields, expiry, exhaustion, replay/concurrency, exact canonical proposal binding, and approval expiry; run the tests against disposable PostgreSQL. |
| F-003 — Security gateway and interception (P0) | Every provider write requires a valid gateway approval; unverified, mismatched, duplicate, or uncertain actions fail closed. | Person 1 / Awais | Integrated adapter tests show unauthorized requests stop before provider dispatch and valid approvals can continue; credentials remain outside model context. Persons 2 and 3 own their adapter enforcement. |
| F-004 — Listing and invoice inspection (P0) | Untrusted listing and PDF text is inspected; suspicious evidence is attached to the proposal/decision, while deterministic authorization remains the payment authority. | Person 4 / Om | Run clean and malicious listing and actual hidden-text PDF fixtures through extraction, scanning, gateway verification, and persisted evidence; show scanner limitations. Person 5 owns upload/display integration. |
| F-005 — Purchasing agent and attack comparison (P0) | A controlled unprotected agent can be manipulated by the malicious input; the same input through the protected gateway is blocked; an authorized purchase remains possible. | Person 4 / Om | Reproducible protected/unprotected run with model input/output and gateway evidence; legitimate purchase reaches a checked provider outcome. No hardcoded proposal or simulated result counts as live attack/settlement evidence. |
| F-006 — GOAT AgentKit payment (P0) | A gateway-approved exact proposal executes on GOAT Testnet3 and the adapter verifies its receipt; unauthorized payments do not execute. | Person 2 / GOAT | Trusted server-side approval binding, isolated wallet, separate numeric spend authorization, one bounded real transaction, checked receipt, and durable persisted outcome/recovery evidence. |
| F-007 — Qatom discovery and checkout (P0) | An authenticated agent discovers supported catalog items and can check out only the gateway-approved item/amount/currency using verified provider capabilities. | Person 3 / Om | Authenticated tool/schema evidence, same-operation atomic price binding, gateway-authorized checkout, checked provider receipt/reference, and documented real limitations. |
| F-008 — Audit records and decision evidence (P0) | Every attempt links the original intent, proposal, inspection findings, decision/reasons, execution identity, provider result, and outcome in durable audit records. | Person 1 / Awais | Database-backed tests verify the complete relationship and result transitions; audit-chain verification passes; rejected attacks can be reconstructed with their source evidence. |
| F-009 — Authorization and audit dashboard (P1) | A user can inspect intent, proposal, decision, reasons, inspection evidence, payment state, and actual provider outcome in one interface. | Person 5 / Nasar | Reloadable, owner-scoped history displays persisted evidence and checked receipts; pending/unknown states are represented accurately. |
| F-010 — Human review (P1) | Ambiguous proposals are visible to an authorized reviewer and cannot execute until that reviewer resolves them. | Person 1 / Awais | Review API and UI queue are exercised; unauthorized reviewers cannot resolve; unresolved items cannot be consumed; resolution and reasons are audited. Person 5 owns UI. |
| F-011 — GOAT escrow (P1 / stretch) | A separate GOAT-native path can deposit an approved transaction and support release, refund, and dispute under contract rules. | Person 2 / GOAT | Reviewed Solidity contract and tests; gateway-bound deposit; demonstrated testnet deposit/release/refund evidence. This begins only after the protected core and separate approval gate. |
| F-012 — Delivery verification (stretch) | Escrow release requires agreed, objective fulfillment evidence rather than an LLM-only judgment. | Person 4 / Om | Defined fulfillment conditions and tested trusted evidence that gates the escrow release path. Person 2 integrates it with escrow. |
| F-013 — Integrated deployment and demo readiness (P0) | One runnable environment demonstrates authorization, attack, protected rejection, legitimate provider payment, Qatom capability, and audit evidence through shared contracts. | Person 5 / Nasar | Current-revision setup and safe checks pass; combined PostgreSQL/provider flow is rehearsed; actual receipts and limitations are shown; demo scripts distinguish mocks from live results. Component owners provide their respective provider and attack evidence. |

**Status rule:** “Implemented” means the feature's listed product acceptance evidence is satisfied, not merely that source code or mock tests exist. Use partial/blocked status until the end-to-end evidence above exists.

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
| Person 5 / Nassar | Connect intent and payment screens. **Local evidence:** intent registration/listing, synthetic proposal decisions, and PDF upload/extraction-to-verification use the local gateway; raw uploaded PDFs are temporary. The UI does not execute payments. |

**Stage checkpoint:** Local implementation evidence: AAT proposal workflow and PDF inspection use local fixtures; GOAT native transfer compiles and its fake wallet path is tested; Qatom read-only client supports discovery shape; the Person 5 console displays gateway decisions and server-generated text/PDF inspection evidence. PDF upload uses the existing bounded extractor and removes the temporary file after extraction. Persistent proposal/evidence reconstruction still depends on Person 1's owner-scoped history API. Live evidence: no GOAT transaction, no authenticated Qatom discovery and no approved numeric ceiling. Stage 2 remains pending. Qatom checkout stays disabled pending exact price binding, receipt facts, gateway and paid authorization.

## Stage 3 — Integration (pending)

| Role | Acceptance |
|---|---|
| Person 1 / Awais | Issue transaction-bound approvals and own authorization. |
| Person 2 / GOAT, opportunistic | Connect the GOAT adapter to the gateway using transaction-bound approvals. |
| Person 3 / Qatom / QPE, Om | Connect the Qatom adapter to the gateway using transaction-bound approvals. |
| Person 4 / AAT, Om | Implement injection inspection and PDF extraction. |
| Person 5 / Nassar | Integrate decisions, receipts and audit views. **Local evidence:** decision/reason display, scanner/PDF evidence, session activity, and allowlisted intent-created audit entries are implemented. Provider receipt view and persisted proposal/evidence reconstruction remain blocked on owner-scoped gateway reads. |

**Stage checkpoint:** Public-export local fixtures compose AAT proposal output with Qatom using explicitly fake authority, transport, atomic-bound capability and receipt. They test valid synthetic settlement projection, seller variation denied before transport and concurrent duplicate claimed once. A second fixture exercises GOAT signed-only hash recovery with a read-only fake RPC and no signer/broadcast. These are not Awais's gateway. GOAT exposes a proposed authority port with atomic claim, durable signed/broadcast checkpoint and authenticated read-only reconciliation lookup. Awais's gateway branch has not demonstrated either aligned adapter contract in a combined local run. Last GOAT live evidence is a read-only chain `48816` / block `18260370` probe only; no signer or transaction. Qatom live price binding and combined gateway integration remain unverified. Stage 3 remains pending.

**Person 5 integration gate:** The shared contracts remain proposed and unaccepted; the web form is a local six-decimal USDC/USDT demo and does not map platform-specific scales. The gateway exposes no owner-scoped decision/proposal/evidence history or review queue; its current audit query does not link verified decisions to intents. The existing review-resolution POST is not sufficient for an authenticated human-review UI. The console preserves these as blockers and does not expose a resolution control.

## Stage 4 — Security testing (pending)

Compare protected and intentionally unprotected attack scenarios, then cover mismatches, expiry, replay, concurrent duplicates, checkout authorization, provider failure and uncertain outcomes. Show that unauthorized proposals are blocked and legitimate proposals remain possible. Exercise reconciliation, malicious seller/provider output and resource-limited PDF inspection. A local QPE suite now covers contract behavior and fake-backed adapter boundaries; broader Awais gateway, Qatom live capability, AAT and GOAT security tests remain pending through public interfaces.

**Stage checkpoint:** Reproducible attack and failure evidence demonstrates protected/unprotected behavior and does not overstate simulated or unknown outcomes.

## Stage 5 — Finalization (pending)

Validate audit and authorization integrity; verify receipts and recovery from uncertain outcomes; confirm actual Qatom functionality; run legitimate and malicious regressions; document dependencies and licenses; rehearse the demo using authorized test environments. Deploy only under Om's gate. Exact submission and pitch details remain unverified; see [hackathon notes](hackathon.md).

**Stage checkpoint:** The demo presents intent, proposal, decision, provider receipt and uncertain states truthfully, with verified dependencies and evidence. Current UI displayed a Nov 15 10:00 EST submission cutoff; organizer confirmation and pitch/judging requirements remain open. See [hackathon notes](hackathon.md).

## Stage 6 — Stretch: optional escrow (pending)

Escrow remains later than the protected core. It requires separate contract design, review, testnet verification and owner approval. Do not claim escrow is a GOAT direct-payment feature or part of Qatom checkout. No escrow code is in this foundation.

**Stage checkpoint:** Keep escrow out of core acceptance; proceed only after the protected core and separate escrow gates are satisfied.
