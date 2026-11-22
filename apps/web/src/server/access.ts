/**
 * Payload access-control helpers. Route handlers enforce access too (AGENTS.md §5);
 * these cover the Payload side, including Payload's own REST API under /api/cms.
 */
import type { Access, FieldAccess, Where } from 'payload'

type MaybeUser = { id: string; role?: string | null } | null | undefined

export const isAdminUser = (user: MaybeUser): boolean => user?.role === 'admin'

const PUBLISHED: Where = { _status: { equals: 'published' } }

/** Anyone, signed in or not. */
export const anyone: Access = () => true

/** Nobody through Payload's own API. The App API writes with the Local API instead. */
export const nobody: Access = () => false

/** Collection-level: admins only. */
export const isAdmin: Access = ({ req: { user } }) => isAdminUser(user)

/** Collection-level: admins see everything, signed-in users see only their own document. */
export const isAdminOrSelf: Access = ({ req: { user } }) => {
  if (!user) return false
  if (isAdminUser(user)) return true
  return { id: { equals: user.id } }
}

/** Public content with drafts: admins see drafts, everyone else sees published only. */
export const adminOrPublished: Access = ({ req: { user } }) => {
  if (isAdminUser(user)) return true
  return PUBLISHED
}

/** Login-gated content with drafts (questions): anonymous gets nothing, learners get published. */
export const signedInPublishedOrAdmin: Access = ({ req: { user } }) => {
  if (!user) return false
  if (isAdminUser(user)) return true
  return PUBLISHED
}

/** Rows owned by a user via a `user` relationship: admins see all, users see their own. */
export const adminOrOwnRows: Access = ({ req: { user } }) => {
  if (!user) return false
  if (isAdminUser(user)) return true
  return { user: { equals: user.id } }
}

/** Field-level: admins only. */
export const isAdminFieldLevel: FieldAccess = ({ req: { user } }) => isAdminUser(user)

/** Field-level: nobody, not even admins. For values that only server code may read. */
export const nobodyFieldLevel: FieldAccess = () => false
