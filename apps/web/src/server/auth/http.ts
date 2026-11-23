/**
 * Request and response plumbing shared by the /api/v1/auth routes and /api/v1/me.
 */
import type { ClientKind, TokenAudience, User as UserDto } from '@medipedia/shared'
import type { z } from 'zod'

import { publicEnv } from '@/env'
import type { User } from '@/payload-types'
import { ApiError, ok } from '@/server/http'

import { clearSessionCookies, sessionCookies } from './cookies'
import type { RefreshedSession, StartedSession } from './service'

/** Cookies are only marked Secure when the site is served over https. */
export const isSecureSite = (): boolean =>
  new URL(publicEnv.NEXT_PUBLIC_SITE_URL).protocol === 'https:'

export function toUserDto(user: User): UserDto {
  return {
    id: user.id,
    email: user.email,
    name: user.name ?? null,
    role: user.role,
    provider: user.provider,
    emailVerified: user._verified === true,
    createdAt: user.createdAt,
  }
}

/** Adds `Set-Cookie` headers to a response. `Response.json` results have mutable headers. */
export function withCookies(response: Response, cookies: readonly string[]): Response {
  for (const cookie of cookies) response.headers.append('Set-Cookie', cookie)
  return response
}

const MAX_BODY_BYTES = 16 * 1024

/**
 * CSRF defence for cookie-authenticated requests (AGENTS.md §5). Browsers always attach these
 * headers to cross-site requests, and scripts cannot forge them. A request from another site is
 * refused. Requests with neither header (the mobile app, curl, server-side calls) pass: they do
 * not carry ambient cookies, so there is nothing to forge.
 */
export function assertSameOrigin(request: Request): void {
  const fetchSite = request.headers.get('sec-fetch-site')
  if (fetchSite === 'cross-site')
    throw new ApiError('forbidden', 'Cross-site requests are not allowed.')

  const origin = request.headers.get('origin')
  if (origin !== null && origin !== new URL(request.url).origin) {
    throw new ApiError('forbidden', 'Cross-site requests are not allowed.')
  }
}

function assertJson(request: Request): void {
  const type = request.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase()
  if (type !== 'application/json') {
    // A cross-site form can post text/plain without a CORS preflight. Requiring JSON closes that.
    throw new ApiError('validation_error', 'Send the request body as application/json.')
  }
}

async function readBody(request: Request): Promise<string> {
  const declared = Number(request.headers.get('content-length') ?? '0')
  if (declared > MAX_BODY_BYTES)
    throw new ApiError('validation_error', 'The request body is too large.')
  const text = await request.text()
  if (text.length > MAX_BODY_BYTES)
    throw new ApiError('validation_error', 'The request body is too large.')
  return text
}

/** Parses a required JSON body with a shared schema. A ZodError becomes a 400. */
export async function readJson<S extends z.ZodType>(
  request: Request,
  schema: S,
): Promise<z.infer<S>> {
  assertSameOrigin(request)
  assertJson(request)
  const text = await readBody(request)
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch {
    throw new ApiError('validation_error', 'The request body is not valid JSON.')
  }
  return schema.parse(value)
}

/**
 * Like `readJson`, for endpoints whose body is optional (the web sends its token in a cookie).
 * An empty body is treated as `{}`.
 */
export async function readOptionalJson<S extends z.ZodType>(
  request: Request,
  schema: S,
): Promise<z.infer<S>> {
  assertSameOrigin(request)
  const text = await readBody(request)
  if (text.trim() === '') return schema.parse({})
  assertJson(request)
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch {
    throw new ApiError('validation_error', 'The request body is not valid JSON.')
  }
  return schema.parse(value)
}

export const unauthorized = (message = 'Sign in to continue.') =>
  new ApiError('unauthorized', message)

// ---------- session responses ----------

export const audienceFor = (client: ClientKind): TokenAudience =>
  client === 'mobile' ? 'mobile' : 'web'

/**
 * The response for a new sign-in. Web: httpOnly cookies and no tokens in the body. Mobile: the
 * tokens in the body (there are no cookies to rely on).
 */
export function sessionResponse(
  user: User,
  session: StartedSession,
  audience: TokenAudience,
  status = 200,
): Response {
  if (audience === 'mobile') {
    return ok(
      {
        user: toUserDto(user),
        tokens: {
          accessToken: session.accessToken,
          refreshToken: session.refresh.token,
          tokenType: 'Bearer' as const,
          expiresIn: session.expiresIn,
        },
      },
      { cache: 'private', status },
    )
  }
  return withCookies(
    ok({ user: toUserDto(user) }, { cache: 'private', status }),
    sessionCookies({
      accessToken: session.accessToken,
      refreshToken: session.refresh.token,
      secure: isSecureSite(),
    }),
  )
}

/** The response for a token refresh. A duplicate refresh returns an access token only. */
export function refreshResponse(session: RefreshedSession, audience: TokenAudience): Response {
  const user = toUserDto(session.user)
  if (audience === 'mobile') {
    return ok(
      {
        user,
        tokens: {
          accessToken: session.accessToken,
          ...(session.refresh ? { refreshToken: session.refresh.token } : {}),
          tokenType: 'Bearer' as const,
          expiresIn: session.expiresIn,
        },
      },
      { cache: 'private' },
    )
  }
  return withCookies(
    ok({ user }, { cache: 'private' }),
    sessionCookies({
      accessToken: session.accessToken,
      ...(session.refresh ? { refreshToken: session.refresh.token } : {}),
      secure: isSecureSite(),
    }),
  )
}

export const ackResponse = (
  options: { cookies?: readonly string[]; status?: number } = {},
): Response =>
  withCookies(
    ok({ ok: true as const }, { cache: 'private', status: options.status }),
    options.cookies ?? [],
  )

export const signedOutCookies = (): string[] => clearSessionCookies(isSecureSite())
