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

**Agentic Payment Guard** creates a physical and cryptographic air-gap between untrusted AI agents and financial execution rails:

```
┌─────────────────────────────────┐       ┌─────────────────────────────────────────┐
│   Out-of-Band Human Principal   │       │           Untrusted AI Agent            │
│ (Treasury / Business Operations)│       │ (Gemini 3.5 Flash / Claude / AutoGPT)  │
└────────────────┬────────────────┘       └────────────────────┬────────────────────┘
                 │ 1. Pre-Authorizes Intent                    │ 2. Reads Vendor Invoice
                 │    (Max $50, Seller X, Single-Use)          │    (Poisoned / Injected)
                 ▼                                             ▼
┌───────────────────────────────────────────────────────────────────────────────────┐
│               🛡️ AGENTIC PAYMENT GUARD SECURITY GATEWAY (PORT 3000)                │
│                                                                                   │
│  [Heuristic & Document Inspection] ──► Extracts invisible font streams & tokens    │
│  [Deterministic Policy Engine]     ──► Microsecond BigInt math & whitelist checks │
│  [Anti-Replay & Expiry Enclave]    ──► Atomic PostgreSQL state machine            │
│  [Cryptographic Audit Ledger]      ──► Tamper-proof SHA-256 continuous hash chain │
└─────────────────────────────────┬─────────────────────────────────────────────────┘
                                  │ 3. Issues Single-Use HMAC Capability Token
                                  ▼
┌───────────────────────────────────────────────────────────────────────────────────┐
│                       PAYMENT ADAPTERS (RESTRICTED ACCESS)                        │
│                                                                                   │
│  • GOAT Network Testnet3 Bridge (Chain ID: 48816, RPC: rpc.testnet3.goat.network) │
│  • Fiat / Credit Card Settlement Adapters                                         │
└───────────────────────────────────────────────────────────────────────────────────┘
```

### Key Architectural Pillars:
1. **Zero LLM in the Critical Payment Path:** The Gateway evaluates policies using pure deterministic BigInt arithmetic and cryptographic lookups (**< 1.5ms per verification, 15,000+ TPS**). No GPU costs, no hallucinations, zero prompt injection surface.
2. **Zero-Gas Attack Rejection:** Malicious attacks are intercepted and blocked off-chain. Treasury wallets spend **$0.00 in gas fees or RPC costs** on blocked attempts.
3. **Dual-Control Air Gap:** AI agents have **zero private keys, zero wallet seeds, and zero signing authority**. The gateway only issues single-use cryptographic HMAC execution tokens when all invariants pass.
4. **Tamper-Proof Audit Chain:** Every single creation, approval, and blocked attack is linked into a continuous SHA-256 hash chain (`SHA-256(prev_hash + payload)`), making insider fraud mathematically impossible to hide.

---

## 🚀 Live Track 3 Demonstrations (Run in 10 Seconds)

All components run with comprehensive end-to-end test fixtures:

```bash
# 1. Full Attack & Defense Scenario (Hijacked invoice vs clean purchase)
npm run demo:attack

# 2. Adversarial Invisible PDF Invoice Attack (PyMuPDF render_mode=3 extraction)
npm run demo:pdf

# 3. Replay & Expired Intent Attack Defense (Single-use exhaustion)
npm run demo:replay

# 4. Cryptographic SHA-256 Audit Chain Verification
npm run demo:audit

# 5. Live GOAT Network Testnet3 Blockchain Connection (Chain ID 48816)
npm run demo:goat
```

---

## 💻 Web Console & Interactive AI Playground

A real-time Next.js console with a **Live Gemini 3.5 Flash Playground** is included:

- **Web Dashboard:** `http://localhost:3001`
- **Security Gateway API:** `http://localhost:3000`
- **Interactive Scenarios:**
  - 🚨 *Store Hijack Attack:* Test real prompt injection against Gemini 3.5 Flash live.
  - 📄 *Invisible PDF Invoice Attack:* Experience prompt injection hidden in invisible font layers.
  - ✅ *Clean Purchase:* Watch legitimate approvals pass and issue cryptographic HMAC tokens.
  - 🔗 *Live Audit Chain Pill:* Instant visual verification of ledger integrity (`✓ Ledger Valid`).

---

## 🧪 Test Suite & Code Quality

```bash
# Run 89 unit & integration tests across 18 test files
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

