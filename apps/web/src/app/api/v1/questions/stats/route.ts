import { requireUser } from '@/server/auth/session'
import { handler, ok } from '@/server/http'
import { getQuestionStats } from '@/server/public-queries'

/**
 * How many published questions there are per domain and topic: counts, never question content.
 * Signed-in learners only, like the rest of the content API (AGENTS.md §15).
 */
export const GET = handler(async (request: Request) => {
  await requireUser(request)
  return ok(await getQuestionStats(), { cache: 'private' })
})
