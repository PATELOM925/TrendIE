# Implementation plan

This plan maps the original five roles from [Division.md](../Division.md) to current ownership. It
records a proposed order, not completed work. Product priorities remain in [PRD.md](../PRD.md).

## Stage 1 — Foundation (current docs slice)

- **QPE / Om:** document Qatom capabilities, checkout constraints, exact-price open gate and
  adapter boundary.
- **Shared / Awais:** align intent, decision, approval and execution contracts; own policy and
  authorization.
- **Shared / Nassar:** align frontend-to-gateway contract and integration boundary.
- **AAT / Om:** prepare synthetic clean and malicious fixtures after contract alignment.
- **GOAT / Om:** opportunistic capability and environment review only.

**Acceptance:** owners and order are explicit; proposed contracts and threat cases are linked;
provider gaps are called out; no runtime behavior is claimed. This documentation stage is on
`om/QPE`.

## Stage 2 — Qatom adapter and guarded checkout

- **PR slice QPE / Om:** discovery/checkout adapter behind the gateway; no unrestricted agent
  checkout.
- **Awais:** provide server-owned intent, deterministic policy, opaque approval and durable
  execution authority.
- **Nassar:** frontend integration for intent, decision and status through the public gateway API.

**Acceptance:** integration uses real provider responses and records checked outcomes; approval is
one-use and transaction-bound; concurrent replay cannot dispatch twice; uncertain outcomes remain
unknown and reconcile before retry. The P0 Qatom exact-price capability gate must be resolved with
evidence before live execution is enabled.

## Stage 3 — Agent, attack comparison and integration

- **PR slice AAT / Om:** agent discovery/proposal tools, synthetic attack fixtures and local PDF
  inspection with limits.
- **PR slice GOAT / Om (opportunistic):** GOAT adapter behind the same gateway boundary.
- **Awais:** review policy and authority boundaries.
- **Nassar:** integrate screens and system flow through public interfaces.

**Acceptance:** controlled unprotected agent can reproduce the selected attack; protected flow
blocks unauthorized proposals while preserving legitimate proposals; inspection is advisory; any
payment outcome is supported by provider evidence. For a future GOAT dispatch, verify chain ID
48816 before submission. Do not infer payment from Noop or simulated results.

## Stage 4 — Security and failure verification

Exercise malformed/mismatched/stale/cross-owner/reused approvals, expiry, concurrent duplicates,
provider rejection, definite no-dispatch, timeout after possible dispatch, crash/reconciliation,
price changes, malicious provider/seller output, and resource-limited PDF inspection. Add runtime
tests through public interfaces as those interfaces are implemented. No such test suite exists now.

## Stage 5 — Demo readiness

Use only authorized test environments. Show intent, proposal, decision, provider receipt and
uncertain states truthfully. Document dependencies and licenses. Exact submission and pitch details
remain unverified; see [hackathon notes](hackathon.md).

## Stage 6 — Optional escrow

Escrow is explicitly later than the protected core. It requires separate contract design, review,
testnet verification and owner approval. Do not claim escrow is a GOAT direct-payment feature or
part of Qatom checkout. No escrow code is in this foundation.
