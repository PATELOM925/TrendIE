# GOAT adapter runbook

**Status:** local implementation and offline fake tests only. No wallet was configured and no payment
was sent. Stage 2 standalone payment and Stage 3 gateway integration remain unverified. The adapter
does not implement GOAT Flow, ERC-20, escrow, or fulfillment verification.

## Implemented path

The package `@trendie/goat` accepts only a `platform: "goat"` proposal for native BTC on GOAT
Testnet3. The strict provider arguments contain only `recipient`; transaction data and extra fields
are rejected. The integer proposal amount is wei at scale 18. Each execution also requires a
caller-authorized spend record with an owner, authorization ID and positive maximum. The gateway
must validate that record and return the same authorization ID and maximum in its bound execution.
An adapter-wide numeric ceiling caps that owner-authorized maximum.

The transfer call uses the official `@goatnetwork/agentkit` `transferNativeAction` and
`ViemWalletProvider`. AgentKit runtime retries and viem HTTP retries are set to zero. The runtime has
a bounded timeout and redacts provider error text from logs and results. The typed wallet callbacks
persist the signed hash before broadcast and the accepted broadcast hash before receipt waiting. If
the later wallet confirmation fails, the adapter retains the known hash and reports `unknown` for
read-only reconciliation. Outcome or checkpoint persistence failure after signing also stays
`unknown`; a failed signed checkpoint prevents the broadcast attempt.

Confirmation checks require the returned transaction hash, receipt transaction hash, both block
numbers, exact sender/recipient/value, and transaction chain ID `48816` to match the durable
execution binding. A missing transaction and receipt is `unknown`; a visible unmined transaction is
`pending`. A malformed status, lookup failure, or failed block-height read cannot produce success.
The adapter rejects a missing transaction `chainId`; checking the RPC's current chain ID alone does
not establish the chain identity of an individual transaction.
Only a valid `success` receipt with the configured confirmation depth is settlement success.
A durable `signed` checkpoint alone is not evidence that the wallet broadcast the transaction. If
authorization expires while signing or between the signed checkpoint and wallet send, the callback
rechecks cancellation, binding/expiry, signer and chain after checkpoint persistence; a failed
check throws before the wallet provider is allowed to broadcast. Because a hash is already known,
the returned state is conservatively `unknown` and the hash remains available for reconciliation.

## Authority contract for gateway owner (Awais)

Implement `GoatGatewayAuthority` in a server-only gateway module. `claimExecution` must resolve the
opaque approval reference from durable server state, bind authenticated `callerOwnerId`, current
intent/version, GOAT platform, proposal fingerprint/version, signer address, exact recipient,
native BTC, Testnet3, integer amount/scale, expiry, and the owner-authorized spend ID/maximum; then
atomically persist a unique execution claim before returning
`claimed`. `already_claimed` and `denied` must never permit transfer. The adapter checks the returned
binding before dispatch and again after the signed checkpoint, immediately before broadcast.
`recordSubmissionCheckpoint` durably stores the signed and broadcast hashes. Checkpoint persistence
must be idempotent for one execution, monotonic from `signed` to `broadcast`, and must not clear an
earlier hash. `getExecutionForReconciliation` must look up the caller-owned durable
execution by authenticated owner ID and execution ID, returning its full original proposal, complete
binding and stored hash/phase. Permit read-only lookup for both signed and broadcast phases. A signed
hash not found remains `unknown`; a found matching transaction and receipt can be checked under all
existing identity and confirmation rules. Reconciliation never calls transfer. The client supplies
no transaction hash, recipient, amount or chain expectations to reconciliation. `recordOutcome`
persists the provider reference, status, reason and
evidence. If an outcome write fails, the adapter reports unknown and never restores or retries the
claim.

The port types live in `packages/goat/src/index.ts`; they are local proposed interfaces and do not
imply gateway owner acceptance. Do not expose the signer, private key or wallet object to agent
tools. The private key is injected server-side through the process/secret manager only. Do not log
environment values or serialize the signer.

## Testnet setup and read-only evidence

Official AgentKit documentation identifies `@goatnetwork/agentkit`, its native transfer action,
`ViemWalletProvider`, Testnet3 chain ID `48816`, RPC `https://rpc.testnet3.goat.network`, and native
BTC with 18 decimals. The published package API was checked at `0.3.0` against its declarations.
See the [official quick start](https://docs.goat.network/docs/agents/agent-kit/quick-start).

Read-only `eth_chainId` and `eth_blockNumber` calls to the public Testnet3 RPC returned chain ID
`48816` and block `18260370` on 2026-11-14. No wallet or transaction was used for this probe. This
is endpoint evidence at that time, not payment evidence. Before any eventual testnet transaction,
verify chain ID 48816 immediately before the write. Supply a test-only wallet
through a secure server-side environment injection; never create a wallet automatically or request
funds through this adapter. No owner-authorized numeric ceiling is configured in this checkout, so
the execution input remains unavailable until one is authorized and durably validated by the
gateway. A real transaction also requires a distinct user gate. No transaction was authorized here.

## Local checks

Reconciliation accepts only authenticated caller owner and durable execution ID. The adapter asks
the gateway for trusted stored binding and hash, performs reads, and persists checked outcomes. The
gateway lookup must enforce authorization; do not pass client-assembled expected fields.

The tests use local fake authority, signer and RPC objects. They exercise the AgentKit wallet action's
real `WalletCallOptions` checkpoint callbacks, including throw-after-signed-hash and persistence
failure. They do not prove AgentKit network behavior, a live wallet, gateway durability, testnet
receipt handling, or a real transaction. Do not describe the GOAT stages as complete based on
these checks.
