import { spawnSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inspectText } from '@trendie/inspection';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, '..');
const fixturePath = resolve(rootDir, 'services/pdf-inspection/fixtures/adversarial-invoice.pdf');
const inspectPyPath = resolve(rootDir, 'services/pdf-inspection/inspect_pdf.py');

const bold = (s) => `\x1b[1m${s}\x1b[0m`;
const red = (s) => `\x1b[31m${s}\x1b[0m`;
const green = (s) => `\x1b[32m${s}\x1b[0m`;
const cyan = (s) => `\x1b[36m${s}\x1b[0m`;
const yellow = (s) => `\x1b[33m${s}\x1b[0m`;

console.log(bold('\n============================================================='));
console.log(bold('  LOCAL PDF EXTRACTION AND SCANNER FIXTURE                   '));
console.log(bold('=============================================================\n'));
console.log(yellow('Uses the checked-in PDF fixture and a local decision projection. It does not call the gateway or submit a payment.\n'));

console.log(cyan('1. Inspecting Candidate PDF Document:'));
console.log(`   File: ${fixturePath}`);
console.log('   Visual Appearance: Appears to be a standard invoice for Supplier A.');
console.log('   Hidden Layer:      Rendered with PDF render_mode=3 (invisible to humans).\n');

// 1. Run Python PyMuPDF extraction
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

// 3. Simulate Gateway Defense
console.log(cyan('4. Illustrative policy projection (not a gateway response):'));
const registeredIntent = {
  id: 'int_demo_01',
  seller: 'Supplier A',
  product: 'Product A',
  maxAmount: '5000',
  currency: 'USDC',
  allowedDestinations: ['0xSupplierA_Contract_or_Wallet_001'],
};
console.log(`   Registered Intent Max Amount: ${bold(registeredIntent.maxAmount)} USDC`);
console.log(`   Proposed Invoice Amount:     ${bold('999999')} USDC (manipulated by invisible PDF text)`);

const amountExceeded = BigInt('999999') > BigInt(registeredIntent.maxAmount);
const injectionDetected = scanResult.findings.length > 0;

const reasonCodes = [];
if (amountExceeded) reasonCodes.push('AMOUNT_EXCEEDS_MAX');
if (injectionDetected) reasonCodes.push('INJECTION_FLAGGED');

console.log(`\n   Illustrative Result: ${red('REJECT')}`);
console.log(`   Reason Codes:     ${red(reasonCodes.join(', '))}`);
console.log(green('\n   Fixture complete. This result does not establish a gateway decision or payment outcome.'));
console.log(bold('\n=============================================================\n'));
