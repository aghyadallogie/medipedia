import { AUTH_COOKIES } from '@medipedia/shared'
import { NextRequest } from 'next/server'
import { describe, expect, it, vi } from 'vitest'

import { signAccessToken } from '@/server/auth/tokens'

const SECRET = 's'.repeat(40)

vi.mock('@/env', () => ({ env: { JWT_SECRET: 's'.repeat(40) } }))

const { proxy, config } = await import('./proxy')

async function visit(path: string, cookies: Record<string, string> = {}) {
  const cookie = Object.entries(cookies)
    .map(([name, value]) => `${name}=${value}`)
    .join('; ')
  const response = await proxy(
    new NextRequest(`http://localhost:3000${path}`, { headers: cookie ? { cookie } : {} }),
  )
  const location = response.headers.get('location')
  return { status: response.status, location: location ? new URL(location) : null }
}

const accessToken = async () =>
  (await signAccessToken(SECRET, { userId: 'u1', role: 'learner', audience: 'web' })).token

describe('proxy: guest pages', () => {
  it.each(['/sign-in', '/sign-up', '/forgot-password'])(
    'sends a signed-in visitor from %s to the account page',
    async (path) => {
      const { status, location } = await visit(path, { [AUTH_COOKIES.access]: await accessToken() })
      expect(status).toBe(307)
      expect(location?.pathname).toBe('/account')
    },
  )

  it('sends a signed-in visitor on to the page they were heading for', async () => {
    const { location } = await visit('/sign-in?next=/lectures%3Fpage%3D2', {
      [AUTH_COOKIES.access]: await accessToken(),
    })
    expect(location?.pathname).toBe('/lectures')
    expect(location?.search).toBe('?page=2')
  })

  it.each([
    '/sign-in?next=/sign-in',
    '/sign-in?next=//evil.example',
    '/sign-in?next=https://evil.example',
  ])('never loops or leaves the site: %s', async (path) => {
    const { location } = await visit(path, { [AUTH_COOKIES.access]: await accessToken() })
    expect(location?.origin).toBe('http://localhost:3000')
    expect(location?.pathname).toBe('/account')
  })

  it('shows the page to someone who is not signed in', async () => {
    expect((await visit('/sign-in')).location).toBeNull()
    expect((await visit('/sign-in', { [AUTH_COOKIES.access]: 'garbage' })).location).toBeNull()
  })

  it('renews an expired session once, without looping when the refresh fails', async () => {
    const hint = { [AUTH_COOKIES.hint]: '1' }
    const bounce = await visit('/sign-in', hint)
    expect(bounce.location?.pathname).toBe('/api/v1/auth/refresh')
    expect(bounce.location?.searchParams.get('next')).toBe('/account')
    // A failed refresh comes back as /sign-in?next=..., which must be left alone.
    expect((await visit('/sign-in?next=%2Faccount', hint)).location).toBeNull()
  })
})

describe('proxy: members-only pages', () => {
  it.each([
    '/account',
    '/practice',
    '/practice/analytics',
    '/lectures',
    '/lectures/some-slug',
    '/papers',
    '/videos',
    '/domains',
    '/flashcards/acs',
    '/anything-else',
  ])('lets a signed-in visitor through to %s', async (path) => {
    const { status } = await visit(path, { [AUTH_COOKIES.access]: await accessToken() })
    expect(status).toBe(200)
  })

  it('sends a visitor with no session straight to the sign-in page, coming back afterwards', async () => {
    const { status, location } = await visit('/lectures/some-slug?tab=notes')
    expect(status).toBe(307)
    expect(location?.pathname).toBe('/sign-in')
    expect(location?.searchParams.get('next')).toBe('/lectures/some-slug?tab=notes')
  })

  it('ignores a garbage access token like no token', async () => {
    const { location } = await visit('/practice', { [AUTH_COOKIES.access]: 'garbage' })
    expect(location?.pathname).toBe('/sign-in')
    expect(location?.searchParams.get('next')).toBe('/practice')
  })

  it('renews a session that may still be alive (hint cookie) through the refresh endpoint', async () => {
    for (const path of ['/account', '/practice', '/lectures']) {
      const { status, location } = await visit(path, { [AUTH_COOKIES.hint]: '1' })
      expect(status).toBe(307)
      expect(location?.pathname).toBe('/api/v1/auth/refresh')
      expect(location?.searchParams.get('next')).toBe(path)
    }
  })
})

describe('proxy: public pages', () => {
  it.each(['/', '/reset-password', '/verify-email', '/terms', '/privacy'])(
    'shows %s to a visitor who is not signed in',
    async (path) => {
      const { status, location } = await visit(path)
      expect(status).toBe(200)
      expect(location).toBeNull()
    },
  )

  it('keeps the query string of an email link intact', async () => {
    expect((await visit('/reset-password?token=abc')).location).toBeNull()
    expect((await visit('/verify-email?token=abc')).location).toBeNull()
  })
})

describe('proxy: which requests it sees', () => {
  const [pattern] = config.matcher
  const sees = (path: string) => new RegExp(`^${pattern}$`).test(path)

  it('covers pages', () => {
    for (const path of ['/', '/lectures', '/practice/analytics', '/sign-in', '/administrator']) {
      expect(sees(path)).toBe(true)
    }
  })

  it('leaves out the APIs, the admin panel, Next internals and files with an extension', () => {
    for (const path of [
      '/api/v1/me',
      '/api/cms/users/login',
      '/admin',
      '/admin/collections/lectures',
      '/_next/static/chunk.js',
      '/_next/image',
      '/icon.png',
      '/apple-icon.png',
      '/logo.png',
      '/robots.txt',
      '/sitemap.xml',
      '/manifest.webmanifest',
    ]) {
      expect(sees(path)).toBe(false)
    }
  })
})

describe('proxy: Payload credential routes', () => {
  const attempt = async (path: string, ip: string, method = 'POST') => {
    const response = await proxy(
      new NextRequest(`http://localhost:3000${path}`, { method, headers: { 'x-real-ip': ip } }),
    )
    return { status: response.status, retryAfter: response.headers.get('retry-after') }
  }

  it('refuses the eleventh sign-in attempt from one address, with Retry-After', async () => {
    for (let i = 0; i < 10; i++) {
      expect((await attempt('/api/cms/users/login', '203.0.113.20')).status).toBe(200)
    }
    const blocked = await attempt('/api/cms/users/login', '203.0.113.20')
    expect(blocked.status).toBe(429)
    expect(Number(blocked.retryAfter)).toBeGreaterThan(0)
    // Another address is unaffected.
    expect((await attempt('/api/cms/users/login', '203.0.113.21')).status).toBe(200)
  })

  it.each([
    '/api/cms/users/forgot-password',
    '/api/cms/users/reset-password',
    '/api/cms/users/unlock',
    '/api/cms/users/first-register',
    '/api/cms/users/verify/some-token',
  ])('counts %s as a credential route', async (path) => {
    const ip = `198.51.100.${path.length}`
    for (let i = 0; i < 10; i++) await attempt(path, ip)
    expect((await attempt(path, ip)).status).toBe(429)
  })

  it("leaves reads and the admin panel's other calls alone", async () => {
    for (let i = 0; i < 15; i++) {
      expect((await attempt('/api/cms/users/me', '192.0.2.30', 'GET')).status).toBe(200)
      expect((await attempt('/api/cms/users/refresh-token', '192.0.2.30')).status).toBe(200)
      expect((await attempt('/api/cms/lectures', '192.0.2.30')).status).toBe(200)
    }
  })

  it('is part of what the proxy sees', () => {
    expect(config.matcher).toContain('/api/cms/users/:path*')
  })
})
