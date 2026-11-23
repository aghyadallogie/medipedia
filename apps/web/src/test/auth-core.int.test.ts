/**
 * The Phase 4 spike (AGENTS.md §13): proves our access tokens work as a Payload auth strategy,
 * that refresh tokens rotate with reuse detection, and that the account rules hold, against a
 * real Postgres. Everything later in the phase builds on this.
 */
import { REST_GET } from '@payloadcms/next/routes'
import type { Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { env } from '@/env'
import type { User } from '@/payload-types'
import {
  hashRefreshToken,
  issueRefreshToken,
  REFRESH_REUSE_GRACE_SECONDS,
  revokeAllForUser,
  revokeFamily,
  rotateRefreshToken,
} from '@/server/auth/refresh-tokens'
import { signAccessToken } from '@/server/auth/tokens'

import { asUser, creator, PASSWORD, startHarness, type Harness } from './harness'

let harness: Harness
let payload: Payload
let create: ReturnType<typeof creator>
let admin: User
let learner: User

let counter = 0
const email = (prefix: string) => `${prefix}-${++counter}@example.com`

async function newLearner(overrides: Record<string, unknown> = {}) {
  return create({
    collection: 'users',
    data: {
      email: email('learner'),
      password: PASSWORD,
      name: 'Learner',
      _verified: true,
      ...overrides,
    },
    disableVerificationEmail: true,
  })
}

const bearer = (token: string) => new Headers({ authorization: `Bearer ${token}` })

async function tokenFor(user: User, audience: 'web' | 'mobile' = 'web') {
  return (await signAccessToken(env.JWT_SECRET, { userId: user.id, role: user.role, audience }))
    .token
}

async function familyRows(familyId: string) {
  const { docs } = await payload.find({
    collection: 'refresh-tokens',
    where: { familyId: { equals: familyId } },
    sort: 'createdAt',
    overrideAccess: true,
    depth: 0,
  })
  return docs
}

beforeAll(async () => {
  harness = await startHarness()
  payload = harness.payload
  create = creator(payload)

  // The first account ever created becomes the admin, already verified.
  admin = await create({
    collection: 'users',
    data: { email: 'admin@example.com', password: PASSWORD, name: 'Admin' },
    disableVerificationEmail: true,
  })
  learner = await newLearner({ email: 'learner@example.com' })
})

afterAll(async () => {
  await harness?.stop()
})

describe('the access-token strategy inside Payload', () => {
  it('authenticates a Bearer token through payload.auth', async () => {
    const result = await payload.auth({ headers: bearer(await tokenFor(learner, 'mobile')) })
    expect(result.user?.id).toBe(learner.id)
    expect(result.user?.email).toBe('learner@example.com')
  })

  it('authenticates the access_token cookie', async () => {
    const headers = new Headers({ cookie: `access_token=${await tokenFor(learner)}` })
    expect((await payload.auth({ headers })).user?.id).toBe(learner.id)
  })

  it('treats everything else as anonymous', async () => {
    const expired = (
      await signAccessToken(
        env.JWT_SECRET,
        { userId: learner.id, role: 'learner', audience: 'web' },
        new Date(Date.now() - 3600_000),
      )
    ).token
    const wrongSecret = (
      await signAccessToken('a-completely-different-secret-of-32-chars', {
        userId: learner.id,
        role: 'learner',
        audience: 'web',
      })
    ).token

    for (const token of ['garbage', expired, wrongSecret]) {
      expect((await payload.auth({ headers: bearer(token) })).user).toBeNull()
    }
    expect((await payload.auth({ headers: new Headers() })).user).toBeNull()
  })

  it('stops working the moment the account is deleted', async () => {
    const doomed = await newLearner()
    const token = await tokenFor(doomed)
    expect((await payload.auth({ headers: bearer(token) })).user?.id).toBe(doomed.id)
    await payload.delete({ collection: 'users', id: doomed.id })
    expect((await payload.auth({ headers: bearer(token) })).user).toBeNull()
  })

  it('uses the role stored in the database, not the one claimed in the token', async () => {
    const claimsAdmin = (
      await signAccessToken(env.JWT_SECRET, { userId: learner.id, role: 'admin', audience: 'web' })
    ).token
    const { user } = await payload.auth({ headers: bearer(claimsAdmin) })
    expect(user?.role).toBe('learner')
  })

  async function rest(path: string, token?: string) {
    const [pathname = '', query] = path.split('?')
    const slug = pathname.split('/').filter(Boolean)
    const request = new Request(
      `http://localhost:3000/api/cms/${slug.join('/')}${query ? `?${query}` : ''}`,
      {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      },
    )
    return REST_GET(harness.config)(request, { params: Promise.resolve({ slug }) })
  }

  it('is honoured by Payload’s own REST API, with the learner’s own permissions only', async () => {
    const token = await tokenFor(learner)

    const me = await rest('users/me', token)
    expect(me.status).toBe(200)
    expect(((await me.json()) as { user: { email: string } }).user.email).toBe(
      'learner@example.com',
    )

    const list = await rest('users?limit=100', token)
    expect(list.status).toBe(200)
    const { docs } = (await list.json()) as { docs: Array<{ email: string }> }
    expect(docs.map((doc) => doc.email)).toEqual(['learner@example.com'])

    expect((await rest('refresh-tokens', token)).status).toBe(403)
    expect((await rest('users/me')).status).toBe(200) // anonymous: { user: null }
    expect(((await (await rest('users/me')).json()) as { user: unknown }).user).toBeNull()
  })

  it('does not turn a learner token into an admin session', async () => {
    const response = await rest('users/me', await tokenFor(learner))
    const body = (await response.json()) as { user: { role: string } }
    expect(body.user.role).toBe('learner')
  })
})

describe('accounts', () => {
  it('makes the first account an admin and verified, so it can sign in at once', async () => {
    expect(admin.role).toBe('admin')
    expect(admin._verified).toBe(true)
    const login = await payload.login({
      collection: 'users',
      data: { email: 'admin@example.com', password: PASSWORD },
    })
    expect(login.user?.id).toBe(admin.id)
  })

  it('leaves public sign-ups unverified and unable to sign in until they verify', async () => {
    const address = email('signup')
    const created = await create({
      collection: 'users',
      data: { email: address, password: PASSWORD },
      disableVerificationEmail: true,
    })
    expect(created.role).toBe('learner')
    expect(created.provider).toBe('email')
    expect(created._verified).toBe(false)

    await expect(
      payload.login({ collection: 'users', data: { email: address, password: PASSWORD } }),
    ).rejects.toThrow(/verify/i)

    // The check comes after the password: a wrong password reveals nothing about verification.
    await expect(
      payload.login({ collection: 'users', data: { email: address, password: 'wrong password!' } }),
    ).rejects.toThrow(/incorrect/i)

    const { docs } = await payload.find({
      collection: 'users',
      where: { email: { equals: address } },
      showHiddenFields: true,
      overrideAccess: true,
    })
    const token = docs[0]?._verificationToken
    expect(token).toEqual(expect.any(String))

    expect(await payload.verifyEmail({ collection: 'users', token: token ?? '' })).toBe(true)
    const login = await payload.login({
      collection: 'users',
      data: { email: address, password: PASSWORD },
    })
    expect(login.user?.email).toBe(address)

    // The token works once.
    await expect(payload.verifyEmail({ collection: 'users', token: token ?? '' })).rejects.toThrow()
  })

  it('verifies accounts that an admin creates', async () => {
    const created = await create({
      collection: 'users',
      data: { email: email('by-admin'), password: PASSWORD },
      user: asUser(admin),
      overrideAccess: false,
      disableVerificationEmail: true,
    })
    expect(created._verified).toBe(true)
  })

  it('locks an account after five wrong passwords, even for the right one', async () => {
    const victim = await newLearner()
    for (let attempt = 0; attempt < 5; attempt++) {
      await expect(
        payload.login({
          collection: 'users',
          data: { email: victim.email, password: 'wrong password!' },
        }),
      ).rejects.toThrow()
    }
    await expect(
      payload.login({ collection: 'users', data: { email: victim.email, password: PASSWORD } }),
    ).rejects.toThrow(/locked/i)
  })

  it('stops a learner changing their own email or verification through Payload', async () => {
    const me = await newLearner()
    const updated = await payload.update({
      collection: 'users',
      id: me.id,
      data: { name: 'New Name', email: 'victim@example.com', _verified: false },
      user: asUser(me),
      overrideAccess: false,
    })
    expect(updated.name).toBe('New Name')
    expect(updated.email).toBe(me.email)
    expect(updated._verified).toBe(true)
  })

  it('still lets an admin change them', async () => {
    const target = await newLearner()
    const newAddress = email('changed-by-admin')
    const updated = await payload.update({
      collection: 'users',
      id: target.id,
      data: { email: newAddress },
      user: asUser(admin),
      overrideAccess: false,
    })
    expect(updated.email).toBe(newAddress)
  })

  it('resets a forgotten password with a one-time token', async () => {
    const forgetful = await newLearner()
    const token = await payload.forgotPassword({
      collection: 'users',
      data: { email: forgetful.email },
      disableEmail: true,
    })
    expect(token).toEqual(expect.any(String))

    await payload.resetPassword({
      collection: 'users',
      data: { token, password: 'a brand new password' },
      overrideAccess: true,
    })
    const login = await payload.login({
      collection: 'users',
      data: { email: forgetful.email, password: 'a brand new password' },
    })
    expect(login.user?.id).toBe(forgetful.id)
    await expect(
      payload.login({ collection: 'users', data: { email: forgetful.email, password: PASSWORD } }),
    ).rejects.toThrow()
    await expect(
      payload.resetPassword({
        collection: 'users',
        data: { token, password: 'yet another password' },
        overrideAccess: true,
      }),
    ).rejects.toThrow()
  })
})

describe('refresh token rotation', () => {
  async function login(audience: 'web' | 'mobile' = 'web') {
    const user = await newLearner()
    const refresh = await issueRefreshToken(payload, { userId: user.id, audience })
    return { user, refresh }
  }

  it('stores only a hash, never the token itself', async () => {
    const { refresh } = await login()
    const [row] = await familyRows(refresh.familyId)
    expect(row?.tokenHash).toBe(hashRefreshToken(refresh.token))
    expect(row?.tokenHash).not.toBe(refresh.token)
    expect(JSON.stringify(row)).not.toContain(refresh.token)
    expect(refresh.token).toMatch(/^[A-Za-z0-9_-]{43}$/)
  })

  it('gives web logins seven days and mobile logins thirty', async () => {
    const day = 86_400_000
    const { refresh: web } = await login('web')
    const { refresh: mobile } = await login('mobile')
    expect(Math.round((web.expiresAt.getTime() - Date.now()) / day)).toBe(7)
    expect(Math.round((mobile.expiresAt.getTime() - Date.now()) / day)).toBe(30)
  })

  it('replaces the token on every use, keeping the family and revoking the old one', async () => {
    const { user, refresh } = await login()
    const result = await rotateRefreshToken(payload, refresh.token, 'web')
    expect(result.kind).toBe('rotated')
    if (result.kind !== 'rotated') return
    expect(result.userId).toBe(user.id)
    expect(result.refresh.token).not.toBe(refresh.token)
    expect(result.refresh.familyId).toBe(refresh.familyId)

    const [oldRow, newRow] = await familyRows(refresh.familyId)
    expect(oldRow?.revokedAt).toBeTruthy()
    expect(oldRow?.rotatedAt).toBeTruthy()
    expect(newRow?.revokedAt).toBeFalsy()

    // And the new one rotates in turn.
    expect((await rotateRefreshToken(payload, result.refresh.token, 'web')).kind).toBe('rotated')
  })

  it('revokes the whole family when a rotated token comes back after the grace window', async () => {
    const { refresh } = await login()
    const first = await rotateRefreshToken(payload, refresh.token, 'web')
    if (first.kind !== 'rotated') throw new Error('expected a rotation')

    const later = new Date(Date.now() + (REFRESH_REUSE_GRACE_SECONDS + 1) * 1000)
    expect((await rotateRefreshToken(payload, refresh.token, 'web', later)).kind).toBe('reused')

    // The thief's copy and the victim's newest token are both dead: sign in again.
    expect((await rotateRefreshToken(payload, first.refresh.token, 'web')).kind).toBe('reused')
    const rows = await familyRows(refresh.familyId)
    expect(rows.every((row) => row.revokedAt)).toBe(true)
  })

  it('lets a concurrent request through the grace window with an access token only', async () => {
    const { refresh } = await login()
    const first = await rotateRefreshToken(payload, refresh.token, 'web')
    expect(first.kind).toBe('rotated')

    const second = await rotateRefreshToken(payload, refresh.token, 'web')
    expect(second.kind).toBe('grace')
    // No second successor was minted.
    expect(await familyRows(refresh.familyId)).toHaveLength(2)
  })

  it('rotates exactly once when two requests race with the same token', async () => {
    const { refresh } = await login()
    const results = await Promise.all([
      rotateRefreshToken(payload, refresh.token, 'web'),
      rotateRefreshToken(payload, refresh.token, 'web'),
      rotateRefreshToken(payload, refresh.token, 'web'),
    ])
    expect(results.filter((r) => r.kind === 'rotated')).toHaveLength(1)
    expect(results.filter((r) => r.kind === 'grace')).toHaveLength(2)
    expect(await familyRows(refresh.familyId)).toHaveLength(2)
  })

  it('does not let the grace window outlive a sign-out', async () => {
    const { refresh } = await login()
    const first = await rotateRefreshToken(payload, refresh.token, 'web')
    if (first.kind !== 'rotated') throw new Error('expected a rotation')

    await revokeFamily(payload, refresh.familyId)
    expect((await rotateRefreshToken(payload, refresh.token, 'web')).kind).toBe('reused')
    expect((await rotateRefreshToken(payload, first.refresh.token, 'web')).kind).toBe('reused')
  })

  it('rejects unknown, expired and wrong-audience tokens without revoking anything', async () => {
    const { refresh } = await login('web')
    expect((await rotateRefreshToken(payload, 'x'.repeat(43), 'web')).kind).toBe('invalid')

    // Presenting a web token as a mobile one is refused and does not burn the web session.
    expect((await rotateRefreshToken(payload, refresh.token, 'mobile')).kind).toBe('invalid')
    expect((await familyRows(refresh.familyId))[0]?.revokedAt).toBeFalsy()

    const long = new Date(Date.now() + 8 * 86_400_000)
    expect((await rotateRefreshToken(payload, refresh.token, 'web', long)).kind).toBe('invalid')
  })

  it('revokes every login of a user at once', async () => {
    const { user, refresh } = await login()
    const second = await issueRefreshToken(payload, { userId: user.id, audience: 'mobile' })
    await revokeAllForUser(payload, user.id)
    expect((await rotateRefreshToken(payload, refresh.token, 'web')).kind).toBe('reused')
    expect((await rotateRefreshToken(payload, second.token, 'mobile')).kind).toBe('reused')
  })

  it('keeps one login’s family separate from another’s', async () => {
    const user = await newLearner()
    const a = await issueRefreshToken(payload, { userId: user.id, audience: 'web' })
    const b = await issueRefreshToken(payload, { userId: user.id, audience: 'web' })
    expect(a.familyId).not.toBe(b.familyId)
    await revokeFamily(payload, a.familyId)
    expect((await rotateRefreshToken(payload, b.token, 'web')).kind).toBe('rotated')
  })
})
