# Implementation plan

This plan preserves the original six stages and five role scopes from [Division.md](../Division.md). The docs foundation is separate pre-stage planning; it does not complete Stage 1. Priorities are QPE first, AAT next, and GOAT opportunistically through Stage 3. All runtime stages remain pending. Product priorities remain in [PRD.md](../PRD.md).

## Pre-stage — Planning and docs foundation

The current documentation records proposed contracts, architecture, risks, owners and acceptance. It provides no proof of runtime capability, provider access, tests or completed stage work. Runtime code slices start from fresh `origin/main` after this foundation lands and use focused PRs; do not carry foundation commits into code PRs.

## Stage 1 — Foundation (pending)

| Role | Acceptance |
|---|---|
| Person 1 / Awais | Finalize schemas and policy logic. |
| Person 2 / GOAT, opportunistic | Configure a GOAT Testnet3 wallet. |
| Person 3 / Qatom / QPE, Om | Verify authenticated MCP access and available tools. |
| Person 4 / AAT, Om | Create clean and malicious listing fixtures. |
| Person 5 / Nassar | Scaffold frontend and shared deployment. |

**Stage checkpoint:** Record evidence for each role's acceptance; docs alone do not pass this stage. The expected next focused PR is QPE's Stage 1 capability check. An exact-price P0 gate may block live checkout, but does not block read-only discovery or local work.

## Stage 2 — Core flow (pending)

| Role | Acceptance |
|---|---|
| Person 1 / Awais | Implement intent registration and deterministic verification. |
| Person 2 / GOAT, opportunistic | Make a standalone GOAT Testnet3 payment and verify its receipt. |
| Person 3 / Qatom / QPE, Om | Implement discovery and checkout subject to provider price-binding and spend gates. |
| Person 4 / AAT, Om | Build the purchasing agent and structured proposal generation. |
| Person 5 / Nassar | Connect intent and payment screens. |

**Stage checkpoint:** Demonstrate each branch's acceptance with evidence. Qatom checkout remains disabled unless exact price and spend can be enforced safely; discovery and local development can proceed independently.

## Stage 3 — Integration (pending)

| Role | Acceptance |
|---|---|
| Person 1 / Awais | Issue transaction-bound approvals and own authorization. |
| Person 2 / GOAT, opportunistic | Connect the GOAT adapter to the gateway using transaction-bound approvals. |
| Person 3 / Qatom / QPE, Om | Connect the Qatom adapter to the gateway using transaction-bound approvals. |
| Person 4 / AAT, Om | Implement injection inspection and PDF extraction. |
| Person 5 / Nassar | Integrate decisions, receipts and audit views. |

**Stage checkpoint:** Verify each connected path through public interfaces and retain provider evidence. Baseline authorization and duplicate-execution tests are required while Stage 3 interfaces are implemented; security testing is not deferred to Stage 4. Verify GOAT chain ID `48816` before submission. A Noop or simulated result is not payment evidence.

## Stage 4 — Security testing (pending)

Compare protected and intentionally unprotected attack scenarios, then cover mismatches, expiry, replay, concurrent duplicates, checkout authorization, provider failure and uncertain outcomes. Show that unauthorized proposals are blocked and legitimate proposals remain possible. Exercise reconciliation, malicious seller/provider output and resource-limited PDF inspection. Add runtime tests through public interfaces as those interfaces exist; no test suite exists now.

**Stage checkpoint:** Reproducible attack and failure evidence demonstrates protected/unprotected behavior and does not overstate simulated or unknown outcomes.

## Stage 5 — Finalization (pending)

Validate audit and authorization integrity; verify receipts and recovery from uncertain outcomes; confirm actual Qatom functionality; run legitimate and malicious regressions; document dependencies and licenses; rehearse the demo using authorized test environments. Deploy only under Om's gate. Exact submission and pitch details remain unverified; see [hackathon notes](hackathon.md).

**Stage checkpoint:** The demo presents intent, proposal, decision, provider receipt and uncertain states truthfully, with verified dependencies and evidence.

## Stage 6 — Stretch: optional escrow (pending)

Escrow remains later than the protected core. It requires separate contract design, review, testnet verification and owner approval. Do not claim escrow is a GOAT direct-payment feature or part of Qatom checkout. No escrow code is in this foundation.

**Stage checkpoint:** Keep escrow out of core acceptance; proceed only after the protected core and separate escrow gates are satisfied.
