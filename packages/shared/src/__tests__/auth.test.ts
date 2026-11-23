import { describe, expect, it } from 'vitest'

import {
  DeleteMeBodySchema,
  EmailSchema,
  ForgotPasswordBodySchema,
  GoogleMobileBodySchema,
  LoginBodySchema,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  PasswordSchema,
  RegisterBodySchema,
  ResetPasswordBodySchema,
  SessionSchema,
  UpdateMeBodySchema,
  VerifyEmailBodySchema,
} from '../auth'

const id = '00000000-0000-4000-8000-000000000001'
const NOW = '2026-11-22T12:00:00.000Z'
const token = 'a'.repeat(40)

describe('EmailSchema', () => {
  it('trims and lower-cases so addresses match regardless of how they are typed', () => {
    expect(EmailSchema.parse('  Jane.Doe@Example.COM ')).toBe('jane.doe@example.com')
  })

  it.each(['', 'not-an-email', 'a@', '@b.com', 'a b@c.com', `${'x'.repeat(250)}@a.com`])(
    'rejects %j',
    (value) => {
      expect(EmailSchema.safeParse(value).success).toBe(false)
    },
  )
})

describe('PasswordSchema', () => {
  it('accepts length alone, with no composition rules', () => {
    expect(PasswordSchema.safeParse('a'.repeat(PASSWORD_MIN_LENGTH)).success).toBe(true)
    expect(PasswordSchema.safeParse('correct horse battery staple').success).toBe(true)
    expect(PasswordSchema.safeParse('a'.repeat(PASSWORD_MAX_LENGTH)).success).toBe(true)
  })

  it('does not trim, because spaces are legitimate characters', () => {
    expect(PasswordSchema.parse('  spaced password  ')).toBe('  spaced password  ')
  })

  it('rejects too short and too long', () => {
    expect(PasswordSchema.safeParse('a'.repeat(PASSWORD_MIN_LENGTH - 1)).success).toBe(false)
    expect(PasswordSchema.safeParse('a'.repeat(PASSWORD_MAX_LENGTH + 1)).success).toBe(false)
  })
})

describe('request bodies', () => {
  it('register: requires email and password, name is optional and trimmed', () => {
    expect(
      RegisterBodySchema.parse({ email: 'A@b.co', password: 'long enough pw', name: '  Ada  ' }),
    ).toEqual({ email: 'a@b.co', password: 'long enough pw', name: 'Ada' })
    expect(RegisterBodySchema.safeParse({ email: 'a@b.co', password: 'short' }).success).toBe(false)
    expect(RegisterBodySchema.safeParse({ email: 'a@b.co' }).success).toBe(false)
    expect(
      RegisterBodySchema.safeParse({ email: 'a@b.co', password: 'long enough pw', name: '   ' })
        .success,
    ).toBe(false)
  })

  it('login: defaults to the web client and does not enforce the password rules', () => {
    expect(LoginBodySchema.parse({ email: 'a@b.co', password: 'x' })).toEqual({
      email: 'a@b.co',
      password: 'x',
      client: 'web',
    })
    expect(
      LoginBodySchema.parse({
        email: 'a@b.co',
        password: 'x',
        client: 'mobile',
        deviceLabel: 'iPhone',
      }),
    ).toMatchObject({ client: 'mobile', deviceLabel: 'iPhone' })
    expect(LoginBodySchema.safeParse({ email: 'a@b.co', password: '' }).success).toBe(false)
    expect(
      LoginBodySchema.safeParse({ email: 'a@b.co', password: 'x', client: 'tv' }).success,
    ).toBe(false)
  })

  it('verify, forgot and reset: validate tokens and emails', () => {
    expect(VerifyEmailBodySchema.safeParse({ token }).success).toBe(true)
    expect(VerifyEmailBodySchema.safeParse({ token: 'short' }).success).toBe(false)
    expect(ForgotPasswordBodySchema.parse({ email: 'X@Y.io' })).toEqual({ email: 'x@y.io' })
    expect(
      ResetPasswordBodySchema.safeParse({ token, password: 'a long new password' }).success,
    ).toBe(true)
    expect(ResetPasswordBodySchema.safeParse({ token, password: 'short' }).success).toBe(false)
  })

  it('google mobile: needs a plausible ID token', () => {
    expect(GoogleMobileBodySchema.safeParse({ idToken: 'x'.repeat(100) }).success).toBe(true)
    expect(GoogleMobileBodySchema.safeParse({ idToken: 'tiny' }).success).toBe(false)
  })

  it('update and delete me', () => {
    expect(UpdateMeBodySchema.parse({ name: ' Ada ' })).toEqual({ name: 'Ada' })
    expect(UpdateMeBodySchema.safeParse({ name: '' }).success).toBe(false)
    expect(DeleteMeBodySchema.parse({})).toEqual({})
    expect(DeleteMeBodySchema.parse({ password: 'x' })).toEqual({ password: 'x' })
  })
})

describe('SessionSchema', () => {
  const user = {
    id,
    email: 'a@b.co',
    name: null,
    role: 'learner',
    provider: 'email',
    emailVerified: true,
    createdAt: NOW,
  }

  it('accepts a web session (no tokens) and a mobile session (tokens)', () => {
    expect(SessionSchema.safeParse({ user }).success).toBe(true)
    expect(
      SessionSchema.safeParse({
        user,
        tokens: { accessToken: 'a', refreshToken: 'r', tokenType: 'Bearer', expiresIn: 900 },
      }).success,
    ).toBe(true)
  })

  it('rejects a user with an unknown role or provider', () => {
    expect(SessionSchema.safeParse({ user: { ...user, role: 'owner' } }).success).toBe(false)
    expect(SessionSchema.safeParse({ user: { ...user, provider: 'github' } }).success).toBe(false)
  })
})
