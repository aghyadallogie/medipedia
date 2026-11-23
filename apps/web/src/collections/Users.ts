import { AUTH_PROVIDERS, USER_ROLES } from '@medipedia/shared'
import type {
  CollectionBeforeChangeHook,
  CollectionBeforeDeleteHook,
  CollectionConfig,
} from 'payload'

import { env } from '@/env'
import { toOptions } from '@/fields/shared'
import { isAdmin, isAdminFieldLevel, isAdminOrSelf, isAdminUser } from '@/server/access'
import {
  resetPasswordHtml,
  resetPasswordSubject,
  verifyEmailHtml,
  verifyEmailSubject,
} from '@/server/auth/emails'
import { createAccessTokenStrategy } from '@/server/auth/strategy'

/**
 * The first account ever created (via /admin's "create first user" screen) becomes an admin.
 * Every later account defaults to "learner".
 *
 * Accounts made by the first-user screen or by a signed-in admin are verified from the start:
 * nobody needs to prove they own an address that an admin typed in. Accounts that sign up
 * through the public API stay unverified until they use the emailed link.
 */
const bootstrapAccount: CollectionBeforeChangeHook = async ({ data, operation, req }) => {
  if (operation !== 'create') return data
  const { totalDocs } = await req.payload.count({ collection: 'users', req })
  if (totalDocs === 0) {
    return { ...data, role: 'admin', _verified: true }
  }
  if (isAdminUser(req.user)) {
    return { ...data, _verified: true }
  }
  return data
}

/**
 * A signed-in non-admin updating an account through Payload's own REST API must not change who
 * the account belongs to. Without this, a learner could point their verified account at someone
 * else's email address and later be linked to that person's Google sign-in.
 *
 * Server code (our own endpoints) runs without `req.user`, so it is unaffected.
 */
const protectIdentityFields: CollectionBeforeChangeHook = ({
  data,
  operation,
  originalDoc,
  req,
}) => {
  if (operation !== 'update' || !req.user || isAdminUser(req.user)) return data
  // Put the stored values back rather than dropping the keys: Payload validates `email` as
  // required, so a missing value would fail the whole update.
  const rest = { ...data }
  delete rest._verificationToken
  return { ...rest, email: originalDoc?.email, _verified: originalDoc?._verified }
}

/**
 * Deleting an account deletes its answers and refresh tokens (App Store account-deletion rule).
 * Runs before the delete: afterwards the foreign keys have already been nulled.
 */
const deleteUserData: CollectionBeforeDeleteHook = async ({ id, req }) => {
  for (const collection of ['answer-events', 'refresh-tokens'] as const) {
    await req.payload.delete({
      collection,
      where: { user: { equals: id } },
      req,
      overrideAccess: true,
    })
  }
}

export const Users: CollectionConfig = {
  slug: 'users',
  // Payload native auth powers the admin panel and checks passwords and verification. Learner
  // sessions are our own token layer (AGENTS.md §5), recognised through the strategy below.
  auth: {
    // Payload's own tokens are only used by the admin panel. Keep them as short as ours.
    tokenExpiration: 15 * 60,
    // Brute-force protection: five wrong passwords lock the account for ten minutes.
    maxLoginAttempts: 5,
    lockTime: 10 * 60 * 1000,
    verify: {
      generateEmailSubject: () => verifyEmailSubject(),
      generateEmailHTML: ({ token, user }) => verifyEmailHtml({ token, user }),
    },
    forgotPassword: {
      expiration: 60 * 60 * 1000,
      generateEmailSubject: () => resetPasswordSubject(),
      generateEmailHTML: (args) =>
        resetPasswordHtml({ token: args?.token ?? '', user: args?.user ?? {} }),
    },
    strategies: [createAccessTokenStrategy(() => env.JWT_SECRET)],
  },
  admin: {
    useAsTitle: 'email',
    group: 'System',
    defaultColumns: ['email', 'name', 'role', 'provider', 'createdAt'],
  },
  access: {
    // Only admins can open /admin.
    admin: ({ req: { user } }) => isAdminUser(user),
    read: isAdminOrSelf,
    create: isAdmin,
    update: isAdminOrSelf,
    delete: isAdmin,
  },
  hooks: {
    beforeChange: [bootstrapAccount, protectIdentityFields],
    beforeDelete: [deleteUserData],
  },
  fields: [
    {
      name: 'name',
      type: 'text',
    },
    {
      name: 'role',
      type: 'select',
      required: true,
      defaultValue: 'learner',
      options: toOptions(USER_ROLES),
      saveToJWT: true,
      // Learners can never change their own role.
      access: {
        create: isAdminFieldLevel,
        update: isAdminFieldLevel,
      },
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'provider',
      type: 'select',
      required: true,
      defaultValue: 'email',
      options: toOptions(AUTH_PROVIDERS),
      access: {
        create: isAdminFieldLevel,
        update: isAdminFieldLevel,
      },
      admin: {
        position: 'sidebar',
        readOnly: true,
      },
    },
    {
      name: 'googleSub',
      label: 'Google account ID',
      type: 'text',
      unique: true,
      index: true,
      access: {
        read: isAdminFieldLevel,
        create: isAdminFieldLevel,
        update: isAdminFieldLevel,
      },
      admin: {
        position: 'sidebar',
        readOnly: true,
      },
    },
  ],
}
