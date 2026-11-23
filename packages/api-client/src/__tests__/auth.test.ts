import { describe, expect, it, vi } from 'vitest'

import { ApiClientError, createApiClient } from '../index'

const USER = {
  id: '00000000-0000-4000-8000-000000000001',
  email: 'learner@example.com',
  name: 'Learner',
  role: 'learner',
  provider: 'email',
  emailVerified: true,
  createdAt: '2026-11-22T12:00:00.000Z',
}
const TOKENS = {
  accessToken: 'access',
  refreshToken: 'refresh',
  tokenType: 'Bearer',
  expiresIn: 900,
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

function clientWith(
  respond: (url: URL, init: RequestInit) => Response | Promise<Response>,
  extra: Partial<Parameters<typeof createApiClient>[0]> = {},
) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) =>
    respond(new URL(String(input)), init ?? {}),
  )
  const api = createApiClient({ baseUrl: 'https://example.test', fetch: fetchMock, ...extra })
  return { api, fetchMock }
}

const bodyOf = (fetchMock: ReturnType<typeof clientWith>['fetchMock'], call = 0) =>
  JSON.parse(String(fetchMock.mock.calls[call]?.[1]?.body))

describe('auth', () => {
  it('posts credentials as JSON and parses the session', async () => {
    const { api, fetchMock } = clientWith(() => json({ data: { user: USER, tokens: TOKENS } }))
    const session = await api.auth.login({
      email: 'learner@example.com',
      password: 'secret-secret',
      client: 'mobile',
    })
    expect(session.tokens?.refreshToken).toBe('refresh')
    expect(session.user.email).toBe('learner@example.com')

    const [url, init] = fetchMock.mock.calls[0]!
    expect(new URL(String(url)).pathname).toBe('/api/v1/auth/login')
    expect(init?.method).toBe('POST')
    expect((init?.headers as Record<string, string>)['Content-Type']).toBe('application/json')
    expect(bodyOf(fetchMock)).toEqual({
      email: 'learner@example.com',
      password: 'secret-secret',
      client: 'mobile',
    })
  })

  it('web sessions carry no tokens', async () => {
    const { api } = clientWith(() => json({ data: { user: USER } }))
    expect((await api.auth.login({ email: 'a@example.com', password: 'x' })).tokens).toBeUndefined()
  })

  it('maps the acknowledgement-only endpoints to void', async () => {
    const { api, fetchMock } = clientWith(() => json({ data: { ok: true } }, 202))
    await expect(
      api.auth.register({ email: 'a@example.com', password: 'a-long-password' }),
    ).resolves.toBeUndefined()
    await expect(api.auth.forgotPassword({ email: 'a@example.com' })).resolves.toBeUndefined()
    await expect(api.auth.verifyEmail('t'.repeat(20))).resolves.toBeUndefined()
    await expect(
      api.auth.resetPassword({ token: 't'.repeat(20), password: 'a-long-password' }),
    ).resolves.toBeUndefined()
    await expect(api.auth.logout()).resolves.toBeUndefined()
    expect(fetchMock.mock.calls.map(([url]) => new URL(String(url)).pathname)).toEqual([
      '/api/v1/auth/register',
      '/api/v1/auth/forgot-password',
      '/api/v1/auth/verify-email',
      '/api/v1/auth/reset-password',
      '/api/v1/auth/logout',
    ])
  })

  it('refresh sends the token in the body only when given one', async () => {
    const { api, fetchMock } = clientWith(() =>
      json({ data: { user: USER, tokens: { ...TOKENS, refreshToken: undefined } } }),
    )
    const duplicate = await api.auth.refresh('r'.repeat(43))
    expect(duplicate.tokens?.refreshToken).toBeUndefined()
    await api.auth.refresh()
    expect(bodyOf(fetchMock, 0)).toEqual({ refreshToken: 'r'.repeat(43) })
    expect(bodyOf(fetchMock, 1)).toEqual({})
  })

  it('surfaces the reason an auth request failed', async () => {
    const { api } = clientWith(() =>
      json(
        {
          error: {
            code: 'forbidden',
            message: 'Confirm your email.',
            details: { reason: 'email_not_verified' },
          },
        },
        403,
      ),
    )
    const error = await api.auth
      .login({ email: 'a@example.com', password: 'x' })
      .catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ApiClientError)
    expect(error).toMatchObject({
      code: 'forbidden',
      status: 403,
      details: { reason: 'email_not_verified' },
    })
  })

  it('builds the Google sign-in URL for a browser redirect', () => {
    const { api } = clientWith(() => json({}))
    expect(api.auth.googleSignInUrl()).toBe('https://example.test/api/v1/auth/google')
    expect(api.auth.googleSignInUrl('/questions?x=1')).toBe(
      'https://example.test/api/v1/auth/google?returnTo=%2Fquestions%3Fx%3D1',
    )
  })

  it('exchanges a Google ID token on mobile', async () => {
    const { api, fetchMock } = clientWith(() => json({ data: { user: USER, tokens: TOKENS } }))
    const session = await api.auth.googleMobile({ idToken: 'x'.repeat(30), deviceLabel: 'Pixel' })
    expect(session.tokens?.accessToken).toBe('access')
    expect(bodyOf(fetchMock)).toEqual({ idToken: 'x'.repeat(30), deviceLabel: 'Pixel' })
  })
})

describe('me', () => {
  it('sends the access token and reads the user', async () => {
    const { api, fetchMock } = clientWith(() => json({ data: USER }), {
      getAccessToken: () => 'access',
    })
    expect((await api.me.get()).email).toBe('learner@example.com')
    expect((fetchMock.mock.calls[0]?.[1]?.headers as Record<string, string>).Authorization).toBe(
      'Bearer access',
    )
  })

  it('updates and deletes with the right verbs', async () => {
    const { api, fetchMock } = clientWith((_url, init) =>
      init.method === 'DELETE'
        ? json({ data: { ok: true } })
        : json({ data: { ...USER, name: 'New' } }),
    )
    expect((await api.me.update({ name: 'New' })).name).toBe('New')
    await api.me.delete({ password: 'secret-secret' })
    expect(fetchMock.mock.calls.map(([, init]) => init?.method)).toEqual(['PATCH', 'DELETE'])
    expect(bodyOf(fetchMock, 1)).toEqual({ password: 'secret-secret' })
  })
})

describe('refreshing an expired session', () => {
  const unauthorized = () =>
    json({ error: { code: 'unauthorized', message: 'Sign in to continue.' } }, 401)

  it('refreshes once on a 401 and replays the request', async () => {
    let token = 'old'
    const refresh = vi.fn(async () => {
      token = 'new'
      return true
    })
    const { api, fetchMock } = clientWith(
      (_url, init) =>
        (init.headers as Record<string, string>).Authorization === 'Bearer new'
          ? json({ data: USER })
          : unauthorized(),
      { getAccessToken: () => token, refresh },
    )
    expect((await api.me.get()).id).toBe(USER.id)
    expect(refresh).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('shares one refresh between concurrent requests', async () => {
    let token = 'old'
    const refresh = vi.fn(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10))
      token = 'new'
      return true
    })
    const { api } = clientWith(
      (_url, init) =>
        (init.headers as Record<string, string>).Authorization === 'Bearer new'
          ? json({ data: USER })
          : unauthorized(),
      { getAccessToken: () => token, refresh },
    )
    await Promise.all([api.me.get(), api.me.get(), api.me.get()])
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it('gives up when the refresh fails, and surfaces the 401', async () => {
    const refresh = vi.fn(async () => false)
    const { api, fetchMock } = clientWith(unauthorized, { refresh })
    await expect(api.me.get()).rejects.toMatchObject({ code: 'unauthorized', status: 401 })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('does not loop when the replay is also refused', async () => {
    const refresh = vi.fn(async () => true)
    const { api, fetchMock } = clientWith(unauthorized, { refresh })
    await expect(api.me.get()).rejects.toMatchObject({ status: 401 })
    expect(refresh).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('never refreshes because a sign-in was refused', async () => {
    const refresh = vi.fn(async () => true)
    const { api } = clientWith(unauthorized, { refresh })
    await expect(api.auth.login({ email: 'a@example.com', password: 'x' })).rejects.toMatchObject({
      status: 401,
    })
    expect(refresh).not.toHaveBeenCalled()
  })

  it('treats a throwing refresh as a failed one', async () => {
    const { api } = clientWith(unauthorized, {
      refresh: async () => {
        throw new Error('offline')
      },
    })
    await expect(api.me.get()).rejects.toMatchObject({ status: 401 })
  })
})
