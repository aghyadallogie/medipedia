import { postgresAdapter } from '@payloadcms/db-postgres'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { vercelBlobStorage } from '@payloadcms/storage-vercel-blob'
import path from 'path'
import { buildConfig } from 'payload'
import sharp from 'sharp'
import { fileURLToPath } from 'url'

import { AnswerEvents } from './collections/AnswerEvents'
import { Domains } from './collections/Domains'
import { Flashcards } from './collections/Flashcards'
import { Lectures } from './collections/Lectures'
import { Media } from './collections/Media'
import { Papers } from './collections/Papers'
import { Questions } from './collections/Questions'
import { RefreshTokens } from './collections/RefreshTokens'
import { Topics } from './collections/Topics'
import { Users } from './collections/Users'
import { Videos } from './collections/Videos'
import { env } from './env'

const dirname = path.dirname(fileURLToPath(import.meta.url))

export type ConfigOptions = {
  /** Postgres schema to use instead of `public`. Integration tests isolate themselves with this. */
  schemaName?: string
  /** Let Payload alter the database to match the config. Off for real databases: use migrations. */
  push?: boolean
}

/** Single place the Payload config is assembled, so tests can build it against another schema. */
export function createConfig({ schemaName, push = false }: ConfigOptions = {}) {
  return buildConfig({
    admin: {
      user: Users.slug,
      importMap: { baseDir: path.resolve(dirname) },
      meta: { titleSuffix: ' · Medipedia' },
    },
    // Payload's REST API lives under /api/cms so it never collides with the App API at /api/v1 (AGENTS.md §6).
    routes: { api: '/api/cms' },
    graphQL: { disable: true },
    collections: [
      Lectures,
      Flashcards,
      Questions,
      Papers,
      Videos,
      Media,
      Domains,
      Topics,
      Users,
      AnswerEvents,
      RefreshTokens,
    ],
    editor: lexicalEditor(),
    secret: env.PAYLOAD_SECRET,
    db: postgresAdapter({
      // UUID primary keys. Decided before the first migration; do not change (AGENTS.md §4).
      idType: 'uuid',
      push,
      schemaName,
      pool: {
        connectionString: env.PAYLOAD_MIGRATING ? env.DATABASE_URL_UNPOOLED : env.DATABASE_URL,
      },
      migrationDir: path.resolve(dirname, 'migrations'),
    }),
    // Vercel's request body limit is 4.5 MB, so uploads larger than this would fail anyway.
    upload: { limits: { fileSize: 4_000_000 } },
    plugins: [
      // Without a token (local development) uploads stay on disk under apps/web/media.
      vercelBlobStorage({
        enabled: env.BLOB_READ_WRITE_TOKEN !== undefined,
        collections: { media: true },
        token: env.BLOB_READ_WRITE_TOKEN ?? '',
      }),
    ],
    sharp,
    typescript: { outputFile: path.resolve(dirname, 'payload-types.ts') },
    telemetry: false,
  })
}
