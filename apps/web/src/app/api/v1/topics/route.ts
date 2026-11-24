import { TopicListQuerySchema } from '@medipedia/shared'

import { parseQuery } from '@/server/api-route'
import { requireUser } from '@/server/auth/session'
import { handler, okList } from '@/server/http'
import { listTopics } from '@/server/public-queries'

/** Topics, optionally for one domain. Bounded and small, so `nextCursor` is always null. */
export const GET = handler(async (request: Request) => {
  await requireUser(request)
  const query = parseQuery(TopicListQuerySchema, request)
  return okList(await listTopics(query), null, { cache: 'private' })
})
