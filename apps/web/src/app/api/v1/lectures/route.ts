import { LectureListQuerySchema } from '@medipedia/shared'

import { parseQuery } from '@/server/api-route'
import { handler, okList } from '@/server/http'
import { listLectures } from '@/server/public-queries'

/** Lecture summaries (no body), most recently updated first. */
export const GET = handler(async (request: Request) => {
  const page = await listLectures(parseQuery(LectureListQuerySchema, request))
  return okList(page.items, page.nextCursor, { cache: 'public' })
})
