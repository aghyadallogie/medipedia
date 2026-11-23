import { parseCookies, serializeCookie } from '@/server/auth/cookies'
import {
  decodeFlowState,
  exchangeCodeForIdToken,
  GOOGLE_COOKIE,
  GOOGLE_COOKIE_PATH,
  requireGoogleConfig,
  safeEqual,
  safeReturnTo,
  verifyGoogleIdToken,
} from '@/server/auth/google'
import { audienceFor, isSecureSite, sessionResponse, withCookies } from '@/server/auth/http'
import { signInWithGoogle, startSession } from '@/server/auth/service'
import { ApiError, CACHE_CONTROL } from '@/server/http'
import { getClient } from '@/server/payload'

/** Back to the sign-in page with a reason it can show. Never reveals more than that. */
function failure(reason: string, cookies: string[]): Response {
  return withCookies(
    new Response(null, {
      status: 302,
      headers: {
        Location: `/sign-in?error=${reason}`,
        'Cache-Control': CACHE_CONTROL.private,
      },
    }),
    cookies,
  )
}

/**
 * Where Google sends the browser back to. Checks `state` against the cookie from the first leg,
 * trades the code for an ID token, verifies it, and signs the user in. Every failure ends on the
 * sign-in page: this is a browser navigation, so it must never answer with raw JSON.
 */
export async function GET(request: Request): Promise<Response> {
  const clearFlowCookie = serializeCookie(GOOGLE_COOKIE, '', {
    path: GOOGLE_COOKIE_PATH,
    httpOnly: true,
    secure: isSecureSite(),
    sameSite: 'Lax',
    maxAge: 0,
  })

  try {
    const config = requireGoogleConfig()
    const params = new URL(request.url).searchParams
    const flow = decodeFlowState(parseCookies(request.headers.get('cookie'))[GOOGLE_COOKIE])

    // The person closed the consent screen, or Google refused: nothing to do but go back.
    if (params.get('error')) return failure('google_cancelled', [clearFlowCookie])

    const state = params.get('state')
    const code = params.get('code')
    // `state` ties this request to the browser that started the flow (login CSRF defence).
    if (!flow || !state || !code || !safeEqual(state, flow.state)) {
      return failure('google', [clearFlowCookie])
    }

    const idToken = await exchangeCodeForIdToken(config, { code, codeVerifier: flow.codeVerifier })
    const identity = await verifyGoogleIdToken(idToken, {
      audiences: [config.clientId],
      nonce: flow.nonce,
    })
    if (!identity) return failure('google', [clearFlowCookie])

    const payload = await getClient()
    const user = await signInWithGoogle(payload, identity)
    const session = await startSession(payload, user, { audience: audienceFor('web') })

    // Reuse the cookie-setting response for the session, then turn it into a redirect.
    const signedIn = sessionResponse(user, session, 'web')
    const response = new Response(null, {
      status: 302,
      headers: { Location: safeReturnTo(flow.returnTo), 'Cache-Control': CACHE_CONTROL.private },
    })
    return withCookies(response, [...signedIn.headers.getSetCookie(), clearFlowCookie])
  } catch (error) {
    if (error instanceof ApiError && error.code === 'not_found') {
      return failure('google_unavailable', [clearFlowCookie])
    }
    console.error('Google sign-in failed', error)
    return failure('google', [clearFlowCookie])
  }
}
