import { ResetPasswordBodySchema } from '@medipedia/shared'

import { ackResponse, readJson, signedOutCookies } from '@/server/auth/http'
import { resetPassword } from '@/server/auth/service'
import { handler } from '@/server/http'
import { getClient } from '@/server/payload'

/** Sets a new password from an emailed token and signs the account out everywhere. */
export const POST = handler(async (request: Request) => {
  const body = await readJson(request, ResetPasswordBodySchema)
  await resetPassword(await getClient(), body)
  return ackResponse({ cookies: signedOutCookies() })
})
