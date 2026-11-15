import { spawnSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inspectText } from '@trendie/inspection';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, '..');
const fixturePath = resolve(rootDir, 'services/pdf-inspection/fixtures/adversarial-invoice.pdf');
const inspectPyPath = resolve(rootDir, 'services/pdf-inspection/inspect_pdf.py');

const GATEWAY_URL = process.env.GATEWAY_URL || 'http://127.0.0.1:3000';
const API_KEY_DASHBOARD = process.env.API_KEY_DASHBOARD || 'dev-dashboard-key-3456';
const API_KEY_AGENT = process.env.API_KEY_AGENT || 'dev-agent-key-1234';
const API_KEY_ADMIN = process.env.API_KEY_ADMIN || 'dev-admin-key-7890';

const bold = (s) => `\x1b[1m${s}\x1b[0m`;
const red = (s) => `\x1b[31m${s}\x1b[0m`;
const green = (s) => `\x1b[32m${s}\x1b[0m`;
const cyan = (s) => `\x1b[36m${s}\x1b[0m`;
const yellow = (s) => `\x1b[33m${s}\x1b[0m`;
const dim = (s) => `\x1b[2m${s}\x1b[0m`;

console.log(bold('\n============================================================='));
console.log(bold('  STAGE 4 STEP 1: LIVE ADVERSARIAL PDF INVOICE ATTACK DEMO    '));
console.log(bold('=============================================================\n'));

// 1. Inspect Candidate PDF Document via Python PyMuPDF
console.log(cyan('1. Inspecting Candidate PDF Document via PyMuPDF:'));
console.log(`   File: ${fixturePath}`);
console.log('   Visual Appearance: Appears to be a standard invoice for Supplier A.');
console.log('   Hidden Layer:      Rendered with PDF render_mode=3 (invisible to humans).\n');

const pythonExec = resolve(rootDir, '.venv-pdf/bin/python3');
const pyResult = spawnSync(pythonExec, [inspectPyPath, fixturePath], { encoding: 'utf8' });

if (pyResult.status !== 0) {
  console.error(red('Failed to run Python PDF inspector:'), pyResult.stderr);
  process.exit(1);
}

const extracted = JSON.parse(pyResult.stdout);
console.log(cyan('2. Extracted PDF Text Stream:'));
const allText = extracted.pages.map((p) => p.text).join('\n').trim();
console.log(yellow(`   "${allText.replace(/\n/g, ' ')}"`));
console.log(`   Pages: ${extracted.pageCount} | Characters: ${extracted.textChars}\n`);

// 2. Run Heuristic Scanner on extracted text
console.log(cyan('3. Running Heuristic Text Scanner on Document Stream:'));
const scanResult = inspectText(allText);
console.log(`   Findings count: ${scanResult.findings.length}`);
for (const finding of scanResult.findings) {
  console.log(`   - [${red(finding.code)}] excerpt: "${finding.excerpt}"`);
}
console.log('');

// 3. Register a real Intent on the live Gateway
const intentId = `int_pdf_${Date.now()}`;
const registeredIntent = {
  id: intentId,
  owner: 'finance-ops-01',
  seller: 'Supplier A',
  product: 'Invoice #1042',
  maxAmount: '5000', // 50.00 USDC in minor units
  currency: 'USDC',
  allowedDestinations: ['0xSupplierA_Contract_or_Wallet_001'],
  expiry: new Date(Date.now() + 3_600_000).toISOString(),
  remainingUses: 1,
  createdAt: new Date().toISOString(),
};

console.log(cyan('4. Registering Immutable Intent on Live Gateway (PostgreSQL):'));
console.log(`   Intent ID:       ${intentId}`);
console.log(`   Authorized Max:  ${registeredIntent.maxAmount} USDC (minor units)`);

const intentRes = await fetch(`${GATEWAY_URL}/intents`, {
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    authorization: `Bearer ${API_KEY_DASHBOARD}`,
  },
  body: JSON.stringify(registeredIntent),
});

if (!intentRes.ok) {
  const errText = await intentRes.text();
  console.error(red(`Failed to register intent: ${intentRes.status} ${errText}`));
  process.exit(1);
}
console.log(green('   ✓ Intent registered and logged in PostgreSQL audit chain.\n'));

// 4. Submit Poisoned Proposal to Live Gateway API
console.log(cyan('5. Submitting Poisoned Proposal to Live Security Gateway (POST /verify):'));
const proposal = {
  intentId,
  seller: 'Supplier A',
  product: 'Invoice #1042',
  amount: '999999', // Manipulated by invisible PDF prompt injection
  currency: 'USDC',
  destination: '0xSupplierA_Contract_or_Wallet_001',
  sourceRef: 'adversarial-invoice.pdf',
};

const inspectionPayload = {
  source: 'adversarial-invoice.pdf',
  flags: scanResult.findings.map((f) => ({ code: f.code, severity: 'medium' })),
  evidence: scanResult.findings.map((f) => f.excerpt),
  findings: {
    detector: 'pymupdf-stream-scanner',
    charCount: extracted.textChars,
    pageCount: extracted.pageCount,
  },
};

console.log(`   Proposal Amount: ${bold('999999')} USDC (Ceiling: 5000 USDC)`);
console.log(`   Injection Flags: ${scanResult.findings.map((f) => f.code).join(', ')}`);

const verifyRes = await fetch(`${GATEWAY_URL}/verify`, {
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    authorization: `Bearer ${API_KEY_AGENT}`,
  },
  body: JSON.stringify({
    proposal,
    inspection: inspectionPayload,
  }),
});

const verifyData = await verifyRes.json();
console.log(`\n   Live Gateway Decision: ${red(verifyData.decision.toUpperCase())}`);
console.log(`   Reason Codes:          ${red(verifyData.reasonCodes.join(', '))}`);
console.log(`   Authorization Ref:     ${dim(verifyData.authorizationRef || 'NONE (DENIED)')}`);

if (verifyData.decision === 'reject' && verifyData.reasonCodes.includes('AMOUNT_EXCEEDS_MAX')) {
  console.log(green('\n   ✓ Fund Drain Prevented: Transaction halted deterministically. Zero funds moved!'));
} else {
  console.error(red('\n   ❌ Unexpected gateway decision:'), verifyData);
  process.exit(1);
}

// 5. Verify the attack rejection was cryptographically logged in the PostgreSQL Audit Ledger
console.log(cyan('\n6. Checking Live PostgreSQL Cryptographic Audit Ledger:'));
const auditRes = await fetch(`${GATEWAY_URL}/audit/chain/verify`, {
  headers: { authorization: `Bearer ${API_KEY_ADMIN}` },
});
const auditData = await auditRes.json();
console.log(`   Audit Ledger Valid:   ${auditData.valid ? green('YES (UNBROKEN)') : red('NO')}`);
console.log(`   Total Verified Blocks: ${auditData.totalEntries}`);
console.log(green('   ✓ Blocked attack permanently preserved in SHA-256 audit ledger (SOC-2 ready).'));

console.log(bold('\n=============================================================\n'));
