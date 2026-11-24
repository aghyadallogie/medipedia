import { RefreshBodySchema, AUTH_COOKIES } from '@medipedia/shared'

import { parseCookies } from '@/server/auth/cookies'
import { safeReturnTo } from '@/server/auth/google'
import {
  readOptionalJson,
  refreshResponse,
  signedOutCookies,
  withCookies,
} from '@/server/auth/http'
import { refreshSession } from '@/server/auth/service'
import { ApiError, CACHE_CONTROL, errorResponse, handler } from '@/server/http'
import { getClient } from '@/server/payload'
import { limitByIp, RATE_RULES } from '@/server/rate-limit'

/**
 * Exchanges a refresh token for a new access token and a new refresh token. Mobile sends the token
 * in the body; the web sends its httpOnly cookie (scoped to this path) and gets cookies back.
 */
export const POST = handler(async (request: Request) => {
  await limitByIp(request, RATE_RULES.refresh)
  const body = await readOptionalJson(request, RefreshBodySchema)
  const audience = body.refreshToken ? 'mobile' : 'web'
  const raw = body.refreshToken ?? parseCookies(request.headers.get('cookie'))[AUTH_COOKIES.refresh]
  if (!raw) throw new ApiError('unauthorized', 'Sign in to continue.', { reason: 'invalid_token' })

  try {
    return refreshResponse(await refreshSession(await getClient(), raw, audience), audience)
  } catch (error) {
    // A browser whose refresh failed holds dead cookies: clear them so it stops sending them.
    if (audience === 'web' && error instanceof ApiError && error.code === 'unauthorized') {
      return withCookies(errorResponse(error), signedOutCookies())
    }
    throw error
  }
})

/**
 * Refreshing for page navigations. The refresh cookie only travels to /api/v1/auth, so a page
 * request (/account) cannot use it. `proxy.ts` sends visitors without a valid access token here
 * with `?next=/account`; this rotates the cookies and sends the browser on, or to the sign-in
 * page when there is nothing to refresh. The destination must be a path on this site.
 */
export async function GET(request: Request): Promise<Response> {
  const next = safeReturnTo(new URL(request.url).searchParams.get('next'), '/')
  const redirect = (location: string, cookies: readonly string[] = []) =>
    withCookies(
      new Response(null, {
        status: 303,
        headers: { Location: location, 'Cache-Control': CACHE_CONTROL.private },
      }),
      cookies,
    )
  const signIn = `/sign-in?next=${encodeURIComponent(next)}`

  const raw = parseCookies(request.headers.get('cookie'))[AUTH_COOKIES.refresh]
  if (!raw) return redirect(signIn)

  try {
    await limitByIp(request, RATE_RULES.refresh)
    const session = await refreshSession(await getClient(), raw, 'web')
    const { headers } = refreshResponse(session, 'web')
    return redirect(next, headers.getSetCookie())
  } catch (error) {
    if (error instanceof ApiError && error.code === 'unauthorized') {
      return redirect(signIn, signedOutCookies())
    }
    // Too many renewals. This is a page navigation, so land on the sign-in page, keeping the cookies.
    if (error instanceof ApiError && error.code === 'rate_limited') return redirect(signIn)
    console.error('Session refresh failed', error)
    return redirect(signIn)
  }
}
