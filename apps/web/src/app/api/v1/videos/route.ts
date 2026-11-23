import { VideoListQuerySchema } from '@medipedia/shared'

import { parseQuery } from '@/server/api-route'
import { handler, okList } from '@/server/http'
import { listVideos } from '@/server/public-queries'

/** Videos, most recently updated first. */
export const GET = handler(async (request: Request) => {
  const page = await listVideos(parseQuery(VideoListQuerySchema, request))
  return okList(page.items, page.nextCursor, { cache: 'public' })
})
