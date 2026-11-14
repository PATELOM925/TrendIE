import tseslint from 'typescript-eslint';

export default tseslint.config(...tseslint.configs.recommended, {
  ignores: ['**/dist/**', '**/node_modules/**', '**/.next/**', 'apps/web/next-env.d.ts', 'gateway/**'],
}, {
  rules: {
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/no-non-null-assertion': 'error',
  },
});
