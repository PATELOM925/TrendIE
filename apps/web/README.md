# Guard Console (local frontend)

The Person 5 local frontend slice is implemented here as a Next.js App Router workspace with
Tailwind. It is a single-user local demo, bound to `127.0.0.1:3001`; the Fastify gateway remains
on `127.0.0.1:3000`. It does not complete the PRD's integrated purchase flow or Stage 1–3 gates.

## Run locally

1. From the repository root, install the committed npm workspace lockfile:

   ```sh
   npm ci --ignore-scripts
   ```

2. Start the gateway only with a disposable local database and distinct synthetic service keys,
   following [gateway setup](../../gateway/README.md). Database migrations and seed commands are
   intentionally not run by the frontend.
3. Copy `.env.example` to `.env.local` in this directory and set the same local dashboard and agent
   keys used by the gateway, plus a synthetic `DEMO_OWNER_ID`. These values stay server-side; do not
   prefix them with `NEXT_PUBLIC_`.
4. From the repository root, start Next.js:

   ```sh
   npm run web:dev
   ```

The web workspace builds the existing inspection package before starting Next.js. The browser
talks only to same-origin Next.js routes; those routes call a fixed loopback gateway URL.

## What the console does

- Creates one-use local intents for USDC or USDT, using six-decimal integer base units and a required
  allowed destination.
- Sends synthetic proposal scenarios to the gateway's deterministic `/verify` endpoint.
- Runs the existing heuristic text scanner on the server and passes its findings as advisory
  inspection signals. Findings may be incomplete and never decide authorization.
- Shows gateway decisions, reason codes, the compared intent/proposal, scanner evidence, local-session
  activity, and allowlisted intent-created audit entries.

An approved decision is displayed as **not executed**. The UI does not consume approvals or invoke
GOAT/Qatom payment adapters. It has no login and must not be exposed as a multi-user or public app.
The persisted gateway audit feed currently cannot reconstruct the full proposal and inspection
evidence for a decision after reload; the console labels decision history as session-only.

The UI currently scans supplied text and synthetic listing fixtures. It does not yet upload or
extract PDF invoices. PDF extraction and live payment execution remain separate PRD work and are not
claimed by this frontend.
