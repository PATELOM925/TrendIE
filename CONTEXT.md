# Current context

**Checked:** 2026-11-14. **Branch:** `om/QPE`. **Head at task start:**
`8b823ed229f3b09ef36cb36ddbbe48f800ec7d8d`.

## Verified repository state

The repository contains `PRD.md` and `Division.md` as project documents. It has no package
manifest, runtime application, or tests. QPE is the docs-first foundation branch. `om/AAT` and
`om/GOAT` are planning branches based on `origin/main`. No runtime feature is completed by this
documentation work.

## Owners and order

Awais owns backend, security and authorization (Person 1). Nassar (repository identity Nasar) owns
frontend and system integration (Person 5). Om primarily owns Qatom (Person 3) while Tirth is
unavailable, then agent and attack work (Person 4), with GOAT (Person 2) opportunistic through
Stage 3. Original role numbers and scopes remain in [Division.md](Division.md).

Operational order is Qatom-first, then agent/attack, with GOAT opportunistic. This does not remove
GOAT's P0 product scope. Escrow is Stage 6. One focused PR covers each slice. Implementation PRs
start from fresh `origin/main` after this documentation foundation lands.

## Next slices and unresolved gates

1. Align gateway, approval, execution and adapter contracts with Awais and Nassar.
2. Verify Qatom buyer authentication, checkout permissions and whether checkout can enforce an
   exact approved price or an equivalent safe bound. The documented interface lets the provider
   supply price; strict price-cap prevention is unresolved and blocks unsupported live checkout.
3. Build local synthetic attack and clean fixtures; inspection remains advisory.
4. Verify the GOAT network by checking `eth_chainId` before any future testnet dispatch. No chain
   activity has been performed here.
5. Establish runtime manifests, controls and checks with their implementation owners. No runtime
   check command exists today.

Exact submission cutoff, pitch time and rubric are unknown. The public event page, organizer email,
team messages and sponsor guide have different evidence boundaries; see [hackathon notes](docs/hackathon.md).
