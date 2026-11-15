# AAT UI fixture integration

This guide describes the current public `@trendie/agent` runner API for a server-side, synthetic fixture comparison. It is suitable for wiring a local UI to the runner; it does not establish gateway contract agreement or live-provider behavior.

## Runner boundary

The entry point exports `runControlledComparison`, `TrustedTask`, `Discovery`, `Model`, and `Limits` from `@trendie/agent`. Supply the trusted task and query from server-controlled state. Supply a discovery adapter that returns bounded listing data, a model port explicitly marked `modelMode: 'fixture'`, and a verifier adapter. The verifier shape here is the runner interface (`verify(proposal, evidence)`); it does not prescribe gateway routes, authorization semantics, or decision policy.

The runner validates task, listing, proposal, and evidence shapes and bounds; it freezes the proposal and evidence passed to the verifier. Evidence contains the same inspected listing set, source references, content hash, canonical proposal fingerprint, and model input/output used by that run. Keep that proposal/evidence pair together through display and verification. Listings and model output are untrusted.

Do not expose the runner as an arbitrary URL, model, or execution endpoint. Keep task identity, amount ceiling, scale, asset, platform, chain, adapter selection, and verifier configuration under server control. The runner has no checkout or settlement operation. Display decisions as fixture decisions and outcomes as `NOT_SETTLED`; a simulation action is not a payment.

## Typed fixture example

```ts
import { runControlledComparison } from '@trendie/agent';

const task = {
  ownerId: 'fixture-owner', intentId: 'fixture-intent', intentVersion: 1,
  platform: 'qatom', chain: 'fixture-chain', task: 'Find the synthetic tea set',
  maxAmount: '12500', maxScale: 3, asset: 'USD-TDN',
} as const;

const result = await runControlledComparison({
  task,
  query: 'synthetic tea set',
  discovery: {
    async search() {
      return [{ itemId: 'tea-set-1', sellerId: 'fixture-seller',
        title: 'Synthetic tea set', amount: '12500', scale: 3,
        asset: 'USD-TDN', description: 'Fixture listing only',
        sourceRef: 'fixture://catalog/tea-set-1' }];
    },
  },
  modelMode: 'fixture',
  model: {
    async propose() {
      return { itemId: 'tea-set-1', sellerId: 'fixture-seller',
        money: { amount: '12500', scale: 3 }, asset: 'USD-TDN',
        providerArgs: { recipient: 'fixture-recipient' } };
    },
  },
  gateway: {
    async verify(proposal, evidence) {
      // Replace only with an approved server-side fixture verifier.
      void proposal; void evidence;
      return { decision: 'review', reasons: ['synthetic fixture'] };
    },
  },
});

// Render result.proposal, result.evidence, and result.protected explicitly.
// The protected outcome is NOT_SETTLED; no provider dispatch occurs.
```

`amount` is an unsigned integer string in minor units; `scale` gives its decimal places. Thus `12500` at scale `3` represents 12.500 units. The current proposed Qatom-specific contract requires asset `USD-TDN` and scale `3`; that schema rule is not evidence of an authenticated Qatom provider schema. For GOAT native amounts, the separate current convention is wei at scale `18`. The example is synthetic and does not describe a real network payment.

For the repository's runnable fixture comparison, use the commands and output description in [the controlled offline comparison runbook](aat-runbook.md#controlled-offline-comparison). That CLI uses a local synthetic policy and does not call a live model or gateway.

## Status and coordination

On 2026-11-15 the parent reported that Nasar described a local comparison attack and compliant case, 121 tests, and seven route checks in WhatsApp. This checkout's fetched `origin/nasar-frontend` pin is `14f9ec2` and contains no corresponding comparison delta; the reported changes remain **UNVERIFIED** until a pushed SHA is supplied and inspected.

The parent also reported sending the verified group response at 14:52: PR #11's runner interface is approved for server-side fixture integration only. This is not merge approval, security clearance, or confirmation that Awais accepted the contract. Awais contract confirmation remains pending. The final `claude-opus-5-5` medium review is authorized once the specified work is ready; it has not been run.
