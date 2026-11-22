/**
 * Payload access-control helpers. Route handlers enforce access too (AGENTS.md §5);
 * these cover the Payload side.
 */
import type { Access, FieldAccess } from 'payload'

type MaybeUser = { id: string; role?: string | null } | null | undefined

export const isAdminUser = (user: MaybeUser): boolean => user?.role === 'admin'

/** Collection-level: admins only. */
export const isAdmin: Access = ({ req: { user } }) => isAdminUser(user)

/** Collection-level: admins see everything, signed-in users see only their own document. */
export const isAdminOrSelf: Access = ({ req: { user } }) => {
  if (!user) return false
  if (isAdminUser(user)) return true
  return { id: { equals: user.id } }
}

/** Field-level: admins only. */
export const isAdminFieldLevel: FieldAccess = ({ req: { user } }) => isAdminUser(user)
