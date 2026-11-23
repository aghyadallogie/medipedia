/**
 * Sign in with Google, end to end against a real database. Google itself is replaced: ID tokens
 * are signed with a key pair made here, and the token endpoint is a mock that records what it
 * was sent.
 */
import { createHash } from 'node:crypto'

import { AUTH_COOKIES } from '@medipedia/shared'
import { generateKeyPair, SignJWT, type CryptoKey } from 'jose'
import type { Payload } from 'payload'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('next/cache', () => ({ revalidateTag: vi.fn(), unstable_cache: (fn: unknown) => fn }))

import { GET as callbackGET } from '@/app/api/v1/auth/google/callback/route'
import { POST as mobilePOST } from '@/app/api/v1/auth/google/mobile/route'
import { GET as googleGET } from '@/app/api/v1/auth/google/route'
import { POST as loginPOST } from '@/app/api/v1/auth/login/route'
import { POST as refreshPOST } from '@/app/api/v1/auth/refresh/route'
import { DELETE as meDELETE, GET as meGET } from '@/app/api/v1/me/route'
import { googleDeps } from '@/server/auth/google'
import { issueRefreshToken } from '@/server/auth/refresh-tokens'

import { creator, PASSWORD, startHarness, type Harness } from './harness'

const ORIGIN = 'http://localhost:3000'
const WEB_CLIENT_ID = 'web-client.apps.googleusercontent.com'
const ANDROID_CLIENT_ID = 'android-client.apps.googleusercontent.com'

let harness: Harness
let payload: Payload
let create: ReturnType<typeof creator>
let privateKey: CryptoKey
let otherPrivateKey: CryptoKey

let counter = 0
const email = (prefix = 'g') => `${prefix}-${++counter}@example.com`

type Claims = {
  sub?: string
  email?: string
  email_verified?: boolean | string
  name?: string
  aud?: string
  iss?: string
  nonce?: string
  expiresIn?: string
  key?: CryptoKey
}

async function idToken(claims: Claims) {
  const {
    sub = `sub-${++counter}`,
    expiresIn = '10m',
    key = privateKey,
    aud = WEB_CLIENT_ID,
  } = claims
  return new SignJWT({
    email: claims.email,
    email_verified: claims.email_verified ?? true,
    name: claims.name,
    nonce: claims.nonce,
  })
    .setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
    .setSubject(sub)
    .setIssuer(claims.iss ?? 'https://accounts.google.com')
    .setAudience(aud)
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(key)
}

const tokenEndpoint = vi.fn<(init: RequestInit) => Promise<Response>>()

type Handler = (request: Request) => Promise<Response> | Response

async function request(
  handler: Handler,
  method: string,
  path: string,
  init: { cookie?: string; body?: unknown; headers?: Record<string, string> } = {},
) {
  const headers = new Headers(init.headers)
  if (init.cookie) headers.set('cookie', init.cookie)
  let body: string | undefined
  if (init.body !== undefined) {
    body = JSON.stringify(init.body)
    headers.set('content-type', 'application/json')
  }
  const response = await handler(new Request(`${ORIGIN}${path}`, { method, headers, body }))
  const text = await response.text()
  return {
    status: response.status,
    location: response.headers.get('location'),
    setCookies: response.headers.getSetCookie(),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    json: (text.startsWith('{') ? JSON.parse(text) : null) as any,
  }
}

/** The cookies a browser would send back: live ones only, not the ones a response deletes. */
const cookieHeader = (setCookies: string[]) =>
  setCookies
    .filter((line) => !/Max-Age=0/.test(line))
    .map((line) => line.split(';')[0]!)
    .join('; ')

type Flow = Awaited<ReturnType<typeof startFlow>>

/** Runs the first leg and returns what the browser would send on the second. */
async function startFlow(returnTo?: string) {
  const query = returnTo === undefined ? '' : `?returnTo=${encodeURIComponent(returnTo)}`
  const started = await request(googleGET, 'GET', `/api/v1/auth/google${query}`)
  const authorize = new URL(started.location!)
  return {
    started,
    authorize,
    state: authorize.searchParams.get('state')!,
    nonce: authorize.searchParams.get('nonce')!,
    challenge: authorize.searchParams.get('code_challenge')!,
    cookie: cookieHeader(started.setCookies),
  }
}

/** Google redirects back; the token endpoint answers with `claims` signed as an ID token. */
async function finishFlow(
  flow: Flow,
  claims: Claims,
  overrides: { state?: string; cookie?: string } = {},
) {
  const token = await idToken({ nonce: flow.nonce, ...claims })
  tokenEndpoint.mockResolvedValueOnce(Response.json({ id_token: token, access_token: 'unused' }))
  const params = new URLSearchParams({ code: 'auth-code', state: overrides.state ?? flow.state })
  return request(callbackGET, 'GET', `/api/v1/auth/google/callback?${params}`, {
    cookie: overrides.cookie ?? flow.cookie,
  })
}

async function findUser(address: string) {
  const { docs } = await payload.find({
    collection: 'users',
    where: { email: { equals: address } },
    overrideAccess: true,
    depth: 0,
  })
  return docs[0]
}

beforeAll(async () => {
  harness = await startHarness()
  payload = harness.payload
  create = creator(payload)
  await create({
    collection: 'users',
    data: { email: 'admin@example.com', password: PASSWORD, name: 'Admin' },
    disableVerificationEmail: true,
  })

  const pair = await generateKeyPair('RS256')
  privateKey = pair.privateKey
  otherPrivateKey = (await generateKeyPair('RS256')).privateKey

  googleDeps.getKey = async () => pair.publicKey
  googleDeps.fetch = ((_url: unknown, init?: RequestInit) =>
    tokenEndpoint(init ?? {})) as typeof fetch
  googleDeps.getConfig = () => ({
    clientId: WEB_CLIENT_ID,
    clientSecret: 'shh',
    mobileClientIds: [ANDROID_CLIENT_ID],
  })
})

afterAll(async () => {
  await harness?.stop()
})

beforeEach(() => {
  tokenEndpoint.mockReset()
})

describe('the first leg (/auth/google)', () => {
  it('sends the browser to Google with PKCE, state and nonce, and keeps the secrets in a cookie', async () => {
    const flow = await startFlow()
    expect(flow.started.status).toBe(302)
    expect(flow.authorize.origin + flow.authorize.pathname).toBe(
      'https://accounts.google.com/o/oauth2/v2/auth',
    )
    const q = flow.authorize.searchParams
    expect(q.get('client_id')).toBe(WEB_CLIENT_ID)
    expect(q.get('redirect_uri')).toBe(`${ORIGIN}/api/v1/auth/google/callback`)
    expect(q.get('response_type')).toBe('code')
    expect(q.get('scope')).toBe('openid email profile')
    expect(q.get('code_challenge_method')).toBe('S256')
    expect(flow.state.length).toBeGreaterThan(20)
    expect(flow.nonce.length).toBeGreaterThan(20)

    const cookie = flow.started.setCookies[0]!
    expect(cookie).toMatch(/^google_oauth=/)
    expect(cookie).toMatch(/HttpOnly/)
    expect(cookie).toMatch(/SameSite=Lax/)
    expect(cookie).toMatch(/Path=\/api\/v1\/auth\/google/)
    expect(cookie).toMatch(/Max-Age=600/)
  })

  it('is not available when Google is not configured', async () => {
    const original = googleDeps.getConfig
    googleDeps.getConfig = () => null
    try {
      const response = await request(googleGET, 'GET', '/api/v1/auth/google')
      expect(response.status).toBe(404)
      expect(response.json.error.details).toEqual({ reason: 'google_unavailable' })
    } finally {
      googleDeps.getConfig = original
    }
  })
})

describe('the callback', () => {
  it('creates a confirmed learner on first sign-in and starts a web session', async () => {
    const address = email('new')
    const flow = await startFlow('/questions')
    const done = await finishFlow(flow, { email: address, name: 'Gina Google', sub: 'sub-new-1' })

    expect(done.status).toBe(302)
    expect(done.location).toBe('/questions')

    // Google was sent the PKCE verifier that matches the challenge from the first leg.
    const sent = tokenEndpoint.mock.calls[0]![0].body as URLSearchParams
    expect(sent.get('grant_type')).toBe('authorization_code')
    expect(sent.get('code')).toBe('auth-code')
    expect(sent.get('client_secret')).toBe('shh')
    expect(createHash('sha256').update(sent.get('code_verifier')!).digest('base64url')).toBe(
      flow.challenge,
    )

    expect(await findUser(address)).toMatchObject({
      provider: 'google',
      googleSub: 'sub-new-1',
      role: 'learner',
      _verified: true,
      name: 'Gina Google',
    })

    // The flow cookie is cleared and the session cookies are httpOnly.
    expect(done.setCookies.some((c) => c.startsWith('google_oauth=;') && /Max-Age=0/.test(c))).toBe(
      true,
    )
    expect(done.setCookies.find((c) => c.startsWith(`${AUTH_COOKIES.access}=`))).toMatch(/HttpOnly/)

    const me = await request(meGET, 'GET', '/api/v1/me', { cookie: cookieHeader(done.setCookies) })
    expect(me.status).toBe(200)
    expect(me.json.data).toMatchObject({ email: address, provider: 'google', emailVerified: true })
  })

  it('signs the same Google account in again without making a second user', async () => {
    const address = email('again')
    await finishFlow(await startFlow(), { email: address, sub: 'sub-again' })
    const second = await finishFlow(await startFlow(), { email: address, sub: 'sub-again' })
    expect(second.status).toBe(302)
    const { totalDocs } = await payload.count({
      collection: 'users',
      where: { email: { equals: address } },
      overrideAccess: true,
    })
    expect(totalDocs).toBe(1)
  })

  it('never redirects off the site', async () => {
    for (const returnTo of [
      '//evil.example',
      'https://evil.example',
      '/\\evil.example',
      'javascript:alert(1)',
    ]) {
      const done = await finishFlow(await startFlow(returnTo), { email: email('redir') })
      expect(done.location).toBe('/account')
    }
  })

  it('refuses a forged or missing state', async () => {
    const flow = await startFlow()
    const forged = await finishFlow(flow, { email: email('csrf') }, { state: 'attacker-state' })
    expect(forged.location).toBe('/sign-in?error=google')
    expect(cookieHeader(forged.setCookies)).toBe('')
    expect(tokenEndpoint).not.toHaveBeenCalled()

    // A different browser (no flow cookie) cannot finish someone else's flow.
    tokenEndpoint.mockReset()
    const noCookie = await finishFlow(flow, { email: email('csrf') }, { cookie: '' })
    expect(noCookie.location).toBe('/sign-in?error=google')
    expect(tokenEndpoint).not.toHaveBeenCalled()
  })

  it('refuses an ID token minted for another flow (nonce)', async () => {
    const flow = await startFlow()
    const done = await finishFlow(flow, { email: email('nonce'), nonce: 'someone-elses-nonce' })
    expect(done.location).toBe('/sign-in?error=google')
  })

  it('ends on the sign-in page when the person cancels or Google fails', async () => {
    const flow = await startFlow()
    const cancelled = await request(
      callbackGET,
      'GET',
      '/api/v1/auth/google/callback?error=access_denied',
      { cookie: flow.cookie },
    )
    expect(cancelled.location).toBe('/sign-in?error=google_cancelled')

    tokenEndpoint.mockResolvedValueOnce(new Response('nope', { status: 400 }))
    const failed = await request(
      callbackGET,
      'GET',
      `/api/v1/auth/google/callback?code=x&state=${flow.state}`,
      { cookie: flow.cookie },
    )
    expect(failed.location).toBe('/sign-in?error=google')
  })

  it('links to an existing confirmed account by email and keeps its password', async () => {
    const address = email('link')
    await create({
      collection: 'users',
      data: { email: address, password: PASSWORD, name: 'Existing', _verified: true },
      disableVerificationEmail: true,
    })
    const done = await finishFlow(await startFlow(), { email: address, sub: 'sub-link' })
    expect(done.status).toBe(302)
    expect(await findUser(address)).toMatchObject({
      googleSub: 'sub-link',
      provider: 'email',
      name: 'Existing',
    })
    const login = await request(loginPOST, 'POST', '/api/v1/auth/login', {
      body: { email: address, password: PASSWORD },
    })
    expect(login.status).toBe(200)
  })

  it('takes over an unconfirmed account: the squatter loses the password and every session', async () => {
    const address = email('squat')
    const squatted = await create({
      collection: 'users',
      data: { email: address, password: 'Squatter-password-1' },
      disableVerificationEmail: true,
    })
    // What the public sign-up leaves behind: unverified, with a live login.
    await payload.update({
      collection: 'users',
      id: squatted.id,
      data: { _verified: false },
      overrideAccess: true,
    })
    const refresh = await issueRefreshToken(payload, { userId: squatted.id, audience: 'web' })

    const done = await finishFlow(await startFlow(), { email: address, sub: 'sub-owner' })
    expect(done.status).toBe(302)
    expect(await findUser(address)).toMatchObject({ googleSub: 'sub-owner', _verified: true })

    const login = await request(loginPOST, 'POST', '/api/v1/auth/login', {
      body: { email: address, password: 'Squatter-password-1' },
    })
    expect(login.status).toBe(401)
    const refreshed = await request(refreshPOST, 'POST', '/api/v1/auth/refresh', {
      cookie: `${AUTH_COOKIES.refresh}=${refresh.token}`,
    })
    expect(refreshed.status).toBe(401)
  })

  it('will not link an address that already belongs to a different Google account', async () => {
    const address = email('conflict')
    await finishFlow(await startFlow(), { email: address, sub: 'sub-first' })
    const second = await finishFlow(await startFlow(), { email: address, sub: 'sub-second' })
    expect(second.location).toBe('/sign-in?error=google')
    expect(await findUser(address)).toMatchObject({ googleSub: 'sub-first' })
  })

  it('refuses an unverified Google email', async () => {
    const done = await finishFlow(await startFlow(), { email: email('unv'), email_verified: false })
    expect(done.location).toBe('/sign-in?error=google')
  })
})

describe('Google-only accounts', () => {
  it('cannot sign in with a password, and delete without one', async () => {
    const address = email('only')
    const done = await finishFlow(await startFlow(), { email: address, sub: 'sub-only' })
    const cookie = cookieHeader(done.setCookies)

    const login = await request(loginPOST, 'POST', '/api/v1/auth/login', {
      body: { email: address, password: 'guess-guess-guess' },
    })
    expect(login.status).toBe(401)

    const deleted = await request(meDELETE, 'DELETE', '/api/v1/me', { cookie, body: {} })
    expect(deleted.status).toBe(200)
    expect(await findUser(address)).toBeUndefined()
  })
})

describe('POST /auth/google/mobile', () => {
  const call = (body: unknown) =>
    request(mobilePOST, 'POST', '/api/v1/auth/google/mobile', { body })

  it('signs in with a valid ID token and returns tokens in the body', async () => {
    const address = email('phone')
    const response = await call({
      idToken: await idToken({ email: address, sub: 'sub-phone', aud: ANDROID_CLIENT_ID }),
      deviceLabel: 'Pixel',
    })
    expect(response.status).toBe(200)
    expect(response.setCookies).toEqual([])
    expect(response.json.data.tokens).toMatchObject({ tokenType: 'Bearer' })
    expect(response.json.data.user).toMatchObject({ email: address, provider: 'google' })

    const me = await request(meGET, 'GET', '/api/v1/me', {
      headers: { authorization: `Bearer ${response.json.data.tokens.accessToken}` },
    })
    expect(me.status).toBe(200)
  })

  it('accepts the web client ID too', async () => {
    const response = await call({
      idToken: await idToken({ email: email('web'), aud: WEB_CLIENT_ID }),
    })
    expect(response.status).toBe(200)
  })

  it.each([
    ['another app’s audience', { aud: 'someone-else.apps.googleusercontent.com' }],
    ['a different issuer', { iss: 'https://evil.example' }],
    ['an expired token', { expiresIn: '-1m' }],
    ['an unverified email', { email_verified: false }],
  ])('rejects %s', async (_label, extra) => {
    const response = await call({ idToken: await idToken({ email: email('bad'), ...extra }) })
    expect(response.status).toBe(401)
    expect(response.json.error.details).toEqual({ reason: 'invalid_token' })
  })

  it('rejects a token signed with someone else’s key', async () => {
    const forged = await idToken({ email: email('forged'), key: otherPrivateKey })
    expect((await call({ idToken: forged })).status).toBe(401)
  })

  it('rejects an unsigned (alg none) token', async () => {
    const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url')
    const header = encode({ alg: 'none', typ: 'JWT' })
    const body = encode({
      sub: 'x',
      email: 'a@example.com',
      email_verified: true,
      aud: WEB_CLIENT_ID,
      iss: 'https://accounts.google.com',
      exp: 9999999999,
    })
    expect((await call({ idToken: `${header}.${body}.` })).status).toBe(401)
  })
})
