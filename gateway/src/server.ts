import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { Config, config as defaultConfig, parseCorsOrigins } from './config.js';
import { authPlugin } from './auth/plugin.js';
import { intentRoutes } from './routes/intents.js';
import { verifyRoutes } from './routes/verify.js';
import { approvalRoutes } from './routes/approvals.js';
import { executionRoutes } from './routes/executions.js';
import { auditRoutes } from './routes/audit.js';
import { reviewRoutes } from './routes/reviews.js';

export async function buildServer(appConfig: Config = defaultConfig): Promise<FastifyInstance> {
  const app = Fastify({
    logger: appConfig.NODE_ENV === 'test' ? false : true,
  });

  app.setErrorHandler((error, req, reply) => {
    req.log.error(error);
    const statusCode = error instanceof Error && 'statusCode' in error ? error.statusCode : undefined;
    const code = typeof statusCode === 'number' && statusCode >= 400 && statusCode < 500 ? statusCode : 500;
    return reply.status(code).send({ error: code === 500 ? 'INTERNAL_ERROR' : 'REQUEST_REJECTED', message: code === 500 ? 'Request could not be completed' : 'Request was rejected' });
  });

  await app.register(cors, {
    origin: parseCorsOrigins(appConfig.CORS_ORIGINS),
  });

  await app.register(authPlugin);

  app.get('/health', async () => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });

  await app.register(intentRoutes);
  await app.register(verifyRoutes);
  await app.register(approvalRoutes);
  await app.register(executionRoutes);
  await app.register(auditRoutes);
  await app.register(reviewRoutes);

  return app;
}

if (process.env.NODE_ENV !== 'test' && !process.env.VITEST) {
  const server = await buildServer();
  try {
    await server.listen({ port: defaultConfig.PORT, host: defaultConfig.HOST });
    server.log.info(`Security Gateway running at http://${defaultConfig.HOST}:${defaultConfig.PORT}`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
}
