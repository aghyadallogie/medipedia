/**
 * Loads sample content into the configured database. Safe to re-run. Refuses to run against
 * production.
 *
 *   pnpm seed
 */
import { getPayload } from 'payload'

import { env } from '../env'
import config from '../payload.config'
import { seedSampleContent } from './seed-content'

async function main() {
  if (env.NODE_ENV === 'production' || env.VERCEL_ENV === 'production') {
    throw new Error('Refusing to seed a production environment.')
  }

  const payload = await getPayload({ config })
  const created = await seedSampleContent(payload)

  payload.logger.info(
    created.length > 0
      ? `Seeded ${created.length} items.`
      : 'Nothing to seed: sample content already exists.',
  )
  process.exit(0)
}

// `payload run` imports this file and exits once the import settles, so it must be awaited here.
try {
  await main()
} catch (error) {
  console.error(error)
  process.exit(1)
}
