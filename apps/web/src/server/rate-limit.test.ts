import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/env', () => ({ env: { NODE_ENV: 'test' } }))

const { checkRateLimit, clientIp, enforceRateLimit, limitByEmail, rateLimitTesting } =
  await import('./rate-limit')

const RULE = { name: 'unit', limit: 3, windowSeconds: 60 }

beforeEach(() => {
  rateLimitTesting.reset()
  rateLimitTesting.setEnabled(true)
})
afterEach(() => {
  vi.useRealTimers()
  rateLimitTesting.setEnabled(false)
})

describe('checkRateLimit (in-memory window)', () => {
  it('allows up to the limit, then refuses with the time left', async () => {
    for (let i = 0; i < 3; i++) expect(await checkRateLimit(RULE, 'a')).toEqual({ allowed: true })
    const verdict = await checkRateLimit(RULE, 'a')
    expect(verdict).toMatchObject({ allowed: false })
    expect(verdict.allowed === false && verdict.retryAfterSeconds).toBeGreaterThan(0)
    expect(verdict.allowed === false && verdict.retryAfterSeconds).toBeLessThanOrEqual(60)
  })

  it('counts each subject and each rule separately', async () => {
    for (let i = 0; i < 3; i++) await checkRateLimit(RULE, 'a')
    expect(await checkRateLimit(RULE, 'a')).toMatchObject({ allowed: false })
    expect(await checkRateLimit(RULE, 'b')).toEqual({ allowed: true })
    expect(await checkRateLimit({ ...RULE, name: 'other' }, 'a')).toEqual({ allowed: true })
  })

  it('lets requests through again once the window has passed', async () => {
    vi.useFakeTimers()
    for (let i = 0; i < 3; i++) await checkRateLimit(RULE, 'a')
    expect(await checkRateLimit(RULE, 'a')).toMatchObject({ allowed: false })
    vi.advanceTimersByTime(61_000)
    expect(await checkRateLimit(RULE, 'a')).toEqual({ allowed: true })
  })

  it('does not count refused requests against the subject', async () => {
    vi.useFakeTimers()
    for (let i = 0; i < 3; i++) await checkRateLimit(RULE, 'a')
    vi.advanceTimersByTime(30_000)
    for (let i = 0; i < 10; i++) await checkRateLimit(RULE, 'a') // all refused
    vi.advanceTimersByTime(31_000) // the first three have now left the window
    expect(await checkRateLimit(RULE, 'a')).toEqual({ allowed: true })
  })

  it('is off when disabled, which is the default under NODE_ENV=test', async () => {
    rateLimitTesting.setEnabled(false)
    for (let i = 0; i < 20; i++) expect(await checkRateLimit(RULE, 'a')).toEqual({ allowed: true })
  })
})

describe('enforceRateLimit', () => {
  it('throws a rate_limited ApiError that carries the wait', async () => {
    for (let i = 0; i < 3; i++) await enforceRateLimit(RULE, 'a')
    const error = await enforceRateLimit(RULE, 'a').catch((e: unknown) => e)
    expect(error).toMatchObject({
      code: 'rate_limited',
      status: 429,
      details: { retryAfterSeconds: expect.any(Number) },
    })
  })

  it('treats an email the same in any case and with stray spaces', async () => {
    for (let i = 0; i < 3; i++) await limitByEmail('  Ada@Example.com ', RULE)
    await expect(limitByEmail('ada@example.com', RULE)).rejects.toMatchObject({
      code: 'rate_limited',
    })
  })
})

describe('clientIp', () => {
  const req = (headers: Record<string, string>) => new Request('http://x.test/', { headers })

  it('prefers x-real-ip, then the first x-forwarded-for entry', () => {
    expect(clientIp(req({ 'x-real-ip': '1.1.1.1', 'x-forwarded-for': '2.2.2.2' }))).toBe('1.1.1.1')
    expect(clientIp(req({ 'x-forwarded-for': '2.2.2.2, 3.3.3.3' }))).toBe('2.2.2.2')
  })

  it('falls back to one shared bucket when there is no address', () => {
    expect(clientIp(req({}))).toBe('unknown')
  })
})
