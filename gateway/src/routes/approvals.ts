import { FastifyPluginAsync } from 'fastify';
import { PurchaseProposalSchema, proposalHash } from '../schemas/index.js';
import { withTransaction } from '../db/client.js';
import { requireRole } from '../auth/plugin.js';
import { appendAuditLog } from '../audit/hashChain.js';

export const approvalRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /approvals/:id/consume (adapter roles only: adapter-goat, adapter-qatom, admin)
  fastify.post(
    '/approvals/:id/consume',
    {
      preHandler: [requireRole('adapter-goat', 'adapter-qatom', 'admin')],
    },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      const parseResult = PurchaseProposalSchema.safeParse(req.body);

      if (!parseResult.success) {
        return reply.status(400).send({
          error: 'SCHEMA_INVALID',
          message: 'Invalid proposal payload for consumption',
          details: parseResult.error.format(),
        });
      }

      const proposal = parseResult.data;
      const computedHash = proposalHash(proposal);

      try {
        const result = await withTransaction(async (client) => {
          // 1. Check approval existence and lock
          const aprQuery = await client.query(
            'SELECT * FROM approvals WHERE id = $1',
            [id]
          );

          if (aprQuery.rows.length === 0) {
            return { ok: false, reason: 'APPROVAL_NOT_FOUND' };
          }

          const approval = aprQuery.rows[0];

          // 2. Lock intent for update
          const intentQuery = await client.query(
            'SELECT * FROM intents WHERE id = $1 FOR UPDATE',
            [approval.intent_id]
          );

          if (intentQuery.rows.length === 0) {
            return { ok: false, reason: 'INTENT_NOT_FOUND' };
          }

          const intent = intentQuery.rows[0];
          if (intent.remaining_uses <= 0) {
            return { ok: false, reason: 'INTENT_EXHAUSTED' };
          }

          // 3. Atomically consume approval
          const updateRes = await client.query(
            `UPDATE approvals
             SET consumed_at = NOW()
             WHERE id = $1
               AND consumed_at IS NULL
               AND expires_at > NOW()
               AND proposal_hash = $2
             RETURNING *`,
            [id, computedHash]
          );

          if (updateRes.rows.length === 0) {
            return { ok: false, reason: 'CONSUME_FAILED_HASH_OR_EXPIRED_OR_USED' };
          }

          // 4. Decrement remaining_uses on intent
          await client.query(
            'UPDATE intents SET remaining_uses = remaining_uses - 1 WHERE id = $1',
            [intent.id]
          );

          // 5. Append audit log
          await appendAuditLog(client, {
            eventType: 'APPROVAL_CONSUMED',
            entityType: 'approval',
            entityId: id,
            callerRole: req.callerRole!,
            payload: {
              executionId: approval.execution_id,
              proposalHash: computedHash,
              intentId: intent.id,
            },
          });

          return { ok: true, executionId: approval.execution_id };
        });

        if (!result.ok) {
          return reply.status(403).send({
            error: 'FORBIDDEN',
            message: `Approval cannot be consumed: ${result.reason}`,
          });
        }

        return reply.status(200).send({
          executionId: result.executionId,
        });
      } catch (err) {
        req.log.error(err);
        return reply.status(500).send({ error: 'INTERNAL_ERROR', message: 'Failed to consume approval' });
      }
    }
  );
};
