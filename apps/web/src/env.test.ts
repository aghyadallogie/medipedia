import { describe, expect, it } from 'vitest'

import { parsePublicEnv, parseServerEnv } from './env'

const valid = {
  DATABASE_URL: 'postgres://u:p@localhost:5432/db',
  DATABASE_URL_UNPOOLED: 'postgresql://u:p@localhost:5432/db',
  PAYLOAD_SECRET: 'p'.repeat(32),
  JWT_SECRET: 'j'.repeat(32),
}

describe('parseServerEnv', () => {
  it('accepts the required variables and applies defaults', () => {
    const env = parseServerEnv(valid)
    expect(env.NODE_ENV).toBe('development')
    expect(env.PAYLOAD_MIGRATING).toBe(false)
    expect(env.GOOGLE_CLIENT_ID).toBeUndefined()
    expect(env.RESEND_API_KEY).toBeUndefined()
  })

  it('parses PAYLOAD_MIGRATING as a boolean', () => {
    expect(parseServerEnv({ ...valid, PAYLOAD_MIGRATING: 'true' }).PAYLOAD_MIGRATING).toBe(true)
  })

  it('treats empty strings as unset for optional variables', () => {
    const env = parseServerEnv({ ...valid, RESEND_API_KEY: '', GOOGLE_CLIENT_ID: '' })
    expect(env.RESEND_API_KEY).toBeUndefined()
    expect(env.GOOGLE_CLIENT_ID).toBeUndefined()
  })

  it('names every missing required variable', () => {
    expect(() => parseServerEnv({})).toThrowError(
      /DATABASE_URL[\s\S]*DATABASE_URL_UNPOOLED[\s\S]*PAYLOAD_SECRET[\s\S]*JWT_SECRET/,
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

  it('requires a JWT_SECRET of at least 32 characters', () => {
    expect(() => parseServerEnv({ ...valid, JWT_SECRET: 'short' })).toThrowError(/JWT_SECRET/)
    expect(() => parseServerEnv({ ...valid, JWT_SECRET: '' })).toThrowError(/JWT_SECRET/)
  })

  it('rejects JWT_SECRET equal to PAYLOAD_SECRET', () => {
    expect(() => parseServerEnv({ ...valid, JWT_SECRET: valid.PAYLOAD_SECRET })).toThrowError(
      /JWT_SECRET must differ/,
    )
  })

  it('needs both Google credentials or neither', () => {
    expect(() => parseServerEnv({ ...valid, GOOGLE_CLIENT_ID: 'id' })).toThrowError(
      /GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET/,
    )
    expect(() => parseServerEnv({ ...valid, GOOGLE_CLIENT_SECRET: 'secret' })).toThrowError(
      /GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET/,
    )
    expect(
      parseServerEnv({ ...valid, GOOGLE_CLIENT_ID: 'id', GOOGLE_CLIENT_SECRET: 'secret' })
        .GOOGLE_CLIENT_ID,
    ).toBe('id')
  })

  describe('on Vercel', () => {
    const deployed = { ...valid, BLOB_READ_WRITE_TOKEN: 'token' }

    it('requires email settings on preview and production', () => {
      for (const VERCEL_ENV of ['preview', 'production']) {
        expect(() => parseServerEnv({ ...deployed, VERCEL_ENV })).toThrowError(/RESEND_API_KEY/)
        expect(() =>
          parseServerEnv({ ...deployed, VERCEL_ENV, RESEND_API_KEY: 'key' }),
        ).toThrowError(/EMAIL_FROM/)
        expect(
          parseServerEnv({
            ...deployed,
            VERCEL_ENV,
            RESEND_API_KEY: 'key',
            EMAIL_FROM: 'Medipedia <hello@example.com>',
          }).VERCEL_ENV,
        ).toBe(VERCEL_ENV)
      }
    })

    it('does not require them for local `vercel dev`', () => {
      expect(() => parseServerEnv({ ...deployed, VERCEL_ENV: 'development' })).not.toThrow()
    })
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
