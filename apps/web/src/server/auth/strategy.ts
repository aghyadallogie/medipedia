import { AUTH_COOKIES } from '@medipedia/shared'
import type { AuthStrategy } from 'payload'

import { parseCookies, readBearerToken } from './cookies'
import { verifyAccessToken } from './tokens'

export const ACCESS_TOKEN_STRATEGY = 'medipedia-access-token'

/**
 * Teaches Payload to recognise our access tokens (AGENTS.md §5). With this registered on the
 * Users collection, `payload.auth({ headers })` and every Payload access function see the same
 * `req.user` that our route handlers do.
 *
 * The token is read from `Authorization: Bearer` (mobile, and API clients) or the `access_token`
 * cookie (web). The user is then loaded fresh, so deleting an account or changing its role takes
 * effect immediately. Anything that does not check out returns no user: Payload then tries its own
 * strategies and finally treats the request as anonymous.
 */
export function createAccessTokenStrategy(getSecret: () => string): AuthStrategy {
  return {
    name: ACCESS_TOKEN_STRATEGY,
    authenticate: async ({ headers, payload }) => {
      const token =
        readBearerToken(headers) ?? parseCookies(headers.get('cookie'))[AUTH_COOKIES.access]
      if (!token) return { user: null }

      const claims = await verifyAccessToken(getSecret(), token)
      if (!claims) return { user: null }

      const user = await payload.findByID({
        collection: 'users',
        id: claims.userId,
        depth: 0,
        overrideAccess: true,
        disableErrors: true,
      })
      if (!user) return { user: null }

      return { user: { ...user, collection: 'users', _strategy: ACCESS_TOKEN_STRATEGY } }
    },
  }
}
