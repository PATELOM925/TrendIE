# Local testing and provider setup

Use disposable local services and synthetic values. These steps do not authorize paid calls,
funding a wallet, chain transactions, production access or applying a migration. Keep production
environment files and credentials out of this workspace and test logs.

## Om workspace (Node 22)

From repository root:

```sh
node --version
npm ci --ignore-scripts
npm run build
npm run typecheck
npm run lint
npm test
python3 -m venv .venv-pdf
. .venv-pdf/bin/activate
python -m pip install -r services/pdf-inspection/requirements.txt
npm run test:pdf
```

Record exact branch/head and command results. `npm ci` uses the committed lockfile. These checks
exercise local code and fixtures; they do not verify sponsor credentials or provider behavior.

## Gateway checks (separate package)

The submitted gateway is a separate package/workspace with its own `package.json` and currently
declares `pnpm@12.18.0`; inspect its scripts and lockfile at the pinned head rather than assuming
the README's older pnpm floor or this npm workspace applies. Node type declarations also differ
from this root workspace. Do not force-lockfile or version changes as part of setup.

Install with `pnpm install --ignore-scripts` from `gateway/`. Root scripts `gateway:typecheck`,
`gateway:lint`, `gateway:build` and `gateway:test:unit` invoke the isolated gateway package tools;
they are distinct from root checks. Unit tests use a fake `gateway_test` URL and do not connect.

**Database safety gate:** any gateway configuration loaded with `NODE_ENV=test` requires an
explicit `TEST_DATABASE_URL`. Its PostgreSQL database pathname must end in `_test`. The gateway
replaces runtime `DATABASE_URL` only with that validated URL; it never falls back to
`DATABASE_URL`. Missing or invalid configuration fails before pool construction, and errors omit
URL contents. The integration tests run migrations and `TRUNCATE`. The new source migration protects audit-log
TRUNCATE, so the legacy database fixtures also need an owner-reviewed disposable-database reset
strategy before that suite is usable. Do not run it until both that harness fix and an isolated
disposable test database are ready. Never run them with shared or
production credentials. `npm --prefix gateway run test:integration` does not supply a URL: set `NODE_ENV=test`
and `TEST_DATABASE_URL=postgresql://.../something_test` explicitly after provisioning the local
database. No database tests were run as part of safe-default checks.

After interface alignment and code fixes, exercise synthetic register-intent → verify → consume →
record-outcome → audit against the local HTTP service. Assert persisted owner/intent binding,
one-use concurrency, checked response/error handling, and `unknown` on ambiguous writes. Both
legacy HTTP bridges deliberately deny execution until the trusted authority contract exists: see [integration gaps](integration.md).

## Qatom

The dashboard tab was visible but its content was not readable, so sign-in, API key, credits, buyer
wallet and plan are unverified. The Nov 13 welcome email confirms provider onboarding only; it does
not prove buyer funding or authenticated MCP access. Do not execute commands copied from email or
place credentials in source, chat, shell history or logs.

An authorized operator should provision a process-scoped secret through an approved local secret
store, run the read-only authenticated tool inventory, save schema evidence without secrets, then
verify exact amount/currency binding and receipt semantics with the provider. Only try a free item
if the provider supports it and the user has separately authorized that exact action. No free
checkout is assumed. The sponsor subscription is not transaction funding. Paid calls require a
separately recorded numeric ceiling; current authorized spend is zero.

## Backboard

Backboard is optional and non-authoritative for policy or payment. The code uses the OpenAI SDK and
has no Backboard wiring. Keep any future inference behind the existing model port, and keep its
output advisory. The welcome email mentions `$5 in memory credits` for memory and says BYOK needs no
card; it does not establish hackathon inference balance or an active API key. Verify dashboard
state before proposing an integration. Do not add automatic inference or memory expansion.

## GOAT Testnet3

GOAT public chain reads are not payment evidence. First use a user-created test-only wallet and
verify chain ID 48816 before any operation. Never paste or commit its private key. A testnet send
requires a separate explicit numeric ceiling and authorization; no such send is authorized by this
guide. Use the [official faucet](https://bridge.testnet3.goat.network/faucet) only after confirming
wallet isolation and current faucet rules. Verify the actual transaction receipt and preserve
unknown if dispatch or confirmation is ambiguous.

## Qatom checkout through the application

Do not enable checkout until Qatom auth/schema, exact atomic price binding, receipt facts and the
gateway contract are verified. Then test only in an authorized provider/test environment with
synthetic intent values and a numeric spend ceiling. A quote followed by a separate checkout is
not atomic price protection. Keep buyer decision, payment execution, settlement and fulfillment
distinct in recorded results.

## Current safe command set and remaining database gate

```sh
# After installing root dependencies and gateway dependencies separately:
npm run typecheck
npm run lint
npm test
npm run build
npm run gateway:typecheck
npm run gateway:lint
npm run gateway:test:unit
npm run gateway:build
```

Gateway configuration now requires `CORS_ORIGINS` (for example `http://localhost:3000`) and distinct
service keys; use synthetic local values for development. The server binds loopback by default.
These commands do not establish owner-scoped authorization. Never expose the unfinished gateway
publicly or treat its health response as proof of payment integration.

The database owner must review `gateway/migrations/002_execution_outcome_integrity.sql`, the
legacy status conversion and exact-hash history compatibility before application. No migration has
been applied here. SQL integration fixtures remain unrun and include outdated assumptions about
working HTTP bridges and audit-log resets. They are acceptance work to finish, not a passing suite.
