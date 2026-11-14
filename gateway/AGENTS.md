# AGENTS.md — Agentic Payment Guard: Security Gateway (Person 1)

This repo is **Person 1 — Security & Backend** of the Agentic Payment Guard hackathon MVP.
Full context: `../PRD.md` (product) and `../Division.md` (team split). This lives in the `gateway/` folder of the TrendIE repo (branch `awais/security-backend`); other people own other folders — only touch `gateway/`. Read both before coding.

## Mission

Build the **only service allowed to approve payments**. It stores the user's trusted authorization
(an *Intent*), deterministically verifies every `PurchaseProposal` against it (no LLM in the decision),
and issues a **single-use, transaction-bound approval**. Payment adapters (Person 2 GOAT, Person 3 Qatom)
execute only against that approval. Everything is audited. **Fail closed.**

## Stack

- TypeScript (strict), Node 20+, Fastify, Zod, PostgreSQL (`pg` or `postgres`), Vitest.
- Package manager: pnpm. ESM modules.
- Python/PyMuPDF inspection belongs to Person 4 and is out of this repo; we only consume their `InspectionResult`.
- Sponsor platforms: **GOAT Network** and **Qatom** (adapters owned by others). **Backboard.io** is mentioned by
  the team but is not defined in the PRD — do NOT integrate it until Awais specifies its role. If used, it may
  only be an optional, non-authoritative helper behind an interface (e.g. explaining ambiguous cases or memory
  for the audit UI), never in the approve/reject path.

## Repo layout (target)

```
src/
  server.ts            Fastify bootstrap
  config.ts            env validation (Zod); secrets never logged
  schemas/             Zod: Intent, PurchaseProposal, InspectionResult, VerificationDecision, PaymentResult
  policy/              pure deterministic verification (no I/O) + reason codes
  approvals/           token issue / atomic consume
  db/                  migrations, queries, transactions
  routes/              intents, verify, approvals, executions, audit, reviews
  audit/               append-only audit writer + hash chain
  auth/                service API keys, roles
test/                  unit + integration + attack/replay/race tests
docs/CONTRACTS.md      API/contract spec — keep updated (paths here are relative to gateway/)
```

## Core contracts (Person 1 owns Intent and VerificationDecision; co-owns PurchaseProposal)

All money = **integer minor units** (string-encoded bigint over JSON; never floats). Currency/token is an enum
with decimals metadata (e.g. `USD` cents, `USDC` 6 decimals, GOAT testnet token). Never compare across currencies.

- `Intent`: `id, owner, seller, product, maxAmount, currency, expiry, remainingUses, createdAt` — **immutable** once created.
- `PurchaseProposal`: `intentId, seller, product, amount, currency, destination, sourceRef`.
- `InspectionResult` (from Person 4): `source, evidence[], flags[], findings`. Advisory input only.
- `VerificationDecision`: `proposalHash, decision (approve|reject|review), reasonCodes[], timestamp, authorizationRef`.
- `PaymentResult` (from Persons 2/3): `executionId, status, platform, txHashOrCheckoutRef, error`.

`proposalHash` = SHA-256 over canonical JSON (sorted keys, normalized strings, bigint-as-string) of the proposal.

## Verification rules (policy/)

Pure function `verify(intent, proposal, inspection, now) -> decision`. Deterministic; same input → same output.
Checks, each with a stable reason code:

1. `INTENT_NOT_FOUND`, `INTENT_EXPIRED`, `INTENT_EXHAUSTED` (remainingUses = 0)
2. `SELLER_MISMATCH` (exact match after normalization, no fuzzy matching)
3. `PRODUCT_MISMATCH`
4. `AMOUNT_EXCEEDS_MAX`, `AMOUNT_INVALID` (non-positive / non-integer)
5. `CURRENCY_MISMATCH`
6. `DESTINATION_NOT_ALLOWED` (destination must be bound to seller in the intent)
7. `INJECTION_FLAGGED` → at least `review`; policy decides reject vs review (high-severity flag → reject)
8. `SCHEMA_INVALID`, `INTERNAL_ERROR` → reject (fail closed)

Outcomes: any hard mismatch → `reject`. Only soft/ambiguous conditions → `review` (human approval). All pass → `approve`.
An `InspectionResult` can only make a decision stricter, never looser.

## Approval lifecycle (the security invariant)

**The executed payment must match the exact approved proposal. Neither agent nor adapter may change approved fields.**

1. `POST /verify` → on approve, create an `Approval` row bound to `proposalHash`, `intentId`, unique `executionId`,
   short TTL, plus HMAC-signed token (server secret, key id for rotation).
2. Adapter calls `POST /approvals/:id/consume` with the **full proposal it is about to execute**. Server recomputes
   the hash, compares, and consumes **atomically**:
   `UPDATE approvals SET consumed_at = now() WHERE id = $1 AND consumed_at IS NULL AND expires_at > now() AND proposal_hash = $2 RETURNING *`
   Zero rows → deny. Decrement `intents.remaining_uses` in the same DB transaction (`SELECT ... FOR UPDATE`).
3. Adapter reports outcome via `POST /executions/:executionId/result` (idempotent on `executionId`).
4. Uncertain outcomes (timeouts) stay `pending_unknown`; never auto-reissue approval. Reconciliation is manual/explicit.

## Data model (PostgreSQL)

`intents` (immutable; no UPDATE except `remaining_uses` via the consume transaction), `proposals`, `inspections`,
`decisions`, `approvals` (unique `proposal_hash`, unique `execution_id`), `executions`, `audit_log`
(append-only; revoke UPDATE/DELETE from the app role; each row stores `prev_hash` + `row_hash` for tamper evidence).
Use migrations (e.g. `node-pg-migrate` or plain SQL files). Never rewrite history.

## API surface (keep in `docs/CONTRACTS.md`, Person 5 and adapters depend on it)

- `POST /intents`, `GET /intents/:id` (user-facing; owner-authenticated)
- `POST /verify` (agent/gateway-facing; returns decision + approval handle on approve)
- `POST /approvals/:id/consume` (adapter-only service key)
- `POST /executions/:id/result` (adapter-only service key)
- `GET /audit?intentId=` , `GET /decisions/:id` (dashboard read)
- `POST /reviews/:decisionId/resolve` (human approver; may only convert `review` → approve/reject, never override a hard reject)

Auth: separate service API keys per caller role (`agent`, `adapter-goat`, `adapter-qatom`, `dashboard`, `admin`).
The agent role can call `/verify` but can **never** call `/consume` or see the signing secret.

## Hard rules (security)

- No LLM, and no agent-supplied text, ever decides approve/reject. LLM output may only add flags.
- Agent never receives wallet keys, Qatom credentials, or approval-signing secrets. Secrets via env only; never log them.
- Intents are written only through the user-authenticated path, never from agent context.
- Validate every inbound payload with Zod at the boundary; unknown fields → reject (`.strict()`).
- Fail closed on any error, timeout, DB failure, or missing data.
- No floats for money. No `Date.now()` inside policy functions (inject `now`).
- Every decision and every execution transition writes an audit row with reason codes.
- Do not weaken a test to make it pass. Do not add features outside this scope.

## Testing (Person 1 definition of done)

Vitest. Required:
- Unit: each reason code has a passing and failing case; property tests on policy purity/determinism.
- Mismatch: seller, product, amount (+1 over max, boundary equal ok), currency, destination, expiry (exact boundary).
- Replay: consuming an approval twice → second denied. Concurrent consume (N parallel) → exactly 1 succeeds.
- Tamper: altered amount/seller/destination at consume time → denied.
- Duplicate execution: same `executionId` result posted twice → idempotent, no second payment record.
- Audit integrity: hash chain verifies; mutation attempt fails.
- Fail-closed: DB down / malformed input → reject, never approve.

Definition of done (from Division.md): valid purchases pass; unauthorized purchases fail; duplicate execution is
prevented; every decision has a recorded reason.

## Workflow

- Small commits, conventional messages (`feat:`, `fix:`, `test:`, `docs:`). Branch per task; PR into `main`.
- Update `docs/CONTRACTS.md` in the same PR as any contract change and notify other owners.
- Commands: `pnpm dev`, `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm db:migrate`.
- Priority order: intent verification → approval lifecycle → audit → adapter integration endpoints → stretch (escrow authorization).
