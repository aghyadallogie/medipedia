import { type HealthResponse } from '@medipedia/shared'

import { handler, ok } from '@/server/http'

export const GET = handler(() => {
  const data: HealthResponse['data'] = { status: 'ok' }
  return ok(data, { cache: 'private' })
})
