import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { withTransaction } from '../db/client.js';
import { requireRole } from '../auth/plugin.js';
import { appendAuditLog } from '../audit/hashChain.js';
import { createApprovalId, createExecutionId, generateHmacSignature } from '../approvals/token.js';
import { config } from '../config.js';

const ResolveBodySchema = z
  .object({
    resolution: z.enum(['approve', 'reject']),
    notes: z.string().min(1),
  })
  .strict();

export const reviewRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /reviews/:decisionId/resolve (human approver / admin)
  fastify.post(
    '/reviews/:decisionId/resolve',
    {
      preHandler: [requireRole('admin', 'dashboard')],
    },
    async (req, reply) => {
      const { decisionId } = req.params as { decisionId: string };
      const parseResult = ResolveBodySchema.safeParse(req.body);

      if (!parseResult.success) {
        return reply.status(400).send({
          error: 'SCHEMA_INVALID',
          message: 'Invalid review resolution payload',
          details: parseResult.error.format(),
        });
      }

      const { resolution, notes } = parseResult.data;

      return await withTransaction(async (client) => {
        // Fetch decision
        const decRes = await client.query('SELECT * FROM decisions WHERE id = $1', [decisionId]);
        if (decRes.rows.length === 0) {
          return reply.status(404).send({ error: 'DECISION_NOT_FOUND', message: 'Decision not found' });
        }

        const decision = decRes.rows[0];

        // Security rule: Only 'review' status can be resolved; hard 'reject' can NEVER be overridden
        if (decision.decision !== 'review') {
          return reply.status(400).send({
            error: 'INVALID_RESOLUTION_STATE',
            message: `Cannot resolve decision with status '${decision.decision}'. Only 'review' status can be resolved.`,
          });
        }

        let authorizationRef: string | null = null;
        const now = new Date();

        if (resolution === 'approve') {
          // Fetch associated proposal to get intent and proposalHash
          const propRes = await client.query('SELECT * FROM proposals WHERE id = $1', [decision.proposal_id]);
          if (propRes.rows.length === 0 || !propRes.rows[0].intent_id) {
            return reply.status(400).send({ error: 'PROPOSAL_INVALID', message: 'Cannot approve proposal without valid intent' });
          }

          const proposalRow = propRes.rows[0];
          const approvalId = createApprovalId();
          const executionId = createExecutionId();
          const expiresAt = new Date(now.getTime() + config.APPROVAL_TTL_SECONDS * 1000).toISOString();
          const hmac = generateHmacSignature({
            approvalId,
            executionId,
            proposalHash: decision.proposal_hash,
            intentId: proposalRow.intent_id,
            expiresAt,
          });

          await client.query(
            `INSERT INTO approvals (
              id, decision_id, intent_id, proposal_hash, execution_id, hmac_signature, key_id, expires_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [
              approvalId,
              decisionId,
              proposalRow.intent_id,
              decision.proposal_hash,
              executionId,
              hmac,
              config.APPROVAL_KEY_ID,
              expiresAt,
            ]
          );

          authorizationRef = approvalId;
        }

        // Update decision
        await client.query(
          `UPDATE decisions
           SET decision = $1, authorization_ref = $2
           WHERE id = $3`,
          [resolution, authorizationRef, decisionId]
        );

        // Append audit log
        await appendAuditLog(client, {
          eventType: 'REVIEW_RESOLVED',
          entityType: 'decision',
          entityId: decisionId,
          callerRole: req.callerRole!,
          payload: {
            previousDecision: 'review',
            newDecision: resolution,
            authorizationRef,
            notes,
          },
        });

        return reply.status(200).send({
          id: decisionId,
          decision: resolution,
          authorizationRef,
          notes,
        });
      });
    }
  );
};
