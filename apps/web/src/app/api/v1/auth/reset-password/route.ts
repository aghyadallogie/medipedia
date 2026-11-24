import { ResetPasswordBodySchema } from '@medipedia/shared'

import { ackResponse, readJson, signedOutCookies } from '@/server/auth/http'
import { resetPassword } from '@/server/auth/service'
import { handler } from '@/server/http'
import { getClient } from '@/server/payload'
import { limitByIp, RATE_RULES } from '@/server/rate-limit'

/** Sets a new password from an emailed token and signs the account out everywhere. */
export const POST = handler(async (request: Request) => {
  await limitByIp(request, RATE_RULES.resetPassword)
  const body = await readJson(request, ResetPasswordBodySchema)
  await resetPassword(await getClient(), body)
  return ackResponse({ cookies: signedOutCookies() })
})
