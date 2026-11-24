import { LectureListQuerySchema } from '@medipedia/shared'

import { parseQuery } from '@/server/api-route'
import { requireUser } from '@/server/auth/session'
import { handler, okList } from '@/server/http'
import { listLectures } from '@/server/public-queries'

/** Lecture summaries (no body), most recently updated first. */
export const GET = handler(async (request: Request) => {
  await requireUser(request)
  const page = await listLectures(parseQuery(LectureListQuerySchema, request))
  return okList(page.items, page.nextCursor, { cache: 'private' })
})
