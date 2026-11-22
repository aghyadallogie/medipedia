import { baseConfig } from '@medipedia/config/eslint/base'

export default [
  ...baseConfig,
  {
    rules: {
      // packages/shared must stay framework-free (AGENTS.md §3).
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['next', 'next/*'], message: 'packages/shared must not depend on Next.js.' },
            {
              group: ['payload', 'payload/*', '@payloadcms/*'],
              message: 'packages/shared must not depend on Payload.',
            },
          ],
        },
      ],
    },
  },
]
