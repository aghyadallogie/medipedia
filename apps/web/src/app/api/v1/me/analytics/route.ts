import { requireUser } from '@/server/auth/session'
import { handler, ok } from '@/server/http'
import { getAnalytics } from '@/server/questions/analytics'

/** The signed-in learner's accuracy by domain, from first attempts only. */
export const GET = handler(async (request: Request) => {
  return ok(await getAnalytics(await requireUser(request)), { cache: 'private' })
})
