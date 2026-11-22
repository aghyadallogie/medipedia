import { describe, expect, it } from 'vitest'

import { parsePublicEnv, parseServerEnv } from './env'

const valid = {
  DATABASE_URL: 'postgres://u:p@localhost:5432/db',
  DATABASE_URL_UNPOOLED: 'postgresql://u:p@localhost:5432/db',
  PAYLOAD_SECRET: 'p'.repeat(32),
}

describe('parseServerEnv', () => {
  it('accepts the Phase 1 variables and applies defaults', () => {
    const env = parseServerEnv(valid)
    expect(env.NODE_ENV).toBe('development')
    expect(env.PAYLOAD_MIGRATING).toBe(false)
    expect(env.JWT_SECRET).toBeUndefined()
  })

  it('parses PAYLOAD_MIGRATING as a boolean', () => {
    expect(parseServerEnv({ ...valid, PAYLOAD_MIGRATING: 'true' }).PAYLOAD_MIGRATING).toBe(true)
  })

  it('treats empty strings as unset for optional variables', () => {
    expect(parseServerEnv({ ...valid, JWT_SECRET: '' }).JWT_SECRET).toBeUndefined()
  })

  it('names every missing required variable', () => {
    expect(() => parseServerEnv({})).toThrowError(
      /DATABASE_URL[\s\S]*DATABASE_URL_UNPOOLED[\s\S]*PAYLOAD_SECRET/,
    )
  })

  it('rejects a non-postgres DATABASE_URL', () => {
    expect(() => parseServerEnv({ ...valid, DATABASE_URL: 'mongodb://localhost/db' })).toThrowError(
      /DATABASE_URL/,
    )
  })

  it('rejects a short PAYLOAD_SECRET', () => {
    expect(() => parseServerEnv({ ...valid, PAYLOAD_SECRET: 'short' })).toThrowError(
      /PAYLOAD_SECRET/,
    )
  })

  it('rejects JWT_SECRET equal to PAYLOAD_SECRET', () => {
    expect(() => parseServerEnv({ ...valid, JWT_SECRET: valid.PAYLOAD_SECRET })).toThrowError(
      /JWT_SECRET must differ/,
    )
  })
})

describe('parsePublicEnv', () => {
  it('requires NEXT_PUBLIC_SITE_URL to be a URL', () => {
    expect(() => parsePublicEnv({ NEXT_PUBLIC_SITE_URL: 'not a url' })).toThrowError(
      /NEXT_PUBLIC_SITE_URL/,
    )
    expect(parsePublicEnv({ NEXT_PUBLIC_SITE_URL: 'https://example.com' })).toEqual({
      NEXT_PUBLIC_SITE_URL: 'https://example.com',
    })
  })
})
