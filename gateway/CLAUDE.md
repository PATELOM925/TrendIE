# CLAUDE.md

@AGENTS.md

## Claude-specific notes

- Read `AGENTS.md`, then `../PRD.md` and `../Division.md`, before making changes.
- Work in TDD order for policy code: write the failing reason-code test first, then implement.
- Before editing contracts (Intent, PurchaseProposal, VerificationDecision), check `docs/CONTRACTS.md` and update it in the same change.
- Run `pnpm typecheck && pnpm test` before declaring any task done; report failures verbatim.
- Never add an LLM call to the approve/reject path. Never log secrets, tokens, or raw approval signatures.
- Never run destructive DB commands against a shared database; use a local/test DB.
- Ask before adding dependencies or integrating Backboard.io (its role is undefined) or GOAT/Qatom SDKs here — those live in other people's repos.
- Prefer the smallest change that satisfies the task; do not scaffold features owned by Persons 2–5.
