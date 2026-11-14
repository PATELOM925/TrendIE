import { pool, withTransaction } from './client.js';
import { appendAuditLog } from '../audit/hashChain.js';
import { runMigrations } from './migrate.js';

export async function seedDemoData() {
  await runMigrations();

  const demoIntent = {
    id: 'int_demo_01',
    owner: 'user_enterprise_corp',
    seller: 'Supplier A',
    product: 'Product A',
    maxAmount: '5000',
    currency: 'USDC',
    allowedDestinations: ['0xSupplierA_Contract_or_Wallet_001'],
    expiry: '2026-12-31T23:59:59.000Z',
    remainingUses: 5,
    createdAt: new Date().toISOString(),
  };

  await withTransaction(async (client) => {
  const inserted = await client.query(
    `INSERT INTO intents (
      id, owner, seller, product, max_amount, currency, allowed_destinations, expiry, remaining_uses, created_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    ON CONFLICT (id) DO NOTHING RETURNING id`,
    [
      demoIntent.id,
      demoIntent.owner,
      demoIntent.seller,
      demoIntent.product,
      demoIntent.maxAmount,
      demoIntent.currency,
      JSON.stringify(demoIntent.allowedDestinations),
      demoIntent.expiry,
      demoIntent.remainingUses,
      demoIntent.createdAt,
    ]
  );

  if (inserted.rows.length > 0) await appendAuditLog(client, {
    eventType: 'INTENT_SEEDED',
    entityType: 'intent',
    entityId: demoIntent.id,
    callerRole: 'admin',
    payload: demoIntent,
  });
  });

  console.log('Demo seed data populated: Intent int_demo_01');
}

if (process.argv[1]?.includes('seed')) {
  seedDemoData()
    .then(() => pool.end())
    .catch((err) => {
      console.error('Seed error:', err);
      process.exit(1);
    });
}
