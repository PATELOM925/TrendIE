import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { Config, config as defaultConfig } from './config.js';
import { authPlugin } from './auth/plugin.js';
import { intentRoutes } from './routes/intents.js';
import { verifyRoutes } from './routes/verify.js';

export async function buildServer(appConfig: Config = defaultConfig): Promise<FastifyInstance> {
  const app = Fastify({
    logger: appConfig.NODE_ENV === 'test' ? false : true,
  });

  await app.register(cors, {
    origin: true,
  });

  await app.register(authPlugin);

  app.get('/health', async () => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });

  await app.register(intentRoutes);
  await app.register(verifyRoutes);

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
