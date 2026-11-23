/**
 * Learner access tokens (AGENTS.md §5): short-lived JWTs we sign ourselves with `jose`.
 * HS256, `JWT_SECRET`, 15 minutes. They only prove who the caller is; the role in the token is
 * informational, and every request re-reads the user, so a deleted or demoted account loses
 * access at once instead of when the token expires.
 */
import {
  TOKEN_AUDIENCES,
  TOKEN_TTL_SECONDS,
  TokenAudienceSchema,
  UserRoleSchema,
  type TokenAudience,
  type UserRole,
} from '@medipedia/shared'
import { jwtVerify, SignJWT } from 'jose'

export const TOKEN_ISSUER = 'medipedia'

export type AccessClaims = {
  userId: string
  role: UserRole
  audience: TokenAudience
}

const MIN_SECRET_LENGTH = 32

function signingKey(secret: string): Uint8Array {
  if (secret.length < MIN_SECRET_LENGTH) {
    throw new Error(`The token secret must be at least ${MIN_SECRET_LENGTH} characters`)
  }
  return new TextEncoder().encode(secret)
}

export async function signAccessToken(
  secret: string,
  claims: AccessClaims,
  now: Date = new Date(),
): Promise<{ token: string; expiresIn: number }> {
  const issuedAt = Math.floor(now.getTime() / 1000)
  const token = await new SignJWT({ role: claims.role })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(claims.userId)
    .setIssuer(TOKEN_ISSUER)
    .setAudience(claims.audience)
    .setIssuedAt(issuedAt)
    .setExpirationTime(issuedAt + TOKEN_TTL_SECONDS.access)
    .sign(signingKey(secret))
  return { token, expiresIn: TOKEN_TTL_SECONDS.access }
}

/**
 * Returns the claims of a valid, unexpired token, or null for anything else: a bad signature,
 * another algorithm (including `none`), a wrong issuer or audience, an expired token, or a
 * token with missing or malformed claims. Never throws, so callers cannot leak the reason.
 */
export async function verifyAccessToken(
  secret: string,
  token: string,
  now: Date = new Date(),
): Promise<AccessClaims | null> {
  try {
    const { payload } = await jwtVerify(token, signingKey(secret), {
      algorithms: ['HS256'],
      issuer: TOKEN_ISSUER,
      audience: [...TOKEN_AUDIENCES],
      requiredClaims: ['sub', 'exp', 'iat'],
      currentDate: now,
    })

    const role = UserRoleSchema.safeParse(payload.role)
    const audience = TokenAudienceSchema.safeParse(payload.aud)
    if (
      !role.success ||
      !audience.success ||
      typeof payload.sub !== 'string' ||
      payload.sub === ''
    ) {
      return null
    }
    return { userId: payload.sub, role: role.data, audience: audience.data }
  } catch {
    return null
  }
}
