# Qatom capability evidence

## Current evidence boundary

The Qatom seller guide is a seller setup guide. Its instructions cover publishing catalog items, checking public discovery, and using `agent_checkout` for seller-side launch validation. Those steps are not buyer checkout contract evidence for TrendIE: the guide does not establish that a checkout operation atomically binds an approved amount and currency, nor does it define a receipt shape suitable for settlement verification. The guide also warns that a failed paid call may still charge and that a complete fulfillment response must be retained. TrendIE therefore does not use seller examples as authority to dispatch a buyer purchase.

Primary references reviewed 2026-11-15:

- [TODAQ Micro documentation](https://docs.m.todaq.net/) — official documentation landing page; deeper auth and API details were not available in the retrieved page evidence.
- [Qatom seller guide repository](https://github.com/StarwaterHeaven/qatom-seller-guide) — canonical seller setup guide and linked skill. Seller launch checks do not establish buyer-side atomic price binding or a provider receipt contract.
- [Qatom seller guide skill](https://github.com/StarwaterHeaven/qatom-seller-guide/blob/main/skills/qatom-seller-guide/SKILL.md) — setup notes describe the master MCP URL, catalog discovery and seller-side purchase workflows; they do not document a verified buyer OAuth/custom MCP connector authorization contract.

### Observed locally

The read-only MCP client performs `initialize` and `tools/list`; its capability collector records only a display-sanitized endpoint, timestamp, token presence, access verification, numeric status/auth challenge, tool names, canonical schema fingerprints and read-only annotations. `accessVerified` becomes true only after initialization and `tools/list` succeed; it does not verify identity. Token presence alone does not establish access. It never stores credentials, raw tool descriptions, provider error text or raw responses. It never calls checkout, continuation, catalog fulfillment or account modification. A checkout tool being listed is discovery evidence only. Atomic price/currency binding and receipt guarantee remain `unknown` until provider evidence and the Person 1 authority contract establish them.

Unauthenticated live evidence from 2026-11-14 is recorded in the runbook: initialize returned HTTP 401 with a Bearer challenge and protected-resource metadata URL, with no tool inventory. No authenticated probe or paid operation was performed for this task. HTTP 401 does not establish that Qatom checkout is unsupported.

## Authority boundary proposed for Person 1 review

This is a proposed Qatom adapter request/response shape, not an agreed route or server implementation. Use the common principle V1 envelope: explicit version, full server-approved proposal, and an already persisted binding. Do not let an adapter construct authority from caller input.

Request: `{ version: 1, proposal: <full PurchaseProposal>, binding: <ApprovedBinding> }` where the binding is loaded/returned by the gateway and contains immutable authenticated owner and intent identity/version, canonical proposal fingerprint, approval identity, provider/platform, exact seller/item, amount and scale, currency/asset, provider arguments, expiry, persisted provider reference where applicable, and execution ID.

Response: `{ version: 1, executionId, status: "succeeded" | "failed" | "unknown" | "pending" | "blocked", checkedResult?, providerReference?, reasonCode? }`. `succeeded` requires a checked provider result and actual receipt evidence matching the binding. Ambiguous dispatch/persistence remains `unknown`; never blind-retry it. This shape needs Person 1 agreement and must not be read as an implemented server contract.

## Buyer connector setup evidence and remaining gate

The seller guide's public setup material does not verify a buyer OAuth/custom MCP connector flow, its scopes, token issuer/audience, or protected-resource metadata requirements. A buyer can provide the provider's documented connector/auth instructions or confirm them in their own client; do not paste a login, token or PIN into chat. If a secret is needed, provide the exact environment-variable name `QATOM_MCP_TOKEN` and have the user enter it through the approved local secret mechanism. Presence alone is not authenticated tool-schema evidence.

Before enabling buyer execution, obtain authenticated sanitized tool inventory, checkout schema, proof the checkout operation binds the approved exact price and currency atomically, supported receipt semantics, and agreement on the persisted authority contract. Spend ceiling remains zero.
