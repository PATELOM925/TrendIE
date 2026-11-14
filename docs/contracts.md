# Shared contracts (proposed)

**Status:** Proposed; pending Awais and Nassar alignment. These are conceptual fields, not generated
schemas or existing APIs. Keep money as integer strings plus explicit asset scale; reject floats.

| Record | Proposed fields | Owner |
|---|---|---|
| Intent | `id`, trusted `owner_id`, seller/recipient constraints, item constraints, amount bound,
  asset/currency/chain, provider arguments, expiry, version | Awais |
| Proposal | `intent_id`, item and seller/recipient, amount and scale, asset/currency/chain, provider
  arguments, untrusted source references | Agent proposes; gateway validates |
| Inspection | source reference, extracted text metadata, findings, resource-limit outcome | Om; advisory |
| Decision | proposal hash and canonicalization version, decision, reason codes, timestamp | Awais |
| Approval reference | opaque ID, owner, intent/version, proposal hash/version, platform, exact item and
  amount/asset/chain, Qatom arguments, expiry, execution ID, one-use status | Awais |
| Execution | unique ID, approval ID, provider, submission state, timestamps, provider reference,
  actual charged item/amount, reconciliation evidence | Gateway and adapter owners |

## Invariants

1. Trusted identity comes from authenticated server context, not agent fields.
2. The approval reference is opaque and resolved server-side. An agent cannot assert an approved
   boolean or mint a valid hash.
3. Approval binds owner, intent ID/version, canonical proposal hash/version, platform, seller/item
   or recipient, exact integer amount and asset/currency/chain, Qatom input arguments, expiry and
   execution ID.
4. Reject malformed, mismatched, stale, expired, cross-owner or reused references before any
   network write.
5. Atomically claim/consume an approval and persist its execution record before dispatch. Unique
   execution identity blocks concurrent duplicate dispatch. Do not hold a database transaction over
   the external payment rail.
6. Distinguish definite no-dispatch errors from outcomes that may have charged. The latter become
   `unknown` and require reconciliation; never blindly retry or restore spent authority.
7. Qatom human approval continuation reuses the same provider approval and execution identity,
   revalidates it and its expiry, and cannot disguise a new purchase as a retry.
8. Actual provider receipt evidence is stored separately from the agent proposal. Settlement does
   not assert fulfillment or refund.

## Money encoding

Use base-10 integer strings and an explicit scale. Qatom USD-TDN uses scale 3. GOAT values use the
asset's declared decimal count and chain. Reject decimal values with excess precision and unknown
scales. Never use binary floating point for authorization comparisons.

## Open contract gate

Qatom may set the price at checkout and may not accept an expected maximum price atomically with
purchase. This is unresolved. Re-reading a quote immediately before checkout is not an atomic
bound. Do not enable live Qatom execution until a safe provider capability or separately reviewed
mitigation is verified.
