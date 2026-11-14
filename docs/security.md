# Security model (proposed)

See the [contracts](contracts.md) and [architecture](../ARCHITECTURE.md). This is a target threat
model, not proof that controls exist.

## Assets and boundaries

Protect owner identity, original purchase intent, wallet credentials, one-use approval authority,
execution records and payment funds. The trust boundary is the gateway. Agent output, seller
content, PDFs, provider responses, user-submitted identifiers and network outcomes are untrusted.
Wallet credentials remain outside LLM context. Only the gateway can authorize and dispatch through
provider adapters.

## Required failure handling

| Case | Required result |
|---|---|
| Malformed, stale, mismatched or cross-owner proposal | Reject before provider write; retain reason evidence |
| Reused approval or concurrent duplicate | Atomically claim once; do not dispatch a second payment |
| Provider clearly rejects before dispatch | Record definite failure; do not report success |
| Timeout/crash after possible dispatch | Record `unknown`; reconcile provider state; no blind retry or automatic authority renewal |
| Seller changes item or price | Reject if mismatched. Qatom exact-price binding is unresolved P0; refuse unsupported live path |
| Human continuation after Qatom approval | Revalidate same intent, approval, execution and expiry; do not make a new purchase |
| Malicious listing/PDF instructions | Treat as untrusted content; inspection can provide evidence but cannot authorize |
| PDF resource exhaustion or external reference | Enforce local limits; do not fetch URLs or execute scripts |
| Provider claims fulfillment | Keep payment settlement and fulfillment as separate evidence |
| Missing amount/scale or excessive precision | Reject; unknown is not zero |

## Qatom price race (P0 open gate)

The documented Qatom checkout can receive item/arguments while price is provider-supplied. A quote
read followed by checkout does not prove the charged amount matches the authorized maximum. Until
an atomic provider bound or an independently verified mitigation exists, do not enable unsupported
live checkout. Record the actual charged amount and item from provider evidence when available.

## Demonstration boundary

The suggested paid purchase/report scenario is proposed, not team-approved. Use clean and malicious
synthetic listings or documents. Do not use real customer data or real funds without a separate
explicit numeric spending ceiling and authorization. Inspection does not promise universal prompt
injection detection. There is no guarantee of automatic refund, fulfillment, or distributed exactly-
once execution.
