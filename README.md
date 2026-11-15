# 🛡️ Agentic Payment Guard (TrendIE)
> **Autonomous AI Agentic Payments Secured by Zero-Trust Deterministic Enclaves**
> *Built for Agentic Payments Hackathon Toronto 2026 — Track 3: Attack & Defense*

---

## 🎯 The Problem: Why Agentic Payments are Terrifyingly Vulnerable

Autonomous AI agents are being handed wallets, credit cards, and signing authorities to purchase cloud servers, SaaS subscriptions, and physical inventory. 

**However, current AI agent payment implementations suffer from a catastrophic vulnerability:**
1. **Prompt Injection & Indirect Document Poisoning:** Attackers hide malicious instructions inside vendor invoices, web forms, or PDF streams (`render_mode=3` invisible font layers).
2. **LLM Jailbreaking & Tool Misdirection:** When the agent reads the poisoned invoice, its context is hijacked. The LLM changes the recipient wallet to an attacker's address and inflates the transaction amount.
3. **The Fatal Mistake:** If the AI agent directly holds private keys or API credentials, **the attacker wins and corporate treasuries are drained instantly.**

---

## ⚡ Our Solution: The Dual-Control Deterministic Gateway

**Agentic Payment Guard** is designed to place deterministic authorization between untrusted agent proposals and payment adapters. The diagram below shows the intended architecture; it is not evidence of a complete integrated or live payment flow.

```
┌─────────────────────────────────┐       ┌─────────────────────────────────────────┐
│   Out-of-Band Human Principal   │       │           Untrusted AI Agent            │
│ (Treasury / Business Operations)│       │ (Untrusted agent; provider not selected)│
└────────────────┬────────────────┘       └────────────────────┬────────────────────┘
                 │ 1. Pre-Authorizes Intent                    │ 2. Reads Vendor Invoice
                 │    (Max $50, Seller X, Single-Use)          │    (Poisoned / Injected)
                 ▼                                             ▼
┌───────────────────────────────────────────────────────────────────────────────────┐
│               🛡️ AGENTIC PAYMENT GUARD SECURITY GATEWAY (PORT 3000)                │
│                                                                                   │
│  [Advisory Inspection]             ──► Scans text; does not guarantee detection   │
│  [Deterministic Policy Engine]     ──► Evaluates proposals against intents       │
│  [Gateway and Database]            ──► Source exists; PostgreSQL integration open │
│  [Append-only Audit Chain]         ──► Hash verification code and route exist     │
└─────────────────────────────────┬─────────────────────────────────────────────────┘
                                  │ 3. Issues Single-Use HMAC Capability Token
                                  ▼
┌───────────────────────────────────────────────────────────────────────────────────┐
│                       PAYMENT ADAPTERS (RESTRICTED ACCESS)                        │
│                                                                                   │
│  • GOAT adapter boundary (live gateway execution unverified)                     │
│  • Qatom discovery client (checkout remains disabled)                            │
└───────────────────────────────────────────────────────────────────────────────────┘
```

### Key Architectural Pillars:
1. **Deterministic policy:** Gateway-backed PDF and replay demos are recorded on `develop`; the isolated current-revision PostgreSQL integration and concurrency suite remains incomplete.
2. **Advisory inspection:** Text and PDF extraction can provide findings, but scanner coverage is incomplete and findings are not payment authorization.
3. **Guarded adapter boundary:** Adapter source has fail-closed checks, but a complete gateway-bound provider payment and checked receipt have not been demonstrated.
4. **Audit verification:** Hash-chain code and an audit verification route exist. A valid chain does not prove that every required event or provider outcome is recorded or visible.

---

## Local fixtures and read-only probes

These scripts are not a complete end-to-end purchase demonstration. Read the comments and output for each script before using a configured local gateway.

```bash
# Live local-gateway policy checks; vulnerable path is narrated and no provider payment is sent
npm run demo:attack

# PyMuPDF fixture extraction submitted to the configured local gateway; no provider payment is sent
npm run demo:pdf

# Live local-gateway single-use consume, duplicate replay, intent exhaustion, and expiry checks
# Writes test intents/audit events to the configured local database; no provider payment is sent
npm run demo:replay

# Audit-chain check against a configured local gateway
npm run demo:audit

# Read-only GOAT Testnet3 RPC probe plus fake local adapter boundary
npm run demo:goat
```

---

`demo:goat` performs public chain reads and a balance query, then exercises a fake local boundary; it
does not broadcast a transaction. `demo:attack` submits the protected proposal to the live local
gateway, but prints a hard-coded vulnerable transfer and labels approval consumption as settlement;
those displayed outcomes are not actual agent execution or provider payment. `demo:pdf` extracts the
checked-in fixture and records/verifies the rejection through the local gateway and PostgreSQL
audit chain. `demo:replay` consumes the same approval twice and checks exhaustion/expiry in the
gateway; it does not dispatch a provider transaction. `demo:audit` reports invalid or unconfirmed
chain state but does not exit nonzero for that result. None proves a provider payment or full PRD
acceptance.

## Web console and synthetic playground

The Next.js console is a local/test interface. Its playground uses user-entered synthetic text;
live Gemini calls are disabled until a numeric spend limit is approved and enforced.

- **Web Dashboard:** `http://127.0.0.1:3001`
- **Security Gateway API:** `http://127.0.0.1:3000`
- **Interactive Scenarios:**
  - Synthetic proposal scenarios are checked by the configured local gateway.
  - PDF extraction findings are advisory; they do not authorize payment.
  - The console does not call payment adapters or claim settlement. Persisted proposal, review, and payment history depends on owner-scoped gateway APIs that are not yet available.
  - The audit-chain badge reports chain integrity only; it does not prove that all decisions or payment outcomes are displayed.

---

## 🧪 Test Suite & Code Quality

```bash
# Run the current local test suite
npm test

# Run TypeScript typechecks across all 6 workspaces
npm run typecheck

# Run zero-warning ESLint validation
npm run lint
```

---

## 📚 Technical Documentation & Architecture

- [Contribution Rules & Ownership](AGENTS.md)
- [Architecture & Implementation Boundary](ARCHITECTURE.md)
- [Shared Type Contracts](docs/contracts.md)
- [Threat Model & Security Analysis](docs/security.md)
- [Team Local Setup Guide](docs/team-setup-guide.md)
- [Proposed ADR 0001: Guarded Payment Execution](docs/adr/0001-guarded-payment-execution.md)

