# Changelog

## Unreleased

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
