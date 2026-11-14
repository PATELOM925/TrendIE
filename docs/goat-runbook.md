# GOAT adapter runbook

**Status:** local implementation and offline fake tests only. No wallet was configured and no payment
was sent. Stage 2 standalone payment and Stage 3 gateway integration remain unverified. The adapter
does not implement GOAT Flow, ERC-20, escrow, or fulfillment verification.

## Implemented path

The package `@trendie/goat` accepts only a `platform: "goat"` proposal for native BTC on GOAT
Testnet3. The recipient must be `providerArgs.recipient`; the integer proposal amount is wei at
scale 18. The adapter compares owner, intent/version, fingerprint, destination, asset, chain, amount,
scale and expiry against the authority claim before transfer. A positive numeric wei ceiling is
mandatory when constructing the adapter; there is no default live execution ceiling.

The transfer call uses the official `@goatnetwork/agentkit` `transferNativeAction` and
`ViemWalletProvider`. AgentKit runtime retries are set to zero. A claimed authorization is recorded
before the chain write. A possible broadcast with no reliable result, or an outcome persistence
failure, returns `unknown`, retains a known transaction hash, and must be reconciled before any
retry. A checked transaction and successful receipt with the requested confirmations returns
`succeeded` as settlement evidence only.

## Authority contract for gateway owner (Awais)

Implement `GoatGatewayAuthority` in a server-only gateway module. `claimExecution` must resolve the
opaque approval reference from durable server state, bind authenticated `callerOwnerId`, current
intent/version, GOAT platform, proposal fingerprint/version, exact recipient, native BTC, Testnet3,
integer amount/scale and expiry, and atomically persist a unique execution claim before returning
`claimed`. `already_claimed` and `denied` must never permit transfer. The adapter checks the returned
binding independently before broadcast. `recordOutcome` persists the provider reference, status,
reason and evidence. If it fails after a possible write, the adapter reports unknown and never
restores or retries the claim.

The port types live in `packages/goat/src/index.ts`; they are local proposed interfaces and do not
imply gateway owner acceptance. Do not expose the signer, private key or wallet object to agent
tools. The private key is injected server-side through the process/secret manager only. Do not log
environment values or serialize the signer.

## Testnet setup and read-only evidence

Official AgentKit documentation identifies `@goatnetwork/agentkit`, its native transfer action,
`ViemWalletProvider`, Testnet3 chain ID `48816`, RPC `https://rpc.testnet3.goat.network`, and native
BTC with 18 decimals. The published package API was checked at `0.3.0` against its declarations.
See the [official quick start](https://docs.goat.network/docs/agents/agent-kit/quick-start).

An operator may capture read-only `eth_chainId` and `eth_blockNumber` evidence without a wallet.
This implementation does not claim that probe was run in this slice. Before any eventual
testnet transaction, verify chain ID 48816 immediately before the write. Supply a test-only wallet
through a secure server-side environment injection; never create a wallet automatically or request
funds through this adapter. A real transaction requires a separate explicit authorization with a
numeric testnet spend ceiling and a distinct user gate. No transaction was authorized here.

## Local checks

The tests use fake authority, signer and RPC objects. They cover caller, expiry and ceiling
rejection, wrong chain, transaction submission timeout, reverted receipts and outcome persistence
failure. They do not prove AgentKit network behavior, a live wallet, gateway durability, testnet
receipt handling, or a real transaction. Do not describe the GOAT stages as complete based on
these checks.
