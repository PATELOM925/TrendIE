# Qatom QPE runbook

## Current safe boundary

The deployed local MCP client connects to `https://mcp.m.todaq.net/mcp` over Streamable HTTP.
Capability inspection and catalog search are read-only. Write and continuation methods refuse.
Checkout is not enabled: authentication, tool schemas, exact-price binding and receipt format have
not been verified. Paid execution remains disabled by default (zero) until Q003 has a numeric
ceiling and a separate authorization; this runbook never dispatches checkout.

On 2026-11-14, an unauthenticated read-only MCP `initialize` request returned HTTP 401 with a
Bearer challenge and protected-resource metadata URL. It disclosed no tools. This is the only live
Qatom evidence recorded here.

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

## Read-only tool inventory

After building, `npm run qatom:probe` attempts `initialize` and `tools/list`. It prints only whether
the token environment variable is present, tool count, and tool names; on failure it prints only
sanitized error metadata. It does not print schemas, token values, provider response bodies or
call tools. No checkout tool is invoked.

If authentication is later provisioned by an approved secret manager, inject `QATOM_MCP_TOKEN`
into the probe process environment. Do not place the token in this repository, command arguments,
chat, terminal transcripts or logs. Current implementation supports a server-provided Bearer
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
