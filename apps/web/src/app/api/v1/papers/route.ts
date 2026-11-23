import { PaperListQuerySchema } from '@medipedia/shared'

import { parseQuery } from '@/server/api-route'
import { handler, okList } from '@/server/http'
import { listPapers } from '@/server/public-queries'

/** Paper summaries (no abstract or spark notes), alphabetical by title. */
export const GET = handler(async (request: Request) => {
  const page = await listPapers(parseQuery(PaperListQuerySchema, request))
  return okList(page.items, page.nextCursor, { cache: 'public' })
})
