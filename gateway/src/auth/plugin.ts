import { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import { config } from '../config.js';

export type UserRole = 'agent' | 'adapter-goat' | 'adapter-qatom' | 'dashboard' | 'admin';

declare module 'fastify' {
  interface FastifyRequest {
    callerRole?: UserRole;
  }
}

const keyToRoleMap: Record<string, UserRole> = {
  [config.API_KEY_AGENT]: 'agent',
  [config.API_KEY_ADAPTER_GOAT]: 'adapter-goat',
  [config.API_KEY_ADAPTER_QATOM]: 'adapter-qatom',
  [config.API_KEY_DASHBOARD]: 'dashboard',
  [config.API_KEY_ADMIN]: 'admin',
};

const authPluginAsync: FastifyPluginAsync = async (fastify) => {
  fastify.decorateRequest('callerRole', undefined);

  fastify.addHook('onRequest', async (req: FastifyRequest) => {
    // Check x-api-key or Authorization Bearer header
    const headerKey = req.headers['x-api-key'];
    let apiKey: string | undefined;

    if (typeof headerKey === 'string') {
      apiKey = headerKey;
    } else if (req.headers.authorization?.startsWith('Bearer ')) {
      apiKey = req.headers.authorization.slice(7).trim();
    }

    if (apiKey && keyToRoleMap[apiKey]) {
      req.callerRole = keyToRoleMap[apiKey];
    }
  });
};

export const authPlugin = fp(authPluginAsync, { name: 'authPlugin' });

export function requireRole(...allowedRoles: UserRole[]) {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.callerRole) {
      return reply.status(401).send({ error: 'UNAUTHORIZED', message: 'Missing or invalid API key' });
    }
    if (!allowedRoles.includes(req.callerRole)) {
      return reply.status(403).send({ error: 'FORBIDDEN', message: 'Role not authorized for this resource' });
    }
  };
}
