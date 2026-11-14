import { FastifyPluginAsync } from 'fastify';
import { pool } from '../db/client.js';
import { requireRole } from '../auth/plugin.js';

export const auditRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /audit?intentId= (dashboard/admin only)
  fastify.get(
    '/audit',
    {
      preHandler: [requireRole('dashboard', 'admin')],
    },
    async (req, reply) => {
      const { intentId } = req.query as { intentId?: string };

      if (intentId) {
        // Find audit entries related to this intent or its decisions/approvals
        const res = await pool.query(
          `SELECT * FROM audit_log
           WHERE (entity_type = 'intent' AND entity_id = $1)
              OR (payload->>'intentId' = $1)
           ORDER BY id ASC`,
          [intentId]
        );
        return reply.status(200).send(res.rows);
      }

      const res = await pool.query('SELECT * FROM audit_log ORDER BY id ASC LIMIT 100');
      return reply.status(200).send(res.rows);
    }
  );

  // GET /decisions/:id (dashboard/admin only)
  fastify.get(
    '/decisions/:id',
    {
      preHandler: [requireRole('dashboard', 'admin')],
    },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      const res = await pool.query('SELECT * FROM decisions WHERE id = $1', [id]);

      if (res.rows.length === 0) {
        return reply.status(404).send({ error: 'DECISION_NOT_FOUND', message: 'Decision not found' });
      }

      const row = res.rows[0];
      return reply.status(200).send({
        id: row.id,
        proposalId: row.proposal_id,
        proposalHash: row.proposal_hash,
        decision: row.decision,
        reasonCodes: row.reason_codes,
        authorizationRef: row.authorization_ref,
        timestamp: row.created_at.toISOString(),
      });
    }
  );
};
