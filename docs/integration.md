# QPE integration boundary

**Status:** local QPE/AAT/GOAT libraries and fake integration fixtures exist. Awais's pinned
`origin/awais/security-backend` source includes a gateway and HTTP bridge, but has not been
integrated or validated against these adapters here. Contracts remain proposed pending owner
alignment. No real Qatom checkout is verified. Current evidence and blockers are in
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

## Awais gateway source and contract matrix

The pinned Awais commit `5a9d3d4283e680ed8aa68de00fe8a677889af1be` adds a Fastify/Postgres gateway
with intent, policy, verify/consume, result, audit and review routes, plus tests and a Qatom HTTP
`GatewayAuthority` client. This is source evidence only: no test result, local endpoint run, combined
Postgres check, deployed behavior, or owner acceptance is asserted. Awais has merged AAT, not GOAT.

| Concern | QPE / GOAT proposal | Awais submitted bridge/source | Alignment needed |
|---|---|---|---|
| Amount and asset | Qatom proposals use integer amount + scale 3 and `USD-TDN`; GOAT uses explicit chain asset/units. | Bridge serializes amount and maps `USD-TDN` to `USDC`. | Verify provider denomination and gateway contract; never silently reinterpret currency or scale. |
| Binding | QPE expects a persisted trusted binding with owner, intent/version, fingerprint, provider/item/seller, money, asset, chain, args and expiry. | GOAT's temporary HTTP bridge denies every claim without HTTP; the former client-side binding fabrication is removed. | Pending: authenticated claim endpoint returns or allows retrieval of server-persisted, independently checked binding and authoritative expiry. |
| Consume outcomes | QPE has `claimed`, `already_claimed`, `denied`; uncertain dispatch remains unknown. | Bridge treats HTTP 403 as denied and all other non-200 responses as denied. | Agree status mapping, retry/timeout behavior, and unknown state if consume may have committed before response loss. |
| Result persistence | QPE requires durable result recording; failed persistence after possible provider write remains unknown. GOAT needs monotonic submission checkpoints and owner-scoped reconciliation reads. | GOAT bridge throws unsupported-contract errors for checkpoint and outcome writes, and returns no reconciliation record; these methods make no HTTP request and no local cache is treated as durable. | Pending: durable checked outcome-write endpoint, monotonic signed/broadcast checkpoint endpoint, and authenticated owner-scoped execution recovery read. Add QPE continuation contract. |
| Identity and API auth | Trusted caller identity must be server-derived; authorization is owner and intent scoped. | Client sends `X-API-Key`; proposal payload includes intent/seller/product/amount/currency/destination/sourceRef. | Document service identity, key role/scope, authenticated owner binding and prohibition on client-controlled authority fields. |

These are code-observed alignment concerns for the requested review, not a review verdict. Do not
label them confirmed defects until the adversarial review evaluates the full gateway and contract.

## Gateway authority requirements

Implement `GatewayAuthority` behind a server-only module. `claimExecution` must resolve the opaque
reference from durable server-owned state; compare authenticated owner, current intent/version,
proposal fingerprint/version, exact provider/item/seller/money/asset/chain/arguments and expiry;
atomically consume one-use authorization; and persist a unique execution claim before returning
`claimed`. `already_claimed` and `denied` never dispatch. Persist each outcome. After a possible
provider write, outcome-save failure must remain `unknown`; never mint/retry authority. Continuation
must revalidate the same execution, approval, current intent and expiry and atomically serialize
resume. Storage, transaction behavior, identity binding and migrations belong to Awais.

The gateway branch has an implementation proposal; QPE does not yet have an aligned, verified
implementation of this port or its database contract.

## GOAT authority port and recovery boundary

The current HTTP client is a temporary fail-closed compatibility bridge, not a gateway
implementation: claims are denied without network access, checkpoint/outcome writes throw an
unsupported-contract error, and reconciliation returns no record. GOAT gateway integration remains
unsupported until the trusted stored-binding claim, durable checkpoint/outcome writes, and
owner-scoped read-only recovery endpoints exist and are verified. No in-memory cache substitutes
for those server records.

`@trendie/goat` has a separate proposed `GoatGatewayAuthority` shape in
`packages/goat/src/types.ts`:

- `claimExecution` receives authenticated `callerOwnerId`, opaque approval reference, complete
  proposal and fingerprint, spend authorization, and current time. The adapter expects an atomic
  one-use claim and the returned binding to include owner/intent/version, fingerprint, sender,
  destination, asset, chain ID, amount/scale, expiry, spend authorization ID and maximum.
- `recordSubmissionCheckpoint` stores `signed` and `broadcast` phases with the same execution ID
  and transaction hash. Writes must be durable, idempotent and monotonic; they must never erase an
  earlier known hash. A signed hash is a local signed-transaction checkpoint and does not prove
  broadcast.
- `getExecutionForReconciliation` receives only authenticated owner ID and durable execution ID.
  It returns the stored proposal, complete binding, hash and phase. The adapter reads the chain for
  either `signed` or `broadcast` checkpoints. It never submits during reconciliation. Missing,
  mismatched or unconfirmed results remain `unknown`/`pending`; a matching transaction and receipt
  can resolve success or failure using the normal chain, sender, destination, amount and depth
  checks.
- `recordOutcome` persists the checked outcome/evidence. A write failure remains `unknown` and
  cannot clear or reissue the claim.

The QPE `GatewayAuthority` differs: it receives `TrustedCaller`, proposal and fingerprint in
`claimExecution`, exposes `recordOutcome(executionId, result)`, and has `claimContinuation` for a
provider human-action flow. It has no provider hash checkpoint or reconciliation-read method in its
current port. These ports are not interchangeable and neither has Awais's implementation or
acceptance. Awais owns the server storage schema, atomic claim transaction, concurrency control,
durability, owner authorization and migration strategy. In particular, GOAT needs an owner-scoped
execution read path and append/monotonic submission checkpoints; QPE continuation needs atomic
claiming of the same provider reference and execution identity. Align these exact differences before
combining the adapters behind one gateway API. No direct payment path bypasses gateway authority.

There is no database transaction spanning an external provider write. Awais must persist the
execution claim before adapter dispatch, retain a signed hash even if later broadcast persistence
fails, and recover uncertain dispatch through reads. GOAT's callback revalidates signal, owner-bound
binding, expiry, signer and chain after the signed checkpoint persists and before the wallet may
broadcast. Expiry at that point stops broadcast but leaves a known hash and conservatively returns
`unknown` for reconciliation.

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
Its trusted implementation must also establish seller/merchant, asset/currency and chain identity from
provider evidence or a documented provider guarantee before reporting settlement success. The local port
does not invent fields for those facts; its receipt projection is not proof of them.
Unrecognized responses, tool errors after a possible write, mismatches and uncertain outcomes stay
`unknown`. Verified settlement still does not assert fulfillment. No live Qatom response schema is
assumed by this library; local fake tests exercise the port with explicitly synthetic shapes.

For human-action continuation, the authority's claimed binding must include the same persisted provider
reference recorded with the pending execution. Continuation reconstructs and fingerprints the proposal
from that binding, then rechecks the numeric paid gate and atomic-price capability before provider contact.

## Nassar display dependency

The UI should render the shared `PaymentStatus` vocabulary literally. In particular, `unknown` must
not be shown as failed or zero, `pending_approval` means a provider human action is still required,
and `succeeded` is settlement evidence only, not fulfillment. Display actual receipt/item/amount
separately from proposal data and do not imply that a local fake result is a provider transaction.
Nassar owns the presentation and system integration implementation.

## Local evidence and stage boundary

The Om test suite uses local fake authority, transport, checkout capability, signer and receipt
verifier only; it makes no network calls. Public fixtures cover AAT → Qatom proposal flow and GOAT
signed-hash recovery. They are separate from Awais's gateway. The unauthenticated capability probe
returned 401. Stage 1 live auth and tool inventory are unverified, Stage 2 live discovery/payment is
unverified, and Stage 3 combined gateway-backed execution is unverified. GOAT's separate live
evidence is only a read-only RPC chain/block probe. No funds, transaction, or production state was
touched.
