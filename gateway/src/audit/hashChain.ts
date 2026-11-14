import { createHash } from 'node:crypto';
import pg from 'pg';
import { canonicalJson } from '../schemas/canonical.js';

export const GENESIS_HASH = '0000000000000000000000000000000000000000000000000000000000000000';

export interface AuditEntryInput {
  eventType: string;
  entityType: string;
  entityId: string;
  callerRole: string;
  payload: Record<string, unknown>;
}

export function computeRowHash(
  prevHash: string,
  eventType: string,
  entityType: string,
  entityId: string,
  callerRole: string,
  payload: Record<string, unknown>,
  createdAtIso: string
): string {
  const content = `${prevHash}|${eventType}|${entityType}|${entityId}|${callerRole}|${canonicalJson(payload)}|${createdAtIso}`;
  return createHash('sha256').update(content, 'utf8').digest('hex');
}

/**
 * Appends an audit row to audit_log inside an existing transaction or using pool.
 * Computes hash chain by locking/reading the latest row hash.
 */
export async function appendAuditLog(
  client: pg.PoolClient,
  entry: AuditEntryInput
): Promise<{ id: string; rowHash: string }> {
  await client.query("SELECT pg_advisory_xact_lock(hashtext('gateway.audit_log.chain'))");
  // Serialize writers before reading the chain head.
  const latestRes = await client.query(
    'SELECT row_hash FROM audit_log ORDER BY id DESC LIMIT 1'
  );
  const prevHash = latestRes.rows.length > 0 ? (latestRes.rows[0].row_hash as string) : GENESIS_HASH;
  const createdAt = new Date().toISOString();

  const rowHash = computeRowHash(
    prevHash,
    entry.eventType,
    entry.entityType,
    entry.entityId,
    entry.callerRole,
    entry.payload,
    createdAt
  );

  const insertRes = await client.query(
    `INSERT INTO audit_log (
      event_type, entity_type, entity_id, caller_role, payload, prev_hash, row_hash, created_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING id, row_hash`,
    [
      entry.eventType,
      entry.entityType,
      entry.entityId,
      entry.callerRole,
      JSON.stringify(entry.payload),
      prevHash,
      rowHash,
      createdAt,
    ]
  );

  return {
    id: insertRes.rows[0].id.toString(),
    rowHash: insertRes.rows[0].row_hash,
  };
}
