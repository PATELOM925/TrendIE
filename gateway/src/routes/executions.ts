import { FastifyPluginAsync } from 'fastify';
import { PaymentResultSchema } from '../schemas/index.js';
import { withTransaction } from '../db/client.js';
import { requireRole } from '../auth/plugin.js';
import { appendAuditLog } from '../audit/hashChain.js';
import { canTransition, normalizeStatus, sameOutcome, validOutcome } from '../executions/state.js';

export const executionRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post('/executions/:id/result', { preHandler: [requireRole('adapter-goat', 'adapter-qatom', 'admin')] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const parsed = PaymentResultSchema.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: 'SCHEMA_INVALID', message: 'Invalid payment result payload', details: parsed.error.format() });
    const payment = parsed.data;
    if (payment.executionId !== id) return reply.status(400).send({ error: 'EXECUTION_ID_MISMATCH', message: 'Path executionId does not match body executionId' });
    const rolePlatform = req.callerRole === 'adapter-goat' ? 'goat' : req.callerRole === 'adapter-qatom' ? 'qatom' : null;
    try {
      const result = await withTransaction(async (client) => {
        const ar = await client.query('SELECT * FROM approvals WHERE execution_id = $1 FOR UPDATE', [id]);
        if (!ar.rows.length) return { code: 404, error: 'APPROVAL_NOT_FOUND' };
        const approval = ar.rows[0];
        if (!approval.consumed_at) return { code: 403, error: 'APPROVAL_NOT_CONSUMED' };
        if (!approval.consumed_platform || approval.consumed_platform !== payment.platform || (rolePlatform && rolePlatform !== approval.consumed_platform)) return { code: 403, error: 'PLATFORM_MISMATCH' };
        const er = await client.query('SELECT * FROM executions WHERE execution_id = $1 FOR UPDATE', [id]);
        if (er.rows.length) {
          const row = er.rows[0];
          const stored = { status: row.status, platform: row.platform, txHashOrCheckoutRef: row.tx_hash_or_checkout_ref, error: row.error, evidence: row.evidence ?? {} };
          if (sameOutcome(stored, payment)) return { code: 200, body: { ...payment, status: normalizeStatus(row.status) } };
          if (!canTransition(row.status, payment) || (row.tx_hash_or_checkout_ref && row.tx_hash_or_checkout_ref !== payment.txHashOrCheckoutRef)) return { code: 409, error: 'EXECUTION_CONFLICT' };
          await client.query('UPDATE executions SET status=$2, platform=$3, tx_hash_or_checkout_ref=$4, error=$5, evidence=$6, updated_at=NOW() WHERE execution_id=$1', [id, normalizeStatus(payment.status), payment.platform, payment.txHashOrCheckoutRef, payment.error, JSON.stringify(payment.evidence)]);
        } else {
          if (!validOutcome(payment)) return { code: 409, error: 'INVALID_INITIAL_OUTCOME' };
          await client.query('INSERT INTO executions (id, execution_id, approval_id, status, platform, tx_hash_or_checkout_ref, error, evidence, created_at, updated_at) VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, NOW(), NOW())', [id, approval.id, normalizeStatus(payment.status), payment.platform, payment.txHashOrCheckoutRef, payment.error, JSON.stringify(payment.evidence)]);
        }
        const persisted = { ...payment, status: normalizeStatus(payment.status) };
        await appendAuditLog(client, { eventType: 'PAYMENT_RESULT_RECORDED', entityType: 'execution', entityId: id, callerRole: req.callerRole!, payload: persisted });
        return { code: 200, body: persisted };
      });
      return reply.status(result.code).send(result.body ?? { error: result.error });
    } catch (err) {
      req.log.error(err);
      return reply.status(500).send({ error: 'INTERNAL_ERROR', message: 'Failed to record payment result' });
    }
  });
};
