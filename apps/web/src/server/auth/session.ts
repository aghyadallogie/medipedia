/**
 * Who is calling? Resolves the access token (Bearer header or `access_token` cookie) to a user
 * through Payload's `auth`, which runs the strategy from ./strategy.ts. Used by /api/v1 route
 * handlers and by server components.
 */
import type { User } from '@/payload-types'
import { getClient } from '@/server/payload'

import { unauthorized } from './http'

/** The signed-in learner or admin, or null. Never throws for a bad or expired token. */
export async function authenticateHeaders(headers: Headers): Promise<User | null> {
  const payload = await getClient()
  const { user } = await payload.auth({ headers })
  if (!user || user.collection !== 'users') return null
  return user as User
}

export const authenticateRequest = (request: Request) => authenticateHeaders(request.headers)

/** For routes that need a signed-in user: a missing or invalid token is a 401. */
export async function requireUser(request: Request): Promise<User> {
  const user = await authenticateRequest(request)
  if (!user) throw unauthorized()
  return user
}
