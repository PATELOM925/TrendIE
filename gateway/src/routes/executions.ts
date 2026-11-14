import { FastifyPluginAsync } from 'fastify';
import { randomUUID } from 'node:crypto';
import { PaymentResultSchema } from '../schemas/index.js';
import { withTransaction, pool } from '../db/client.js';
import { requireRole } from '../auth/plugin.js';
import { appendAuditLog } from '../audit/hashChain.js';

export const executionRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /executions/:id/result (adapter roles only)
  fastify.post(
    '/executions/:id/result',
    {
      preHandler: [requireRole('adapter-goat', 'adapter-qatom', 'admin')],
    },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      const parseResult = PaymentResultSchema.safeParse(req.body);

      if (!parseResult.success) {
        return reply.status(400).send({
          error: 'SCHEMA_INVALID',
          message: 'Invalid payment result payload',
          details: parseResult.error.format(),
        });
      }

      const payment = parseResult.data;
      if (payment.executionId !== id) {
        return reply.status(400).send({
          error: 'EXECUTION_ID_MISMATCH',
          message: 'Path executionId does not match body executionId',
        });
      }

      // Check if already recorded (idempotent lookup)
      const existing = await pool.query(
        'SELECT * FROM executions WHERE execution_id = $1',
        [id]
      );

      if (existing.rows.length > 0) {
        const row = existing.rows[0];
        return reply.status(200).send({
          executionId: row.execution_id,
          status: row.status,
          platform: row.platform,
          txHashOrCheckoutRef: row.tx_hash_or_checkout_ref,
          error: row.error,
        });
      }

      // Look up corresponding approval
      const aprRes = await pool.query(
        'SELECT * FROM approvals WHERE execution_id = $1',
        [id]
      );

      const approvalId = aprRes.rows.length > 0 ? aprRes.rows[0].id : null;

      return await withTransaction(async (client) => {
        const execDbId = `exe_rec_${randomUUID().replace(/-/g, '')}`;
        await client.query(
          `INSERT INTO executions (
            id, execution_id, approval_id, status, platform, tx_hash_or_checkout_ref, error, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
          ON CONFLICT (execution_id) DO NOTHING`,
          [
            execDbId,
            id,
            approvalId,
            payment.status,
            payment.platform,
            payment.txHashOrCheckoutRef,
            payment.error,
          ]
        );

        await appendAuditLog(client, {
          eventType: 'PAYMENT_RESULT_RECORDED',
          entityType: 'execution',
          entityId: id,
          callerRole: req.callerRole!,
          payload: payment,
        });

        return reply.status(200).send(payment);
      });
    }
  );
};
