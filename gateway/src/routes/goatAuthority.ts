import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { pool, withTransaction } from '../db/client.js';
import { requireRole } from '../auth/plugin.js';
import { appendAuditLog } from '../audit/hashChain.js';
import { isIntentActive } from '../approvals/expiry.js';
import { normalizeStatus } from '../executions/state.js';

const GOAT_TESTNET_CHAIN_ID = 48816;
const GOAT_NATIVE_ASSET = 'BTC';
const GOAT_NATIVE_SCALE = 18;

const ClaimBodySchema = z.object({
  version: z.literal(1),
  kind: z.literal('claim'),
  callerOwnerId: z.string().min(1).max(128),
  proposal: z.record(z.string(), z.unknown()),
  fingerprint: z.string().min(1).max(128),
  spendAuthorization: z.object({
    ownerId: z.string().min(1).max(128),
    authorizationId: z.string().min(1).max(128),
    maxAmountWei: z.string().regex(/^\d+$/),
  }),
});

const CheckpointBodySchema = z.object({
  version: z.literal(1),
  kind: z.literal('checkpoint'),
  executionId: z.string().min(1).max(128),
  phase: z.enum(['signed', 'broadcast']),
  txHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
});

const OutcomeBodySchema = z.object({
  version: z.literal(1),
  kind: z.literal('outcome'),
  executionId: z.string().min(1).max(128),
  status: z.enum(['blocked', 'pending_approval', 'submitting', 'pending', 'succeeded', 'failed', 'unknown']),
  providerReference: z.string().max(512).optional(),
  reason: z.string().max(2048).optional(),
  evidence: z.unknown().optional(),
});

export const goatAuthorityRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /v1/goat/approvals/:approvalReference/claim
  fastify.post(
    '/v1/goat/approvals/:approvalReference/claim',
    {
      preHandler: [requireRole('adapter-goat', 'admin')],
    },
    async (req, reply) => {
      const { approvalReference } = req.params as { approvalReference: string };
      const parsed = ClaimBodySchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({
          status: 'denied',
          reason: 'Request proposal or owner is invalid',
          details: parsed.error.format(),
        });
      }

      const { callerOwnerId, proposal, fingerprint, spendAuthorization } = parsed.data;

      if (callerOwnerId !== spendAuthorization.ownerId) {
        return reply.status(400).send({
          status: 'denied',
          reason: 'Caller owner ID does not match spend authorization owner ID',
        });
      }

      const proposalAmountStr = String(
        (proposal.money as { amount?: string } | undefined)?.amount ?? proposal.amount ?? '0'
      );
      if (BigInt(proposalAmountStr) > BigInt(spendAuthorization.maxAmountWei)) {
        return reply.status(400).send({
          status: 'denied',
          reason: 'Proposal amount exceeds spend ceiling',
        });
      }

      try {
        const result = await withTransaction(async (client) => {
          const aprRes = await client.query('SELECT * FROM approvals WHERE id = $1 FOR UPDATE', [approvalReference]);
          if (aprRes.rows.length === 0) {
            return { ok: false, status: 'denied', reason: 'APPROVAL_NOT_FOUND' };
          }

          const approval = aprRes.rows[0];

          if (approval.consumed_at) {
            return { ok: false, status: 'already_claimed', reason: 'CONSUME_FAILED_HASH_OR_EXPIRED_OR_USED' };
          }

          const now = new Date();
          if (new Date(approval.expires_at).getTime() <= now.getTime()) {
            return { ok: false, status: 'denied', reason: 'APPROVAL_EXPIRED' };
          }

          // Check intent
          const intentRes = await client.query('SELECT * FROM intents WHERE id = $1 FOR UPDATE', [approval.intent_id]);
          if (intentRes.rows.length === 0) {
            return { ok: false, status: 'denied', reason: 'INTENT_NOT_FOUND' };
          }

          const intent = intentRes.rows[0];
          if (!isIntentActive(intent.expiry instanceof Date ? intent.expiry.toISOString() : String(intent.expiry), now)) {
            return { ok: false, status: 'denied', reason: 'INTENT_EXPIRED' };
          }
          if (intent.remaining_uses <= 0) {
            return { ok: false, status: 'denied', reason: 'INTENT_EXHAUSTED' };
          }

          const owner = approval.owner_id ?? intent.owner;
          if (owner !== callerOwnerId) {
            return { ok: false, status: 'denied', reason: 'OWNER_MISMATCH' };
          }

          // Mark approval consumed
          await client.query(
            `UPDATE approvals
             SET consumed_at = NOW(),
                 consumed_platform = 'goat',
                 spend_authorization_id = $2,
                 spend_ceiling = $3
             WHERE id = $1`,
            [approvalReference, spendAuthorization.authorizationId, spendAuthorization.maxAmountWei]
          );

          // Decrement intent remaining uses
          await client.query('UPDATE intents SET remaining_uses = remaining_uses - 1 WHERE id = $1', [intent.id]);

          // Create initial execution record in 'submitting' status
          const existingExec = await client.query('SELECT * FROM executions WHERE execution_id = $1', [approval.execution_id]);
          if (existingExec.rows.length === 0) {
            await client.query(
              `INSERT INTO executions (
                id, execution_id, approval_id, status, platform, owner_id, created_at, updated_at
              ) VALUES (gen_random_uuid()::text, $1, $2, 'submitting', 'goat', $3, NOW(), NOW())`,
              [approval.execution_id, approval.id, callerOwnerId]
            );
          }

          await appendAuditLog(client, {
            eventType: 'GOAT_CLAIM_RECORDED',
            entityType: 'approval',
            entityId: approvalReference,
            callerRole: req.callerRole!,
            payload: {
              executionId: approval.execution_id,
              callerOwnerId,
              spendAuthorizationId: spendAuthorization.authorizationId,
            },
          });

          // Fetch stored proposal payload if available
          const propRes = await client.query('SELECT raw_payload FROM proposals WHERE id = (SELECT proposal_id FROM decisions WHERE id = $1)', [approval.decision_id]);
          const storedProposal = propRes.rows.length > 0 && propRes.rows[0].raw_payload
            ? propRes.rows[0].raw_payload
            : proposal;

          const destination = String(
            (proposal.providerArgs as { recipient?: string } | undefined)?.recipient ??
            proposal.destination ??
            approval.bound_destination ??
            '0x000000000000000000000000000000000000dEaD'
          );

          const sender = approval.bound_sender || intent.sender || '0x0000000000000000000000000000000000000001';

          const binding = {
            platform: 'goat' as const,
            fingerprint,
            ownerId: callerOwnerId,
            intentId: intent.id,
            intentVersion: approval.intent_version ?? intent.intent_version ?? 1,
            sender,
            destination,
            asset: GOAT_NATIVE_ASSET,
            chainId: GOAT_TESTNET_CHAIN_ID,
            amount: proposalAmountStr,
            scale: GOAT_NATIVE_SCALE,
            expiresAt: new Date(approval.expires_at).getTime(),
            spendAuthorizationId: spendAuthorization.authorizationId,
            spendCeilingWei: spendAuthorization.maxAmountWei,
          };

          return {
            ok: true,
            executionId: approval.execution_id,
            proposal: storedProposal,
            binding,
          };
        });

        if (!result.ok) {
          const status = result.status === 'already_claimed' ? 403 : 403;
          return reply.status(status).send({
            version: 1,
            kind: 'claim',
            status: result.status,
            reason: result.reason,
          });
        }

        return reply.status(200).send({
          version: 1,
          kind: 'claim',
          status: 'claimed',
          executionId: result.executionId,
          proposal: result.proposal,
          binding: result.binding,
        });
      } catch (err) {
        req.log.error(err);
        return reply.status(500).send({
          version: 1,
          kind: 'claim',
          status: 'denied',
          reason: 'INTERNAL_ERROR',
        });
      }
    }
  );

  // PUT /v1/goat/executions/:executionId/checkpoint
  fastify.put(
    '/v1/goat/executions/:executionId/checkpoint',
    {
      preHandler: [requireRole('adapter-goat', 'admin')],
    },
    async (req, reply) => {
      const { executionId } = req.params as { executionId: string };
      const parsed = CheckpointBodySchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: 'SCHEMA_INVALID',
          message: 'Invalid checkpoint payload',
          details: parsed.error.format(),
        });
      }

      const { phase, txHash } = parsed.data;

      try {
        const result = await withTransaction(async (client) => {
          const exRes = await client.query('SELECT * FROM executions WHERE execution_id = $1 FOR UPDATE', [executionId]);
          if (exRes.rows.length === 0) {
            // Check if approval exists
            const apRes = await client.query('SELECT * FROM approvals WHERE execution_id = $1', [executionId]);
            if (apRes.rows.length === 0) {
              return { ok: false, error: 'EXECUTION_NOT_FOUND' };
            }
            const approval = apRes.rows[0];
            await client.query(
              `INSERT INTO executions (
                id, execution_id, approval_id, status, platform, tx_hash_or_checkout_ref,
                checkpoint_phase, checkpoint_tx_hash, owner_id, created_at, updated_at
              ) VALUES (gen_random_uuid()::text, $1, $2, 'pending', 'goat', $3, $4, $5, $6, NOW(), NOW())`,
              [executionId, approval.id, txHash, phase, txHash, approval.owner_id ?? null]
            );
          } else {
            await client.query(
              `UPDATE executions
               SET checkpoint_phase = $2,
                   checkpoint_tx_hash = $3,
                   tx_hash_or_checkout_ref = COALESCE(tx_hash_or_checkout_ref, $3),
                   status = CASE WHEN $2 = 'broadcast' AND status = 'submitting' THEN 'pending' ELSE status END,
                   updated_at = NOW()
               WHERE execution_id = $1`,
              [executionId, phase, txHash]
            );
          }

          await appendAuditLog(client, {
            eventType: 'GOAT_CHECKPOINT_RECORDED',
            entityType: 'execution',
            entityId: executionId,
            callerRole: req.callerRole!,
            payload: { phase, txHash },
          });

          return { ok: true };
        });

        if (!result.ok) {
          return reply.status(404).send({ error: result.error });
        }

        return reply.status(200).send({
          version: 1,
          kind: 'checkpoint_ack',
          status: 'persisted',
          executionId,
          phase,
          txHash,
        });
      } catch (err) {
        req.log.error(err);
        return reply.status(500).send({ error: 'INTERNAL_ERROR', message: 'Failed to record checkpoint' });
      }
    }
  );

  // PUT /v1/goat/executions/:executionId/outcome
  fastify.put(
    '/v1/goat/executions/:executionId/outcome',
    {
      preHandler: [requireRole('adapter-goat', 'admin')],
    },
    async (req, reply) => {
      const { executionId } = req.params as { executionId: string };
      const parsed = OutcomeBodySchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: 'SCHEMA_INVALID',
          message: 'Invalid outcome payload',
          details: parsed.error.format(),
        });
      }

      const { status, providerReference, reason, evidence } = parsed.data;

      try {
        const result = await withTransaction(async (client) => {
          const exRes = await client.query('SELECT * FROM executions WHERE execution_id = $1 FOR UPDATE', [executionId]);
          if (exRes.rows.length === 0) {
            const apRes = await client.query('SELECT * FROM approvals WHERE execution_id = $1', [executionId]);
            if (apRes.rows.length === 0) {
              return { ok: false, error: 'EXECUTION_NOT_FOUND' };
            }
            const approval = apRes.rows[0];
            await client.query(
              `INSERT INTO executions (
                id, execution_id, approval_id, status, platform, tx_hash_or_checkout_ref,
                error, evidence, owner_id, created_at, updated_at
              ) VALUES (gen_random_uuid()::text, $1, $2, $3, 'goat', $4, $5, $6, $7, NOW(), NOW())`,
              [executionId, approval.id, normalizeStatus(status), providerReference ?? null, reason ?? null, JSON.stringify(evidence ?? {}), approval.owner_id ?? null]
            );
          } else {
            await client.query(
              `UPDATE executions
               SET status = $2,
                   tx_hash_or_checkout_ref = COALESCE($3, tx_hash_or_checkout_ref),
                   error = $4,
                   evidence = $5,
                   updated_at = NOW()
               WHERE execution_id = $1`,
              [executionId, normalizeStatus(status), providerReference ?? null, reason ?? null, JSON.stringify(evidence ?? {})]
            );
          }

          await appendAuditLog(client, {
            eventType: 'GOAT_OUTCOME_RECORDED',
            entityType: 'execution',
            entityId: executionId,
            callerRole: req.callerRole!,
            payload: { status, providerReference, reason },
          });

          return { ok: true };
        });

        if (!result.ok) {
          return reply.status(404).send({ error: result.error });
        }

        return reply.status(200).send({
          version: 1,
          kind: 'outcome_ack',
          status: 'persisted',
          executionId,
          resultStatus: status,
          providerReference: providerReference ?? null,
        });
      } catch (err) {
        req.log.error(err);
        return reply.status(500).send({ error: 'INTERNAL_ERROR', message: 'Failed to record outcome' });
      }
    }
  );

  // GET /v1/goat/executions/:executionId
  fastify.get(
    '/v1/goat/executions/:executionId',
    {
      preHandler: [requireRole('adapter-goat', 'admin', 'dashboard')],
    },
    async (req, reply) => {
      const { executionId } = req.params as { executionId: string };
      const { ownerId } = req.query as { ownerId?: string };

      if (!ownerId) {
        return reply.status(400).send({ error: 'OWNER_REQUIRED', message: 'ownerId query parameter is required' });
      }

      try {
        const res = await pool.query(
          `SELECT e.*, a.owner_id as approval_owner, a.intent_id, a.intent_version,
                  a.proposal_hash, a.bound_destination, a.bound_sender, a.spend_authorization_id,
                  a.spend_ceiling, a.expires_at as approval_expires_at,
                  i.owner as intent_owner, i.intent_version as intent_intent_version,
                  p.raw_payload as proposal_payload, p.amount as proposal_amount,
                  p.destination as proposal_destination
           FROM executions e
           JOIN approvals a ON e.approval_id = a.id
           LEFT JOIN intents i ON a.intent_id = i.id
           LEFT JOIN decisions d ON a.decision_id = d.id
           LEFT JOIN proposals p ON d.proposal_id = p.id
           WHERE e.execution_id = $1`,
          [executionId]
        );

        if (res.rows.length === 0) {
          return reply.status(404).send({ error: 'EXECUTION_NOT_FOUND', message: 'Execution not found' });
        }

        const row = res.rows[0];
        const owner = row.owner_id ?? row.approval_owner ?? row.intent_owner;
        if (owner !== ownerId) {
          return reply.status(403).send({ error: 'FORBIDDEN', message: 'Execution does not belong to specified owner' });
        }

        const txHash = row.checkpoint_tx_hash || row.tx_hash_or_checkout_ref;
        if (!txHash) {
          return reply.status(404).send({ error: 'NO_CHECKPOINT', message: 'No transaction hash or checkpoint available' });
        }

        const proposal = row.proposal_payload ?? {
          version: 1,
          ownerId,
          intentId: row.intent_id,
          intentVersion: row.intent_version ?? row.intent_intent_version ?? 1,
          platform: 'goat',
          itemId: 'item_1',
          sellerId: 'seller_1',
          money: { amount: String(row.proposal_amount ?? '0'), scale: GOAT_NATIVE_SCALE },
          asset: GOAT_NATIVE_ASSET,
          chain: 'goat-testnet',
          providerArgs: { recipient: row.proposal_destination ?? row.bound_destination },
        };

        const binding = {
          platform: 'goat' as const,
          fingerprint: row.proposal_hash,
          ownerId,
          intentId: row.intent_id,
          intentVersion: row.intent_version ?? row.intent_intent_version ?? 1,
          sender: row.bound_sender || '0x0000000000000000000000000000000000000001',
          destination: row.bound_destination || row.proposal_destination,
          asset: GOAT_NATIVE_ASSET,
          chainId: GOAT_TESTNET_CHAIN_ID,
          amount: String(row.proposal_amount ?? '0'),
          scale: GOAT_NATIVE_SCALE,
          expiresAt: new Date(row.approval_expires_at).getTime(),
          spendAuthorizationId: row.spend_authorization_id || 'auth_1',
          spendCeilingWei: row.spend_ceiling ? row.spend_ceiling.toString() : String(row.proposal_amount ?? '0'),
        };

        return reply.status(200).send({
          version: 1,
          kind: 'reconciliation',
          executionId,
          ownerId,
          proposal,
          binding,
          phase: row.checkpoint_phase ?? 'signed',
          txHash,
        });
      } catch (err) {
        req.log.error(err);
        return reply.status(500).send({ error: 'INTERNAL_ERROR', message: 'Failed to reconcile execution' });
      }
    }
  );
};
