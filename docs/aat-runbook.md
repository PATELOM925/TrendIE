# AAT local runbook

**Scope:** Person 4 local agent and inspection scaffolding. It is advisory and proposal-only. There is no gateway, frontend, approval authority, checkout tool, or live model result in these checks.

## Local workflow

The package entry points are `@trendie/agent` and `@trendie/inspection`. The core accepts narrow `Discovery` and `Model` ports, validates generated output through `PurchaseProposalSchema`, overwrites identity, intent version, platform, and chain from the trusted task context, checks item/seller/amount against discovery, and returns advisory inspection evidence. The core has turn and tool-call limit fields for caller policy (1–4); elapsed time, result count and text size are bounded. Errors are intentionally generic. `source: scripted` means a fixture transport, not an LLM test.

`@trendie/agent/openai` is an optional server-only adapter using the official `@openai/agents` SDK 0.21.0. Importing the core does not inspect credentials or make network calls. Creating the adapter checks `OPENAI_API_KEY`; invoking it may make a paid API call and requires separate authorization and a numeric spend ceiling. No model call was made for this implementation. The SDK receives only a read-only listing function; there is no payment or approval tool.

Inspection scans bounded text for selected instruction patterns and reports source offsets and short excerpts. A missing finding proves nothing. Pattern matching is incomplete and results must not be treated as a decision or authority. HTML is never executed and URLs are never fetched.

## PDF inspection

`services/pdf-inspection/inspect_pdf.py` extracts local PDF text using pinned PyMuPDF. It limits source size to 5 MB, pages to 20, text to 100,000 characters and processing to 3 seconds. It rejects encrypted/malformed files. It does not execute scripts or fetch remote resources. Text extraction may expose hidden text but does not detect every visual, metadata, or document attack. The caller must provide an allowlisted local path; no network URL is accepted.

Install pinned dependencies in an isolated local Python environment with `python -m pip install -r services/pdf-inspection/requirements.txt`. Run `python -m unittest discover -s services/pdf-inspection`. `make_fixture.py` creates a deterministic synthetic local PDF with synthetic provenance and hidden instruction text.

## Integration handoff

**Awais (gateway):** consume validated proposal output as untrusted input; bind authenticated owner and original intent from server state; revalidate all exact fields and policy; inspection must only add advisory evidence. Do not accept agent identity fields or any approval assertion. No authorization signature is defined by this package.

**Nassar (evidence/status UI):** show listing provenance, proposal fields, inspection flags/offsets, and source (`scripted` vs `model`) separately. Mark findings advisory. Never imply a proposal is approved, purchased, settled, or fulfilled.

## Evidence and remaining gates

Local unit/PDF checks cover synthetic clean and malicious inputs, spoofed fields, deviations, malformed output, timeout and basic resource caps. They do not prove real LLM resistance, authenticated provider discovery, gateway enforcement, PDF sandbox isolation beyond process limits, or payment behavior. Root workspace manifests are owned by the integrator; add these packages and the PDF service to root commands/workspaces before root-level checks. Stage 1–3 remain pending until owner integration and evidence are reviewed.
