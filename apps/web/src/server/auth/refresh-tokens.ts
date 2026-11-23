/**
 * Refresh tokens (AGENTS.md §5): opaque random values, stored only as SHA-256 hashes, rotated on
 * every use. All rotations of one login share a `familyId`.
 *
 * Reuse detection: presenting a token that was already rotated means two parties hold the same
 * credential (theft), so the whole family is revoked and the user must sign in again.
 *
 * One deliberate exception: a token rotated a few seconds ago is not treated as theft. Browsers
 * fire several requests at once (a page and its prefetches), and when the access token has just
 * expired each of them tries to refresh with the same cookie. Revoking the family would sign the
 * user out at random. Inside the grace window a rotated token may mint a new *access* token only,
 * never a new refresh token, and only while the family still has a live token (so a logout in
 * between still wins).
 */
import { createHash, randomBytes, randomUUID } from 'node:crypto'

import { TOKEN_TTL_SECONDS, type TokenAudience } from '@medipedia/shared'
import { commitTransaction, createLocalReq, initTransaction, killTransaction } from 'payload'
import type { Payload, PayloadRequest } from 'payload'

import type { RefreshToken } from '@/payload-types'
import { idOf } from '@/server/ids'

export const REFRESH_REUSE_GRACE_SECONDS = 10

export const hashRefreshToken = (raw: string): string =>
  createHash('sha256').update(raw).digest('hex')

export const generateRefreshToken = (): string => randomBytes(32).toString('base64url')

const lifetimeSeconds = (audience: TokenAudience): number =>
  audience === 'mobile' ? TOKEN_TTL_SECONDS.refreshMobile : TOKEN_TTL_SECONDS.refreshWeb

// ---------- decision logic (pure, so it can be tested without a database) ----------

export type TokenState = Pick<RefreshToken, 'audience' | 'expiresAt' | 'revokedAt' | 'rotatedAt'>
export type Classification = 'ok' | 'invalid' | 'reuse' | 'grace'

/**
 * - invalid: unknown, expired, or issued for another audience. Nothing is revoked, so a caller
 *   cannot burn someone else's session by guessing.
 * - ok: live and unused.
 * - grace: rotated within the grace window (see above).
 * - reuse: revoked, or rotated longer ago than the grace window.
 */
export function classifyRefreshToken(
  token: TokenState | null,
  audience: TokenAudience,
  now: Date,
): Classification {
  if (!token || token.audience !== audience) return 'invalid'
  if (new Date(token.expiresAt).getTime() <= now.getTime()) return 'invalid'
  if (!token.revokedAt) return 'ok'
  if (token.rotatedAt) {
    const age = now.getTime() - new Date(token.rotatedAt).getTime()
    if (age >= 0 && age <= REFRESH_REUSE_GRACE_SECONDS * 1000) return 'grace'
  }
  return 'reuse'
}

// ---------- persistence ----------

export type IssuedRefreshToken = {
  /** The raw token. Shown to the client once and never stored. */
  token: string
  familyId: string
  expiresAt: Date
}

export async function issueRefreshToken(
  payload: Payload,
  args: {
    userId: string
    audience: TokenAudience
    familyId?: string
    deviceLabel?: string | null
    now?: Date
    /** Join an open transaction. */
    req?: PayloadRequest
  },
): Promise<IssuedRefreshToken> {
  const now = args.now ?? new Date()
  const familyId = args.familyId ?? randomUUID()
  const token = generateRefreshToken()
  const expiresAt = new Date(now.getTime() + lifetimeSeconds(args.audience) * 1000)

  await payload.create({
    collection: 'refresh-tokens',
    data: {
      user: args.userId,
      tokenHash: hashRefreshToken(token),
      audience: args.audience,
      familyId,
      expiresAt: expiresAt.toISOString(),
      ...(args.deviceLabel ? { deviceLabel: args.deviceLabel } : {}),
    },
    overrideAccess: true,
    ...(args.req ? { req: args.req } : {}),
  })
  return { token, familyId, expiresAt }
}

async function findByRawToken(payload: Payload, raw: string): Promise<RefreshToken | null> {
  const { docs } = await payload.find({
    collection: 'refresh-tokens',
    where: { tokenHash: { equals: hashRefreshToken(raw) } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  return docs[0] ?? null
}

/** Revokes every live token of one login. Idempotent. */
export async function revokeFamily(
  payload: Payload,
  familyId: string,
  now: Date = new Date(),
): Promise<void> {
  await payload.update({
    collection: 'refresh-tokens',
    where: { and: [{ familyId: { equals: familyId } }, { revokedAt: { exists: false } }] },
    data: { revokedAt: now.toISOString() },
    overrideAccess: true,
  })
}

/** Sign out: revokes the login that the given token belongs to. Unknown tokens are ignored. */
export async function revokeFamilyOfToken(
  payload: Payload,
  raw: string,
  now: Date = new Date(),
): Promise<void> {
  const token = await findByRawToken(payload, raw)
  if (token) await revokeFamily(payload, token.familyId, now)
}

/** Revokes every login of a user: after a password reset, for example. */
export async function revokeAllForUser(
  payload: Payload,
  userId: string,
  now: Date = new Date(),
): Promise<void> {
  await payload.update({
    collection: 'refresh-tokens',
    where: { and: [{ user: { equals: userId } }, { revokedAt: { exists: false } }] },
    data: { revokedAt: now.toISOString() },
    overrideAccess: true,
  })
}

/** Housekeeping: removes a user's expired tokens. Called when they sign in. */
export async function purgeExpiredTokens(
  payload: Payload,
  userId: string,
  now: Date = new Date(),
): Promise<void> {
  await payload.delete({
    collection: 'refresh-tokens',
    where: {
      and: [{ user: { equals: userId } }, { expiresAt: { less_than: now.toISOString() } }],
    },
    overrideAccess: true,
  })
}

export type RotationResult =
  /** A new refresh token replaces the old one. */
  | { kind: 'rotated'; userId: string; refresh: IssuedRefreshToken }
  /** The token was rotated moments ago by a concurrent request: mint an access token only. */
  | { kind: 'grace'; userId: string }
  /** Unknown, expired or for another audience. */
  | { kind: 'invalid' }
  /** A rotated token came back: the family has been revoked. */
  | { kind: 'reused'; userId: string }

async function familyHasLiveToken(payload: Payload, familyId: string): Promise<boolean> {
  const { totalDocs } = await payload.count({
    collection: 'refresh-tokens',
    where: { and: [{ familyId: { equals: familyId } }, { revokedAt: { exists: false } }] },
    overrideAccess: true,
  })
  return totalDocs > 0
}

async function resolveRotated(
  payload: Payload,
  token: RefreshToken,
  now: Date,
): Promise<RotationResult> {
  const userId = idOf(token.user) ?? ''
  if (await familyHasLiveToken(payload, token.familyId)) return { kind: 'grace', userId }
  // The successor is gone too (signed out, or already revoked as theft): nothing may proceed.
  await revokeFamily(payload, token.familyId, now)
  return { kind: 'reused', userId }
}

/**
 * Exchanges a refresh token for its successor. The old token is revoked with a conditional update
 * (`revokedAt` must still be empty), so of two simultaneous requests exactly one rotates it.
 */
export async function rotateRefreshToken(
  payload: Payload,
  raw: string,
  audience: TokenAudience,
  now: Date = new Date(),
): Promise<RotationResult> {
  const token = await findByRawToken(payload, raw)
  const state = classifyRefreshToken(token, audience, now)
  if (!token || state === 'invalid') return { kind: 'invalid' }

  const userId = idOf(token.user) ?? ''
  if (state === 'reuse') {
    await revokeFamily(payload, token.familyId, now)
    return { kind: 'reused', userId }
  }
  if (state === 'grace') return resolveRotated(payload, token, now)

  // Revoking the old token and creating its successor happen in ONE transaction. Otherwise a
  // concurrent request could see the old token revoked, find the family empty for a moment, and
  // wrongly call it theft. A loser blocks on the row lock until the winner commits, then finds
  // the token already revoked (and the successor in place).
  const req = await createLocalReq({}, payload)
  const ownsTransaction = await initTransaction(req)
  try {
    const stamp = now.toISOString()
    const { docs } = await payload.update({
      collection: 'refresh-tokens',
      where: { and: [{ id: { equals: token.id } }, { revokedAt: { exists: false } }] },
      data: { revokedAt: stamp, rotatedAt: stamp },
      overrideAccess: true,
      req,
    })
    if (docs.length === 0) {
      // Lost the race. Nothing to commit.
      if (ownsTransaction) await killTransaction(req)
      return resolveRotated(payload, token, now)
    }

    const refresh = await issueRefreshToken(payload, {
      userId,
      audience,
      familyId: token.familyId,
      deviceLabel: token.deviceLabel,
      now,
      req,
    })
    if (ownsTransaction) await commitTransaction(req)
    return { kind: 'rotated', userId, refresh }
  } catch (error) {
    if (ownsTransaction) await killTransaction(req)
    throw error
  }
}
