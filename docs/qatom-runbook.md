# Qatom QPE runbook

## Current safe boundary

The deployed local MCP client connects to `https://mcp.m.todaq.net/mcp` over Streamable HTTP.
Capability inspection and catalog search are read-only. Write and continuation methods refuse.
Checkout is not enabled: authentication, tool schemas, exact-price binding and receipt format have
not been verified. Paid execution remains disabled by default (zero) until Q003 has a numeric
ceiling and a separate authorization; this runbook never dispatches checkout.

On 2026-11-14, an unauthenticated read-only MCP `initialize` request returned HTTP 401 with a
Bearer challenge and protected-resource metadata URL. It disclosed no tools.

On 2026-11-15 at 09:25:16.299 UTC, ParentSol ran the actual read-only CLI from local candidate
`53215e8` with Node 22.23.4 against `https://mcp.m.todaq.net/mcp`, using `npm run qatom:probe`.
Sanitized output was `tokenPresent:false`, `accessVerified:false`, `status:401`,
`authChallenge:true`, `toolInventory:unavailable`, `tools:[]`, and `checkout.toolPresent:false`.
`atomicPriceCurrencyBinding` and `receiptGuarantee` were `unknown`. No `QATOM_MCP_TOKEN` was in
the process environment; no credential file was read, no paid tool was called, and no checkout
was attempted. This confirms the probe's observed unauthenticated response only. It does not
establish that checkout is unsupported or define its authenticated schema, price binding, or
receipt guarantee. The docs update does not change runtime behavior.

## Local checks

From the repository root, with Node 22 and npm:

```sh
npm ci --ignore-scripts
npm run typecheck
npm run lint
npm test
npm run build
. .venv-pdf/bin/activate
npm run test:pdf
```

Tests are offline and use local fakes. Their success does not prove remote access or settlement.
The workspace includes `@trendie/goat` and the public-export AAT-to-Qatom integration fixture.
`test:pdf` requires the existing isolated `.venv-pdf` to be activated; if it must be recreated,
follow the pinned setup in [the AAT runbook](aat-runbook.md). It fails when dependencies are
missing and never skips PDF checks.

Run the full unfiltered dependency audit with `npm audit --json`; do not use `--omit` to conceal
findings. The current GOAT AgentKit nested Zod 3 high advisory remains unresolved and requires an
explicit external-use release assessment. See the [dependency audit record](dependencies.md) and
Q007 in [open questions](questions.md).

## Read-only tool inventory

After building, `npm run qatom:probe` attempts `initialize` and `tools/list`. It prints sanitized
capability evidence, including token presence, access verification, status/auth-challenge state,
tool-inventory availability, and tool names. It does not print schemas, token values, provider
response bodies or call tools. No checkout tool is invoked. The 2026-11-15 result above is pinned
to candidate `53215e8`; rerun the probe to establish evidence for a different candidate.

Secure token request/entry through an approved secret mechanism has not been received. If the user
provides a token through that mechanism, inject `QATOM_MCP_TOKEN` into the probe process environment.
Do not request or accept the token in chat, or place it in this repository, command arguments,
terminal transcripts or logs. Current implementation supports a server-provided Bearer
token only; OAuth login, token refresh, scopes and buyer authorization remain unverified. If
interactive auth is required, stop and document the supported flow before proceeding. Never
automate OTP or account login.

## Live capability gates

Before any future checkout work, retain sanitized actual tool schemas and verify checkout input,
price/currency binding, provider approval continuation and receipt semantics from authenticated
primary evidence. Implement trusted server capability and receipt-verifier ports from those facts;
do not guess fields. The gateway authority implementation must exist and pass its own controls
before adapter dispatch. Continuation uses the original claimed proposal and persisted provider
reference, and must pass the paid gate and atomic-price capability again before provider contact.
A quote followed by checkout is not price protection. A trusted receipt verifier also has to establish
seller/merchant, asset/currency and chain identity from verified provider facts; the local receipt port
does not invent those response fields.

Do not invoke a potentially stateful tool, even for a free item. A numeric spend ceiling and
separate user authorization are required before paid execution, and this library's read-only CLI
will remain discovery-only.
