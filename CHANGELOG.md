# Changelog

## Unreleased

- Update the project record with published PR #10 QPE (`afc1258`, 26 Qatom tests and read-only
  capability collector), published PR #11 AAT (`08016e6`, 35 agent tests) and draft PR #12 GOAT
  (`bdcf505`, complete V1 client and 32 GOAT tests). All target `develop`; none is merged and the
  proposed contracts remain unagreed. Record that lost `executionId` recovery by owner-scoped
  approval reference still requires an unimplemented server endpoint. Pin combined local candidate
  checks at `6397e1710ab7559a908af621ad0bdd24cf55fccf` (Node 22.23.4, root typecheck/lint and 135
  tests across 25 files); package builds were still running. These checks do not prove PR-head or
  global integration. Keep paid execution at zero, provider/authentication/price/receipt gates open,
  and all stages open with no final adversarial review claim.

- Merge reviewed Om PRs #1–#3 and combined gateway PR #4 into develop. Final source 9ffdba5 is
  cleared for local/test integration only; main and production remain unchanged. Add the final
  team handoff, preserve remaining stage gates and track non-blocking audit follow-ups.

- Incorporate Awais HMAC integrity verification and audit/intent-list endpoints; retain expiry,
  consumed-platform and transactional outcome guards through the merge.
- Sanitize unexpected gateway errors, bound database-backed proposal fields, use prototype-safe
  API-key lookup, reject unused GOAT action metadata and remove the conflicting root pnpm workspace.
- Correct the prior Node runtime claim: the named Homebrew path was Node 25. Actual Node 22.23.4
  is available through fnm; validate the executable version before running checks.

- Make the GOAT HTTP authority bridge fail closed: claims deny without HTTP; checkpoint and outcome
  writes report the unsupported contract; reconciliation returns no record. Document required
  trusted stored-binding, durable write, and owner-scoped recovery endpoints as pending.

- Merge reviewed Om PRs #1–#3 into `develop` in dependency order; retain `main` as the production gate.
- Add guarded database test configuration and separate gateway checks. Harden exact policy identity,
  expiry boundaries, review revalidation, transactional intent/audit writes, CORS and distinct role keys.
  Combined validation and fresh adversarial review remain required.
- Add the `@trendie/goat` workspace package with guarded native Testnet3 transfer, durable signed
  and broadcast checkpoint hooks, post-checkpoint/pre-broadcast authorization revalidation, and
  read-only reconciliation of signed or broadcast hashes. Signed-only unknown and mismatched cases
  stay uncertain; no transaction is resubmitted.
- Add a public-export local AAT → Qatom integration fixture with synthetic discovery, proposal,
  test-only authority, atomic-claim behavior and fake receipt. It is not the Awais gateway and does
  not make provider calls.
- Extend root workspace coverage and document local stage implementation separately from owner and
  live evidence. Awais's gateway is present in the unpublished candidate; Nassar's frontend is pending. Authenticated
  Qatom schemas, atomic price limits and verified checkout remain open.
- Scope a `minimatch@11.0.8` override to the `typescript-estree` dependency path and remove the
  vulnerable nested 10.2.6 lock entry. The full audit no longer reports the seven moderate findings;
  two high AgentKit/Zod audit entries remain and are documented as an external-use release risk.
