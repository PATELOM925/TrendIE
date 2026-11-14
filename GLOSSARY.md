# Glossary

- **Intent:** Trusted, owner-authored constraints for a purchase, stored outside agent context.
- **Proposal:** Agent-generated purchase details. A proposal has no authority to spend.
- **Decision:** Gateway result: approved, rejected, or review required. It does not prove payment.
- **Approval reference:** Opaque, one-use server-side authorization bound to one owner, intent,
  canonical proposal, provider, amount and execution.
- **Execution:** One durable attempt to dispatch a gateway-approved payment.
- **Settlement:** Provider-confirmed payment outcome. Settlement is separate from fulfillment.
- **Unknown:** Dispatch may have reached the provider, but the outcome is not yet confirmed.
- **Inspection finding:** Advisory evidence from untrusted listing or document content.
- **Qatom:** Provider interface documented for catalog search and agent checkout. Capabilities
  remain subject to authentication and price-binding verification.
- **GOAT:** GOAT Network integration target. A Noop or simulated result is not an on-chain payment.
- **Escrow:** Separate conditional settlement path. It is a later-stage proposal, not a property of
  direct GOAT or Qatom checkout.
