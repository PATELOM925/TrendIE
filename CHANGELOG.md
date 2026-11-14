# Changelog

## Unreleased

- Make the GOAT HTTP authority bridge fail closed: claims deny without HTTP; checkpoint and outcome
  writes report the unsupported contract; reconciliation returns no record. Document required
  trusted stored-binding, durable write, and owner-scoped recovery endpoints as pending.

- Integrate the Om stack in topological order: QPE → AAT → GOAT. PR #1 is QPE → `main`, PR #2 is
  AAT → QPE, and the local GOAT head is planned for PR #3 → AAT. The owner controls retargeting and
  merges; these layers do not merge automatically.
- Add the `@trendie/goat` workspace package with guarded native Testnet3 transfer, durable signed
  and broadcast checkpoint hooks, post-checkpoint/pre-broadcast authorization revalidation, and
  read-only reconciliation of signed or broadcast hashes. Signed-only unknown and mismatched cases
  stay uncertain; no transaction is resubmitted.
- Add a public-export local AAT → Qatom integration fixture with synthetic discovery, proposal,
  test-only authority, atomic-claim behavior and fake receipt. It is not the Awais gateway and does
  not make provider calls.
- Extend root workspace coverage and document local stage implementation separately from owner and
  live evidence. Awais's gateway and Nassar's frontend are not implemented here. Authenticated
  Qatom schemas, atomic price limits and verified checkout remain open.
- Scope a `minimatch@11.0.8` override to the `typescript-estree` dependency path and remove the
  vulnerable nested 10.2.6 lock entry. The full audit no longer reports the seven moderate findings;
  two high AgentKit/Zod audit entries remain and are documented as an external-use release risk.
