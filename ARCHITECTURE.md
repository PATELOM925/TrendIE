# Architecture and implementation boundary

This document separates implemented local QPE/AAT/GOAT libraries from the target system. Current
verified status is in [CONTEXT.md](CONTEXT.md). The gateway remains Awais-owned and is not
implemented here; adapter ports and the shared contract shapes remain proposals, not production
authority.

## Target layout

The local paths shown below exist unless marked `apps/*`; their contents are libraries and fixtures.
The gateway and frontend paths are proposed targets and do not exist in this repository.

```text
apps/web/                 Proposed frontend (Nassar; not implemented)
apps/api/                 Proposed gateway, security and authorization (Awais; not implemented)
packages/contracts/       Shared schemas and types
packages/qatom/           Qatom adapter (Om)
packages/agent/           Discovery and proposal agent (Om)
packages/inspection/      Inspection interfaces and fixtures (Om)
packages/goat/            GOAT adapter (Om, opportunistic)
services/pdf-inspection/  Python and PyMuPDF local document inspection (Om)
```

The root npm workspace covers `contracts`, `inspection`, `agent`, `qatom`, and `goat`. The
`packages/integration.test.ts` fixture imports public package exports and composes agent proposal
generation with the Qatom adapter. Its fake gateway authority is deliberately test-only and does
not establish owner acceptance or live controls.

The frontend talks to the gateway. The gateway owns trusted user identity, original intent,
policy decisions, approval references, execution records and adapter dispatch. Adapters accept
only gateway-controlled execution parameters. The agent receives narrow discovery and proposal
tools. It never receives wallet secrets, approval authority or unrestricted checkout. Inspection
can add evidence or request review; it cannot authorize or veto by itself.

## Trust and payment flow

The original intent is registered by an authenticated trusted owner and stored outside LLM context.
The gateway binds the authenticated owner to each request on the server. It canonicalizes a
proposal with a versioned algorithm and compares the exact seller or recipient, item, integer
amount, asset/currency/chain, provider arguments and expiry against that intent.

An approval is an opaque, one-use server-side reference authenticated through the gateway. It is
not an `approved` boolean or hash supplied by the agent. Before dispatch, the gateway atomically
claims or consumes the authorization and persists a durable execution record with a unique
execution ID. The record is committed before the external provider call. No database transaction
is assumed to span the provider rail.

A decision (`approved`, `rejected`, or `review_required`) is distinct from payment status. Payment
status uses the proposed vocabulary in [contracts](docs/contracts.md): `pending_approval` means a
provider needs a human action and no settlement is claimed; `submitting` means a durable execution
claim exists before the request; `pending` means the provider accepted the request but the outcome
is not final; `succeeded` means settlement is verified from checked provider evidence; `failed`
requires conclusive terminal evidence, since an error string alone is insufficient; and `unknown`
means dispatch or charge may have occurred without a confirmed result. A crash while `submitting`
must be reconciled before any redispatch. Reconciliation can move `unknown` to `succeeded` or
`failed` only with evidence. Provider human-action continuation reuses the same execution identity.
Never blindly retry or automatically restore authorization after uncertain dispatch. Concurrent
duplicates must not produce a second dispatch. Distributed exactly-once settlement is not promised.

Provider checkout may not bind execution atomically to a previously checked quote. In particular,
Qatom's documented checkout receives item/arguments and provides the price; strict price-cap
prevention remains an unresolved P0 capability gate. A second quote read does not close the
price-change race. Refuse unsupported live paths until a verified mitigation exists. See
[contracts](docs/contracts.md) and [security](docs/security.md).

## Money and evidence

Represent amounts as validated integer strings plus asset scale. Qatom USD-TDN has three decimal
places (milliunits, not cents). GOAT token amounts use token decimals and the selected chain. Reject
floats, invalid precision and unknown scale; do not coerce unknown to zero.

Record actual charged amount and item from provider evidence. Treat seller text and provider
responses as untrusted inputs. Verified settlement success does not prove that a service or item was
fulfilled. Settlement and fulfillment remain separate states. No automatic refund is promised.

PDF inspection uses local synthetic documents with resource limits. Do not fetch URLs or execute
document scripts. Findings are evidence, not a guarantee that every injection is detected.

## Dependencies and ownership

Dependencies point inward: UI → gateway public API → domain policy/contracts → provider adapters.
The agent cannot bypass the gateway. Each policy rule has one owning module. Shared schemas belong
in the contracts package after agreement. External providers sit behind adapters. The frontend
must display provider outcomes and uncertainty without converting them into stronger claims.
