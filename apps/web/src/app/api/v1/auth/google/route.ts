import { serializeCookie } from '@/server/auth/cookies'
import {
  buildAuthorizationUrl,
  encodeFlowState,
  GOOGLE_COOKIE,
  GOOGLE_COOKIE_PATH,
  GOOGLE_COOKIE_TTL_SECONDS,
  newFlowState,
  requireGoogleConfig,
  safeReturnTo,
} from '@/server/auth/google'
import { isSecureSite, withCookies } from '@/server/auth/http'
import { CACHE_CONTROL, handler } from '@/server/http'

/**
 * Starts "Sign in with Google": remembers the PKCE verifier, `state` and `nonce` in a short-lived
 * httpOnly cookie and sends the browser to Google. `?returnTo=/path` says where to land afterwards.
 */
export const GET = handler(async (request: Request) => {
  const config = requireGoogleConfig()
  const returnTo = safeReturnTo(new URL(request.url).searchParams.get('returnTo'))
  const flow = newFlowState(returnTo)

  const response = new Response(null, {
    status: 302,
    headers: {
      Location: buildAuthorizationUrl(config, flow),
      'Cache-Control': CACHE_CONTROL.private,
    },
  })
  return withCookies(response, [
    serializeCookie(GOOGLE_COOKIE, encodeFlowState(flow), {
      path: GOOGLE_COOKIE_PATH,
      httpOnly: true,
      secure: isSecureSite(),
      // Lax, not Strict: the cookie must come back on the redirect from accounts.google.com.
      sameSite: 'Lax',
      maxAge: GOOGLE_COOKIE_TTL_SECONDS,
    }),
  ])
})
