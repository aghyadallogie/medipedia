import { describe, expect, it } from 'vitest'
import { z } from 'zod'

import {
  API_ERROR_CODES,
  API_ERROR_STATUS,
  ApiErrorBodySchema,
  PaginationQuerySchema,
  paginatedResponse,
} from '../api'
import { PAGINATION } from '../constants'

describe('PaginationQuerySchema', () => {
  it('defaults limit when omitted', () => {
    expect(PaginationQuerySchema.parse({})).toEqual({ limit: PAGINATION.defaultLimit })
  })

  it('coerces limit from a query string', () => {
    expect(PaginationQuerySchema.parse({ limit: '50', cursor: 'abc' })).toEqual({
      limit: 50,
      cursor: 'abc',
    })
  })

  it.each(['0', '101', '2.5', 'ten'])('rejects limit=%s', (limit) => {
    expect(PaginationQuerySchema.safeParse({ limit }).success).toBe(false)
  })

  it('rejects an empty cursor', () => {
    expect(PaginationQuerySchema.safeParse({ cursor: '' }).success).toBe(false)
  })
})

describe('paginatedResponse', () => {
  const Schema = paginatedResponse(z.object({ id: z.string() }))

  it('accepts a page with a null cursor', () => {
    expect(Schema.safeParse({ data: [{ id: 'a' }], nextCursor: null }).success).toBe(true)
  })

  it('requires nextCursor to be present', () => {
    expect(Schema.safeParse({ data: [] }).success).toBe(false)
  })
})

describe('API errors', () => {
  it('maps every code to a 4xx or 5xx status', () => {
    for (const code of API_ERROR_CODES) {
      expect(API_ERROR_STATUS[code]).toBeGreaterThanOrEqual(400)
    }
  })

  it('rejects unknown error codes', () => {
    expect(
      ApiErrorBodySchema.safeParse({ error: { code: 'teapot', message: 'nope' } }).success,
    ).toBe(false)
  })
})
