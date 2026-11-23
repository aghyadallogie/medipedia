import { ForgotPasswordBodySchema } from '@medipedia/shared'

import { ackResponse, readJson } from '@/server/auth/http'
import { requestPasswordReset } from '@/server/auth/service'
import { handler } from '@/server/http'
import { getClient } from '@/server/payload'

/** Emails a reset link when the address has an account. The answer is always the same. */
export const POST = handler(async (request: Request) => {
  const body = await readJson(request, ForgotPasswordBodySchema)
  await requestPasswordReset(await getClient(), body.email)
  return ackResponse({ status: 202 })
})
