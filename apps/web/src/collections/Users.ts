import { AUTH_PROVIDERS, USER_ROLES } from '@medipedia/shared'
import type { CollectionBeforeChangeHook, CollectionConfig } from 'payload'

import { isAdmin, isAdminFieldLevel, isAdminOrSelf, isAdminUser } from '@/server/access'

const toOptions = (values: readonly string[]) =>
  values.map((value) => ({ label: value[0]?.toUpperCase() + value.slice(1), value }))

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

export const Users: CollectionConfig = {
  slug: 'users',
  // Payload native auth, used by the admin panel. Learner tokens are our own layer (AGENTS.md §5, Phase 4).
  auth: true,
  admin: {
    useAsTitle: 'email',
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
