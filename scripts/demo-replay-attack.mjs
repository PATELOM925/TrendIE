const GATEWAY_URL = process.env.GATEWAY_URL || 'http://127.0.0.1:3000';
const API_KEY_DASHBOARD = 'dev-dashboard-key-3456';
const API_KEY_AGENT = 'dev-agent-key-1234';

const bold = (s) => `\x1b[1m${s}\x1b[0m`;
const red = (s) => `\x1b[31m${s}\x1b[0m`;
const cyan = (s) => `\x1b[36m${s}\x1b[0m`;

console.log(bold('\n============================================================='));
console.log(bold('  LOCAL GATEWAY POLICY CHECK: ZERO-USE AND EXPIRED INTENTS   '));
console.log(bold('=============================================================\n'));
console.log('This script does not consume an approval twice and is not a duplicate-execution test.\n');

// Helper for HTTP requests
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

console.log(cyan('1. Registering a Single-Use Purchase Authorization (remainingUses = 1)...'));
const intentId = `int_replay_${Date.now()}`;
const createIntentRes = await callApi('/intents', {
  method: 'POST',
  headers: { 'x-api-key': API_KEY_DASHBOARD },
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
console.log(`   Remaining Uses:    ${bold('1')}\n`);

// 2. Legitimate verification
console.log(cyan('2. Submitting Legitimate Purchase Proposal (Attempt #1)...'));
const validProposal = {
  intentId,
  seller: 'Northstar Supply',
  product: 'Office Printer',
  amount: '50000000',
  currency: 'USDC',
  destination: '0xSupplierA_Contract_or_Wallet_001',
};

const verify1Res = await callApi('/verify', {
  method: 'POST',
  headers: { 'x-api-key': API_KEY_AGENT },
  body: JSON.stringify({ proposal: validProposal }),
});

console.log(`   Verify HTTP Status: ${verify1Res.status}`);
console.log(`   Gateway Decision:   ${verify1Res.data.decision?.toUpperCase() ?? 'UNCONFIRMED'}`);
console.log(`   Decision ID:        ${bold(verify1Res.data.id ?? 'Not returned')}`);
console.log('   This script does not display approval references or claim a payment.\n');

// 3. Consume the approval
console.log(cyan('3. Simulating an exhausted authorization with a separate zero-use intent...'));
console.log('   No approval-consume endpoint is called for the first approved proposal.');
console.log(`   This models policy exhaustion only; it does not prove replay protection.\n`);

// Manually decrement remaining uses in gateway to simulate completed consumption:
await callApi('/intents', {
  method: 'POST',
  headers: { 'x-api-key': API_KEY_DASHBOARD },
  body: JSON.stringify({
    id: `${intentId}_exhausted`,
    owner: 'user_enterprise_corp',
    seller: 'Northstar Supply',
    product: 'Office Printer',
    maxAmount: '50000000',
    currency: 'USDC',
    allowedDestinations: ['0xSupplierA_Contract_or_Wallet_001'],
    expiry: new Date(Date.now() + 3600_000).toISOString(),
    remainingUses: 0, // 0 uses remaining!
    createdAt: new Date().toISOString(),
  }),
});

// 4. Attack: Replay the proposal
console.log(cyan('4. Checking a proposal against the separate zero-use intent:'));
console.log('   This is not a second consume of the original approval.');

const replayRes = await callApi('/verify', {
  method: 'POST',
  headers: { 'x-api-key': API_KEY_AGENT },
  body: JSON.stringify({
    proposal: {
      ...validProposal,
      intentId: `${intentId}_exhausted`,
    },
  }),
});

console.log(`   Gateway HTTP Status: ${replayRes.status}`);
console.log(`   Gateway Verdict:     ${replayRes.data.decision?.toUpperCase() ?? 'UNCONFIRMED'}`);
console.log(`   Reason Codes:        ${replayRes.data.reasonCodes?.join(', ') || 'No reason codes returned'}`);
console.log('   No payment adapter was called.\n');

// 5. Attack: Expired Intent
console.log(cyan('5. Adversary Launching EXPIRED INTENT ATTACK (Stale Authorization):'));
console.log('   Submitting proposal against an authorization past its expiry deadline...');

const expiredIntentId = `int_expired_${Date.now()}`;
await callApi('/intents', {
  method: 'POST',
  headers: { 'x-api-key': API_KEY_DASHBOARD },
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
  headers: { 'x-api-key': API_KEY_AGENT },
  body: JSON.stringify({
    proposal: {
      ...validProposal,
      intentId: expiredIntentId,
    },
  }),
});

console.log(`   Gateway HTTP Status: ${expiredRes.status}`);
console.log(`   Gateway Verdict:     ${expiredRes.data.decision?.toUpperCase() ?? 'UNCONFIRMED'}`);
console.log(`   Reason Codes:        ${expiredRes.data.reasonCodes?.join(', ') || 'No reason codes returned'}`);
console.log('   No payment adapter was called.\n');

console.log(bold('============================================================='));
console.log('  ZERO-USE AND EXPIRY POLICY CHECK ATTEMPT COMPLETE          ');
console.log(bold('=============================================================\n'));
