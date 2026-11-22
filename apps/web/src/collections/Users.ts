import { AUTH_PROVIDERS, USER_ROLES } from '@medipedia/shared'
import type {
  CollectionBeforeChangeHook,
  CollectionBeforeDeleteHook,
  CollectionConfig,
} from 'payload'

import { toOptions } from '@/fields/shared'
import { isAdmin, isAdminFieldLevel, isAdminOrSelf, isAdminUser } from '@/server/access'

/**
 * The first account ever created (via /admin's "create first user" screen) becomes an admin.
 * Every later account defaults to `learner`.
 */
const promoteFirstUserToAdmin: CollectionBeforeChangeHook = async ({ data, operation, req }) => {
  if (operation !== 'create') return data
  const { totalDocs } = await req.payload.count({ collection: 'users', req })
  if (totalDocs === 0) {
    return { ...data, role: 'admin' }
  }
  return data
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
  // Payload native auth, used by the admin panel. Learner tokens are our own layer (AGENTS.md §5, Phase 4).
  auth: true,
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
    beforeChange: [promoteFirstUserToAdmin],
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
