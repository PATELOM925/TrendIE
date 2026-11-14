# Open questions

These questions let local work proceed without treating unknowns as approval or evidence. A
question blocks only work that depends on its answer.

| ID | Question / owner | Current evidence | Status and dependent work |
|---|---|---|---|
| Q001 | Awais: where is the gateway authority implementation and what is its accepted contract? | The last recorded remote check saw `origin/main`, `origin/om/QPE` and PR #1. Om's published stack includes PR #2 AAT → QPE; GOAT → AAT is planned locally. No Awais-owned gateway branch was visible at the last check. Unpublished local work cannot be inferred. | Open. Align QPE's `GatewayAuthority` and GOAT's `GoatGatewayAuthority`; GOAT needs durable signed/broadcast checkpoints and owner-scoped reconciliation reads, while QPE defines continuation claims. Awais owns storage, atomic one-use claim, durability, authorization and migrations. |
| Q002 | Qatom authentication: what buyer auth method and securely provisioned token/OAuth setup is available? | Unauthenticated read-only `initialize` returned HTTP 401 and a Bearer protected-resource challenge. No tools were returned. No credential was available or sought. | Open. Authenticated tool inventory is unverified. Provide auth through a secret manager/process environment only; never paste credentials into chat, files or logs. |
| Q003 | What is the numeric ceiling and separate authorization for any paid provider calls? | User said “keep it low,” without a numeric amount. No funded credits or free funds are assumed. | Open; default paid execution is disabled (zero). Checkout remains blocked regardless of test transport until a numeric ceiling and separate authorization are recorded. |
| Q004 | Can Qatom atomically bind the charged price/currency to the approved proposal? | No authenticated tool schema or checkout response schema was available. A quote read is not an atomic price limit. | Open P0. Live checkout blocked until provider capability is verified and an independent review approves the binding. |
| Q005 | Which demo item, seller/merchant and amount are confirmed? | No confirmed demo fixture or merchant was provided. | Open. Use synthetic local fixtures only until the team confirms the demo case. |
| Q006 | What are the exact event submission, demo and pitch requirements? | Existing planning notes say these details are unknown. | Open. Stage 5 scheduling and presentation remain unverified; see [hackathon notes](hackathon.md). |
| Q007 | Om / GOAT AgentKit upstream: what compatible release or tested replacement resolves the nested Zod advisory? | Current registry metadata reports latest `@goatnetwork/agentkit@0.3.0` with `zod ^3.24.2`; the lock resolves nested Zod `3.25.76`. The current advisory's patched version is `4.6.6`, and no Zod 3 patch release or compatible AgentKit release was identified. | Open. Keep the finding visible in the full audit. Do not force Zod 4 into AgentKit's Zod 3 path. Before external use, assess and accept the high transitive risk or wait for an upstream patch / separately tested alternative. See [dependency audit](dependencies.md). |

No Awais or Nassar agreement to the current proposed contracts is implied by this list or by local
tests. The fake authority in `packages/integration.test.ts` exists only to exercise the adapter
boundary with synthetic data. The [dependency audit](dependencies.md) records current advisory
counts and unresolved release risk.
