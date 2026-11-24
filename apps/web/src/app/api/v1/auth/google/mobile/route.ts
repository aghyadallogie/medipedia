import { GoogleMobileBodySchema } from '@medipedia/shared'

import { requireGoogleConfig, verifyGoogleIdToken } from '@/server/auth/google'
import { readJson, sessionResponse } from '@/server/auth/http'
import { signInWithGoogle, startSession } from '@/server/auth/service'
import { ApiError, handler } from '@/server/http'
import { getClient } from '@/server/payload'
import { limitByIp, RATE_RULES } from '@/server/rate-limit'

/**
 * The native apps sign in with Google themselves and send the ID token here. It is verified the
 * same way as on the web (signature, issuer, expiry, verified email), against the web client ID
 * and the native client IDs in `GOOGLE_MOBILE_CLIENT_IDS`. Returns tokens in the body.
 */
export const POST = handler(async (request: Request) => {
  await limitByIp(request, RATE_RULES.google)
  const body = await readJson(request, GoogleMobileBodySchema)
  const config = requireGoogleConfig()

  const identity = await verifyGoogleIdToken(body.idToken, {
    audiences: [config.clientId, ...config.mobileClientIds],
  })
  if (!identity) {
    throw new ApiError('unauthorized', 'Google sign-in failed. Try again.', {
      reason: 'invalid_token',
    })
  }

  const payload = await getClient()
  const user = await signInWithGoogle(payload, identity)
  const session = await startSession(payload, user, {
    audience: 'mobile',
    deviceLabel: body.deviceLabel,
  })
  return sessionResponse(user, session, 'mobile')
})
