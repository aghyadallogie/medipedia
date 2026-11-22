/**
 * Guards for security-relevant collection settings. If one of these fails, a refactor has
 * quietly weakened a rule from AGENTS.md rather than a test being wrong.
 */
import type { ArrayField, CollectionConfig, Field } from 'payload'
import { describe, expect, it } from 'vitest'

import {
  isAdmin,
  isAdminFieldLevel,
  nobody,
  nobodyFieldLevel,
  signedInPublishedOrAdmin,
} from '@/server/access'

import { AnswerEvents } from './AnswerEvents'
import { Flashcards } from './Flashcards'
import { Lectures } from './Lectures'
import { Papers } from './Papers'
import { Questions } from './Questions'
import { RefreshTokens } from './RefreshTokens'
import { Users } from './Users'
import { Videos } from './Videos'

const named = (fields: Field[], name: string): Field | undefined =>
  fields.find((field) => 'name' in field && field.name === name)

describe('Questions hide correctness and explanations from non-admins', () => {
  const choices = named(Questions.fields, 'choices') as ArrayField

  it.each(['isCorrect', 'explanation'])('choices.%s is admin-only to read', (name) => {
    const field = named(choices.fields, name)
    expect(field && 'access' in field ? field.access?.read : undefined).toBe(isAdminFieldLevel)
  })

  it('overallExplanation is admin-only to read', () => {
    const field = named(Questions.fields, 'overallExplanation')
    expect(field && 'access' in field ? field.access?.read : undefined).toBe(isAdminFieldLevel)
  })

  it('requires sign-in to read and keeps version history admin-only', () => {
    expect(Questions.access?.read).toBe(signedInPublishedOrAdmin)
    expect(Questions.access?.readVersions).toBe(isAdmin)
  })

  it('uses drafts', () => {
    expect(Questions.versions).toMatchObject({ drafts: true })
  })
})

describe('content collections', () => {
  const drafted: CollectionConfig[] = [Lectures, Flashcards, Questions, Papers, Videos]

  it.each(drafted.map((c) => [c.slug, c] as const))(
    '%s uses drafts, admin-only writes and versions',
    (_slug, c) => {
      expect(c.versions).toMatchObject({ drafts: true })
      expect(c.access?.create).toBe(isAdmin)
      expect(c.access?.update).toBe(isAdmin)
      expect(c.access?.delete).toBe(isAdmin)
      expect(c.access?.readVersions).toBe(isAdmin)
    },
  )

  it.each(drafted.map((c) => [c.slug, c] as const))(
    '%s has an accessTier defaulting to free',
    (_slug, c) => {
      const field = named(c.fields, 'accessTier')
      expect(field).toMatchObject({ type: 'select', defaultValue: 'free', required: true })
    },
  )
})

describe('server-only collections', () => {
  it('learners cannot write answer events or refresh tokens through Payload', () => {
    for (const c of [AnswerEvents, RefreshTokens]) {
      expect(c.access?.create).toBe(nobody)
      expect(c.access?.update).toBe(nobody)
      expect(c.admin?.hidden).toBe(true)
    }
  })

  it('refresh token hashes are never readable through Payload', () => {
    const field = named(RefreshTokens.fields, 'tokenHash')
    expect(field && 'access' in field ? field.access?.read : undefined).toBe(nobodyFieldLevel)
    expect(field).toMatchObject({ unique: true })
  })
})

describe('Users', () => {
  it('only admins can change role', () => {
    const role = named(Users.fields, 'role')
    expect(role && 'access' in role ? role.access : undefined).toMatchObject({
      create: isAdminFieldLevel,
      update: isAdminFieldLevel,
    })
  })
})
