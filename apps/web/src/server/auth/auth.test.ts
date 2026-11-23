import { SignJWT } from 'jose'
import type { Payload } from 'payload'
import { describe, expect, it, vi } from 'vitest'

import {
  classifyRefreshToken,
  generateRefreshToken,
  hashRefreshToken,
  REFRESH_REUSE_GRACE_SECONDS,
  type TokenState,
} from './refresh-tokens'
import {
  clearSessionCookies,
  parseCookies,
  readBearerToken,
  serializeCookie,
  sessionCookies,
} from './cookies'
import { escapeHtml, resetPasswordHtml, verifyEmailHtml } from './emails'
import { ACCESS_TOKEN_STRATEGY, createAccessTokenStrategy } from './strategy'
import { signAccessToken, TOKEN_ISSUER, verifyAccessToken } from './tokens'

const SECRET = 'unit-test-secret-that-is-at-least-32-chars'
const OTHER_SECRET = 'a-different-secret-that-is-also-32-chars!'
const USER_ID = '00000000-0000-4000-8000-000000000001'

describe('access tokens', () => {
  it('round-trips the claims', async () => {
    const { token, expiresIn } = await signAccessToken(SECRET, {
      userId: USER_ID,
      role: 'learner',
      audience: 'web',
    })
    expect(expiresIn).toBe(900)
    expect(await verifyAccessToken(SECRET, token)).toEqual({
      userId: USER_ID,
      role: 'learner',
      audience: 'web',
    })
  })

  it('expires after 15 minutes', async () => {
    const issued = new Date('2026-01-01T12:00:00Z')
    const { token } = await signAccessToken(
      SECRET,
      { userId: USER_ID, role: 'learner', audience: 'mobile' },
      issued,
    )
    expect(await verifyAccessToken(SECRET, token, new Date('2026-01-01T12:14:59Z'))).not.toBeNull()
    expect(await verifyAccessToken(SECRET, token, new Date('2026-01-01T12:15:01Z'))).toBeNull()
  })

  it('rejects a token signed with another secret and a tampered payload', async () => {
    const { token } = await signAccessToken(OTHER_SECRET, {
      userId: USER_ID,
      role: 'learner',
      audience: 'web',
    })
    expect(await verifyAccessToken(SECRET, token)).toBeNull()

    const { token: good } = await signAccessToken(SECRET, {
      userId: USER_ID,
      role: 'learner',
      audience: 'web',
    })
    const [header, , signature] = good.split('.')
    const forged = Buffer.from(
      JSON.stringify({
        sub: USER_ID,
        role: 'admin',
        aud: 'web',
        iss: TOKEN_ISSUER,
        iat: 1,
        exp: 9999999999,
      }),
    ).toString('base64url')
    expect(await verifyAccessToken(SECRET, `${header}.${forged}.${signature}`)).toBeNull()
  })

  it('rejects alg=none and any other algorithm', async () => {
    const none = [
      Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url'),
      Buffer.from(
        JSON.stringify({
          sub: USER_ID,
          role: 'admin',
          aud: 'web',
          iss: TOKEN_ISSUER,
          exp: 9999999999,
          iat: 1,
        }),
      ).toString('base64url'),
      '',
    ].join('.')
    expect(await verifyAccessToken(SECRET, none)).toBeNull()

    const hs512 = await new SignJWT({ role: 'learner' })
      .setProtectedHeader({ alg: 'HS512' })
      .setSubject(USER_ID)
      .setIssuer(TOKEN_ISSUER)
      .setAudience('web')
      .setIssuedAt()
      .setExpirationTime('15m')
      .sign(new TextEncoder().encode(SECRET))
    expect(await verifyAccessToken(SECRET, hs512)).toBeNull()
  })

  it('rejects the wrong issuer, wrong audience, bad role and missing subject', async () => {
    const make = (build: (jwt: SignJWT) => SignJWT) =>
      build(
        new SignJWT({ role: 'learner' })
          .setProtectedHeader({ alg: 'HS256' })
          .setSubject(USER_ID)
          .setIssuer(TOKEN_ISSUER)
          .setAudience('web')
          .setIssuedAt()
          .setExpirationTime('15m'),
      ).sign(new TextEncoder().encode(SECRET))

    expect(await verifyAccessToken(SECRET, await make((j) => j))).not.toBeNull()
    expect(
      await verifyAccessToken(SECRET, await make((j) => j.setIssuer('someone-else'))),
    ).toBeNull()
    expect(
      await verifyAccessToken(SECRET, await make((j) => j.setAudience('admin-panel'))),
    ).toBeNull()
    expect(await verifyAccessToken(SECRET, await make((j) => j.setSubject('')))).toBeNull()
    const badRole = await new SignJWT({ role: 'superuser' })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(USER_ID)
      .setIssuer(TOKEN_ISSUER)
      .setAudience('web')
      .setIssuedAt()
      .setExpirationTime('15m')
      .sign(new TextEncoder().encode(SECRET))
    expect(await verifyAccessToken(SECRET, badRole)).toBeNull()
  })

  it.each(['', 'garbage', 'a.b.c', 'a.b', '....'])(
    'returns null for %j without throwing',
    async (value) => {
      expect(await verifyAccessToken(SECRET, value)).toBeNull()
    },
  )

  it('refuses to sign or verify with a short secret', async () => {
    await expect(
      signAccessToken('short', { userId: USER_ID, role: 'learner', audience: 'web' }),
    ).rejects.toThrow(/at least 32/)
    expect(await verifyAccessToken('short', 'a.b.c')).toBeNull()
  })
})

describe('cookies', () => {
  it('serializes with the security attributes', () => {
    const cookie = serializeCookie('access_token', 'a b/c', {
      path: '/',
      httpOnly: true,
      secure: true,
      sameSite: 'Lax',
      maxAge: 900,
    })
    expect(cookie).toBe(
      'access_token=a%20b%2Fc; Path=/; Max-Age=900; HttpOnly; Secure; SameSite=Lax',
    )
  })

  it('omits Secure when the site is not https', () => {
    expect(
      serializeCookie('x', 'y', { path: '/', httpOnly: true, secure: false, sameSite: 'Lax' }),
    ).not.toContain('Secure')
  })

  it('builds the web session cookies: access on /, refresh only on the auth path', () => {
    const [access, refresh, hint] = sessionCookies({
      accessToken: 'AT',
      refreshToken: 'RT',
      secure: true,
    })
    expect(access).toContain('access_token=AT')
    expect(access).toContain('Path=/;')
    expect(access).toContain('Max-Age=900')
    expect(refresh).toContain('refresh_token=RT')
    expect(refresh).toContain('Path=/api/v1/auth')
    expect(refresh).toContain('Max-Age=604800')
    for (const cookie of [access, refresh]) {
      expect(cookie).toContain('HttpOnly')
      expect(cookie).toContain('Secure')
      expect(cookie).toContain('SameSite=Lax')
    }
    // The hint is readable by scripts on purpose and holds no secret.
    expect(hint).toMatch(/^signed_in=1; Path=\/; Max-Age=604800/)
    expect(hint).not.toContain('HttpOnly')
  })

  it('can refresh only the access cookie', () => {
    expect(sessionCookies({ accessToken: 'AT', secure: false })).toHaveLength(1)
  })

  it('clears both cookies on the same paths they were set on', () => {
    const [access, refresh, hint] = clearSessionCookies(true)
    expect(access).toMatch(/^access_token=; Path=\/; Max-Age=0; Expires=/)
    expect(refresh).toMatch(/^refresh_token=; Path=\/api\/v1\/auth; Max-Age=0; Expires=/)
    expect(hint).toMatch(/^signed_in=; Path=\/; Max-Age=0; Expires=/)
  })

  it('parses a Cookie header and survives malformed input', () => {
    expect(parseCookies('a=1; b=hello%20world; c=%E0%A4%A; =x; nothing')).toEqual({
      a: '1',
      b: 'hello world',
      c: '%E0%A4%A',
    })
    expect(parseCookies(null)).toEqual({})
    expect(parseCookies('a=1; a=2')).toEqual({ a: '1' })
  })

  it('reads a bearer token and nothing else', () => {
    const h = (value: string) => new Headers({ authorization: value })
    expect(readBearerToken(h('Bearer abc'))).toBe('abc')
    expect(readBearerToken(h('bearer abc'))).toBe('abc')
    expect(readBearerToken(h('Basic abc'))).toBeNull()
    expect(readBearerToken(h('Bearer'))).toBeNull()
    expect(readBearerToken(h('Bearer a b'))).toBeNull()
    expect(readBearerToken(new Headers())).toBeNull()
  })
})

describe('refresh token primitives', () => {
  it('generates long, unique, URL-safe tokens', () => {
    const a = generateRefreshToken()
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(generateRefreshToken()).not.toBe(a)
  })

  it('hashes with SHA-256 so the raw value is never stored', () => {
    expect(hashRefreshToken('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    )
  })
})

describe('classifyRefreshToken', () => {
  const now = new Date('2026-06-01T12:00:00Z')
  const future = '2026-06-08T12:00:00.000Z'
  const live: TokenState = { audience: 'web', expiresAt: future, revokedAt: null, rotatedAt: null }
  const secondsAgo = (n: number) => new Date(now.getTime() - n * 1000).toISOString()

  it('accepts a live token for its own audience', () => {
    expect(classifyRefreshToken(live, 'web', now)).toBe('ok')
  })

  it('treats unknown, expired and wrong-audience tokens as invalid (and nothing more)', () => {
    expect(classifyRefreshToken(null, 'web', now)).toBe('invalid')
    expect(classifyRefreshToken(live, 'mobile', now)).toBe('invalid')
    expect(classifyRefreshToken({ ...live, expiresAt: secondsAgo(1) }, 'web', now)).toBe('invalid')
    // Even a revoked token for the wrong audience is merely invalid: guessing cannot burn a session.
    expect(
      classifyRefreshToken(
        { ...live, revokedAt: secondsAgo(1), rotatedAt: secondsAgo(1) },
        'mobile',
        now,
      ),
    ).toBe('invalid')
  })

  it('allows a token rotated moments ago (concurrent refresh) and no longer', () => {
    const rotated = (age: number): TokenState => ({
      ...live,
      revokedAt: secondsAgo(age),
      rotatedAt: secondsAgo(age),
    })
    expect(classifyRefreshToken(rotated(0), 'web', now)).toBe('grace')
    expect(classifyRefreshToken(rotated(REFRESH_REUSE_GRACE_SECONDS), 'web', now)).toBe('grace')
    expect(classifyRefreshToken(rotated(REFRESH_REUSE_GRACE_SECONDS + 1), 'web', now)).toBe('reuse')
  })

  it('treats a token revoked by sign-out (no rotation) as reuse, never as grace', () => {
    expect(
      classifyRefreshToken({ ...live, revokedAt: secondsAgo(1), rotatedAt: null }, 'web', now),
    ).toBe('reuse')
  })

  it('ignores a rotation timestamp in the future', () => {
    const odd: TokenState = {
      ...live,
      revokedAt: secondsAgo(5),
      rotatedAt: new Date(now.getTime() + 60_000).toISOString(),
    }
    expect(classifyRefreshToken(odd, 'web', now)).toBe('reuse')
  })
})

describe('Payload access-token strategy', () => {
  const strategy = createAccessTokenStrategy(() => SECRET)

  const run = async (headers: Headers, findByID = vi.fn()) => {
    const payload = { findByID } as unknown as Payload
    const result = await strategy.authenticate({ headers, payload })
    return { result, findByID }
  }

  it('is registered under a stable name', () => {
    expect(strategy.name).toBe(ACCESS_TOKEN_STRATEGY)
  })

  it('authenticates a Bearer token and loads the user fresh', async () => {
    const { token } = await signAccessToken(SECRET, {
      userId: USER_ID,
      role: 'learner',
      audience: 'mobile',
    })
    const findByID = vi.fn().mockResolvedValue({ id: USER_ID, email: 'a@b.co', role: 'learner' })
    const { result } = await run(new Headers({ authorization: `Bearer ${token}` }), findByID)
    expect(result.user).toMatchObject({
      id: USER_ID,
      collection: 'users',
      _strategy: ACCESS_TOKEN_STRATEGY,
    })
    expect(findByID).toHaveBeenCalledWith(
      expect.objectContaining({ collection: 'users', id: USER_ID, disableErrors: true }),
    )
  })

  it('authenticates the access_token cookie', async () => {
    const { token } = await signAccessToken(SECRET, {
      userId: USER_ID,
      role: 'learner',
      audience: 'web',
    })
    const findByID = vi.fn().mockResolvedValue({ id: USER_ID })
    const { result } = await run(
      new Headers({ cookie: `theme=dark; access_token=${token}` }),
      findByID,
    )
    expect(result.user?.id).toBe(USER_ID)
  })

  it('prefers the Authorization header over the cookie', async () => {
    const { token: header } = await signAccessToken(SECRET, {
      userId: USER_ID,
      role: 'learner',
      audience: 'mobile',
    })
    const findByID = vi.fn().mockResolvedValue({ id: USER_ID })
    await run(
      new Headers({ authorization: `Bearer ${header}`, cookie: 'access_token=junk' }),
      findByID,
    )
    expect(findByID).toHaveBeenCalledTimes(1)
  })

  it('returns no user, and never queries the database, for missing or invalid tokens', async () => {
    const findByID = vi.fn()
    for (const headers of [
      new Headers(),
      new Headers({ authorization: 'Bearer garbage' }),
      new Headers({ cookie: 'access_token=garbage' }),
    ]) {
      expect((await run(headers, findByID)).result.user).toBeNull()
    }
    expect(findByID).not.toHaveBeenCalled()
  })

  it('returns no user when the account no longer exists', async () => {
    const { token } = await signAccessToken(SECRET, {
      userId: USER_ID,
      role: 'learner',
      audience: 'web',
    })
    const findByID = vi.fn().mockResolvedValue(null)
    expect(
      (await run(new Headers({ authorization: `Bearer ${token}` }), findByID)).result.user,
    ).toBeNull()
  })
})

describe('emails', () => {
  it('escapes HTML', () => {
    expect(escapeHtml(`<script>alert("x") & 'y'</script>`)).toBe(
      '&lt;script&gt;alert(&quot;x&quot;) &amp; &#39;y&#39;&lt;/script&gt;',
    )
  })

  it('verification email links to our own page with the token', () => {
    const html = verifyEmailHtml({ token: 'abc123def456abc123def456', user: { name: 'Ada' } })
    expect(html).toContain('http://localhost:3000/verify-email?token=abc123def456abc123def456')
    expect(html).toContain('Hi Ada,')
    expect(html).not.toContain('/admin')
  })

  it('sends a plain welcome, with no link, to accounts that are already verified', () => {
    const html = verifyEmailHtml({ token: 'abc123def456abc123def456', user: { _verified: true } })
    expect(html).not.toContain('verify-email')
    expect(html).toContain('Your account is ready')
    expect(verifyEmailHtml({ token: undefined, user: {} })).not.toContain('verify-email')
  })

  it('escapes a hostile name', () => {
    expect(
      verifyEmailHtml({
        token: 'abc123def456abc123def456',
        user: { name: '<img src=x onerror=alert(1)>' },
      }),
    ).not.toContain('<img')
  })

  it('reset email links to the reset page and states the expiry', () => {
    const html = resetPasswordHtml({ token: 'reset-token-0123456789', user: {} })
    expect(html).toContain('http://localhost:3000/reset-password?token=reset-token-0123456789')
    expect(html).toContain('one hour')
  })
})
