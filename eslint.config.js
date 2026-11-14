import tseslint from 'typescript-eslint';

export default tseslint.config(...tseslint.configs.recommended, {
  ignores: ['**/dist/**', '**/node_modules/**'],
}, {
  rules: {
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/no-non-null-assertion': 'error',
  },
});
