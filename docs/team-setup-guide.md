# Team Local Setup Guide: Agentic Payment Guard

Follow this runbook to set up local PostgreSQL, the Fastify gateway, and the Next.js console. The current demo scripts include synthetic fixtures and read-only probes; they do not demonstrate a completed provider payment.

---

## 1. Prerequisites

Ensure you have installed:
* **Node.js**: `>= 22` (`node --version`)
* **pnpm**: `pnpm --version` (e.g. `pnpm@12.18.0` or `npm install -g pnpm`)
* **Docker Desktop**: Running locally (for PostgreSQL)
* **Python 3** with **PyMuPDF** for the console's bounded PDF text extraction

Install the PDF dependency with `python -m pip install PyMuPDF` (Windows) or
`python3 -m pip install PyMuPDF` (macOS/Linux). If the executable is not named `python` on Windows
or `python3` elsewhere, set `PDF_PYTHON` in `apps/web/.env.local` to its full path. Restart the web
server after changing this value.

---

## 2. Clone and Install Dependencies

```bash
# 1. Switch to the develop branch
git checkout develop
git pull origin develop

# 2. Install root workspace dependencies
npm ci --ignore-scripts

# 3. Install gateway dependencies
cd gateway && pnpm install --frozen-lockfile --ignore-scripts && cd ..
```

---

## 3. Start PostgreSQL Database

In `gateway/`, a Docker Compose file provisions a local PostgreSQL 16 container:

```bash
# Start Postgres in the background
cd gateway && docker compose up -d && cd ..

# Verify the container is healthy:
docker ps
# Expected container: payment_guard_postgres on port 5432
```

---

## 4. Configure Environment Files

Create the two required local configuration files:

### A. Gateway Environment (`gateway/.env`)
Create `gateway/.env` with the following content:

```env
# Server
PORT=3000
HOST=127.0.0.1
CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000,http://localhost:3001,http://127.0.0.1:3001
NODE_ENV=development

# Database
DATABASE_URL=postgresql://postgres:password@127.0.0.1:5432/payment_guard

# Approvals & HMAC
APPROVAL_HMAC_SECRET=dev-hmac-secret-min-32-characters-long-key-12345
APPROVAL_KEY_ID=key_v1
APPROVAL_TTL_SECONDS=300

# Service API Keys (per role)
API_KEY_AGENT=dev-agent-key-1234
API_KEY_ADAPTER_GOAT=dev-goat-key-5678
API_KEY_ADAPTER_QATOM=dev-qatom-key-9012
API_KEY_DASHBOARD=dev-dashboard-key-3456
API_KEY_ADMIN=dev-admin-key-7890
```

### B. Web Console Environment (`apps/web/.env.local`)
Create `apps/web/.env.local` with the following content:

```env
GATEWAY_BASE_URL=http://127.0.0.1:3000
API_KEY_DASHBOARD=dev-dashboard-key-3456
API_KEY_AGENT=dev-agent-key-1234
DEMO_OWNER_ID=user_enterprise_corp
```

Live Gemini calls are disabled in the console until a numeric spend limit is approved and enforced. Do not add a model key to this file for the current local demo.

---

## 5. Run Database Migrations & Seed Demo Data

Run the migration scripts to initialize the PostgreSQL schema and seed the baseline demo authorization:

```bash
# Apply schema migrations (001 and 002)
npm run db:migrate

# Seed demo intent (int_demo_01 for Supplier A)
cd gateway && npx tsx src/db/seed.ts && cd ..
```

---

## 6. Run the Local Applications

Open two terminal tabs:

### Terminal 1: Fastify Security Gateway (Port 3000)
```bash
npm run gateway:dev
# Logs: Security Gateway running at http://127.0.0.1:3000
```

### Terminal 2: Next.js Web Console (Port 3001)
```bash
npm run web:dev
# Logs: Ready in ~350ms, Local: http://127.0.0.1:3001
```

Open your browser at **`http://127.0.0.1:3001`**. This matches the loopback host used by the Next.js server and same-origin API checks. You should see:
* The neutral status badge: `LOCAL SANDBOX · NO PAYMENTS`.
* The seeded authorization: `Supplier A · Product A · 0.005 USDC (5 uses remaining)`.
* Tabs for **`Preset Scenarios (7)`** and **`Synthetic Playground`**. The playground does not call an external model.

---

## 7. Verification & Demos

You can run local checks and the following labeled fixtures/read-only probes from the root directory:

```bash
# 1. Run current workspace unit tests
npm test

# 2. Run TypeScript check across all packages
npm run typecheck

# 3. Run synthetic attack and mock adapter fixture (not live settlement)
npm run demo:attack

# 4. Run read-only GOAT RPC probe and fake local adapter boundary
npm run demo:goat
```

The PDF script extracts a checked-in fixture and computes an illustrative local policy result; it does not call the gateway. The replay script's proposal fixture omits required `sourceRef`, so its requests currently return schema errors instead of proving zero-use or expiry handling; it also does not consume the same approval twice. The audit script reports an invalid chain but does not exit nonzero. See [the root README](../README.md) for current evidence limits. No demo above submits a payment.
