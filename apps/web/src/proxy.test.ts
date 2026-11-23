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

describe('proxy: protected pages', () => {
  it('lets a signed-in visitor through', async () => {
    const { status } = await visit('/account', { [AUTH_COOKIES.access]: await accessToken() })
    expect(status).toBe(200)
  })

  it('sends everyone else through the refresh endpoint', async () => {
    const { status, location } = await visit('/account')
    expect(status).toBe(307)
    expect(location?.pathname).toBe('/api/v1/auth/refresh')
    expect(location?.searchParams.get('next')).toBe('/account')
  })

  it('keeps the practice questions behind a login too, and renews the session back to them', async () => {
    expect(config.matcher).toContain('/practice/:path*')
    const { status, location } = await visit('/practice')
    expect(status).toBe(307)
    expect(location?.pathname).toBe('/api/v1/auth/refresh')
    expect(location?.searchParams.get('next')).toBe('/practice')
  })
})
