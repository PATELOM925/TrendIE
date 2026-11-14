# Agentic Payment Guard — Security Gateway (Person 1: Security & Backend)

The deterministic Security Gateway is the single authoritative service allowed to approve payments initiated by AI purchasing agents.
It verifies proposed purchases against trusted user authorizations (Intents) without any LLM in the decision loop, issues short-TTL single-use approvals, ensures atomic execution by payment adapters (GOAT / Qatom), and maintains a tamper-evident audit hash chain.

---

## Architecture & Responsibilities

- **Deterministic Verification**: Pure TypeScript verification function (`verifyPolicy`), no I/O, no floats, integer minor units as `bigint`.
- **Atomic Single-Use Approvals**: Approvals are bound to canonical proposal hash (`proposalHash`) and unique `executionId`. Consumed atomically in a single PostgreSQL transaction (`SELECT ... FOR UPDATE` + atomic `UPDATE approvals`).
- **Role-Based Authentication**: Strict API key authentication per role (`agent`, `adapter-goat`, `adapter-qatom`, `dashboard`, `admin`). Agents can never consume approvals or modify intents.
- **Tamper-Evident Audit Chain**: Append-only PostgreSQL audit log with `prev_hash` + `row_hash` (SHA-256 chain) protected by database triggers.

---

## Setup & Running Locally

### 1. Requirements
- Node.js 20+
- pnpm 10+
- PostgreSQL (or run with Docker Compose)

### 2. Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

Key environment variables:
- `PORT`: Server port (default `3000`)
- `DATABASE_URL`: PostgreSQL connection string (e.g. `postgresql://postgres:password@localhost:5432/payment_guard`)
- `APPROVAL_HMAC_SECRET`: Minimum 32-character secret for approval tokens
- `APPROVAL_KEY_ID`: Identifier for HMAC key rotation (e.g. `key_v1`)
- `APPROVAL_TTL_SECONDS`: Approval lifetime (default `300`)
- `API_KEY_AGENT`: API key for AI purchasing agents
- `API_KEY_ADAPTER_GOAT`: API key for Person 2 GOAT Adapter
- `API_KEY_ADAPTER_QATOM`: API key for Person 3 Qatom Adapter
- `API_KEY_DASHBOARD`: API key for Person 5 UI / Buyer
- `API_KEY_ADMIN`: API key for admin operations

### 3. Database Migration & Seed
```bash
# Run PostgreSQL container (optional if local postgres is already running):
docker compose up -d

# Run migrations:
pnpm db:migrate

# Seed demo data (Intent int_demo_01):
pnpm tsx src/db/seed.ts
```

### 4. Running the Service
```bash
# Start development server:
pnpm dev

# Build and run production:
pnpm build
pnpm start
```

### 5. Running Tests & Verifications
```bash
pnpm typecheck
pnpm lint
pnpm test
```

---

## Example cURL Commands

### 1. Register an Intent (`dashboard` / `admin`)
```bash
curl -X POST http://localhost:3000/intents \
  -H "Content-Type: application/json" \
  -H "X-API-Key: dashboard-secret-key-012" \
  -d '{
    "id": "int_demo_01",
    "owner": "user_enterprise_corp",
    "seller": "Supplier A",
    "product": "Product A",
    "maxAmount": "5000",
    "currency": "USDC",
    "allowedDestinations": ["0xSupplierA_Contract_or_Wallet_001"],
    "expiry": "2026-12-31T23:59:59.000Z",
    "remainingUses": 1,
    "createdAt": "2026-11-14T10:00:00.000Z"
  }'
```

### 2. Verify a Purchase Proposal (`agent`)
```bash
curl -X POST http://localhost:3000/verify \
  -H "Content-Type: application/json" \
  -H "X-API-Key: agent-secret-key-123" \
  -d '{
    "proposal": {
      "intentId": "int_demo_01",
      "seller": "Supplier A",
      "product": "Product A",
      "amount": "4500",
      "currency": "USDC",
      "destination": "0xSupplierA_Contract_or_Wallet_001",
      "sourceRef": "listing:demo123"
    }
  }'
```
Response on approval:
```json
{
  "id": "dec_...",
  "proposalHash": "6b4458f3...",
  "decision": "approve",
  "reasonCodes": ["OK"],
  "timestamp": "2026-11-14T13:30:00.000Z",
  "authorizationRef": "apr_..."
}
```

### 3. Consume Approval Atomically (`adapter-goat` or `adapter-qatom`)
```bash
curl -X POST http://localhost:3000/approvals/apr_.../consume \
  -H "Content-Type: application/json" \
  -H "X-API-Key: goat-adapter-secret-key-456" \
  -d '{
    "intentId": "int_demo_01",
    "seller": "Supplier A",
    "product": "Product A",
    "amount": "4500",
    "currency": "USDC",
    "destination": "0xSupplierA_Contract_or_Wallet_001",
    "sourceRef": "listing:demo123"
  }'
```
Response:
```json
{
  "executionId": "exe_..."
}
```

### 4. Record Payment Execution Result (`adapter-goat` or `adapter-qatom`)
```bash
curl -X POST http://localhost:3000/executions/exe_.../result \
  -H "Content-Type: application/json" \
  -H "X-API-Key: goat-adapter-secret-key-456" \
  -d '{
    "executionId": "exe_...",
    "status": "succeeded",
    "platform": "goat",
    "txHashOrCheckoutRef": "0x39a123f...",
    "error": null
  }'
```

### 5. Inspect Audit Log (`dashboard` / `admin`)
```bash
curl -X GET "http://localhost:3000/audit?intentId=int_demo_01" \
  -H "X-API-Key: dashboard-secret-key-012"
```

### 6. Human Review Resolution (`admin` / `dashboard`)
```bash
curl -X POST http://localhost:3000/reviews/dec_.../resolve \
  -H "Content-Type: application/json" \
  -H "X-API-Key: admin-secret-key-999" \
  -d '{
    "resolution": "approve",
    "notes": "Reviewed and approved manually by security officer"
  }'
```
