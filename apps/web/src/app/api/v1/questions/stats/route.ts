import { handler, ok } from '@/server/http'
import { getQuestionStats } from '@/server/public-queries'

/**
 * How many published questions there are per domain and topic. This is the only part of the
 * question bank that is public: counts, never question content (AGENTS.md §6).
 */
export const GET = handler(async () => {
  return ok(await getQuestionStats(), { cache: 'public' })
})
