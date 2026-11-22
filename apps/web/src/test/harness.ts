/**
 * Integration test harness. Starts Payload against a throwaway Postgres schema so tests never
 * touch real tables, and drops the schema afterwards.
 */
import { randomBytes } from 'node:crypto'
import { Client } from 'pg'
import {
  getPayload,
  type CollectionSlug,
  type DataFromCollectionSlug,
  type Payload,
  type RequestContext,
} from 'payload'

import { createConfig } from '@/config'
import { env } from '@/env'
import type { User } from '@/payload-types'

export type Harness = {
  payload: Payload
  /** The config the instance was built from. Hand it to REST route handlers to share the instance. */
  config: ReturnType<typeof createConfig>
  stop: () => Promise<void>
}

async function withClient<T>(fn: (client: Client) => Promise<T>): Promise<T> {
  const client = new Client({ connectionString: env.DATABASE_URL_UNPOOLED })
  await client.connect()
  try {
    return await fn(client)
  } finally {
    await client.end()
  }
}

export async function startHarness(): Promise<Harness> {
  // Lowercase hex only: the name is interpolated into SQL below.
  const schemaName = `itest_${randomBytes(6).toString('hex')}`
  await withClient((client) => client.query(`CREATE SCHEMA "${schemaName}"`))

  try {
    // The default instance key is used on purpose: route handlers such as REST_GET look the
    // instance up by that key, so they share this schema instead of opening another one.
    const config = createConfig({ schemaName, push: true })
    const payload = await getPayload({ config })
    return {
      payload,
      config,
      stop: async () => {
        await payload.destroy()
        await withClient((client) => client.query(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`))
      },
    }
  } catch (error) {
    await withClient((client) => client.query(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`))
    throw error
  }
}

type CreateArgs<C extends CollectionSlug> = {
  collection: C
  data: Record<string, unknown>
  draft?: boolean
  context?: RequestContext
  user?: unknown
  overrideAccess?: boolean
}

/**
 * `payload.create` without TypeScript demanding fields that hooks fill in (slug, domain, role).
 * The data is still validated at runtime, which is what these tests exercise.
 */
export function creator(payload: Payload) {
  return <C extends CollectionSlug>(args: CreateArgs<C>): Promise<DataFromCollectionSlug<C>> =>
    payload.create(args as never) as Promise<DataFromCollectionSlug<C>>
}

/** Local API calls that check access need the user document tagged with its collection. */
export const asUser = (user: User) => ({ ...user, collection: 'users' as const })

export const PASSWORD = 'Correct-horse-battery-9'
