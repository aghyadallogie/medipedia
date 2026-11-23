/**
 * Cookie helpers for the web session (AGENTS.md §5, Transport). Small and dependency-free so
 * they are easy to test. Both session cookies are httpOnly and SameSite=Lax, and Secure whenever
 * the site is served over https. The refresh cookie is scoped to the auth endpoints, so the
 * long-lived credential is not sent with every page and API request.
 */
import { AUTH_COOKIES, TOKEN_TTL_SECONDS } from '@medipedia/shared'

export type CookieOptions = {
  path: string
  httpOnly: boolean
  secure: boolean
  sameSite: 'Lax' | 'Strict' | 'None'
  /** Seconds. 0 expires the cookie now. */
  maxAge?: number
}

export function serializeCookie(name: string, value: string, options: CookieOptions): string {
  const parts = [`${name}=${encodeURIComponent(value)}`, `Path=${options.path}`]
  if (options.maxAge !== undefined) {
    parts.push(`Max-Age=${Math.max(0, Math.floor(options.maxAge))}`)
    if (options.maxAge <= 0) parts.push('Expires=Thu, 01 Jan 1970 00:00:00 GMT')
  }
  if (options.httpOnly) parts.push('HttpOnly')
  if (options.secure) parts.push('Secure')
  parts.push(`SameSite=${options.sameSite}`)
  return parts.join('; ')
}

/** `Cookie: a=1; b=2` -> `{ a: '1', b: '2' }`. Malformed pairs are ignored. */
export function parseCookies(header: string | null | undefined): Record<string, string> {
  const cookies: Record<string, string> = {}
  if (!header) return cookies
  for (const pair of header.split(';')) {
    const index = pair.indexOf('=')
    if (index === -1) continue
    const name = pair.slice(0, index).trim()
    if (name === '' || name in cookies) continue
    const raw = pair.slice(index + 1).trim()
    try {
      cookies[name] = decodeURIComponent(raw)
    } catch {
      cookies[name] = raw
    }
  }
  return cookies
}

/** The token from `Authorization: Bearer <token>`, or null. */
export function readBearerToken(headers: Headers): string | null {
  const header = headers.get('authorization')
  if (!header) return null
  const [scheme, token, ...rest] = header.trim().split(/\s+/)
  if (scheme?.toLowerCase() !== 'bearer' || !token || rest.length > 0) return null
  return token
}

type SessionCookieArgs = {
  accessToken: string
  /** Omit to refresh only the access cookie (the concurrent-refresh grace path). */
  refreshToken?: string
  secure: boolean
}

/** `Set-Cookie` values that sign a browser in. */
export function sessionCookies({ accessToken, refreshToken, secure }: SessionCookieArgs): string[] {
  const cookies = [
    serializeCookie(AUTH_COOKIES.access, accessToken, {
      path: '/',
      httpOnly: true,
      secure,
      sameSite: 'Lax',
      maxAge: TOKEN_TTL_SECONDS.access,
    }),
  ]
  if (refreshToken !== undefined) {
    cookies.push(
      serializeCookie(AUTH_COOKIES.refresh, refreshToken, {
        path: AUTH_COOKIES.refreshPath,
        httpOnly: true,
        secure,
        sameSite: 'Lax',
        maxAge: TOKEN_TTL_SECONDS.refreshWeb,
      }),
      // Set with the refresh cookie and living as long. Page scripts can read it, so it carries
      // no secret: it only says "someone signed in here".
      serializeCookie(AUTH_COOKIES.hint, '1', {
        path: '/',
        httpOnly: false,
        secure,
        sameSite: 'Lax',
        maxAge: TOKEN_TTL_SECONDS.refreshWeb,
      }),
    )
  }
  return cookies
}

/** `Set-Cookie` values that sign a browser out. */
export function clearSessionCookies(secure: boolean): string[] {
  return [
    serializeCookie(AUTH_COOKIES.access, '', {
      path: '/',
      httpOnly: true,
      secure,
      sameSite: 'Lax',
      maxAge: 0,
    }),
    serializeCookie(AUTH_COOKIES.refresh, '', {
      path: AUTH_COOKIES.refreshPath,
      httpOnly: true,
      secure,
      sameSite: 'Lax',
      maxAge: 0,
    }),
    serializeCookie(AUTH_COOKIES.hint, '', {
      path: '/',
      httpOnly: false,
      secure,
      sameSite: 'Lax',
      maxAge: 0,
    }),
  ]
}
