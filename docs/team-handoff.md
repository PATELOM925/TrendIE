# Reviewed develop handoff

Code integration is complete for Om PRs #1–#3 and gateway PR #4. The code merge is
`56926a28833067cb1d20c2ce174bcfad44de0232`, containing reviewed source `9ffdba5` and Awais
source through `11a66a1`. Opus cleared local/test integration only; live and production remain on
HOLD. Main is unchanged. New teammate commits continue through their own PRs.

## Start work

Use current origin/develop as the base, preserving your existing work:

```sh
git fetch origin
git switch -c your-name/feature origin/develop
```

Activate a real Node 22 runtime and verify `node --version`. On the checked Mac:

```sh
fnm exec --using 22.23.4 node --version
```

Use npm at the repository root and pnpm inside gateway/. Read [testing setup](testing-setup.md)
for install and safe unit-check commands. The apparent Homebrew node@22 path on Om's Mac points
to Node 25, so the executable version matters. The reviewed code passed 69 root tests, 73 gateway
offline tests and both packages' typecheck/lint/build on Node 22.23.4. Four Python PDF tests passed
separately. There is no CI workflow or frontend preview yet.

Do not run the legacy database integration suite yet: its TRUNCATE fixtures conflict with the new
audit protection. Migration 002 is source only; a dedicated disposable database/reset harness and
an owner-approved migration plan are still needed. Never point tests at shared/production data.

## Next ownership

- Awais + Om: align complete proposal and approval bindings, money units, authenticated owner
  scope, durable GOAT checkpoints/recovery and Qatom continuation. The HTTP bridges currently
  deny claims rather than fabricate authority. Real PostgreSQL integration and concurrency tests
  remain open. Q011 tracks remaining non-blocking audit/rotation/route-test follow-ups.
- Nassar: deliver the frontend/system integration branch against develop. Preserve unknown and
  pending states in the UI; a decision or fake fixture is not a receipt. No UI preview is claimed.
- Om + sponsors: securely verify Qatom buyer authentication, tool schemas, atomic price protection
  and receipt semantics; configure an isolated GOAT test wallet and obtain an explicit numeric
  testnet authorization before sending anything. Confirm funded balances independently of welcome
  emails. Backboard's optional role and account setup remain unverified.
- Om: record a numeric paid-test ceiling and separate authorization before paid model/checkout
  calls. Current paid execution stays disabled. Confirm demo seller/item and submission cutoff.

Project Stages 1–3 remain open. Local AAT fixtures, proposal generation and PDF inspection are
implemented, but authenticated payments, authority integration and the actual attack/demo evidence
still require work. Both Om and Awais continue contributing after this merge. Escrow is Stage 6
stretch, not a prerequisite for current integration.

See [context](../CONTEXT.md), [questions](questions.md), [integration](integration.md),
[plan](plan.md), and [unsent sponsor questions](sponsor-questions.md).

## Copy-ready team message

Develop now includes my QPE, AAT and GOAT PRs plus Awais's published gateway work through 11a66a1
and the reviewed integration fixes. Main is unchanged. Please base new work on origin/develop and
use focused PRs back into develop.

The code is cleared for local/test integration, with 69 root tests and 73 gateway offline tests
passing on actual Node 22.23.4. Use npm at root and pnpm inside gateway/. Read CONTEXT.md,
docs/questions.md and docs/testing-setup.md before starting.

Awais and I still need to align the complete owner-scoped approval interface and durable adapter
recovery, and finish the disposable PostgreSQL test harness. Nassar can continue the frontend on
develop using the shared status semantics. The legacy HTTP payment bridges stay disabled until
the trusted interface is ready. Live payments and production are not cleared; Stages 1–3 remain
open. No paid provider/model execution tests, wallet transactions or migrations have been run.
