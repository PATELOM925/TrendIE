# Open questions

These questions let local work proceed without treating unknowns as approval or evidence. A
question blocks only work that depends on its answer.

| ID | Question / owner | Current evidence | Status and dependent work |
|---|---|---|---|
| Q001 | Awais, Om: align gateway and adapter contracts before `develop` integration. | Pinned Awais candidate `0b7d110` contains Fastify/Postgres gateway work and an HTTP Qatom bridge. Om PR #1/#2/#3 are merged to `develop` at `b576c12`. See [contract matrix](integration.md) and [review disposition](reviews/2026-11-14-integration.md). | HOLD. Reconcile money units/assets, trusted binding/expiry, error and outcome semantics, GOAT checkpoints/reconciliation, QPE continuation and auth. Local checks are not adversarial clearance. Awais owns durable storage, atomic claim, authorization and migration design. |
| Q002 | Qatom authentication: what buyer auth method and securely provisioned token/OAuth setup is available? | Unauthenticated read-only `initialize` returned HTTP 401 and a Bearer protected-resource challenge. No tools were returned. No credential was available or sought. | Open. Authenticated tool inventory is unverified. Provide auth through a secret manager/process environment only; never paste credentials into chat, files or logs. |
| Q003 | What is the numeric ceiling and separate authorization for any paid provider calls? | User said “keep it low,” without a numeric amount. No funded credits or free funds are assumed. | Open; default paid execution is disabled (zero). Checkout remains blocked regardless of test transport until a numeric ceiling and separate authorization are recorded. |
| Q004 | Can Qatom atomically bind the charged price/currency to the approved proposal? | No authenticated tool schema or checkout response schema was available. A quote read is not an atomic price limit. | Open P0. Live checkout blocked until provider capability is verified and an independent review approves the binding. |
| Q005 | Which demo item, seller/merchant and amount are confirmed? | No confirmed demo fixture or merchant was provided. | Open. Use synthetic local fixtures only until the team confirms the demo case. |
| Q006 | What are the exact event submission, demo and pitch requirements? | BuilderBase event page UI displayed on Nov 14: “Live, submissions close tomorrow at 10:00 EST” (implies Nov 15 10:00 EST). Organizer confirmation is still needed. Nov 15 5 PM EST is the event end, not the submission cutoff. | Open pending organizer confirmation and exact pitch/judging details. Stage 5 remains unverified; see [hackathon notes](hackathon.md). |
| Q007 | Om / GOAT AgentKit upstream: what compatible release or tested replacement resolves the nested Zod advisory? | Current registry metadata reports latest `@goatnetwork/agentkit@0.3.0` with `zod ^3.24.2`; the lock resolves nested Zod `3.25.76`. The current advisory's patched version is `4.6.6`, and no Zod 3 patch release or compatible AgentKit release was identified. | Open. Keep the finding visible in the full audit. Do not force Zod 4 into AgentKit's Zod 3 path. Before external use, assess and accept the high transitive risk or wait for an upstream patch / separately tested alternative. See [dependency audit](dependencies.md). |

No Awais or Nassar agreement to proposed contracts is implied by visible source or local fake tests.
The fake authority in `packages/integration.test.ts` exercises adapter boundaries with synthetic
data only. The [dependency audit](dependencies.md) records current advisory counts and unresolved
release risk.
