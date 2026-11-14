import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildServer } from '../src/server.js';
import { pool } from '../src/db/client.js';
import { runMigrations } from '../src/db/migrate.js';
import { config } from '../src/config.js';
import { createHttpGoatGatewayAuthority, GOAT_NATIVE_SCALE, GOAT_TESTNET_CHAIN_ID, createGoatExecutionAdapter, type GoatSigner, type GoatRpc } from '@trendie/goat';
import { createHttpGatewayAuthority, createQatomExecutionAdapter } from '@trendie/qatom';
import { runPurchaseWorkflow } from '@trendie/agent';
import { verifyAuditChain } from '../src/audit/verifyChain.js';
import { FastifyInstance } from 'fastify';

describe('Stage 2 Cross-Platform Core Flow Integration (Agent -> Inspection -> Gateway -> GOAT & Qatom Adapters)', () => {
  let app: FastifyInstance;
  let serverPort: number;
  let baseUrl: string;

  beforeAll(async () => {
    await runMigrations();
    await pool.query('TRUNCATE TABLE audit_log, executions, approvals, decisions, inspections, proposals, intents CASCADE');

    app = await buildServer();
    // Start listening on a dynamic port
    const address = await app.listen({ port: 0, host: '127.0.0.1' });
    const match = address.match(/:(\d+)$/);
    serverPort = match ? parseInt(match[1], 10) : 3000;
    baseUrl = `http://127.0.0.1:${serverPort}`;
  });

  afterAll(async () => {
    await app.close();
    await pool.end();
  });

  it('Core Flow 1: Agent discovers Qatom product, Gateway verifies & approves, Qatom adapter claims & reports outcome', async () => {
    // 1. Register Intent for Qatom purchase
    const intentId = 'int_qatom_core_01';
    await app.inject({
      method: 'POST',
      url: '/intents',
      headers: { 'x-api-key': config.API_KEY_DASHBOARD },
      payload: {
        id: intentId,
        owner: 'user_enterprise',
        seller: 'synthetic-seller-1',
        product: 'synthetic-item-1',
        maxAmount: '2000',
        currency: 'USDC',
        allowedDestinations: ['synthetic-seller-1'],
        expiry: '2026-12-31T23:59:59.000Z',
        remainingUses: 1,
        createdAt: new Date().toISOString(),
      },
    });

    // 2. Run agent workflow to propose purchase
    const listing = {
      itemId: 'synthetic-item-1',
      sellerId: 'synthetic-seller-1',
      title: 'Legitimate product',
      amount: '1250',
      scale: 3,
      asset: 'USD-TDN',
      description: 'Clean product description with no malicious instructions.',
      sourceRef: 'fixture://catalog/item-1',
    };

    const workflow = await runPurchaseWorkflow({
      task: {
        ownerId: 'user_enterprise',
        intentId,
        intentVersion: 1,
        platform: 'qatom',
        chain: 'qatom-network',
        task: 'Buy the synthetic item',
        maxAmount: '2000',
        maxScale: 3,
        asset: 'USD-TDN',
      },
      query: 'synthetic item',
      discovery: { async search() { return [listing]; } },
      model: {
        async propose({ listings }) {
          const selected = listings[0];
          return {
            itemId: selected.itemId,
            sellerId: selected.sellerId,
            money: { amount: selected.amount, scale: selected.scale },
            asset: selected.asset,
            providerArgs: {
              destination: selected.sellerId,
              sourceRef: selected.sourceRef,
            },
          };
        },
      },
      source: 'model',
    });

    // 3. Agent submits proposal to Gateway /verify
    const verifyRes = await app.inject({
      method: 'POST',
      url: '/verify',
      headers: { 'x-api-key': config.API_KEY_AGENT },
      payload: {
        proposal: {
          intentId: workflow.proposal.intentId,
          seller: workflow.proposal.sellerId,
          product: workflow.proposal.itemId,
          amount: workflow.proposal.money.amount,
          currency: 'USDC',
          destination: workflow.proposal.sellerId,
          sourceRef: (workflow.proposal.providerArgs?.sourceRef as string) || 'listing:1',
        },
        inspection: {
          source: listing.sourceRef,
          flags: workflow.inspection.findings.map((f) => ({
            code: f.code,
            severity: 'low' as const,
          })),
          evidence: [],
          findings: {},
        },
      },
    });

    expect(verifyRes.statusCode).toBe(200);
    const verifyBody = verifyRes.json();
    expect(verifyBody.decision).toBe('approve');
    expect(verifyBody.authorizationRef).toBeDefined();

    // 4. Person 3 Qatom execution adapter claims execution via GatewayAuthority HTTP client
    const qatomAuthority = createHttpGatewayAuthority({
      baseUrl,
      apiKey: config.API_KEY_ADAPTER_QATOM,
    });

    let toolCalled = false;
    const qatomAdapter = createQatomExecutionAdapter({
      authority: qatomAuthority,
      transport: {
        async listTools() { return [{ name: 'agent_checkout', inputSchema: { type: 'object' } }]; },
        async callTool() {
          toolCalled = true;
          return { content: [{ type: 'text', text: '{"receiptId":"rcpt_live_qatom_001"}' }] };
        },
        async continueTool() { throw new Error('Unused'); },
      },
      boundPrice: {
        async supportsAtomicPriceBound() { return true; },
        async prepareBoundCall({ binding }) {
          return { args: { itemId: binding.itemId, amount: binding.money.amount } };
        },
      },
      paidExecution: { async isAuthorized() { return true; } },
      receiptVerifier: {
        async assess({ binding }) {
          return {
            status: 'succeeded',
            actual: { itemId: binding.itemId, money: binding.money, receiptId: 'rcpt_live_qatom_001' },
          };
        },
      },
      checkoutToolName: 'agent_checkout',
    });

    const paymentResult = await qatomAdapter.execute({
      caller: { ownerId: 'user_enterprise' },
      approvalReference: verifyBody.authorizationRef,
      proposal: workflow.proposal,
    });

    expect(paymentResult.status).toBe('succeeded');
    expect(toolCalled).toBe(true);
    expect(paymentResult.actual?.receiptId).toBe('rcpt_live_qatom_001');

    // 5. Verify the Gateway audit chain remains unbroken
    const auditStatus = await verifyAuditChain(pool);
    expect(auditStatus.valid).toBe(true);
  });

  it('Core Flow 2: Agent proposes GOAT payment, Gateway verifies & approves, GOAT adapter claims & verifies on-chain receipt', async () => {
    // 1. Register Intent for GOAT payment
    const intentId = 'int_goat_core_01';
    const recipient = '0x000000000000000000000000000000000000dEaD';
    await app.inject({
      method: 'POST',
      url: '/intents',
      headers: { 'x-api-key': config.API_KEY_DASHBOARD },
      payload: {
        id: intentId,
        owner: 'user_enterprise',
        seller: 'goat-seller-1',
        product: 'cloud-server-monthly',
        maxAmount: '2000000000000000',
        currency: 'BTC',
        allowedDestinations: [recipient],
        expiry: '2026-12-31T23:59:59.000Z',
        remainingUses: 1,
        createdAt: new Date().toISOString(),
      },
    });

    const goatProposal = {
      version: 1 as const,
      ownerId: 'user_enterprise',
      intentId,
      intentVersion: 1,
      platform: 'goat' as const,
      itemId: 'cloud-server-monthly',
      sellerId: 'goat-seller-1',
      money: { amount: '1000000000000000', scale: GOAT_NATIVE_SCALE },
      asset: 'BTC',
      chain: 'goat-testnet',
      providerArgs: {
        recipient,
        sourceRef: 'goat:invoice:123',
      },
    };

    // 2. Agent submits to Gateway /verify
    const verifyRes = await app.inject({
      method: 'POST',
      url: '/verify',
      headers: { 'x-api-key': config.API_KEY_AGENT },
      payload: {
        proposal: {
          intentId: goatProposal.intentId,
          seller: goatProposal.sellerId,
          product: goatProposal.itemId,
          amount: goatProposal.money.amount,
          currency: 'BTC',
          destination: recipient,
          sourceRef: 'goat:invoice:123',
        },
      },
    });

    expect(verifyRes.statusCode).toBe(200);
    const verifyBody = verifyRes.json();
    expect(verifyBody.decision).toBe('approve');

    // 3. Person 2 GOAT execution adapter claims execution via HTTP client
    const goatAuthority = createHttpGoatGatewayAuthority({
      baseUrl,
      apiKey: config.API_KEY_ADAPTER_GOAT,
    });

    const txHash = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef' as const;
    const rpc: GoatRpc = {
      async getChainId() { return GOAT_TESTNET_CHAIN_ID; },
      async getBlockNumber() { return 100n; },
      async getTransaction() {
        return {
          hash: txHash,
          from: '0x0000000000000000000000000000000000000001',
          to: recipient,
          value: BigInt(goatProposal.money.amount),
          blockNumber: 99n,
          chainId: GOAT_TESTNET_CHAIN_ID,
        };
      },
      async getTransactionReceipt() {
        return {
          transactionHash: txHash,
          status: 'success',
          blockNumber: 99n,
        };
      },
    };

    const mockSigner: GoatSigner = {
      getAddress: async () => '0x0000000000000000000000000000000000000001',
      getNetwork: async () => 'goat-testnet',
      getChainId: async () => GOAT_TESTNET_CHAIN_ID,
      getBalance: async () => '0',
      getErc20Balance: async () => '0',
      transferNative: async (_to, _amountWei, options) => {
        await options?.onSignedTransaction?.(txHash);
        await options?.onBroadcast?.(txHash);
        return { txHash };
      },
      transferErc20: async () => { throw new Error('unused'); },
      approveErc20: async () => { throw new Error('unused'); },
      signTypedData: async () => { throw new Error('unused'); },
      callContract: async () => { throw new Error('unused'); },
      writeContract: async () => { throw new Error('unused'); },
      deployContract: async () => { throw new Error('unused'); },
    } as unknown as GoatSigner;

    const goatAdapter = createGoatExecutionAdapter({
      authority: goatAuthority,
      rpc,
      signer: mockSigner,
      numericSpendCeilingWei: '3000000000000000',
      now: () => Math.floor(Date.now() / 1000),
    });

    const result = await goatAdapter.execute({
      caller: { ownerId: 'user_enterprise' },
      approvalReference: verifyBody.authorizationRef,
      proposal: goatProposal,
      spendAuthorization: {
        ownerId: 'user_enterprise',
        authorizationId: 'auth_goat_1',
        maxAmountWei: '2000000000000000',
      },
    });

    if (result.status !== 'succeeded') {
      console.error('GOAT NON-SUCCEEDED STATUS:', result.status, 'REASON:', result.reason);
    }

    expect(result.status).toBe('succeeded');
    expect(result.providerReference).toBe(txHash);

    // 4. Verify Gateway audit trail records both the claim and execution result
    const auditStatus = await verifyAuditChain(pool);
    expect(auditStatus.valid).toBe(true);
  });
});
