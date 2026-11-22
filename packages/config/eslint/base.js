// Shared ESLint rules for every workspace. Framework configs (Next.js) layer on top.
import js from '@eslint/js'
import tseslint from 'typescript-eslint'

/** Files allowed to read process.env directly (AGENTS.md §10). */
export const envFiles = ['**/src/env.ts']

/**
 * Project rules only, with no plugin registration. Use this on top of a config that already
 * registers the typescript-eslint plugin (e.g. eslint-config-next/typescript).
 */
export const sharedRules = [
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': ['error', { fixStyle: 'inline-type-imports' }],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
      'no-restricted-properties': [
        'error',
        {
          object: 'process',
          property: 'env',
          message: 'Read environment variables through src/env.ts only (AGENTS.md §10).',
        },
      ],
    },
  },
  {
    files: envFiles,
    rules: { 'no-restricted-properties': 'off' },
  },
]

/** Full config for plain TypeScript packages. */
export const baseConfig = [js.configs.recommended, ...tseslint.configs.recommended, ...sharedRules]

export default baseConfig
