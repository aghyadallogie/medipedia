import { NextQuestionQuerySchema } from '@medipedia/shared'

import { parseQuery } from '@/server/api-route'
import { requireUser } from '@/server/auth/session'
import { handler, ok } from '@/server/http'
import { nextQuestion } from '@/server/questions/bank'

/** A question for tutor mode, chosen at random from what matches the filters. No answer key. */
export const GET = handler(async (request: Request) => {
  const user = await requireUser(request)
  return ok(await nextQuestion(user, parseQuery(NextQuestionQuerySchema, request)), {
    cache: 'private',
  })
})
