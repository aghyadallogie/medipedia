import { ApiErrorBodySchema } from '@medipedia/shared'
import { describe, expect, it, vi } from 'vitest'
import { z } from 'zod'

import { ApiError, CACHE_CONTROL, errorResponse, handler, ok, okList } from './http'

describe('ok', () => {
  it('wraps data and sets the cache policy', async () => {
    const res = ok({ hello: 'world' }, { cache: 'private' })
    expect(res.status).toBe(200)
    expect(res.headers.get('Cache-Control')).toBe(CACHE_CONTROL.private)
    expect(await res.json()).toEqual({ data: { hello: 'world' } })
  })
})

describe('okList', () => {
  it('wraps items with the next cursor and sets the cache policy', async () => {
    const res = okList([{ a: 1 }], 'next-cursor', { cache: 'private' })
    expect(res.status).toBe(200)
    expect(res.headers.get('Cache-Control')).toBe(CACHE_CONTROL.private)
    expect(await res.json()).toEqual({ data: [{ a: 1 }], nextCursor: 'next-cursor' })
  })

  it('keeps nextCursor present and null on the last page', async () => {
    const res = okList([], null, { cache: 'private' })
    expect(await res.json()).toEqual({ data: [], nextCursor: null })
  })
})

describe('errorResponse', () => {
  it('maps an ApiError to its status and error body', async () => {
    const res = errorResponse(new ApiError('not_found', 'No such lecture.'))
    expect(res.status).toBe(404)
    expect(res.headers.get('Cache-Control')).toBe(CACHE_CONTROL.private)
    const body: unknown = await res.json()
    expect(ApiErrorBodySchema.parse(body)).toEqual({
      error: { code: 'not_found', message: 'No such lecture.' },
    })
  })

  it('maps a ZodError to a 400 with issue details', async () => {
    const result = z.object({ limit: z.number() }).safeParse({ limit: 'x' })
    expect(result.success).toBe(false)
    const res = errorResponse(result.error)
    expect(res.status).toBe(400)
    const body = ApiErrorBodySchema.parse(await res.json())
    expect(body.error.code).toBe('validation_error')
    expect(Array.isArray(body.error.details)).toBe(true)
  })

  it('adds Retry-After to a rate_limited error', async () => {
    const res = errorResponse(new ApiError('rate_limited', 'Slow down.', { retryAfterSeconds: 42 }))
    expect(res.status).toBe(429)
    expect(res.headers.get('Retry-After')).toBe('42')
    expect(res.headers.get('Cache-Control')).toBe(CACHE_CONTROL.private)
  })

  it('omits Retry-After when there is no wait to report', () => {
    expect(
      errorResponse(new ApiError('rate_limited', 'Slow down.')).headers.get('Retry-After'),
    ).toBe(null)
    expect(errorResponse(new ApiError('not_found', 'Nope.')).headers.get('Retry-After')).toBeNull()
  })

  it('hides unknown errors behind a generic 500', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const res = errorResponse(new Error('database password is hunter2'))
    expect(res.status).toBe(500)
    expect(JSON.stringify(await res.json())).not.toContain('hunter2')
    spy.mockRestore()
  })
})

describe('handler', () => {
  it('turns thrown errors into error responses', async () => {
    const route = handler(() => {
      throw new ApiError('forbidden', 'Admins only.')
    })
    const res = await route()
    expect(res.status).toBe(403)
  })
})
