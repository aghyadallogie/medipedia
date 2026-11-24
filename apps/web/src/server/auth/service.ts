/**
 * Account and session operations behind /api/v1/auth/* and /api/v1/me. Route handlers stay thin
 * (validate, call, respond) and everything that decides something lives here, taking `payload`
 * as an argument so it can be tested against a real database without HTTP.
 *
 * Responses never reveal whether an email address has an account: sign-up, password reset and
 * email verification behave the same whether or not it does.
 */
import { randomBytes } from 'node:crypto'

import type { TokenAudience } from '@medipedia/shared'
import { APIError, AuthenticationError, LockedAuth, UnverifiedEmail, type Payload } from 'payload'

import { env } from '@/env'
import type { User } from '@/payload-types'
import { ApiError } from '@/server/http'

import { verifyEmailHtml, verifyEmailSubject } from './emails'
import type { GoogleIdentity } from './google'
import {
  issueRefreshToken,
  purgeExpiredTokens,
  revokeAllForUser,
  revokeFamilyOfToken,
  rotateRefreshToken,
  type IssuedRefreshToken,
} from './refresh-tokens'
import { signAccessToken } from './tokens'

// ---------- lookups ----------

export async function findUserByEmail(payload: Payload, email: string): Promise<User | null> {
  const { docs } = await payload.find({
    collection: 'users',
    where: { email: { equals: email } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  return docs[0] ?? null
}

async function findUserById(payload: Payload, id: string): Promise<User | null> {
  return payload.findByID({
    collection: 'users',
    id,
    depth: 0,
    overrideAccess: true,
    disableErrors: true,
  })
}

// ---------- sign-up and email verification ----------

/** Sends the confirmation link again to an account that has not used it yet. */
async function resendVerification(payload: Payload, user: User): Promise<void> {
  const { docs } = await payload.find({
    collection: 'users',
    where: { id: { equals: user.id } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
    showHiddenFields: true,
  })
  const token = docs[0]?._verificationToken
  if (!token) return
  await payload.sendEmail({
    to: user.email,
    subject: verifyEmailSubject(),
    html: verifyEmailHtml({ token, user }),
  })
}

/**
 * Creates an unverified learner account and emails the confirmation link. If the address is
 * already registered nothing is revealed: a pending account gets the link again, and a confirmed
 * one is left alone.
 *
 * With `REQUIRE_EMAIL_CONFIRMATION=false` no email is sent at all (and none is re-sent), and the
 * account can sign in straight away. It is still stored as unconfirmed.
 */
export async function registerAccount(
  payload: Payload,
  input: { email: string; password: string; name?: string },
): Promise<void> {
  const existing = await findUserByEmail(payload, input.email)
  if (existing) {
    if (
      env.REQUIRE_EMAIL_CONFIRMATION &&
      existing._verified !== true &&
      existing.provider === 'email'
    ) {
      await resendVerification(payload, existing)
    }
    return
  }

  try {
    await payload.create({
      collection: 'users',
      data: {
        email: input.email,
        password: input.password,
        name: input.name,
        role: 'learner',
        provider: 'email',
      },
      disableVerificationEmail: !env.REQUIRE_EMAIL_CONFIRMATION,
    })
  } catch (error) {
    // Two sign-ups for the same address at once: the loser lands here. Same silent outcome.
    if (await findUserByEmail(payload, input.email)) return
    throw error
  }
}

const invalidToken = (message: string) =>
  new ApiError('validation_error', message, { reason: 'invalid_token' })

export async function verifyEmail(payload: Payload, token: string): Promise<void> {
  let verified = false
  try {
    verified = await payload.verifyEmail({ collection: 'users', token })
  } catch (error) {
    if (!(error instanceof APIError) || error.status >= 500) throw error
  }
  if (!verified) throw invalidToken('This confirmation link is invalid or has already been used.')
}

// ---------- sign-in ----------

function mapLoginError(error: unknown): unknown {
  if (error instanceof UnverifiedEmail) {
    return new ApiError('forbidden', 'Confirm your email address before signing in.', {
      reason: 'email_not_verified',
    })
  }
  if (error instanceof LockedAuth) {
    return new ApiError('rate_limited', 'Too many failed attempts. Try again in a few minutes.', {
      reason: 'account_locked',
    })
  }
  if (error instanceof AuthenticationError) {
    return new ApiError('unauthorized', 'Invalid email or password.', {
      reason: 'invalid_credentials',
    })
  }
  return error
}

/**
 * Checks an email and password with Payload (which hashes, counts failures, locks the account
 * after five and requires a confirmed email) and returns the user. Payload's own token is
 * discarded: our sessions are the access and refresh tokens below.
 *
 * With `REQUIRE_EMAIL_CONFIRMATION=false` an unconfirmed account may sign in. Payload checks the
 * password and the lockout before it checks confirmation, so an `UnverifiedEmail` error means the
 * password was right and the account was not locked; the user is then loaded here and the failed
 * attempts Payload would have cleared on success are cleared by hand.
 */
export async function loginWithPassword(
  payload: Payload,
  credentials: { email: string; password: string },
): Promise<User> {
  try {
    const { user } = await payload.login({ collection: 'users', data: credentials })
    if (!user) throw new AuthenticationError()
    return user as User
  } catch (error) {
    if (error instanceof UnverifiedEmail && !env.REQUIRE_EMAIL_CONFIRMATION) {
      const user = await findUserByEmail(payload, credentials.email)
      if (user) {
        await clearFailedAttempts(payload, user.id)
        return user
      }
    }
    throw mapLoginError(error)
  }
}

/** What Payload does after a successful sign-in: forget earlier wrong passwords. */
async function clearFailedAttempts(payload: Payload, userId: string): Promise<void> {
  await payload.update({
    collection: 'users',
    id: userId,
    data: { loginAttempts: 0, lockUntil: null },
    overrideAccess: true,
  })
}

export type StartedSession = {
  accessToken: string
  expiresIn: number
  refresh: IssuedRefreshToken
}

/** Mints an access token and a new refresh-token family for a verified user. */
export async function startSession(
  payload: Payload,
  user: User,
  options: { audience: TokenAudience; deviceLabel?: string | null },
): Promise<StartedSession> {
  const { token: accessToken, expiresIn } = await signAccessToken(env.JWT_SECRET, {
    userId: user.id,
    role: user.role,
    audience: options.audience,
  })
  const refresh = await issueRefreshToken(payload, {
    userId: user.id,
    audience: options.audience,
    deviceLabel: options.deviceLabel,
  })
  await purgeExpiredTokens(payload, user.id)
  return { accessToken, expiresIn, refresh }
}

export type RefreshedSession = {
  user: User
  accessToken: string
  expiresIn: number
  /** Absent when this was a duplicate refresh that only gets an access token. */
  refresh?: IssuedRefreshToken
}

/**
 * Rotates a refresh token. Theft (a rotated token coming back) revokes the whole login and is
 * reported as such, so the client can tell the user to sign in again.
 */
export async function refreshSession(
  payload: Payload,
  rawRefreshToken: string,
  audience: TokenAudience,
): Promise<RefreshedSession> {
  const result = await rotateRefreshToken(payload, rawRefreshToken, audience)

  if (result.kind === 'invalid') {
    throw new ApiError('unauthorized', 'Your session has expired. Sign in again.', {
      reason: 'invalid_token',
    })
  }
  if (result.kind === 'reused') {
    throw new ApiError('unauthorized', 'Your session is no longer valid. Sign in again.', {
      reason: 'token_reused',
    })
  }

  const user = await findUserById(payload, result.userId)
  if (!user) {
    throw new ApiError('unauthorized', 'Your session has expired. Sign in again.', {
      reason: 'invalid_token',
    })
  }

  const { token: accessToken, expiresIn } = await signAccessToken(env.JWT_SECRET, {
    userId: user.id,
    role: user.role,
    audience,
  })
  return {
    user,
    accessToken,
    expiresIn,
    ...(result.kind === 'rotated' ? { refresh: result.refresh } : {}),
  }
}

/** Sign out: revokes the login the refresh token belongs to. Unknown tokens are ignored. */
export async function endSession(
  payload: Payload,
  rawRefreshToken: string | undefined,
): Promise<void> {
  if (rawRefreshToken) await revokeFamilyOfToken(payload, rawRefreshToken)
}

// ---------- password reset ----------

/** Emails a reset link if the address has an account. The caller always gets the same answer. */
export async function requestPasswordReset(payload: Payload, email: string): Promise<void> {
  try {
    // Payload returns without sending when there is no such account.
    await payload.forgotPassword({ collection: 'users', data: { email } })
  } catch (error) {
    // A failure here (the mail provider is down) must not look different from 'no such account'.
    console.error('Password reset email failed', error)
  }
}

/**
 * Sets a new password, signs the account out everywhere, and clears any lock. Following the
 * emailed link also proves the owner reads this inbox, so an unconfirmed address becomes confirmed.
 */
export async function resetPassword(
  payload: Payload,
  input: { token: string; password: string },
): Promise<void> {
  let userId: string
  try {
    const result = await payload.resetPassword({
      collection: 'users',
      data: input,
      overrideAccess: true,
    })
    userId = String(result.user.id)
  } catch (error) {
    if (error instanceof APIError && error.status < 500) {
      throw invalidToken('This reset link is invalid or has expired.')
    }
    throw error
  }

  await revokeAllForUser(payload, userId)
  await payload.update({
    collection: 'users',
    id: userId,
    data: { _verified: true },
    overrideAccess: true,
  })
}

// ---------- the signed-in user ----------

export async function updateProfile(payload: Payload, userId: string, name: string): Promise<User> {
  return payload.update({
    collection: 'users',
    id: userId,
    data: { name },
    overrideAccess: true,
  })
}

/**
 * Deletes the account and, through the Users `beforeDelete` hook, its answers and refresh tokens.
 * Accounts that sign in with a password must confirm it first: a stolen session alone is not
 * enough to destroy an account. Google-only accounts have no password to confirm.
 */
export async function deleteAccount(
  payload: Payload,
  user: User,
  confirmation: { password?: string },
): Promise<void> {
  if (user.provider === 'email') {
    if (!confirmation.password) {
      throw new ApiError('validation_error', 'Enter your password to delete your account.', {
        reason: 'invalid_credentials',
      })
    }
    // Goes through Payload's login so wrong guesses count towards the lockout too.
    await loginWithPassword(payload, { email: user.email, password: confirmation.password })
  }
  await payload.delete({ collection: 'users', id: user.id, overrideAccess: true })
}

// ---------- Google ----------

const googleRefused = () =>
  new ApiError('forbidden', 'This email address is linked to a different Google account.', {
    reason: 'google_unavailable',
  })

/**
 * Finds or creates the account for a verified Google identity.
 *
 *  - Known Google account: sign in.
 *  - Known email address: link the Google account to it. If that account was never confirmed (it
 *    may have been created by someone who does not own the address), its password is replaced and
 *    its sessions are revoked, so whoever registered it can no longer get in. Google has vouched
 *    for the address, which makes the real owner the only one left.
 *  - Otherwise: create a confirmed learner with no usable password.
 *
 * Google-only accounts get a random password because Payload requires one. Nobody knows it, and
 * `provider: 'google'` tells the account page and deletion flow not to ask for it.
 *
 * Callers must have verified the ID token (verifyGoogleIdToken), including `email_verified`.
 */
export async function signInWithGoogle(payload: Payload, identity: GoogleIdentity): Promise<User> {
  const { docs: bySub } = await payload.find({
    collection: 'users',
    where: { googleSub: { equals: identity.sub } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  if (bySub[0]) return bySub[0]

  const existing = await findUserByEmail(payload, identity.email)
  if (existing) {
    if (existing.googleSub && existing.googleSub !== identity.sub) throw googleRefused()
    const unconfirmed = existing._verified !== true
    const linked = await payload.update({
      collection: 'users',
      id: existing.id,
      data: {
        googleSub: identity.sub,
        _verified: true,
        ...(existing.name ? {} : { name: identity.name ?? undefined }),
        ...(unconfirmed ? { password: randomBytes(32).toString('base64url') } : {}),
      },
      overrideAccess: true,
    })
    if (unconfirmed) await revokeAllForUser(payload, existing.id)
    return linked
  }

  try {
    return await payload.create({
      collection: 'users',
      data: {
        email: identity.email,
        password: randomBytes(32).toString('base64url'),
        name: identity.name ?? undefined,
        role: 'learner',
        provider: 'google',
        googleSub: identity.sub,
        _verified: true,
      },
      overrideAccess: true,
      disableVerificationEmail: true,
    })
  } catch (error) {
    // Two first sign-ins at once: the other request created the account. Use it.
    const winner = await findUserByEmail(payload, identity.email)
    if (winner && winner.googleSub === identity.sub) return winner
    throw error
  }
}
