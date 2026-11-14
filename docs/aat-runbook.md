# AAT local runbook

**Scope:** Person 4 local agent and inspection scaffolding. It is advisory and proposal-only. There is no gateway, frontend, approval authority, checkout tool, authenticated provider discovery, or verified live model result in these checks.

## Local workflow

The root npm workspace builds `@trendie/contracts`, `@trendie/inspection`, `@trendie/agent`, and `@trendie/qatom` in dependency order. The agent accepts narrow discovery and model ports. It validates the trusted task and all configured limits before provider calls, invokes discovery exactly once, bounds and validates the complete listing payload before inspecting fields, and forwards `maxTurns` and `maxToolCalls` to the model port. Listing findings include source spans and item/seller/source references. Proposals are bounded before schema parsing, reject unknown candidate fields, and receive trusted identity, version, platform, and chain only from the core.

`@trendie/agent/openai` is optional and server-only. Construct it with an explicit model name and an asynchronous `authorizeSpend` callback that returns a positive finite numeric ceiling for each invocation. The adapter fails closed when the callback denies authorization and does not run the SDK. Its structured output schema contains proposal fields only; the core supplies trusted fields. The adapter has a caller-controlled turn limit and enforces the listing tool call limit. It can make a paid model call after authorization. This implementation has made no model calls; local mocked SDK tests do not verify provider behavior or actual spend enforcement by the provider.

Inspection scans bounded text for selected instruction patterns and reports source offsets. A missing finding proves nothing. Findings are advisory and must not be treated as a decision or authority. HTML is never executed and URLs are never fetched.

## PDF inspection

Create an isolated Python environment and install the pinned dependencies:

```sh
python3 -m venv .venv-pdf
. .venv-pdf/bin/activate
python -m pip install -r services/pdf-inspection/requirements.txt
npm run test:pdf
```

`npm run test:pdf` fails when the Python environment or dependencies are missing; it does not skip PDF tests. The Node subprocess caps stdout at 1 MB and stderr at 16 KB, kills an oversized or timed out child with `SIGKILL`, hides stderr content from errors, and validates the complete JSON output shape. Python limits source size to 5 MB, pages to 20, extracted text to 100,000 characters, and checks a 3 second cooperative processing budget between pages. That Python limit cannot interrupt a page operation that hangs; the Node hard timeout bounds the whole process. The caller must supply an allowlisted local root; the root is trusted configuration, while the model cannot choose the path. The service rejects traversal and symlink escapes, encrypted/malformed PDFs, and does not execute scripts or fetch remote resources. Text extraction may include visually hidden text but does not detect every visual, metadata, or document attack.

## Integration handoff

**Awais (gateway):** consume validated proposal output as untrusted input; bind authenticated owner and original intent from server state; revalidate all exact fields and policy; inspection must only add advisory evidence. Do not accept agent identity fields or any approval assertion. No authorization signature is defined by this package.

**Nassar (evidence/status UI):** show listing provenance, proposal fields, inspection flags/offsets, source spans, and source (`scripted` vs `model`) separately. Mark findings advisory. Never imply a proposal is approved, purchased, settled, or fulfilled.

## Evidence and remaining gates

Local typecheck, lint, build, Vitest, and Python checks cover synthetic fixtures and mocked child processes only. They do not prove real LLM resistance, authenticated provider discovery, gateway enforcement, PDF sandbox isolation beyond the implemented process limits, numeric spend enforcement by a model provider, or payment behavior. Authentication (`401`), gateway availability, and a nonzero numeric budget remain open integration gates. No live model, provider, gateway, checkout, or payment stage is verified by this runbook. Stages remain pending until owner integration and fresh evidence are reviewed.
