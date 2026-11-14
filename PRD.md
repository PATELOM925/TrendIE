# Product Requirements Document
## Agentic Payment Guard
**Version:** 0.1 — Hackathon MVP  
**Platforms:** GOAT Network + Qatom  
**Tracks:** Control / Attack

### 1. Product Overview

Agentic Payment Guard is a security middleware that protects autonomous AI purchasing agents from prompt injection, unauthorized purchases, and payment fraud.

The product independently verifies purchases against the user's original authorization before execution. For higher-risk transactions, it optionally provides smart-contract escrow on GOAT Network, releasing funds only after verified fulfillment.

**Value proposition:** Secure what agents decide to pay for, not just how they pay.

### 2. Problem

AI agents increasingly discover products, process invoices, and execute payments without human intervention.

Existing payment infrastructure provides cryptographic verification, spending limits, and transaction authorization. However, those mechanisms do not necessarily establish that an agent's purchase matches the user's original intent.

Malicious product descriptions, invoices, and tool responses can manipulate purchasing decisions while producing otherwise valid transactions.

### 3. Target Users

- Developers building autonomous purchasing agents.
- Businesses automating procurement and accounts payable.
- Agentic commerce platforms and payment providers.

### 4. MVP Features

| Feature | Requirements | Priority |
|---|---|---|
| Intent registration | Store trusted buyer authorization, seller, product, amount, and expiry | P0 |
| Payment verification | Compare proposed purchases against registered intent using deterministic rules | P0 |
| Prompt-injection inspection | Detect suspicious instructions in product descriptions and PDF invoices | P0 |
| Payment interception | Block unauthorized payments before execution | P0 |
| GOAT integration | Secure payment action using AgentKit | P0 |
| Qatom integration | MCP wrapper for catalog search and checkout | P0 |
| Audit dashboard | Display intent, proposed payment, decision, and evidence | P1 |
| GOAT escrow | Smart contract for deposit, release, refund, and dispute | P1 |
| Delivery verification | Verify agreed fulfillment evidence before escrow release | P1 |

### 5. Core User Flow

1. **Authorize:** User establishes a trusted purchasing intent and constraints.
2. **Discover:** AI agent searches merchants, catalogs, or invoices.
3. **Inspect:** Gateway examines untrusted content for suspicious instructions.
4. **Verify:** Proposed purchase is compared against the trusted authorization.
5. **Decide:**
    - Approved → Proceed to payment.
    - Rejected → Block transaction and record evidence.
    - Ambiguous → Require human approval.
6. **Execute:** Payment is processed through GOAT or Qatom.
7. **Optional escrow:** On supported GOAT transactions, funds remain locked until delivery conditions are satisfied.
8. **Audit:** Record authorization, verification decision, and transaction outcome.

### 6. Technical Architecture

| Component | Technology |
|---|---|
| Frontend | Next.js, Tailwind CSS |
| Backend | TypeScript, Fastify |
| Agent | OpenAI Agents SDK |
| Security policies | Zod + deterministic validation |
| Document inspection | Python, PyMuPDF |
| Database | PostgreSQL |
| GOAT integration | AgentKit, viem |
| Qatom integration | MCP client |
| Escrow | Solidity, Foundry, OpenZeppelin |

**Architecture:** AI Agent → Security Gateway → GOAT/Qatom Payment Adapter → Settlement.

Escrow is a separate GOAT-native payment path, not an assumed feature of GOAT Flow or Qatom checkout.

### 7. Security Requirements

- Payment credentials must remain inaccessible to the LLM.
- Original user authorizations must be stored outside agent-controlled context.
- All payment operations must pass through the verification gateway.
- Amount, seller, product, currency, and expiry must be independently validated.
- Approved transactions must be bound to unique authorization IDs to prevent replay and duplicate payments.
- Unverified transactions must fail closed.
- Escrow release requires trusted verification evidence, not an LLM judgment alone.

### 8. Hackathon Demonstration

**Scenario A — Prompt-injection attack**

An agent receives a synthetic invoice or product listing containing hidden malicious instructions.

Without the gateway, an intentionally vulnerable test agent changes its purchasing decision.

**Scenario B — Protected purchase**

The same attack is attempted with Agentic Payment Guard enabled.

The gateway detects the unauthorized deviation and blocks payment.

**Scenario C — Conditional settlement**

A legitimate transaction is approved and deposited into a GOAT escrow contract.

Funds are released upon verified fulfillment or refunded according to contract rules.

### 9. Success Criteria

- 100% of known, deterministic authorization violations in the test suite are blocked.
- Legitimate purchases complete successfully.
- At least one successful prompt-injection attack is reproduced in a controlled, unprotected agent.
- The same attack is prevented with the gateway enabled.
- At least one real testnet transaction is executed through GOAT.
- Qatom integration performs an authenticated test checkout where supported.
- Optional escrow demonstrates deposit, release, and refund.
- Every decision produces an auditable explanation.

### 10. Out of Scope

- Cross-chain escrow between GOAT and Qatom.
- Production handling of real customer funds.
- Fully autonomous dispute arbitration.
- Universal detection of every prompt-injection technique.
- Replacing existing wallets, payment protocols, or marketplaces.

### 11. Key Risks and Dependencies

- **Qatom authorization:** Confirm MCP authentication, checkout permissions, and availability of test transactions.
- **GOAT escrow compatibility:** Custom escrow payments require their own contract flow; standard direct checkout is not automatically compatible.
- **Verification accuracy:** An LLM-based scanner cannot guarantee detection. Deterministic authorization remains the primary defense.
- **Delivery disputes:** Fulfillment evidence may be ambiguous; the MVP should use objectively verifiable delivery conditions.

### 12. Definition of Done

A working AI purchasing agent can discover a product, propose a transaction, and execute payment through a security gateway integrating with GOAT or Qatom.

The system demonstrably prevents an unauthorized purchase caused by prompt injection, records the evidence, and supports an optional GOAT escrow transaction with verifiable release conditions.

**MVP priority:** Intent verification → GOAT payment → Qatom integration → attack demonstration → optional escrow.