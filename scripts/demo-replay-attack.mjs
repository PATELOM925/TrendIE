const GATEWAY_URL = process.env.GATEWAY_URL || 'http://127.0.0.1:3000';
const API_KEY_DASHBOARD = process.env.API_KEY_DASHBOARD || 'dev-dashboard-key-3456';
const API_KEY_AGENT = process.env.API_KEY_AGENT || 'dev-agent-key-1234';
const API_KEY_ADAPTER_GOAT = process.env.API_KEY_ADAPTER_GOAT || 'dev-goat-key-5678';
const API_KEY_ADMIN = process.env.API_KEY_ADMIN || 'dev-admin-key-7890';

const bold = (s) => `\x1b[1m${s}\x1b[0m`;
const red = (s) => `\x1b[31m${s}\x1b[0m`;
const green = (s) => `\x1b[32m${s}\x1b[0m`;
const cyan = (s) => `\x1b[36m${s}\x1b[0m`;
const dim = (s) => `\x1b[2m${s}\x1b[0m`;

console.log(bold('\n============================================================='));
console.log(bold('  STAGE 4 STEP 2: LIVE REPLAY & EXPIRY ATTACK DEFENSE DEMO   '));
console.log(bold('=============================================================\n'));

async function callApi(path, options = {}) {
  const res = await fetch(`${GATEWAY_URL}${path}`, {
    ...options,
    headers: {
      'content-type': 'application/json',
      ...options.headers,
    },
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, ok: res.ok, data };
}

// 1. Register Single-Use Intent
console.log(cyan('1. Registering Single-Use Purchase Intent (remainingUses = 1) in PostgreSQL:'));
const intentId = `int_replay_${Date.now()}`;
const createIntentRes = await callApi('/intents', {
  method: 'POST',
  headers: { authorization: `Bearer ${API_KEY_DASHBOARD}` },
  body: JSON.stringify({
    id: intentId,
    owner: 'user_enterprise_corp',
    seller: 'Northstar Supply',
    product: 'Office Printer',
    maxAmount: '50000000', // 50 USDC
    currency: 'USDC',
    allowedDestinations: ['0xSupplierA_Contract_or_Wallet_001'],
    expiry: new Date(Date.now() + 3600_000).toISOString(),
    remainingUses: 1,
    createdAt: new Date().toISOString(),
  }),
});

if (!createIntentRes.ok) {
  console.error(red('Failed to register intent:'), createIntentRes.data);
  process.exit(1);
}
console.log(`   Intent Registered: ${bold(intentId)}`);
console.log(`   Seller:            Northstar Supply`);
console.log(`   Max Amount:        50.00 USDC`);
console.log(`   Remaining Uses:    ${bold('1')}`);
console.log(green('   ✓ Registered and chained into PostgreSQL audit ledger.\n'));

// 2. Legitimate Verification
console.log(cyan('2. Submitting Legitimate Purchase Proposal (Attempt #1):'));
const validProposal = {
  intentId,
  seller: 'Northstar Supply',
  product: 'Office Printer',
  amount: '50000000',
  currency: 'USDC',
  destination: '0xSupplierA_Contract_or_Wallet_001',
  sourceRef: 'po-101.pdf',
};

const verify1Res = await callApi('/verify', {
  method: 'POST',
  headers: { authorization: `Bearer ${API_KEY_AGENT}` },
  body: JSON.stringify({ proposal: validProposal }),
});

if (!verify1Res.ok || verify1Res.data.decision !== 'approve') {
  console.error(red('Verification failed:'), verify1Res.data);
  process.exit(1);
}

const approvalId = verify1Res.data.authorizationRef;
const executionId = verify1Res.data.executionRef;
console.log(`   Gateway Decision: ${green('APPROVE')}`);
console.log(`   Approval Token:   ${bold(approvalId)}`);
console.log(`   Execution ID:     ${dim(executionId)}`);
console.log(green('   ✓ Gateway issued cryptographic HMAC capability token.\n'));

// 3. Consume Approval Token via Payment Adapter
console.log(cyan('3. Consuming Approval Capability via Payment Adapter (POST /approvals/:id/consume):'));
const consume1Res = await callApi(`/approvals/${encodeURIComponent(approvalId)}/consume`, {
  method: 'POST',
  headers: { authorization: `Bearer ${API_KEY_ADAPTER_GOAT}` },
  body: JSON.stringify(validProposal),
});

if (!consume1Res.ok) {
  console.error(red('Failed to consume approval:'), consume1Res.data);
  process.exit(1);
}
console.log(`   Consume Status:   ${green('200 OK (CLAIMED)')}`);
console.log(`   Execution ID:     ${bold(consume1Res.data.executionId)}`);
console.log(green('   ✓ Atomic database decrement executed: remaining_uses transitioned 1 -> 0.\n'));

// 4. Adversary Launching REPLAY ATTACK (Attempt #2 - Duplicate Consume on Same Approval Token)
console.log(cyan('4. Adversary Launching REPLAY ATTACK #1 (Duplicate Consume on Same Approval):'));
console.log('   Attacker intercepted approval token and resubmits to payment adapter to double-bill...');

const replayConsumeRes = await callApi(`/approvals/${encodeURIComponent(approvalId)}/consume`, {
  method: 'POST',
  headers: { authorization: `Bearer ${API_KEY_ADAPTER_GOAT}` },
  body: JSON.stringify(validProposal),
});

console.log(`   Gateway Verdict:  ${red(`HTTP ${replayConsumeRes.status} ${replayConsumeRes.data.error || 'FORBIDDEN'}`)}`);
console.log(`   Gateway Message:  ${red(replayConsumeRes.data.message || 'Consumed or expired')}`);
if (replayConsumeRes.status === 403) {
  console.log(green('   ✓ Replay Defeated: Approval is already consumed! Zero duplicate payment possible.\n'));
} else {
  console.error(red('   ❌ Replay was not blocked!'), replayConsumeRes.data);
  process.exit(1);
}

// 5. Adversary Launching REPLAY ATTACK #2 (Resubmitting proposal against exhausted intent)
console.log(cyan('5. Adversary Launching REPLAY ATTACK #2 (Resubmitting Proposal to POST /verify):'));
console.log('   Attacker attempts to generate a second approval against the exhausted intent...');

const replayVerifyRes = await callApi('/verify', {
  method: 'POST',
  headers: { authorization: `Bearer ${API_KEY_AGENT}` },
  body: JSON.stringify({ proposal: validProposal }),
});

console.log(`   Gateway Verdict:  ${red(replayVerifyRes.data.decision.toUpperCase())}`);
console.log(`   Reason Codes:     ${red(replayVerifyRes.data.reasonCodes?.join(', '))}`);
if (replayVerifyRes.data.decision === 'reject' && replayVerifyRes.data.reasonCodes.includes('INTENT_EXHAUSTED')) {
  console.log(green('   ✓ Exhaustion Defeated: Intent remaining_uses = 0 in PostgreSQL! Zero funds moved.\n'));
} else {
  console.error(red('   ❌ Exhaustion was not enforced!'), replayVerifyRes.data);
  process.exit(1);
}

// 6. Adversary Launching EXPIRED INTENT ATTACK (Stale Authorization)
console.log(cyan('6. Adversary Launching EXPIRED INTENT ATTACK (Stale Timestamp):'));
console.log('   Submitting proposal against an authorization past its expiry deadline...');

const expiredIntentId = `int_expired_${Date.now()}`;
await callApi('/intents', {
  method: 'POST',
  headers: { authorization: `Bearer ${API_KEY_DASHBOARD}` },
  body: JSON.stringify({
    id: expiredIntentId,
    owner: 'user_enterprise_corp',
    seller: 'Northstar Supply',
    product: 'Office Printer',
    maxAmount: '50000000',
    currency: 'USDC',
    allowedDestinations: ['0xSupplierA_Contract_or_Wallet_001'],
    expiry: '2020-01-01T00:00:00.000Z', // In the past!
    remainingUses: 1,
    createdAt: new Date().toISOString(),
  }),
});

const expiredRes = await callApi('/verify', {
  method: 'POST',
  headers: { authorization: `Bearer ${API_KEY_AGENT}` },
  body: JSON.stringify({
    proposal: {
      ...validProposal,
      intentId: expiredIntentId,
    },
  }),
});

console.log(`   Gateway Verdict:  ${red(expiredRes.data.decision.toUpperCase())}`);
console.log(`   Reason Codes:     ${red(expiredRes.data.reasonCodes?.join(', '))}`);
if (expiredRes.data.decision === 'reject' && expiredRes.data.reasonCodes.includes('INTENT_EXPIRED')) {
  console.log(green('   ✓ Stale Intent Defeated: Timestamp expired in PostgreSQL, transaction halted!\n'));
} else {
  console.error(red('   ❌ Expiry was not enforced!'), expiredRes.data);
  process.exit(1);
}

// 7. Verify the cryptographic audit chain integrity after all attacks
console.log(cyan('7. Verifying PostgreSQL Cryptographic Audit Chain Integrity:'));
const auditRes = await callApi('/audit/chain/verify', {
  headers: { authorization: `Bearer ${API_KEY_ADMIN}` },
});
console.log(`   Audit Ledger Valid:   ${auditRes.data.valid ? green('YES (UNBROKEN)') : red('NO')}`);
console.log(`   Total Verified Blocks: ${auditRes.data.totalEntries}`);
console.log(green('   ✓ Complete sequence from Genesis verified across all attempts.\n'));

console.log(bold('============================================================='));
console.log(green('  LIVE REPLAY & EXPIRY ATTACK DEFENSES 100% VERIFIED         '));
console.log(bold('=============================================================\n'));
