import pg from 'pg';
import { computeRowHash, GENESIS_HASH } from './hashChain.js';

export interface AuditChainVerificationResult {
  valid: boolean;
  totalEntries: number;
  error?: string;
  tamperedRowId?: number;
}

export async function verifyAuditChain(
  client: pg.PoolClient | pg.Pool
): Promise<AuditChainVerificationResult> {
  const res = await client.query('SELECT * FROM audit_log ORDER BY id ASC');
  const rows = res.rows;

  let expectedPrevHash = GENESIS_HASH;

  for (const row of rows) {
    if (row.prev_hash !== expectedPrevHash) {
      return {
        valid: false,
        totalEntries: rows.length,
        tamperedRowId: row.id,
        error: `Broken hash chain at row ${row.id}: expected prev_hash ${expectedPrevHash}, found ${row.prev_hash}`,
      };
    }

    const recalculated = computeRowHash(
      row.prev_hash,
      row.event_type,
      row.entity_type,
      row.entity_id,
      row.caller_role,
      row.payload,
      new Date(row.created_at).toISOString()
    );

    if (recalculated !== row.row_hash) {
      return {
        valid: false,
        totalEntries: rows.length,
        tamperedRowId: row.id,
        error: `Tampered payload or signature at row ${row.id}: expected ${recalculated}, found ${row.row_hash}`,
      };
    }

    expectedPrevHash = row.row_hash;
  }

  return {
    valid: true,
    totalEntries: rows.length,
  };
}
