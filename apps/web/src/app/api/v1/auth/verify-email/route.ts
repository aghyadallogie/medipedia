import { VerifyEmailBodySchema } from '@medipedia/shared'

import { ackResponse, readJson } from '@/server/auth/http'
import { verifyEmail } from '@/server/auth/service'
import { handler } from '@/server/http'
import { getClient } from '@/server/payload'
import { limitByIp, RATE_RULES } from '@/server/rate-limit'

/** Confirms an email address with the token from the link in the confirmation email. */
export const POST = handler(async (request: Request) => {
  await limitByIp(request, RATE_RULES.verifyEmail)
  const body = await readJson(request, VerifyEmailBodySchema)
  await verifyEmail(await getClient(), body.token)
  return ackResponse()
})
