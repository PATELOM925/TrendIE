# Agentic Payment Guard — 5-Person Team Plan

**Objective:** Deliver a working agentic payment-security gateway integrating GOAT Network and Qatom, demonstrating protection against prompt-injection-induced unauthorized purchases.

**Priority:** Protected payment flow → attack demonstration → both payment integrations → optional GOAT escrow.

## 2026-11-14 ownership and delivery override

The role numbers and scopes below remain the original team plan. For the current work through
Stage 3, Om primarily owns Person 3 (Qatom) while Tirth is unavailable. Person 4 (agent and attack)
is next, and Person 2 (GOAT) is opportunistic. Nassar (repository contribution identity: Nasar)
owns Person 5 frontend and system integration. Awais owns Person 1 security, backend and
authorization. See the current [implementation plan](docs/plan.md).

The original foundation began as documentation only. **Owner-approved stacked-work exception
(2026-11-14):** Om is explicitly authorized to continue QPE through Stage 3 on shared branch
`om/QPE`, including runtime workspace, contracts and Qatom library work. Later Om AAT and GOAT
slices may base on QPE and target QPE until the owner merges that dependency. This does not imply
Awais or Nassar agreed to current contract shapes. Keep integration dependencies visible at their
owned boundaries. Each slice remains focused with small commits. No direct main writes, merges or
deployments. Om owns merge and deployment gates.

For runtime work, GPT 6.1 Sol handles orchestration, planning and implementation review. GPT 6
Luna builds and fixes. Sol checks scope, interfaces, edge cases, control points and acceptance
before runtime work; reviews the built result; and reviews fixes. A final adversarial review starts
only when Om explicitly asks for the named PR scope. It uses Claude API credits, `claude-opus-5-5`,
medium effort. Do not start that review automatically or substitute a provider.

## 1. Team Responsibilities

| Person | Ownership | Concrete deliverables | Definition of Done |
|---|---|---|---|
| **1 — Security & Backend** | Intent verification, policy enforcement, database, authorization lifecycle | Fastify API; Zod schemas; PostgreSQL; trusted intent registration; seller/product/amount/currency/expiry validation; one-use authorizations; audit records | Valid purchases pass; unauthorized purchases fail; duplicate execution is prevented; every decision has a recorded reason |
| **2 — GOAT Integration & Escrow** | GOAT AgentKit, payment execution, blockchain verification, optional escrow | GOAT adapter; testnet wallet; secure payment action; transaction submission; receipt verification; optional Solidity escrow | A gateway-approved payment executes on GOAT Testnet3; unauthorized payments never execute; escrow works if implemented |
| **3 — Qatom Integration** | Qatom MCP, marketplace discovery, checkout, settlement verification | Authenticated MCP client; `catalog_search`; `agent_checkout`; secured wrapper tools; payment receipts; error handling | An approved purchase completes through Qatom where supported; unauthorized checkout requests are blocked; real capabilities and limitations are documented |
| **4 — AI Agent & Attack Testing** | Purchasing agent, malicious documents, prompt-injection inspection, adversarial testing | Agent tool-calling workflow; clean/malicious listings; hidden-text PDF fixtures; PyMuPDF extraction; injection flags; attack comparison tests | An unprotected test agent can be manipulated; the protected flow blocks unauthorized proposals; legitimate purchases still work |
| **5 — Frontend & System Integration** | Dashboard, authorization UI, integration testing, deployment and demo | Next.js interface; intent registration; verification results; audit evidence; transaction status; integrated environment; README | A user can complete the protected purchase flow through one interface and see the authorization, decision, and payment outcome |

## 2. Shared API Contracts

Agree on these before independent implementation.

| Contract | Required fields | Owner |
|---|---|---|
| `Intent` | ID, owner, seller, product, maximum amount, currency/token, expiry, remaining uses | Person 1 |
| `PurchaseProposal` | Intent ID, seller, product, amount, currency/token, recipient/destination, source reference | Persons 1 + 4 |
| `InspectionResult` | Source, suspicious evidence, flags, extraction findings | Person 4 |
| `VerificationDecision` | Proposal hash, decision, reason codes, timestamp, authorization reference | Person 1 |
| `PaymentResult` | Execution ID, status, platform, transaction hash or checkout reference, error | Persons 2 + 3 |

**Security invariant:** The executed payment must match the exact approved proposal. Neither the agent nor a payment adapter may modify approved transaction fields.

Use integer monetary units, immutable authorization records, atomic one-use authorization consumption, and unique execution IDs.

## 3. Implementation Schedule

| Stage | Person 1 | Person 2 | Person 3 | Person 4 | Person 5 |
|---|---|---|---|---|---|
| **1. Foundation** | Finalize schemas and policy logic | Configure GOAT testnet and wallet | Verify Qatom authentication and tool access | Create clean and malicious listings | Scaffold frontend and shared deployment |
| **2. Core flow** | Implement intent registration and verification | Execute standalone GOAT test payment | Test catalog discovery and checkout | Build purchasing agent and proposal generation | Connect intent and payment screens |
| **3. Integration** | Issue transaction-bound approvals | Connect GOAT adapter to gateway | Connect Qatom adapter to gateway | Implement injection inspection and PDF extraction | Integrate decisions, receipts and audit views |
| **4. Security testing** | Test mismatches, expiry and replay | Verify unauthorized payments cannot execute | Test checkout authorization and failure handling | Compare unprotected and protected attack scenarios | Test end-to-end workflows and display evidence |
| **5. Finalization** | Validate audit and authorization integrity | Test receipts and recovery from uncertain outcomes | Confirm actual Qatom functionality | Run legitimate and malicious regression tests | Deploy, document and rehearse demo |
| **6. Stretch** | Escrow authorization integration | Solidity escrow contract | Additional Qatom coverage | Delivery verification tests | Escrow dashboard |

**Escrow begins only when the core protected GOAT flow works and the remaining P0 integration and security tasks are sufficiently complete.**

## 4. Integration Boundaries

### Person 1 — Security Authority

- Owns the only service authorized to approve payments.
- Stores the original trusted user authorization.
- Performs deterministic verification independently of the LLM.
- Issues single-use, transaction-bound execution approval.
- Records all verification and execution decisions.

### Person 2 — GOAT Payment Execution

- Uses GOAT AgentKit and viem.
- Accepts only gateway-approved transactions.
- Keeps wallet credentials inaccessible to the agent.
- Verifies transaction status and records receipts.
- Implements escrow separately from GOAT Flow's direct-payment path.

### Person 3 — Qatom Payment Execution

- Uses Qatom's authenticated MCP interface.
- Wraps catalog search and checkout operations.
- Prevents direct agent access to unrestricted checkout.
- Validates approved parameters immediately before execution.
- Handles retries conservatively to avoid duplicate payments.

### Person 4 — Agent and Adversarial Testing

- Builds the AI purchasing agent.
- Supplies legitimate and attacker-controlled product information.
- Tests malicious instructions in descriptions and PDF text layers.
- Produces repeatable controlled attack scenarios.
- Provides inspection evidence, but cannot independently authorize transactions.

### Person 5 — Frontend and Integration

- Builds the authorization and monitoring interface.
- Integrates all components into a single demo.
- Displays approved, rejected and review-required decisions.
- Shows actual payment outcomes, not merely simulated success.
- Maintains deployment configuration, integration tests and demo documentation.

## 5. Scope and Priorities

### P0 — Required MVP

- Trusted purchase-intent registration.
- Deterministic authorization verification.
- Payment interception and enforcement.
- GOAT AgentKit integration.
- Qatom MCP integration.
- Prompt-injection inspection for listings and PDF invoices.
- Replay and duplicate-payment protection.
- Working protected/unprotected attack comparison.
- Auditable decisions and transaction outcomes.

### P1 — Secondary

- Full audit dashboard and human-review workflow.
- GOAT smart-contract escrow.
- Delivery verification and conditional fund release.

A minimal UI is needed for the demo, even though the full dashboard is P1.

### Out of Scope

- Cross-chain or GOAT-to-Qatom escrow.
- Production custody of customer funds.
- Autonomous dispute arbitration.
- Universal prompt-injection prevention.
- Modifications to GOAT or Qatom core protocols.

## 6. Minimum Hackathon Demonstration

1. **Register intent:** User authorizes the purchase of Product A from Supplier A for a defined maximum amount.
2. **Demonstrate attack:** An intentionally vulnerable agent processes malicious seller content and proposes an unauthorized purchase.
3. **Enable protection:** The same attack is attempted through Agentic Payment Guard.
4. **Block purchase:** The gateway identifies the mismatch against the trusted authorization and rejects payment.
5. **Execute legitimate payment:** An approved transaction completes on GOAT Testnet3 with a verifiable receipt.
6. **Demonstrate Qatom integration:** Show authenticated discovery and an approved checkout where supported.
7. **Display evidence:** Dashboard shows original intent, agent proposal, verification decision, attack evidence and payment status.

**Optional extension:** Deposit a separate approved transaction into GOAT escrow and demonstrate release or refund under verified conditions.

## 7. Success Criteria

- 100% of known deterministic authorization violations in the test suite are blocked.
- Legitimate authorized purchases complete successfully.
- At least one attack succeeds against an intentionally unprotected test agent.
- The corresponding attack is blocked by the protected workflow.
- At least one real GOAT testnet transaction is verified.
- Qatom's supported integration is exercised, with any unavailable capabilities clearly disclosed.
- Duplicate and replay attempts cannot create additional payments.
- Verification decisions and transaction outcomes are auditable.
- Optional escrow demonstrates deposit, release and refund.

## 8. Final Ownership Rule

Each person owns the implementation, unit tests, and integration verification of their component.

**Person 1 owns authorization. Persons 2 and 3 own payment execution. Person 4 owns the agent and adversarial validation. Person 5 owns end-to-end integration and demo readiness.**

No individual component is considered finished until it works through the shared gateway.
