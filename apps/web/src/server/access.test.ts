import type { Access, FieldAccess } from 'payload'
import { describe, expect, it } from 'vitest'

import {
  adminOrOwnRows,
  adminOrPublished,
  anyone,
  isAdmin,
  isAdminFieldLevel,
  isAdminOrSelf,
  nobody,
  nobodyFieldLevel,
  signedInPublishedOrAdmin,
} from './access'

type User = { id: string; role: 'admin' | 'learner' } | null

// Access functions only read `req.user`, so a minimal request is enough.
const run = (access: Access, user: User) =>
  access({ req: { user } } as unknown as Parameters<Access>[0])
const runField = (access: FieldAccess, user: User) =>
  access({ req: { user } } as unknown as Parameters<FieldAccess>[0])

const admin: User = { id: 'a1', role: 'admin' }
const learner: User = { id: 'l1', role: 'learner' }
const published = { _status: { equals: 'published' } }

describe('collection access', () => {
  it('anyone / nobody', () => {
    expect(run(anyone, null)).toBe(true)
    expect(run(nobody, admin)).toBe(false)
  })

  it('isAdmin allows only admins', () => {
    expect(run(isAdmin, admin)).toBe(true)
    expect(run(isAdmin, learner)).toBe(false)
    expect(run(isAdmin, null)).toBe(false)
  })

  it('isAdminOrSelf scopes learners to their own document', () => {
    expect(run(isAdminOrSelf, admin)).toBe(true)
    expect(run(isAdminOrSelf, learner)).toEqual({ id: { equals: 'l1' } })
    expect(run(isAdminOrSelf, null)).toBe(false)
  })

  it('adminOrPublished shows drafts to admins only', () => {
    expect(run(adminOrPublished, admin)).toBe(true)
    expect(run(adminOrPublished, learner)).toEqual(published)
    expect(run(adminOrPublished, null)).toEqual(published)
  })

  it('signedInPublishedOrAdmin hides questions from anonymous callers', () => {
    expect(run(signedInPublishedOrAdmin, null)).toBe(false)
    expect(run(signedInPublishedOrAdmin, learner)).toEqual(published)
    expect(run(signedInPublishedOrAdmin, admin)).toBe(true)
  })

  it('adminOrOwnRows scopes rows to their owner', () => {
    expect(run(adminOrOwnRows, admin)).toBe(true)
    expect(run(adminOrOwnRows, learner)).toEqual({ user: { equals: 'l1' } })
    expect(run(adminOrOwnRows, null)).toBe(false)
  })
})

describe('field access', () => {
  it('isAdminFieldLevel allows only admins', () => {
    expect(runField(isAdminFieldLevel, admin)).toBe(true)
    expect(runField(isAdminFieldLevel, learner)).toBe(false)
    expect(runField(isAdminFieldLevel, null)).toBe(false)
  })

  it('nobodyFieldLevel denies everyone', () => {
    expect(runField(nobodyFieldLevel, admin)).toBe(false)
  })
})
