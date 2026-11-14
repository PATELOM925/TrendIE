# QPE integration boundary

**Status:** local library contracts implemented, proposed for owner alignment. No gateway, frontend
or real Qatom checkout implementation exists here. Current evidence and blockers are in
[CONTEXT.md](../CONTEXT.md) and [questions](questions.md).

## QPE library imports

`@trendie/contracts` exports `PurchaseProposalSchema`, `MoneySchema`, `PaymentStatusSchema`,
`canonicalJson`, and `proposalFingerprint`. Money is an unsigned base-10 integer string with an
explicit scale; Qatom USD-TDN proposals use scale 3. The proposal fingerprint covers contract
version, trusted owner/intent identifiers and version, platform, seller, item, money, asset, chain,
and provider arguments.

`@trendie/qatom` exports `createQatomClient`, `createQatomExecutionAdapter`, and the public ports
`GatewayAuthority`, `BoundCheckoutCapability`, `QatomExecutionTransport`, and
`QatomReceiptVerifier`. The real client uses the official MCP TypeScript SDK and Streamable HTTP.
Its `listTools` and `catalogSearch` are the read paths. `catalogSearch` requires the listed tool to
carry `readOnlyHint: true`. `callTool` and `continueTool` refuse. The exported default checkout
capability is unsupported. The adapter's optional `PaidExecutionGate` defaults to
`disabledPaidExecution`; an integration must enforce a numeric ceiling and separate authorization
before enabling a paid call. There is no exported agent checkout action.

Example integration shape (not a working gateway implementation):

```ts
const adapter = createQatomExecutionAdapter({
  authority: gatewayAuthority,
  transport: qatomTransport,
  boundPrice: trustedProviderCapability,
  receiptVerifier: trustedReceiptVerifier,
  checkoutToolName: verifiedCheckoutToolName,
});

const result = await adapter.execute({
  caller: { ownerId: authenticatedSession.ownerId },
  approvalReference: opaqueApprovalReference,
  proposal: validatedProposal,
});
```

`authenticatedSession`, `opaqueApprovalReference`, `gatewayAuthority`, provider capability,
transport and receipt verifier in that example must come from trusted server integration. Do not
construct caller identity from agent JSON. The code above is illustrative; no API server can yet
run it against a real Qatom checkout.

## Awais authority dependency

Implement `GatewayAuthority` behind a server-only module. `claimExecution` must resolve the opaque
reference from durable server-owned state; compare authenticated owner, current intent/version,
proposal fingerprint/version, exact provider/item/seller/money/asset/chain/arguments and expiry;
atomically consume one-use authorization; and persist a unique execution claim before returning
`claimed`. `already_claimed` and `denied` never dispatch. Persist each outcome. After a possible
provider write, outcome-save failure must remain `unknown`; never mint/retry authority. Continuation
must revalidate the same execution, approval, current intent and expiry and atomically serialize
resume. Storage, transaction behavior, identity binding and migrations belong to Awais.

No implementation of this port or database schema is included in QPE.

## Provider capability and receipt dependency

`BoundCheckoutCapability.supportsAtomicPriceBound` must verify the actual tool's schema and a
provider guarantee that binds the exact approved maximum/amount and currency to the same checkout
operation. `prepareBoundCall` must construct arguments using only that verified schema. It must not
invent an `expected_price` field or rely on a preceding quote read. The real MCP transport has no
verified checkout schema and no such capability implementation; capability is unsupported by
default.

`PaidExecutionGate` is denied by default. A future implementation must compare the proposal's
integer amount and scale to a configured numeric ceiling and require the separately recorded
authorization. No ceiling is currently configured and no funded credits or free funds are assumed.

`QatomReceiptVerifier` must validate the actual MCP result shape using verified provider evidence,
retain only a minimal checked receipt ID, item and amount/scale, and compare them with the approved proposal.
Unrecognized responses, tool errors after a possible write, mismatches and uncertain outcomes stay
`unknown`. Verified settlement still does not assert fulfillment. No live Qatom response schema is
assumed by this library; local fake tests exercise the port with explicitly synthetic shapes.

## Nassar display dependency

The UI should render the shared `PaymentStatus` vocabulary literally. In particular, `unknown` must
not be shown as failed or zero, `pending_approval` means a provider human action is still required,
and `succeeded` is settlement evidence only, not fulfillment. Display actual receipt/item/amount
separately from proposal data and do not imply that a local fake result is a provider transaction.
Nassar owns the presentation and system integration implementation.

## Local evidence and stage boundary

The test suite uses local fake authority, transport, checkout capability and receipt verifier only;
it makes no network calls. The unauthenticated capability probe returned 401. Stage 1 live auth and
tool inventory are unverified, Stage 2 live discovery is unverified, and Stage 3 gateway-backed
execution is unimplemented. No funds, chain or production state was touched.
