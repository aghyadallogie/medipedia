import { LoginBodySchema } from '@medipedia/shared'

import { audienceFor, readJson, sessionResponse } from '@/server/auth/http'
import { loginWithPassword, startSession } from '@/server/auth/service'
import { handler } from '@/server/http'
import { getClient } from '@/server/payload'
import { limitByIp, RATE_RULES } from '@/server/rate-limit'

/** Email and password sign-in. Web gets cookies; `client: 'mobile'` gets tokens in the body. */
export const POST = handler(async (request: Request) => {
  await limitByIp(request, RATE_RULES.login)
  const body = await readJson(request, LoginBodySchema)
  const payload = await getClient()
  const user = await loginWithPassword(payload, { email: body.email, password: body.password })
  const audience = audienceFor(body.client)
  const session = await startSession(payload, user, { audience, deviceLabel: body.deviceLabel })
  return sessionResponse(user, session, audience)
})
