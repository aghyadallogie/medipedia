import { SubmitAnswerBodySchema } from '@medipedia/shared'

import type { RouteContext } from '@/server/api-route'
import { readJson } from '@/server/auth/http'
import { requireUser } from '@/server/auth/session'
import { handler, ok } from '@/server/http'
import { submitAnswer } from '@/server/questions/bank'
import { enforceRateLimit, RATE_RULES } from '@/server/rate-limit'

/** Records the learner's answer and returns the verdict with every explanation. */
export const POST = handler(async (request: Request, { params }: RouteContext<{ id: string }>) => {
  const user = await requireUser(request)
  await enforceRateLimit(RATE_RULES.answer, user.id)
  const body = await readJson(request, SubmitAnswerBodySchema)
  return ok(await submitAnswer(user, (await params).id, body.selectedLabel), { cache: 'private' })
})
