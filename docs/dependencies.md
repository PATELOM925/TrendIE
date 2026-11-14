# Dependency audit and release risk

**Checked:** 2026-11-14 against the root `package-lock.json` with a full development dependency
audit (`npm audit --json`; no `--omit` filter). The initial lock reported 9 advisories: 7 moderate
and 2 high. A narrow npm override now resolves only the `minimatch` child of
`@typescript-eslint/typescript-estree` to `11.0.8`. After clean lock regeneration, the moderate
advisories disappeared; the current full audit reports 2 high advisories and no moderate ones.
Record the live `npm audit` result on the final candidate before external use because registry and
lock state can change.

## Resolved development-tool findings

The moderate advisories shared the `typescript-eslint@8.72.2` →
`@typescript-eslint/typescript-estree@8.72.2` → `minimatch@10.2.6` dependency path. The root ESLint
dependency already resolves `minimatch@11.0.8`, which is outside the affected range in
[GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249). The root override in
`package.json` applies `minimatch@11.0.8` only beneath `@typescript-eslint/typescript-estree`; it
does not change unrelated minimatch consumers. The resulting lock reuses the root 11.0.8 package.
This uses npm's documented [nested override syntax](https://docs.npmjs.com/cli/v10/configuring-npm/package-json/#overrides).
Clean install, typecheck, lint, test and build gates are required evidence for this scoped override.

## Unresolved GOAT transitive high finding

The two high entries npm reports are the GOAT AgentKit package and its nested Zod package; they
lead to one advisory chain, not two separate GHSA reports. The underlying high advisory is
[GHSA-mrhx-c7xc-m3w5](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5), which reports Zod
versions below `4.6.6` as affected. The lock contains `@goatnetwork/agentkit@0.3.0` and its nested
`zod@3.25.76`. [AgentKit 0.3.0 registry metadata](https://www.npmjs.com/package/@goatnetwork/agentkit/v/0.3.0?activeTab=dependencies)
reports it as the latest release and declares `zod ^3.24.2`; [the latest Zod 3 release](https://www.npmjs.com/package/zod/v/3.25.76)
is still below the advisory's patched `4.6.6` threshold. No compatible AgentKit release or Zod 3
patch path was identified. Do not force Zod 4 into AgentKit's Zod 3 dependency tree. That could
break its runtime/schema integration and would not be a verified remediation.

In this repository, [GOAT execution](../packages/goat/src/execution.ts) imports the upstream
`transferNativeAction` and `ViemWalletProvider`. The adapter validates the GOAT proposal, recipient,
integer amount, owner authorization and numeric ceiling before it invokes the transfer action; the
action receives the bounded recipient and amount scalars. Other AgentKit plugins are not exposed by
our GOAT public package API. These code facts do not prove the vulnerable Zod path is unreachable in
all upstream code paths or eliminate the advisory. Do not label the high finding cleared on this
basis.

Any release or deployment that exposes the AgentKit dependency to external use must assess and
accept this unresolved high transitive risk before release, or wait for a compatible upstream patch
or a separately tested alternative. `npm audit` remains unfiltered; do not hide the issue with
`--omit` or claim full remediation. Q007 tracks the follow-up.

## Current reproducible checks

From the repository root, use Node 22 and npm:

```sh
npm ci --ignore-scripts
npm audit --json
npm run typecheck
npm run lint
npm test
npm run build
. .venv-pdf/bin/activate
npm run test:pdf
```

The PDF check uses the existing isolated `.venv-pdf`; do not skip it or install Python packages
globally. Tests and build checks do not establish provider behavior, gateway controls or production
readiness.
