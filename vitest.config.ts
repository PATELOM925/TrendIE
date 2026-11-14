import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@trendie/contracts': fileURLToPath(new URL('./packages/contracts/src/index.ts', import.meta.url)),
      '@trendie/inspection': fileURLToPath(new URL('./packages/inspection/src/index.ts', import.meta.url)),
    },
  },
  test: {
    include: ['packages/**/*.test.ts', 'services/**/*.test.mjs'],
    testTimeout: 5_000,
  },
});
