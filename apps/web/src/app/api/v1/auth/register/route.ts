import { RegisterBodySchema } from '@medipedia/shared'

import { ackResponse, readJson } from '@/server/auth/http'
import { registerAccount } from '@/server/auth/service'
import { handler } from '@/server/http'
import { getClient } from '@/server/payload'
import { limitByEmail, limitByIp, RATE_RULES } from '@/server/rate-limit'

/**
 * Creates an account and emails a confirmation link. The answer is the same whether or not the
 * address was already registered, so this cannot be used to find out who has an account.
 */
export const POST = handler(async (request: Request) => {
  await limitByIp(request, RATE_RULES.register)
  const body = await readJson(request, RegisterBodySchema)
  await limitByEmail(body.email, RATE_RULES.registerEmail)
  await registerAccount(await getClient(), body)
  return ackResponse({ status: 202 })
})
