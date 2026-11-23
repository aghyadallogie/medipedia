import { baseConfig } from '@medipedia/config/eslint/base'

export default [
  ...baseConfig,
  {
    rules: {
      // The client is shared with the mobile app: it depends on packages/shared and fetch only.
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['next', 'next/*'], message: 'api-client must not depend on Next.js.' },
            {
              group: ['payload', 'payload/*', '@payloadcms/*'],
              message: 'api-client must not depend on Payload.',
            },
            { group: ['react', 'react-dom', 'react/*'], message: 'api-client must stay UI-free.' },
          ],
        },
      ],
    },
  },
]
