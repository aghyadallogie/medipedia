import { notFound, type RouteContext } from '@/server/api-route'
import { requireUser } from '@/server/auth/session'
import { handler, ok } from '@/server/http'
import { getQuestion } from '@/server/questions/bank'

/**
 * One question, WITHOUT its answer key. Signed-in learners only, never cached publicly
 * (AGENTS.md §7). The verdict and explanations come from `POST /questions/:id/answer`.
 */
export const GET = handler(async (request: Request, { params }: RouteContext<{ id: string }>) => {
  const user = await requireUser(request)
  const question = await getQuestion(user, (await params).id)
  if (!question) throw notFound('Question')
  return ok(question, { cache: 'private' })
})
