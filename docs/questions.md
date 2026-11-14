# Open questions

These questions are recorded so local implementation can continue without treating unknowns as
approval or evidence. A question blocks only work that depends on its answer.

| ID | Question / owner | Current evidence | Status and dependent work |
|---|---|---|---|
| Q001 | Awais: where is the gateway authority implementation and what is its accepted contract? | Remote checked 2026-11-14 after `git fetch origin --prune`: only `origin/main` and `origin/om/QPE` were visible; GitHub listed only PR #1 (`om/QPE` → `main`). Unpublished local work cannot be inferred. | Open. QPE exports a proposed `GatewayAuthority` port; gateway-backed execution and Stage 3 integration depend on Awais's implementation. |
| Q002 | Qatom authentication: what buyer auth method and securely provisioned token/OAuth setup is available? | Unauthenticated read-only `initialize` returned HTTP 401 and a Bearer protected-resource challenge. No tools were returned. No credential was available or sought. | Open. Authenticated tool inventory is unverified. Provide auth through a secret manager/process environment only; never paste credentials into chat, files or logs. |
| Q003 | What is the numeric ceiling and separate authorization for any paid provider calls? | User said “keep it low,” without a numeric amount. No funded credits or free funds are assumed. | Open; default paid execution is disabled (zero). Checkout remains blocked regardless of test transport until a numeric ceiling and separate authorization are recorded. |
| Q004 | Can Qatom atomically bind the charged price/currency to the approved proposal? | No authenticated tool schema or checkout response schema was available. A quote read is not an atomic price limit. | Open P0. Live checkout blocked until provider capability is verified and an independent review approves the binding. |
| Q005 | Which demo item, seller/merchant and amount are confirmed? | No confirmed demo fixture or merchant was provided. | Open. Use synthetic local fixtures only until the team confirms the demo case. |
| Q006 | What are the exact event submission, demo and pitch requirements? | Existing planning notes say these details are unknown. | Open. Stage 5 scheduling and presentation remain unverified. |

No Awais or Nassar agreement to the current QPE proposal is implied by this list or by local tests.
