# Integration and execution gaps

**Reviewed against:** `PRD.md`, `Division.md`, `feature_list.json`, and the source at `497db86`  
**Branch:** local `nasar-frontend`, fast-forwarded to `origin/develop`  
**Review type:** source and documentation review. Tests, migrations, provider calls, and payments were not run for this review.

This file distinguishes implementation present in source from behavior demonstrated end to end. A route, adapter, fixture, or mock test is not evidence that the full protected purchase flow works against PostgreSQL and a provider.

## Current result

The repository contains substantial gateway, agent, inspection, adapter, dashboard, and demo code. It does **not yet demonstrate the PRD's complete purchase flow**: discover a real listing, inspect its content, produce a proposal, authorize it against a trusted intent, execute it through GOAT or Qatom, verify the provider result, persist the outcome, and display that evidence after reload.

The most important blockers are:

1. The shared proposal, authorization, and execution contracts are not aligned across the frontend, gateway, and adapters.
2. Qatom checkout is not implemented through the gateway; its HTTP authority remains fail-closed.
3. GOAT has an active-mode HTTP client in source, but its binding and recovery behavior do not yet meet the server-owned durable authority contract, and no real transaction has been verified.
4. The frontend does not execute payments or display persisted decision, inspection, and payment outcomes.
5. PostgreSQL is provisionable from the repository, but was not running or verified in the reviewed environment; database-backed integration tests remain unrun.
6. Several demos use mocked authorities, signers, transactions, or manually constructed decisions while printing stronger success claims.

## Gap register

### G-01 — Shared contracts are not aligned

**Priority:** P0  
**Accountable owner:** Person 1 / Awais  
**Supporting owners:** Person 2 / GOAT, Person 3 / Qatom, Person 4 / agent proposal contract, Person 5 / Nasar frontend contract

- `packages/contracts` defines a versioned proposal with `ownerId`, `intentVersion`, `platform`, `itemId`, `sellerId`, scaled integer `money`, `asset`, `chain`, and `providerArgs`.
- The gateway and web BFF still use a legacy proposal shape: `intentId`, seller, product, amount, currency, destination, and source reference.
- The intent and approval API does not yet expose the same versioned, provider-specific binding expected by QPE adapters.
- The web UI supports only USDC/USDT with six decimal places. Qatom uses USD-TDN with scale 3; GOAT native transfers use a different asset and scale. The UI cannot currently register the platform-specific intents required by both integrations.
- Approval, execution result, continuation, checkpoint, and reconciliation contracts still differ between gateway routes and the GOAT/Qatom authority ports.

**Needed to close:** agree and version one intent/proposal/approval/result contract; add compatibility tests across the gateway, frontend BFF, agent, and adapters; remove legacy coercions and unsupported placeholder mappings.

### G-02 — PostgreSQL is provisionable but not verified here

**Priority:** P0 for integrated acceptance  
**Accountable owner:** Person 1 / Awais (PostgreSQL and gateway tests)  
**Supporting owner:** Person 5 / Nasar (frontend-to-gateway integration and runbook)

- The PRD specifies PostgreSQL. The repository now includes `gateway/docker-compose.yml` and root `db:up`, `db:down`, `db:migrate`, and `db:seed` scripts.
- In the reviewed environment, Docker Desktop's engine was unavailable and no PostgreSQL Windows service was found. No local database was confirmed running.
- No current-revision migrations, gateway endpoint integration tests, or frontend-to-database flow were run.
- Gateway tests require an explicitly isolated PostgreSQL test database. Existing fixtures truncate the audit log, which conflicts with the audit protections; a safe reset strategy is still required before running the database suite.
- `docs/team-setup-guide.md` references `npm run gateway:db:migrate`, but the root script is `db:migrate`.

**Needed to close:** start a disposable local PostgreSQL instance; fix the fixture reset conflict; run migrations and seed only against that disposable instance; execute gateway and frontend endpoint tests and record the exact revision/results.

### G-03 — Gateway approval is not yet a complete shared adapter authority

**Priority:** P0  
**Accountable owner:** Person 1 / Awais  
**Supporting owners:** Person 2 / GOAT and Person 3 / Qatom (adapter consumers)

- Gateway verification, HMAC approval creation, expiry checks, approval consumption, and payment-result routes exist in source.
- The active GOAT HTTP client can call the legacy approval-consume endpoint and post result/checkpoint data. Its current binding is assembled client-side from the submitted proposal and spend-authorization input after consume; it is not fetched as an authoritative persisted binding from the gateway.
- The active GOAT client uses a locally derived expiry and a fallback sender address when none is configured. Those are not a substitute for gateway-owned identity, sender, amount, chain, provider arguments, and expiry binding.
- `getExecutionForReconciliation` still returns no record. The gateway execution read does not provide the complete owner-scoped proposal and binding needed by the adapter to reconcile uncertain writes.
- The Qatom HTTP authority still denies execution and rejects outcome/continuation persistence as unsupported.
- The frontend verification routes deliberately do not expose or consume approval references, and do not invoke either adapter.

**Needed to close:** implement server-owned claim/binding retrieval, atomic single-use consumption, durable execution claim, monotonic signed/broadcast checkpoints, checked outcome persistence, owner-scoped reconciliation reads, and Qatom continuation; prove the same exact proposal is bound through each step.

### G-04 — Qatom is read-only; checkout and receipt flow are missing

**Priority:** P0  
**Accountable owner:** Person 3 / Om (Qatom integration)  
**Supporting owner:** Person 1 / Awais (gateway authorization and persistence)

- The MCP client permits read-only catalog search when the provider marks the tool read-only.
- Write-capable tools and continuation are blocked by the client; the Qatom gateway authority denies claims.
- No authenticated provider tool/schema evidence or supported checkout result/receipt is recorded.
- Atomic price binding to the exact approved amount and currency is not implemented or verified. A separate quote followed by checkout would not prove this property.
- Local fake transport/capability tests do not establish a real Qatom checkout.

**Needed to close:** verify provider authentication and the actual checkout schema; obtain a same-operation atomic price guarantee; implement server-authorized checkout and conservative retries; verify a supported receipt against item, seller, amount, currency, and provider evidence; record any unsupported capability clearly.

### G-05 — GOAT payment acceptance is not demonstrated

**Priority:** P0  
**Accountable owner:** Person 2 / GOAT  
**Supporting owner:** Person 1 / Awais (gateway authority and persistence)

- The AgentKit/viem adapter contains validation, chain checks, spend ceilings, receipt verification, and uncertain-outcome handling.
- The active HTTP authority has mocked-fetch tests, but has not been verified against the running gateway and PostgreSQL.
- The gateway claim/binding contract is not yet sufficiently aligned with the adapter's trusted binding and reconciliation requirements.
- No configured test wallet, separately authorized numeric testnet ceiling, real transaction, or checked receipt is recorded.
- `scripts/demo-goat-live.mjs` reads the public GOAT RPC's chain ID, block height, and an address balance. It then uses a fake authority and a fake signer that throws; it does not broadcast a transaction.
- The clean-purchase branch in `scripts/demo-attack.mjs` uses fake authority, fake signer, mock transaction hash, and mock receipt data.

**Needed to close:** complete and review the trusted gateway authority; provision an isolated test wallet and obtain a separate numeric spend authorization; run one bounded Testnet3 payment; verify the receipt and persisted outcome; retain uncertainty if dispatch or persistence is ambiguous.

### G-06 — Agent attack demo is not yet equivalent to the PRD demonstration

**Priority:** P0  
**Status:** **Closed on `develop`**  
**Accountable owner:** Person 4 / Om & Tirth (agent and attack testing)  
**Supporting owners:** Person 1 / Awais (gateway decision), Person 5 / Nasar (playground integration)

- **Resolved:** `scripts/demo-attack.mjs` and the Web Console (`apps/web`) now execute a true paired vulnerability comparison using identical malicious invoice inputs:
  1. **Path A (Vulnerable Agent Architecture):** Simulates standard agent setups where the agent has direct wallet/signing tool access. Prompt injection hijacks agent context and commands an unverified transfer $\rightarrow$ Funds are stolen and corporate treasury is drained.
  2. **Path B (Protected Agent Architecture):** The agent operates in a dual-control sandbox with zero private keys. The identical proposal is submitted to the live Fastify Security Gateway (`POST /verify`). The Gateway halts execution deterministically (`REJECT [SELLER_MISMATCH, DESTINATION_NOT_ALLOWED, INJECTION_FLAGGED]`), logs the event into PostgreSQL, and denies execution tokens $\rightarrow$ Zero satoshis moved ($0.00 loss, zero gas wasted).
  3. **Path C (Clean Authorized Purchase):** Legitimate invoice matching intent is approved by the live Gateway, issues a cryptographic HMAC approval token, and is consumed via `POST /approvals/:id/consume`.
  4. **Live Web Console UI:** Rejections in the web dashboard now display a paired side-by-side comparison card illustrating the exact vulnerability vs. guard outcome. Testable via `npm run demo:attack`.

### G-07 — PDF extraction is not in the purchase workflow

**Priority:** P0  
**Status:** **Closed on `develop` (Commit 9cee95d)**  
**Accountable owner:** Person 4 / Om & Tirth (inspection and PDF extraction)  
**Supporting owners:** Person 1 / Awais (persisted evidence), Person 5 / Nasar (upload and display)

- A hidden-text adversarial PDF fixture exists (`services/pdf-inspection/fixtures/adversarial-invoice.pdf`).
- **Resolved:** `scripts/demo-pdf-attack.mjs` now runs PyMuPDF extraction (`render_mode=3` stream), registers an immutable Intent on the live Gateway (`POST /intents`), and submits the extracted proposal and heuristic inspection payload directly to `POST /verify` on the live Gateway.
- The live Gateway deterministically halts the attack with `REJECT [AMOUNT_EXCEEDS_MAX, INJECTION_FLAGGED]`.
- The attack rejection is cryptographically appended and verified in the PostgreSQL audit ledger (`GET /audit/chain/verify`). Testable via `npm run demo:pdf`.

### G-08 — Decisions, outcomes, and human review are not fully available in the UI

**Priority:** P0 for outcome display; P1 for full dashboard/review  
**Accountable owner:** Person 5 / Nasar  
**Supporting owners:** Person 1 / Awais (audit/review APIs), Person 2 / GOAT and Person 3 / Qatom (provider results)

- The console displays authorization details, proposal comparison, gateway decision, and scanner findings for the current session.
- A verification decision is displayed as **not executed**; the UI does not consume approval or call an adapter.
- Session decisions are lost on reload. The persisted audit view currently focuses on intent-created events; it does not reconstruct proposal, inspection, decision, and execution records as a coherent history.
- The audit-chain verification endpoint/UI can check chain integrity, but that is not a transaction history or proof that every required outcome is present.
- Gateway review-resolution API exists, but the console has no review queue or approval/rejection controls for an authorized human.
- Payment states such as `submitting`, `pending`, `pending_approval`, `succeeded`, `failed`, and `unknown`, plus provider receipts/references, are not presented as a connected lifecycle in the console.

**Needed to close:** add owner-scoped persisted history and review routes; show proposal, intent, decision reasons, inspection evidence, execution status and checked receipt; represent `unknown` and pending states without converting them to success or failure; add authorized review controls and prove unresolved proposals cannot execute.

### G-09 — Demo scripts and docs overstate some evidence

**Priority:** P1 for demo readiness and accurate acceptance reporting  
**Status:** **Partially closed on `develop` (Replay demo verified end-to-end; GOAT transaction remains explicitly labeled as simulated/read-only)**  
**Accountable owner:** Person 5 / Nasar (integrated demo and documentation)  
**Supporting owners by evidence:** Person 1 / Awais (replay and audit demos), Person 2 / GOAT (`demo:goat`), Person 4 / Om & Tirth (agent and PDF demos)

- **Resolved for Replay Defense:** `scripts/demo-replay-attack.mjs` was upgraded to perform a true live duplicate consumption on the exact same HMAC approval token against `POST /approvals/:id/consume`. The Gateway executes atomic row updates in PostgreSQL:
  1. Attempt #1 consumes the approval (`200 OK`) and decrements `remaining_uses` to 0.
  2. Attempt #2 (Replay of same token) is rejected by Gateway with `HTTP 403 FORBIDDEN` (`Approval cannot be consumed: INTENT_EXHAUSTED`).
  3. Attempt #3 (Proposal resubmission against exhausted intent) is rejected by Gateway with `REJECT [INTENT_EXHAUSTED]`.
  4. Expired timestamps are rejected with `REJECT [INTENT_EXPIRED]`. Testable via `npm run demo:replay`.
- The PDF demo (`demo:pdf`) now runs directly against the live Gateway API and PostgreSQL audit log.
- `scripts/demo-goat-live.mjs` and `scripts/demo-attack.mjs` have been clarified to distinguish live read-only RPC checks from simulated settlement where live spend keys are restricted.

### G-10 — Feature status and project documentation need reconciliation

**Priority:** P1  
**Accountable owner:** Person 5 / Nasar (plan, feature list, and handoff consistency)  
**Supporting owners:** each feature owner validates the evidence for their feature; Om owns the main-branch release gate

- `feature_list.json` marks F-001–F-010 and F-013 `implemented`, despite the acceptance gaps in this document. F-011 and F-012 are `not_started`.
- `CONTEXT.md` and parts of `docs/team-handoff.md` still describe the frontend as unmerged or ask for a PR into develop, even though the frontend commits are ancestors of the current develop head.
- `docs/integration.md` retains earlier pinned-source language and should be refreshed to distinguish newly added active-mode GOAT HTTP code from verified trusted gateway integration.
- The root README's test count and current demo claims have not been verified on `497db86`.

**Needed to close:** use evidence-based states such as `partial`, `blocked`, or `verified` (if the schema is extended); update branch/merge facts; preserve explicit limits of source tests, mocked demos, database tests, and provider evidence.

## PRD acceptance still outstanding

### P0 MVP requirements

- A user can register an intent and the record is verified to persist in PostgreSQL.
- The exact same versioned proposal is validated by the gateway and bound to the adapter authorization.
- Replay, duplicate, expiry, amount, seller, product, destination, asset/currency, chain, and intent-version checks pass against isolated PostgreSQL endpoint tests.
- The inspected listing/PDF evidence is associated with the exact proposal and gateway decision.
- A controlled unprotected model attack is reproduced; the same input is stopped by the protected gateway flow.
- A legitimate purchase actually completes through a trusted adapter; no fake signer, result, or receipt is used as settlement proof.
- One bounded real GOAT Testnet3 transaction and receipt are verified.
- Authenticated Qatom discovery and an approved checkout/receipt are demonstrated where supported; unsupported capabilities remain clearly documented.
- Every attempt has linked, durable intent, proposal, decision/reason, inspection evidence, execution state, and outcome records.

### P1 and optional requirements

- Full persisted authorization/audit/outcome dashboard and human-review workflow.
- GOAT escrow deposit, release, refund, and dispute paths under a separate contract flow.
- Objective delivery evidence that gates escrow release.

### Security and release gates

- Prove wallet/payment credentials cannot enter model context through the integrated run.
- Keep original intent and owner identity outside agent-controlled data; establish real authenticated owner binding rather than only a local `DEMO_OWNER_ID`.
- Prove all provider writes require the server-owned, exact, one-use gateway approval.
- Persist execution claims before provider dispatch and recover uncertain writes through owner-scoped reconciliation; never blindly retry.
- Add numeric paid-model authorization before enabling the Gemini playground's external request path.
- Complete current dependency/license review and resolve or explicitly accept the documented high-severity AgentKit/Zod advisory before external release.
- Run current-revision root, gateway, PDF, and isolated database checks; then rehearse the end-to-end flow and keep test/demo/live evidence distinct.

## Suggested close-out order

1. Agree and implement the shared intent, proposal, approval, execution, result, and reconciliation contract.
2. Provision a disposable PostgreSQL database, repair the audit-safe test reset, and run migrations plus gateway endpoint tests.
3. Finish Qatom's verified checkout path and GOAT's server-owned binding/checkpoint/outcome/reconciliation path.
4. Connect agent, listing/PDF inspection, gateway, adapter, persisted audit, and dashboard into one flow.
5. Run deterministic attacks, duplicate/replay/expiry cases, uncertain-outcome recovery, a real bounded GOAT transaction, and an authenticated Qatom checkout if supported.
6. Update feature statuses and demo docs from the resulting evidence; keep escrow as a separate later acceptance gate.
