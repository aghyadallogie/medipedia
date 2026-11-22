import { TOKEN_AUDIENCES } from '@medipedia/shared'
import type { CollectionConfig } from 'payload'

import { toOptions } from '@/fields/shared'
import { isAdmin, nobody, nobodyFieldLevel } from '@/server/access'

/**
 * Server-only. Refresh tokens are opaque random values; only their SHA-256 hash is stored.
 * Learners never read or write this through Payload. Phase 4 manages it with the Local API.
 */
export const RefreshTokens: CollectionConfig = {
  slug: 'refresh-tokens',
  labels: { singular: 'Refresh token', plural: 'Refresh tokens' },
  admin: { hidden: true, group: 'System' },
  access: {
    read: isAdmin,
    create: nobody,
    update: nobody,
    delete: isAdmin,
  },
  fields: [
    { name: 'user', type: 'relationship', relationTo: 'users', required: true, index: true },
    {
      name: 'tokenHash',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      // Not even admins read hashes back. Server code uses `overrideAccess`.
      access: { read: nobodyFieldLevel },
    },
    { name: 'audience', type: 'select', required: true, options: toOptions(TOKEN_AUDIENCES) },
    {
      name: 'familyId',
      type: 'text',
      required: true,
      index: true,
      admin: { description: 'Shared by every rotation of one login, for reuse detection.' },
    },
    { name: 'expiresAt', type: 'date', required: true, index: true },
    { name: 'revokedAt', type: 'date' },
    { name: 'deviceLabel', type: 'text' },
  ],
}
