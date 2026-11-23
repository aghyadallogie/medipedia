/**
 * Phase 4 exit tests: the /api/v1/auth/* and /api/v1/me route handlers against a real database,
 * called the way a browser and the mobile app call them.
 */
import { AUTH_COOKIES } from '@medipedia/shared'
import type { Payload } from 'payload'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('next/cache', () => ({ revalidateTag: vi.fn(), unstable_cache: (fn: unknown) => fn }))

import { POST as forgotPOST } from '@/app/api/v1/auth/forgot-password/route'
import { POST as loginPOST } from '@/app/api/v1/auth/login/route'
import { POST as logoutPOST } from '@/app/api/v1/auth/logout/route'
import { POST as refreshPOST } from '@/app/api/v1/auth/refresh/route'
import { POST as registerPOST } from '@/app/api/v1/auth/register/route'
import { POST as resetPOST } from '@/app/api/v1/auth/reset-password/route'
import { POST as verifyPOST } from '@/app/api/v1/auth/verify-email/route'
import { DELETE as meDELETE, GET as meGET, PATCH as mePATCH } from '@/app/api/v1/me/route'
import { hashRefreshToken } from '@/server/auth/refresh-tokens'

import { creator, PASSWORD, startHarness, type Harness } from './harness'

const ORIGIN = 'http://localhost:3000'

let harness: Harness
let payload: Payload
let create: ReturnType<typeof creator>
const sendEmail = vi.fn(
  async (_message: { to?: unknown; subject?: string; html?: string }) => undefined,
)

let counter = 0
const email = (prefix = 'learner') => `${prefix}-${++counter}@example.com`

type Handler = (request: Request) => Promise<Response> | Response

type CallOptions = {
  body?: unknown
  headers?: Record<string, string>
  cookies?: Record<string, string>
  /** Send the body as-is with this content type, instead of JSON. */
  raw?: { text: string; contentType: string }
}

async function call(handler: Handler, method: string, path: string, options: CallOptions = {}) {
  const headers = new Headers({ ...options.headers })
  if (options.cookies) {
    headers.set(
      'cookie',
      Object.entries(options.cookies)
        .map(([name, value]) => `${name}=${value}`)
        .join('; '),
    )
  }
  let body: string | undefined
  if (options.raw) {
    body = options.raw.text
    headers.set('content-type', options.raw.contentType)
  } else if (options.body !== undefined) {
    body = JSON.stringify(options.body)
    headers.set('content-type', 'application/json')
  }
  const response = await handler(new Request(`${ORIGIN}${path}`, { method, headers, body }))
  const text = await response.text()
  return {
    status: response.status,
    headers: response.headers,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    json: (text ? JSON.parse(text) : null) as any,
    setCookies: response.headers.getSetCookie(),
  }
}

const post = (handler: Handler, path: string, body?: unknown, options: CallOptions = {}) =>
  call(handler, 'POST', path, { ...options, body })

/** `Set-Cookie` lines -> `{ name: value }`, the way a browser's jar would hold them. */
function jar(setCookies: string[]): Record<string, string> {
  const cookies: Record<string, string> = {}
  for (const line of setCookies) {
    const [pair = ''] = line.split(';')
    const index = pair.indexOf('=')
    cookies[pair.slice(0, index)] = decodeURIComponent(pair.slice(index + 1))
  }
  return cookies
}

async function hiddenFields(userId: string) {
  const { docs } = await payload.find({
    collection: 'users',
    where: { id: { equals: userId } },
    overrideAccess: true,
    showHiddenFields: true,
    depth: 0,
  })
  return docs[0]
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

/** A verified learner who can sign in. */
async function newLearner(address = email()) {
  await create({
    collection: 'users',
    data: { email: address, password: PASSWORD, name: 'Learner', _verified: true },
    disableVerificationEmail: true,
  })
  return address
}

async function signInWeb(address: string) {
  const response = await post(loginPOST, '/api/v1/auth/login', {
    email: address,
    password: PASSWORD,
  })
  expect(response.status).toBe(200)
  return jar(response.setCookies)
}

async function signInMobile(address: string) {
  const response = await post(loginPOST, '/api/v1/auth/login', {
    email: address,
    password: PASSWORD,
    client: 'mobile',
    deviceLabel: 'Test phone',
  })
  expect(response.status).toBe(200)
  return response.json.data.tokens as { accessToken: string; refreshToken: string }
}

beforeAll(async () => {
  harness = await startHarness()
  payload = harness.payload
  create = creator(payload)
  // The first account ever created is the admin.
  await create({
    collection: 'users',
    data: { email: 'admin@example.com', password: PASSWORD, name: 'Admin' },
    disableVerificationEmail: true,
  })
  // Payload sends its own emails through the adapter, and our resend goes through payload.sendEmail.
  // Route both to one recorder so no mail leaves the test and the messages can be checked.
  payload.email = { ...payload.email, sendEmail: sendEmail as never }
  payload.sendEmail = sendEmail as never
})

afterAll(async () => {
  await harness?.stop()
})

beforeEach(() => {
  sendEmail.mockClear()
})

describe('register and verify', () => {
  it('creates an unverified learner, emails a link, and refuses to sign in until it is used', async () => {
    const address = email('new')
    const registered = await post(registerPOST, '/api/v1/auth/register', {
      email: address.toUpperCase(),
      password: PASSWORD,
      name: 'New Learner',
    })
    expect(registered.status).toBe(202)
    expect(registered.json).toEqual({ data: { ok: true } })
    expect(registered.headers.get('cache-control')).toBe('private, no-store')
    expect(registered.setCookies).toEqual([])
    expect(sendEmail).toHaveBeenCalledTimes(1)
    expect(sendEmail.mock.calls[0]?.[0]).toMatchObject({ to: address })

    const user = await findUser(address)
    expect(user).toMatchObject({ role: 'learner', provider: 'email', _verified: false })

    const early = await post(loginPOST, '/api/v1/auth/login', {
      email: address,
      password: PASSWORD,
    })
    expect(early.status).toBe(403)
    expect(early.json.error.details).toEqual({ reason: 'email_not_verified' })
    expect(early.setCookies).toEqual([])

    const token = (await hiddenFields(user!.id))?._verificationToken
    expect(token).toBeTruthy()
    const verified = await post(verifyPOST, '/api/v1/auth/verify-email', { token })
    expect(verified.status).toBe(200)

    const again = await post(verifyPOST, '/api/v1/auth/verify-email', { token })
    expect(again.status).toBe(400)
    expect(again.json.error.details).toEqual({ reason: 'invalid_token' })

    expect(
      (await post(loginPOST, '/api/v1/auth/login', { email: address, password: PASSWORD })).status,
    ).toBe(200)
  })

  it('cannot be used to pick a role', async () => {
    const address = email('sneaky')
    const registered = await post(registerPOST, '/api/v1/auth/register', {
      email: address,
      password: PASSWORD,
      role: 'admin',
      _verified: true,
    })
    expect(registered.status).toBe(202)
    expect(await findUser(address)).toMatchObject({ role: 'learner', _verified: false })
  })

  it('answers the same for an address that is already registered', async () => {
    const taken = await newLearner()
    const response = await post(registerPOST, '/api/v1/auth/register', {
      email: taken,
      password: 'A-different-password-1',
    })
    expect(response.status).toBe(202)
    expect(response.json).toEqual({ data: { ok: true } })
    // The existing account was not touched, and the owner is not emailed.
    expect(sendEmail).not.toHaveBeenCalled()
    expect(
      (await post(loginPOST, '/api/v1/auth/login', { email: taken, password: PASSWORD })).status,
    ).toBe(200)
  })

  it('re-sends the link for an unconfirmed address', async () => {
    const address = email('pending')
    await post(registerPOST, '/api/v1/auth/register', { email: address, password: PASSWORD })
    sendEmail.mockClear()
    const response = await post(registerPOST, '/api/v1/auth/register', {
      email: address,
      password: PASSWORD,
    })
    expect(response.status).toBe(202)
    expect(sendEmail).toHaveBeenCalledTimes(1)
    expect(sendEmail.mock.calls[0]?.[0]).toMatchObject({ to: address })
  })

  it('rejects weak passwords and bad addresses', async () => {
    const weak = await post(registerPOST, '/api/v1/auth/register', {
      email: email(),
      password: 'short',
    })
    expect(weak.status).toBe(400)
    const bad = await post(registerPOST, '/api/v1/auth/register', {
      email: 'nope',
      password: PASSWORD,
    })
    expect(bad.status).toBe(400)
  })
})

describe('sign in', () => {
  it('web: sets httpOnly cookies, keeps tokens out of the body, and signs the user in', async () => {
    const address = await newLearner()
    const response = await post(loginPOST, '/api/v1/auth/login', {
      email: address,
      password: PASSWORD,
    })
    expect(response.status).toBe(200)
    expect(response.json.data.tokens).toBeUndefined()
    expect(response.json.data.user).toMatchObject({
      email: address,
      role: 'learner',
      emailVerified: true,
    })
    expect(response.json.data.user).not.toHaveProperty('password')
    expect(response.headers.get('cache-control')).toBe('private, no-store')

    const access = response.setCookies.find((line) => line.startsWith(`${AUTH_COOKIES.access}=`))
    const refresh = response.setCookies.find((line) => line.startsWith(`${AUTH_COOKIES.refresh}=`))
    expect(access).toMatch(/HttpOnly/)
    expect(access).toMatch(/SameSite=Lax/)
    expect(access).toMatch(/Path=\//)
    expect(refresh).toMatch(/HttpOnly/)
    expect(refresh).toMatch(new RegExp(`Path=${AUTH_COOKIES.refreshPath}(;|$)`))

    const cookies = jar(response.setCookies)
    const me = await call(meGET, 'GET', '/api/v1/me', { cookies })
    expect(me.status).toBe(200)
    expect(me.json.data.email).toBe(address)
    expect(me.headers.get('cache-control')).toBe('private, no-store')
  })

  it('mobile: returns tokens in the body and no cookies', async () => {
    const address = await newLearner()
    const response = await post(loginPOST, '/api/v1/auth/login', {
      email: address,
      password: PASSWORD,
      client: 'mobile',
    })
    expect(response.status).toBe(200)
    expect(response.setCookies).toEqual([])
    expect(response.json.data.tokens).toMatchObject({ tokenType: 'Bearer', expiresIn: 900 })

    const me = await call(meGET, 'GET', '/api/v1/me', {
      headers: { authorization: `Bearer ${response.json.data.tokens.accessToken}` },
    })
    expect(me.json.data.email).toBe(address)
  })

  it('gives wrong passwords and unknown accounts the same answer', async () => {
    const address = await newLearner()
    const wrong = await post(loginPOST, '/api/v1/auth/login', {
      email: address,
      password: 'nope-nope-nope',
    })
    const unknown = await post(loginPOST, '/api/v1/auth/login', {
      email: email('ghost'),
      password: 'nope-nope-nope',
    })
    expect(wrong.status).toBe(401)
    expect(unknown.status).toBe(401)
    expect(wrong.json).toEqual(unknown.json)
    expect(wrong.json.error.details).toEqual({ reason: 'invalid_credentials' })
  })

  it('locks the account after repeated failures', async () => {
    const address = await newLearner()
    for (let i = 0; i < 5; i++) {
      await post(loginPOST, '/api/v1/auth/login', { email: address, password: 'wrong-wrong-wrong' })
    }
    const locked = await post(loginPOST, '/api/v1/auth/login', {
      email: address,
      password: PASSWORD,
    })
    expect(locked.status).toBe(429)
    expect(locked.json.error.details).toEqual({ reason: 'account_locked' })
  })
})

describe('refresh and logout', () => {
  it('web: rotates the cookie pair and keeps the user signed in', async () => {
    const cookies = await signInWeb(await newLearner())
    const refreshed = await post(refreshPOST, '/api/v1/auth/refresh', undefined, { cookies })
    expect(refreshed.status).toBe(200)
    expect(refreshed.json.data.tokens).toBeUndefined()
    const next = jar(refreshed.setCookies)
    expect(next[AUTH_COOKIES.refresh]).toBeTruthy()
    expect(next[AUTH_COOKIES.refresh]).not.toBe(cookies[AUTH_COOKIES.refresh])
    expect((await call(meGET, 'GET', '/api/v1/me', { cookies: next })).status).toBe(200)
  })

  it('mobile: takes the refresh token in the body and returns a new pair', async () => {
    const tokens = await signInMobile(await newLearner())
    const refreshed = await post(refreshPOST, '/api/v1/auth/refresh', {
      refreshToken: tokens.refreshToken,
    })
    expect(refreshed.status).toBe(200)
    expect(refreshed.setCookies).toEqual([])
    expect(refreshed.json.data.tokens.refreshToken).toBeTruthy()
    expect(refreshed.json.data.tokens.refreshToken).not.toBe(tokens.refreshToken)
  })

  it('refuses a missing, unknown or wrong-audience token', async () => {
    expect((await post(refreshPOST, '/api/v1/auth/refresh')).status).toBe(401)
    const unknown = await post(refreshPOST, '/api/v1/auth/refresh', {
      refreshToken: 'x'.repeat(43),
    })
    expect(unknown.status).toBe(401)
    expect(unknown.json.error.details).toEqual({ reason: 'invalid_token' })

    // A web refresh token is not accepted as a mobile one.
    const cookies = await signInWeb(await newLearner())
    const asMobile = await post(refreshPOST, '/api/v1/auth/refresh', {
      refreshToken: cookies[AUTH_COOKIES.refresh],
    })
    expect(asMobile.status).toBe(401)
  })

  it('clears the cookies of a browser whose refresh failed', async () => {
    const cookies = await signInWeb(await newLearner())
    await post(logoutPOST, '/api/v1/auth/logout', undefined, { cookies })
    const failed = await post(refreshPOST, '/api/v1/auth/refresh', undefined, { cookies })
    expect(failed.status).toBe(401)
    const cleared = failed.setCookies.map((line) => line.split(';')[0])
    expect(cleared).toEqual(
      expect.arrayContaining([`${AUTH_COOKIES.access}=`, `${AUTH_COOKIES.refresh}=`]),
    )
    expect(failed.setCookies.every((line) => /Max-Age=0/.test(line))).toBe(true)
  })

  it('a duplicate refresh within seconds gets an access token only', async () => {
    const tokens = await signInMobile(await newLearner())
    const first = await post(refreshPOST, '/api/v1/auth/refresh', {
      refreshToken: tokens.refreshToken,
    })
    const duplicate = await post(refreshPOST, '/api/v1/auth/refresh', {
      refreshToken: tokens.refreshToken,
    })
    expect(first.status).toBe(200)
    expect(duplicate.status).toBe(200)
    expect(duplicate.json.data.tokens.accessToken).toBeTruthy()
    expect(duplicate.json.data.tokens.refreshToken).toBeUndefined()
  })

  it('treats a rotated token that comes back later as theft and signs the whole login out', async () => {
    const tokens = await signInMobile(await newLearner())
    const first = await post(refreshPOST, '/api/v1/auth/refresh', {
      refreshToken: tokens.refreshToken,
    })
    const successor = first.json.data.tokens.refreshToken as string

    // Pretend the rotation happened a minute ago.
    await payload.update({
      collection: 'refresh-tokens',
      where: { tokenHash: { equals: hashRefreshToken(tokens.refreshToken) } },
      data: { rotatedAt: new Date(Date.now() - 60_000).toISOString() },
      overrideAccess: true,
    })

    const replay = await post(refreshPOST, '/api/v1/auth/refresh', {
      refreshToken: tokens.refreshToken,
    })
    expect(replay.status).toBe(401)
    expect(replay.json.error.details).toEqual({ reason: 'token_reused' })

    // The legitimate holder's newer token died with it.
    const legit = await post(refreshPOST, '/api/v1/auth/refresh', { refreshToken: successor })
    expect(legit.status).toBe(401)
  })

  it('logout revokes the login on that device only', async () => {
    const address = await newLearner()
    const phone = await signInMobile(address)
    const laptop = await signInWeb(address)

    const out = await post(logoutPOST, '/api/v1/auth/logout', undefined, { cookies: laptop })
    expect(out.status).toBe(200)
    expect(out.setCookies.every((line) => /Max-Age=0/.test(line))).toBe(true)

    expect(
      (await post(refreshPOST, '/api/v1/auth/refresh', undefined, { cookies: laptop })).status,
    ).toBe(401)
    expect(
      (await post(refreshPOST, '/api/v1/auth/refresh', { refreshToken: phone.refreshToken }))
        .status,
    ).toBe(200)
  })

  it('logout with an unknown token still succeeds', async () => {
    expect(
      (await post(logoutPOST, '/api/v1/auth/logout', { refreshToken: 'y'.repeat(43) })).status,
    ).toBe(200)
    expect((await post(logoutPOST, '/api/v1/auth/logout')).status).toBe(200)
  })
})

describe('cross-site requests', () => {
  it.each([
    ['a foreign Origin', { origin: 'https://evil.example' }],
    ['Sec-Fetch-Site: cross-site', { 'sec-fetch-site': 'cross-site' }],
  ])('are refused with %s', async (_label, headers) => {
    const address = await newLearner()
    const login = await post(
      loginPOST,
      '/api/v1/auth/login',
      { email: address, password: PASSWORD },
      { headers },
    )
    expect(login.status).toBe(403)
    expect(login.setCookies).toEqual([])

    const cookies = await signInWeb(address)
    expect(
      (await post(logoutPOST, '/api/v1/auth/logout', undefined, { cookies, headers })).status,
    ).toBe(403)
    expect(
      (await post(refreshPOST, '/api/v1/auth/refresh', undefined, { cookies, headers })).status,
    ).toBe(403)
    expect(
      (await call(meDELETE, 'DELETE', '/api/v1/me', { cookies, headers, body: {} })).status,
    ).toBe(403)
  })

  it('accepts the same origin', async () => {
    const address = await newLearner()
    const response = await post(
      loginPOST,
      '/api/v1/auth/login',
      { email: address, password: PASSWORD },
      { headers: { origin: ORIGIN, 'sec-fetch-site': 'same-origin' } },
    )
    expect(response.status).toBe(200)
  })

  it('require a JSON body, which a cross-site form cannot send', async () => {
    const address = await newLearner()
    const response = await post(loginPOST, '/api/v1/auth/login', undefined, {
      raw: {
        text: JSON.stringify({ email: address, password: PASSWORD }),
        contentType: 'text/plain',
      },
    })
    expect(response.status).toBe(400)
  })

  it('reject malformed and oversized bodies', async () => {
    const broken = await post(loginPOST, '/api/v1/auth/login', undefined, {
      raw: { text: '{nope', contentType: 'application/json' },
    })
    expect(broken.status).toBe(400)
    const huge = await post(loginPOST, '/api/v1/auth/login', undefined, {
      raw: {
        text: JSON.stringify({ email: 'a@example.com', password: 'x'.repeat(40_000) }),
        contentType: 'application/json',
      },
    })
    expect(huge.status).toBe(400)
  })
})

describe('forgot and reset password', () => {
  it('answers the same for known and unknown addresses, and only emails the known one', async () => {
    const known = await newLearner()
    const a = await post(forgotPOST, '/api/v1/auth/forgot-password', { email: known })
    expect(a.status).toBe(202)
    expect(sendEmail).toHaveBeenCalledTimes(1)
    expect(sendEmail.mock.calls[0]?.[0]).toMatchObject({ to: known })

    sendEmail.mockClear()
    const b = await post(forgotPOST, '/api/v1/auth/forgot-password', { email: email('ghost') })
    expect(b.status).toBe(202)
    expect(b.json).toEqual(a.json)
    expect(sendEmail).not.toHaveBeenCalled()
  })

  it('sets a new password, ends every session, and the token works once', async () => {
    const address = await newLearner()
    const phone = await signInMobile(address)
    const laptop = await signInWeb(address)

    await post(forgotPOST, '/api/v1/auth/forgot-password', { email: address })
    const token = (await hiddenFields((await findUser(address))!.id))?.resetPasswordToken as string
    expect(token).toBeTruthy()

    const newPassword = 'A-brand-new-passphrase-7'
    const reset = await post(resetPOST, '/api/v1/auth/reset-password', {
      token,
      password: newPassword,
    })
    expect(reset.status).toBe(200)

    expect(
      (await post(refreshPOST, '/api/v1/auth/refresh', { refreshToken: phone.refreshToken }))
        .status,
    ).toBe(401)
    expect(
      (await post(refreshPOST, '/api/v1/auth/refresh', undefined, { cookies: laptop })).status,
    ).toBe(401)

    expect(
      (await post(loginPOST, '/api/v1/auth/login', { email: address, password: PASSWORD })).status,
    ).toBe(401)
    expect(
      (await post(loginPOST, '/api/v1/auth/login', { email: address, password: newPassword }))
        .status,
    ).toBe(200)

    const reused = await post(resetPOST, '/api/v1/auth/reset-password', {
      token,
      password: 'Yet-another-pass-88',
    })
    expect(reused.status).toBe(400)
    expect(reused.json.error.details).toEqual({ reason: 'invalid_token' })
  })

  it('rejects an unknown token and a weak new password', async () => {
    const unknown = await post(resetPOST, '/api/v1/auth/reset-password', {
      token: 'f'.repeat(40),
      password: 'A-brand-new-passphrase-7',
    })
    expect(unknown.status).toBe(400)
    expect(unknown.json.error.details).toEqual({ reason: 'invalid_token' })
    const weak = await post(resetPOST, '/api/v1/auth/reset-password', {
      token: 'f'.repeat(40),
      password: 'short',
    })
    expect(weak.status).toBe(400)
  })
})

describe('/me', () => {
  it('requires a signed-in user', async () => {
    expect((await call(meGET, 'GET', '/api/v1/me')).status).toBe(401)
    expect(
      (await call(meGET, 'GET', '/api/v1/me', { headers: { authorization: 'Bearer nonsense' } }))
        .status,
    ).toBe(401)
    expect((await call(mePATCH, 'PATCH', '/api/v1/me', { body: { name: 'X' } })).status).toBe(401)
    expect((await call(meDELETE, 'DELETE', '/api/v1/me', { body: {} })).status).toBe(401)
  })

  it('updates only the name', async () => {
    const address = await newLearner()
    const cookies = await signInWeb(address)
    const updated = await call(mePATCH, 'PATCH', '/api/v1/me', {
      cookies,
      body: { name: '  Renamed  ', role: 'admin', email: 'someone-else@example.com' },
    })
    expect(updated.status).toBe(200)
    expect(updated.json.data).toMatchObject({ name: 'Renamed', email: address, role: 'learner' })
    expect(await findUser(address)).toMatchObject({ name: 'Renamed', role: 'learner' })

    expect(
      (await call(mePATCH, 'PATCH', '/api/v1/me', { cookies, body: { name: '' } })).status,
    ).toBe(400)
  })

  it('deletes the account after the password is confirmed, with its answers and sessions', async () => {
    const address = await newLearner()
    const cookies = await signInWeb(address)
    const user = (await findUser(address))!

    const missing = await call(meDELETE, 'DELETE', '/api/v1/me', { cookies })
    expect(missing.status).toBe(400)
    const wrong = await call(meDELETE, 'DELETE', '/api/v1/me', {
      cookies,
      body: { password: 'not-my-password' },
    })
    expect(wrong.status).toBe(401)
    expect(await findUser(address)).toBeTruthy()

    const deleted = await call(meDELETE, 'DELETE', '/api/v1/me', {
      cookies,
      body: { password: PASSWORD },
    })
    expect(deleted.status).toBe(200)
    expect(deleted.setCookies.every((line) => /Max-Age=0/.test(line))).toBe(true)

    expect(await findUser(address)).toBeUndefined()
    const leftovers = await payload.count({
      collection: 'refresh-tokens',
      where: { user: { equals: user.id } },
      overrideAccess: true,
    })
    expect(leftovers.totalDocs).toBe(0)
    expect((await call(meGET, 'GET', '/api/v1/me', { cookies })).status).toBe(401)
  })
})
