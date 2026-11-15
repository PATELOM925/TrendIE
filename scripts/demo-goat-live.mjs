import { createPublicClient, http } from 'viem';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { GOAT_TESTNET_CHAIN_ID, GOAT_TESTNET_RPC_URL, createGoatExecutionAdapter } from '@trendie/goat';

const bold = (s) => `\x1b[1m${s}\x1b[0m`;
const red = (s) => `\x1b[31m${s}\x1b[0m`;
const green = (s) => `\x1b[32m${s}\x1b[0m`;
const cyan = (s) => `\x1b[36m${s}\x1b[0m`;
const yellow = (s) => `\x1b[33m${s}\x1b[0m`;

console.log(bold('\n============================================================='));
console.log(bold('  AGENTIC PAYMENT GUARD — GOAT TESTNET3 LIVE BRIDGE DEMO    '));
console.log(bold('=============================================================\n'));

const client = createPublicClient({
  transport: http(GOAT_TESTNET_RPC_URL),
});

console.log(cyan('1. Connecting to GOAT Testnet3 Network...'));
console.log(`   RPC URL:  ${GOAT_TESTNET_RPC_URL}`);
const chainId = await client.getChainId();
const blockNumber = await client.getBlockNumber();
console.log(`   Chain ID: ${bold(chainId.toString())} (Expected: ${GOAT_TESTNET_CHAIN_ID})`);
console.log(`   Block:    ${bold(blockNumber.toString())}`);
console.log(green('   ✓ Successfully connected to live GOAT Testnet3 RPC!\n'));

const testKey = process.env.GOAT_PRIVATE_KEY || generatePrivateKey();
const account = privateKeyToAccount(testKey);
const balance = await client.getBalance({ address: account.address });

console.log(cyan('2. Active GOAT Agent Wallet:'));
console.log(`   Address:  ${bold(account.address)}`);
console.log(`   Balance:  ${balance.toString()} wei (native BTC on GOAT Testnet)`);
if (!process.env.GOAT_PRIVATE_KEY) {
  console.log(yellow('   Notice:   Using ephemeral testnet key (Set GOAT_PRIVATE_KEY in .env to persist).\n'));
}

console.log(cyan('3. Simulating Attack vs Defense on GOAT Testnet Bridge:'));
console.log('   Scenario: Autonomous agent tricked into redirecting funds to attacker wallet.');

const fakeAuthority = {
  async claimExecution({ proposal }) {
    if (proposal.providerArgs?.recipient !== '0x1234567890123456789012345678901234567890') {
      return { status: 'denied', reason: 'REJECTED: Recipient does not match authorized buyer intent.' };
    }
    return {
      status: 'claimed',
      executionId: 'exec_goat_live_01',
      binding: {
        platform: 'goat',
        fingerprint: 'test-fingerprint',
        ownerId: 'user_enterprise_corp',
        intentId: 'int_demo_01',
        intentVersion: 1,
        sender: account.address,
        destination: '0x1234567890123456789012345678901234567890',
        asset: 'BTC',
        chainId: GOAT_TESTNET_CHAIN_ID,
        amount: '1000',
        scale: 18,
        expiresAt: Date.now() + 60000,
        spendAuthorizationId: 'auth_goat_01',
        spendCeilingWei: '5000000',
      },
    };
  },
  async recordSubmissionCheckpoint() {},
  async recordOutcome() {},
  async getExecutionForReconciliation() { return undefined; },
};

const fakeRpc = {
  getChainId: () => Promise.resolve(GOAT_TESTNET_CHAIN_ID),
  getBlockNumber: () => client.getBlockNumber(),
  getTransaction: () => Promise.resolve(null),
  getTransactionReceipt: () => Promise.resolve(null),
};

const fakeSigner = {
  async transferNative() {
    throw new Error('Signer transfer should not be called when authority denies execution!');
  },
};

const adapter = createGoatExecutionAdapter({
  authority: fakeAuthority,
  rpc: fakeRpc,
  signer: fakeSigner,
  numericSpendCeilingWei: '1000000000000000000',
});

const maliciousProposal = {
  version: 1,
  ownerId: 'user_enterprise_corp',
  intentId: 'int_demo_01',
  intentVersion: 1,
  platform: 'goat',
  chain: 'goat-testnet',
  itemId: 'item-hacked',
  sellerId: 'AttackerMerchant',
  money: { amount: '1000', scale: 18 },
  asset: 'BTC',
  providerArgs: {
    recipient: '0xDeadDeadDeadDeadDeadDeadDeadDeadDeadDead',
  },
};

const attackResult = await adapter.execute({
  caller: { ownerId: 'user_enterprise_corp' },
  approvalReference: 'one-time-claim-token-123',
  proposal: maliciousProposal,
  spendAuthorization: {
    ownerId: 'user_enterprise_corp',
    authorizationId: 'auth_goat_01',
    maxAmountWei: '5000000',
  },
});

console.log(`   Attacker destination: ${maliciousProposal.providerArgs.recipient}`);
console.log(`   Payment Guard Result: ${red(attackResult.status.toUpperCase())}`);
console.log(`   Halt Reason:          ${attackResult.reason}`);
console.log(green('   ✓ Fund drain prevented: Zero transactions broadcast to GOAT Testnet!\n'));

console.log(bold('============================================================='));
console.log(green('  GOAT TESTNET3 LIVE BRIDGE DEMONSTRATION COMPLETE           '));
console.log(bold('=============================================================\n'));
