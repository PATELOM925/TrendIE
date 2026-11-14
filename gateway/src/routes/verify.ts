import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import {
  PurchaseProposalSchema,
  InspectionResultSchema,
  proposalHash,
  Intent,
  VerificationDecision,
} from '../schemas/index.js';
import { withTransaction } from '../db/client.js';
import { requireRole } from '../auth/plugin.js';
import { verifyPolicy } from '../policy/verify.js';
import { appendAuditLog } from '../audit/hashChain.js';
import { createApprovalId, createExecutionId, generateHmacSignature } from '../approvals/token.js';
import { config } from '../config.js';

const VerifyBodySchema = z
  .object({
    proposal: PurchaseProposalSchema,
    inspection: InspectionResultSchema.optional(),
  })
  .strict();

export const verifyRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /verify (agent role)
  fastify.post(
    '/verify',
    {
      preHandler: [requireRole('agent', 'admin')],
    },
    async (req, reply) => {
      const parseResult = VerifyBodySchema.safeParse(req.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          error: 'SCHEMA_INVALID',
          message: 'Invalid proposal or inspection payload',
          details: parseResult.error.format(),
        });
      }

      const { proposal, inspection } = parseResult.data;
      const pHash = proposalHash(proposal);
      const decisionId = `dec_${randomUUID().replace(/-/g, '')}`;
      const now = new Date();

      return await withTransaction(async (client) => {
        // 1. Fetch intent
        const intentRes = await client.query('SELECT * FROM intents WHERE id = $1', [proposal.intentId]);
        let intent: Intent | null = null;
        if (intentRes.rows.length > 0) {
          const row = intentRes.rows[0];
          intent = {
            id: row.id,
            owner: row.owner,
            seller: row.seller,
            product: row.product,
            maxAmount: row.max_amount.toString(),
            currency: row.currency,
            allowedDestinations: row.allowed_destinations,
            expiry: row.expiry.toISOString(),
            remainingUses: row.remaining_uses,
            createdAt: row.created_at.toISOString(),
          };
        }

        // 2. Run deterministic policy engine
        const evaluation = verifyPolicy(intent, proposal, inspection, now);

        // 3. Persist proposal
        const propId = `prop_${randomUUID().replace(/-/g, '')}`;
        await client.query(
          `INSERT INTO proposals (
            id, intent_id, proposal_hash, seller, product, amount, currency, destination, source_ref, raw_payload
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [
            propId,
            intent ? intent.id : null,
            pHash,
            proposal.seller,
            proposal.product,
            proposal.amount,
            proposal.currency,
            proposal.destination,
            proposal.sourceRef,
            JSON.stringify(proposal),
          ]
        );

        // 4. Persist inspection if present
        if (inspection) {
          const inspId = `insp_${randomUUID().replace(/-/g, '')}`;
          await client.query(
            `INSERT INTO inspections (
              id, proposal_id, source, flags, evidence, findings
            ) VALUES ($1, $2, $3, $4, $5, $6)`,
            [
              inspId,
              propId,
              inspection.source,
              JSON.stringify(inspection.flags),
              JSON.stringify(inspection.evidence),
              JSON.stringify(inspection.findings),
            ]
          );
        }

        let authorizationRef: string | null = null;

        // 5. Persist decision row first (before approvals which reference it)
        await client.query(
          `INSERT INTO decisions (
            id, proposal_id, proposal_hash, decision, reason_codes, authorization_ref
          ) VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            decisionId,
            propId,
            pHash,
            evaluation.decision,
            JSON.stringify(evaluation.reasonCodes),
            null,
          ]
        );

        // 6. If approved, issue single-use Approval row and update decision authorization_ref
        if (evaluation.decision === 'approve' && intent) {
          const approvalId = createApprovalId();
          const executionId = createExecutionId();
          const expiresAt = new Date(now.getTime() + config.APPROVAL_TTL_SECONDS * 1000).toISOString();
          const hmac = generateHmacSignature({
            approvalId,
            executionId,
            proposalHash: pHash,
            intentId: intent.id,
            expiresAt,
          });

          await client.query(
            `INSERT INTO approvals (
              id, decision_id, intent_id, proposal_hash, execution_id, hmac_signature, key_id, expires_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [
              approvalId,
              decisionId,
              intent.id,
              pHash,
              executionId,
              hmac,
              config.APPROVAL_KEY_ID,
              expiresAt,
            ]
          );

          await client.query(
            'UPDATE decisions SET authorization_ref = $1 WHERE id = $2',
            [approvalId, decisionId]
          );

          authorizationRef = approvalId;
        }

        // 7. Write audit log
        await appendAuditLog(client, {
          eventType: 'PROPOSAL_VERIFIED',
          entityType: 'decision',
          entityId: decisionId,
          callerRole: req.callerRole!,
          payload: {
            proposalHash: pHash,
            decision: evaluation.decision,
            reasonCodes: evaluation.reasonCodes,
            authorizationRef,
          },
        });

        const verificationDecision: VerificationDecision = {
          id: decisionId,
          proposalHash: pHash,
          decision: evaluation.decision,
          reasonCodes: evaluation.reasonCodes,
          timestamp: now.toISOString(),
          authorizationRef,
        };

        return reply.status(200).send(verificationDecision);
      });
    }
  );
};
