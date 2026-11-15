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
- The web UI supports only demo USDC/USDT with six decimal places and now states this limitation in the authorization form. Qatom uses USD-TDN with scale 3; GOAT native transfers use a different asset and scale. The UI cannot currently register the platform-specific intents required by both integrations.
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
- `docs/team-setup-guide.md` now references the root `npm run db:migrate` script. PostgreSQL itself remains unverified here.

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
**Accountable owner:** Person 4 / Om (agent and attack testing)  
**Supporting owners:** Person 1 / Awais (gateway decision), Person 5 / Nasar (playground integration)

- The repository contains an optional Gemini model adapter package. The web route now rejects live-model requests before any network call; the console playground only sends user-authored synthetic text and proposal fields.
- No live model attack result is recorded. Re-enable the web route only after Person 4 supplies enforced numeric spend controls and a separate paid-call authorization exists.
- The scripted `demo:attack` does not call a real model for the unprotected scenario. It hardcodes the attack proposal and labels it illustrative; it does not prove an attack succeeded.
- The protected “clean purchase” uses a fake gateway authority, fake signer, fake transaction hash, and fake RPC receipt; it does not settle on GOAT.
- The synthetic playground sends its user-authored proposal through the gateway. It is not a paired vulnerable-agent path that demonstrates the same attack succeeding without the gateway and then being stopped with it.
- The PRD's specified architecture names the OpenAI Agents SDK, while an optional Gemini adapter package also exists. If Gemini is intended as a replacement, record that architecture decision and ensure the shared workflow and spend controls apply before enabling it.

**Needed to close:** Person 4 implements a controlled unprotected agent and protected path using the same malicious input; capture reproducible model output and gateway evidence; keep wallet/payment credentials inaccessible to the model; add an explicit provider-spend gate before any live model call.

### G-07 — PDF extraction is not in the purchase workflow

**Priority:** P0  
**Accountable owner:** Person 4 / Om (inspection and PDF extraction)  
**Supporting owners:** Person 1 / Awais (persisted evidence), Person 5 / Nasar (upload and display)

- A hidden-text adversarial PDF fixture exists. `scripts/demo-pdf-attack.mjs` extracts it with PyMuPDF and runs the heuristic scanner.
- That script manually computes a rejection rather than submitting the extracted evidence and proposal to the actual gateway.
- The synthetic playground's “Synthetic PDF Text Fixture” control still inserts explanatory text; the separate upload panel now sends a selected PDF through the existing bounded PyMuPDF extractor and the same `/api/verify` gateway path used for text proposals.
- Uploaded PDF bytes are written to a unique temporary directory and deleted in a `finally` block after extraction. The UI displays the source filename, page/character counts, extracted text, limitations, advisory findings, and gateway decision; it does not infer an invoice amount or destination.
- The gateway verify endpoint persists a proposal and inspection in source, but PostgreSQL behavior is unverified and the console still has no owner-scoped read API to reconstruct that evidence after reload.

**Progress:** Person 5 added transient upload, bounded extraction, same-flow verification, and evidence display. The local UI/API checks and Python extractor tests passed on this branch.

**Needed to close:** Person 4 validates extraction behavior/coverage and hidden-text fixtures; Person 1 verifies persistence under an isolated PostgreSQL database and adds owner-scoped history reads so evidence can be reconstructed after reload. Scanner findings remain advisory.

### G-08 — Decisions, outcomes, and human review are not fully available in the UI

**Priority:** P0 for outcome display; P1 for full dashboard/review  
**Accountable owner:** Person 5 / Nasar  
**Supporting owners:** Person 1 / Awais (audit/review APIs), Person 2 / GOAT and Person 3 / Qatom (provider results)

- The console displays authorization details, proposal comparison, gateway decision, and scanner findings for the current session.
- A verification decision is displayed as **not executed**; the UI does not consume approval or call an adapter.
- Session decisions are lost on reload. The persisted audit view currently focuses on intent-created events; it does not reconstruct proposal, inspection, decision, and execution records as a coherent history.
- The audit-chain verification endpoint/UI can check chain integrity, but that is not a transaction history or proof that every required outcome is present.
- A gateway review-resolution POST exists for dashboard/admin service roles, but it does not establish an authenticated reviewer identity or owner-scoped review queue; the console has no review controls.
- Payment states such as `submitting`, `pending`, `pending_approval`, `succeeded`, `failed`, and `unknown`, plus provider receipts/references, are not presented as a connected lifecycle in the console.
- Person 5's UI now labels current decisions as session-only and explains that persisted proposal, inspection, review, and payment history is unavailable. `/audit` events do not carry a usable intent binding for verified decisions, and the gateway has no owner-scoped review-list or decision/proposal/evidence history endpoint. The existing review-resolution POST is not enough to build a safe queue.
- The audit badge now describes hash-chain integrity only; it does not claim all decisions are visible or that a payment settled.

**Needed to close:** Person 1 adds owner-scoped persisted history and review-list/read APIs with approved fields and authenticated reviewer identity; provider owners expose checked execution status and receipt facts. Person 5 can then display proposal, intent, reasons, inspection evidence, execution status and receipt, distinguish `unknown` and pending, and add reviewer controls. Prove unresolved proposals cannot execute.

### G-09 — Demo scripts and docs overstate some evidence

**Priority:** P1 for demo readiness and accurate acceptance reporting  
**Accountable owner:** Person 5 / Nasar (integrated demo and documentation)  
**Supporting owners by evidence:** Person 1 / Awais (replay and audit demos), Person 2 / GOAT (`demo:goat`), Person 4 / Om (agent and PDF demos)

- `scripts/demo-attack.mjs` now labels its mock authority, signer, transaction hash, and receipt as synthetic; no gateway or chain is called.
- `scripts/demo-goat-live.mjs` is labeled as a read-only RPC probe plus local fake-authority check; it does not submit a transaction.
- `scripts/demo-replay-attack.mjs` now prints actual HTTP/decision fields, but it still does not call the approval-consume endpoint for the first proposal. Its `validProposal` omits required `sourceRef`, so the local gateway returns schema-invalid rather than testing zero-use/expiry policy. The script does not fail on unexpected responses.
- The PDF CLI demo uses a real fixture/extractor but manually computes an illustrative result. The web UI now has a separate bounded upload flow; see its test evidence after integration.
- The audit demo no longer claims SOC 2 readiness or prints a passing message when verification is invalid; however, it still exits successfully if the chain is invalid.
- The README, setup guide, and demo output now label the attack, PDF, replay, and GOAT scripts as synthetic, local policy checks, or read-only probes as applicable. Their underlying mock/replay behavior is unchanged and still does not meet end-to-end acceptance.
- The setup guide's migration command now matches the root `db:migrate` script.

**Needed to close:** the replay demo owner must add required fields, validate zero-use/expiry API results, and add a true second consume attempt on the same approval; the audit demo owner must use a nonzero exit status for invalid verification. Keep live provider evidence separate from fixture/test evidence. Current labels and setup command are corrected.

### G-10 — Feature status and project documentation need reconciliation

**Priority:** P1  
**Accountable owner:** Person 5 / Nasar (plan, feature list, and handoff consistency)  
**Supporting owners:** each feature owner validates the evidence for their feature; Om owns the main-branch release gate

- **Historical finding from the initial gap review:** `feature_list.json` marked F-001–F-010 and F-013 `implemented`, despite the acceptance gaps in this document; F-011 and F-012 were `not_started`. The current status legend and evidence-based rows are documented in the progress note below.
- `CONTEXT.md` and parts of `docs/team-handoff.md` still describe the frontend as unmerged or ask for a PR into develop, even though the frontend commits are ancestors of the current develop head.
- `docs/integration.md` retains earlier pinned-source language and should be refreshed to distinguish newly added active-mode GOAT HTTP code from verified trusted gateway integration.
- The root README's test count and current demo claims have not been verified on `497db86`.

**Progress:** `feature_list.json` now defines `verified`, `partial`, `blocked`, and `not_started` and no longer marks incomplete P0/P1 features as implemented. See status notes for remaining component-owner validation.

**Needed to close:** feature owners validate their rows against current evidence; update branch/merge facts after integration; preserve explicit limits of source tests, mocked demos, database tests, and provider evidence.

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
