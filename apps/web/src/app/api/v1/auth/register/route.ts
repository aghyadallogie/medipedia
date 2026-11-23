import { RegisterBodySchema } from '@medipedia/shared'

import { ackResponse, readJson } from '@/server/auth/http'
import { registerAccount } from '@/server/auth/service'
import { handler } from '@/server/http'
import { getClient } from '@/server/payload'

/**
 * Creates an account and emails a confirmation link. The answer is the same whether or not the
 * address was already registered, so this cannot be used to find out who has an account.
 */
export const POST = handler(async (request: Request) => {
  const body = await readJson(request, RegisterBodySchema)
  await registerAccount(await getClient(), body)
  return ackResponse({ status: 202 })
})
