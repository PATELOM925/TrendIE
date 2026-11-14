# ADR 0001: Guarded payment execution

- **Status:** Proposed; pending Awais and Nassar alignment
- **Date:** 2026-11-14

## Context

An agent proposal and a valid payment request do not prove that the purchase matches the owner's
original authorization. Provider dispatch may succeed even when the caller times out. A provider
may also choose price at checkout, which creates a race between quote and purchase.

## Decision

Put all payment dispatch behind a server-side gateway. Keep owner identity and intent outside agent
context. Bind an opaque one-use approval reference to a canonical, versioned proposal and exact
provider execution parameters. Atomically claim authority and persist a unique execution record
before external dispatch. Preserve uncertain outcomes as `unknown` until reconciled. Keep decision,
settlement and fulfillment separate.

Do not enable live Qatom checkout when the provider cannot enforce the authorized price bound and
no mitigation has been verified. A second quote read is not sufficient proof. Treat inspection as
advisory evidence and the agent as a proposer only.

## Consequences

The gateway and adapter contracts need explicit owner alignment. Recovery must reconcile uncertain
provider outcomes rather than retry blindly. Provider receipts must report actual charged item and
amount where available. This design does not promise distributed exactly-once execution or
automatic refunds. Escrow remains a separate Stage 6 design.

## Revisit when

Awais and Nassar align on contracts; Qatom confirms price-binding and retry semantics; or evidence
shows a safer provider capability or mitigation.
