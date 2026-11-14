import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: process.env.TEST_SUITE === 'integration'
      ? ['test/**/*.integration.test.ts', 'test/{audit,consume,db,e2e,executions,intents,verify}.test.ts']
      : ['test/**/*.test.ts'],
    exclude: process.env.TEST_SUITE === 'integration' ? [] : ['test/**/*.integration.test.ts', 'test/{audit,consume,db,e2e,executions,intents,verify}.test.ts'],
    testTimeout: 10000,
    fileParallelism: false,
  },
});
