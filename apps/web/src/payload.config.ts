import { postgresAdapter } from '@payloadcms/db-postgres'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import path from 'path'
import { buildConfig } from 'payload'
import sharp from 'sharp'
import { fileURLToPath } from 'url'

import { Users } from './collections/Users'
import { env } from './env'

const dirname = path.dirname(fileURLToPath(import.meta.url))

export default buildConfig({
  admin: {
    user: Users.slug,
    importMap: {
      baseDir: path.resolve(dirname),
    },
    meta: {
      titleSuffix: ' · Medipedia',
    },
  },
  // Payload's REST API lives under /api/cms so it never collides with the App API at /api/v1 (AGENTS.md §6).
  routes: {
    api: '/api/cms',
  },
  graphQL: {
    disable: true,
  },
  collections: [Users],
  editor: lexicalEditor(),
  secret: env.PAYLOAD_SECRET,
  db: postgresAdapter({
    // UUID primary keys. Decided before the first migration; do not change (AGENTS.md §4).
    idType: 'uuid',
    pool: {
      connectionString: env.PAYLOAD_MIGRATING ? env.DATABASE_URL_UNPOOLED : env.DATABASE_URL,
    },
    migrationDir: path.resolve(dirname, 'migrations'),
  }),
  sharp,
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  telemetry: false,
})
