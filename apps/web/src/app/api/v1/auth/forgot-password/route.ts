import { ForgotPasswordBodySchema } from '@medipedia/shared'

import { ackResponse, readJson } from '@/server/auth/http'
import { requestPasswordReset } from '@/server/auth/service'
import { handler } from '@/server/http'
import { getClient } from '@/server/payload'
import { limitByEmail, limitByIp, RATE_RULES } from '@/server/rate-limit'

/** Emails a reset link when the address has an account. The answer is always the same. */
export const POST = handler(async (request: Request) => {
  await limitByIp(request, RATE_RULES.forgotPassword)
  const body = await readJson(request, ForgotPasswordBodySchema)
  await limitByEmail(body.email, RATE_RULES.forgotPasswordEmail)
  await requestPasswordReset(await getClient(), body.email)
  return ackResponse({ status: 202 })
})
