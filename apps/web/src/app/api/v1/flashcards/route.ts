import { FlashcardListQuerySchema } from '@medipedia/shared'

import { parseQuery } from '@/server/api-route'
import { requireUser } from '@/server/auth/session'
import { handler, okList } from '@/server/http'
import { listFlashcards } from '@/server/public-queries'

/**
 * Flashcards, oldest first. `?client=mobile` omits `back`: the app reveals it per card from
 * `GET /flashcards/:id/back`. Every card carries a stable `id` and `updatedAt`, because
 * review state on the device is keyed by `id` (AGENTS.md §9).
 */
export const GET = handler(async (request: Request) => {
  await requireUser(request)
  const { client, ...query } = parseQuery(FlashcardListQuerySchema, request)
  const page = await listFlashcards({ ...query, includeBack: client !== 'mobile' })
  return okList(page.items, page.nextCursor, { cache: 'private' })
})
