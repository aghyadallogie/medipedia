import { AUTH_COOKIES, LogoutBodySchema } from '@medipedia/shared'

import { parseCookies } from '@/server/auth/cookies'
import { ackResponse, readOptionalJson, signedOutCookies } from '@/server/auth/http'
import { endSession } from '@/server/auth/service'
import { handler } from '@/server/http'
import { getClient } from '@/server/payload'

/** Signs this device out: revokes its refresh-token family and clears the web cookies. */
export const POST = handler(async (request: Request) => {
  const body = await readOptionalJson(request, LogoutBodySchema)
  const raw = body.refreshToken ?? parseCookies(request.headers.get('cookie'))[AUTH_COOKIES.refresh]
  await endSession(await getClient(), raw)
  return ackResponse({ cookies: signedOutCookies() })
})
