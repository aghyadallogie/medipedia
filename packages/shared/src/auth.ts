/**
 * Request and response schemas for /api/v1/auth/* and /api/v1/me (AGENTS.md §5, §6).
 * The route handlers, the web forms and the (future) mobile app all validate against these.
 */
import { z } from 'zod'

import { dataResponse } from './api'
import { ClientKindSchema, AuthProviderSchema, UserRoleSchema } from './enums'
import { IdSchema, IsoDateTimeSchema } from './content'

// ---------- primitives ----------

/** Addresses are compared case-insensitively, so they are stored and matched in lower case. */
export const EmailSchema = z.string().trim().toLowerCase().pipe(z.email().max(254))

/**
 * Length is what matters (NIST SP 800-63B): at least 10 characters, no composition rules,
 * and no trimming, because spaces are legitimate password characters.
 */
export const PASSWORD_MIN_LENGTH = 10
export const PASSWORD_MAX_LENGTH = 128
export const PasswordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Use at least ${PASSWORD_MIN_LENGTH} characters.`)
  .max(PASSWORD_MAX_LENGTH, `Use at most ${PASSWORD_MAX_LENGTH} characters.`)

export const NameSchema = z.string().trim().min(1, 'Enter your name.').max(80)

/** Opaque one-time tokens from emails. Hex today, but treat them as opaque. */
export const EmailTokenSchema = z.string().min(16).max(200)

export const DeviceLabelSchema = z.string().trim().min(1).max(80)

// ---------- requests ----------

export const RegisterBodySchema = z.object({
  email: EmailSchema,
  password: PasswordSchema,
  name: NameSchema.optional(),
})
export type RegisterBody = z.infer<typeof RegisterBodySchema>

/**
 * `client: 'mobile'` returns the tokens in the response body. The web default sets httpOnly
 * cookies and keeps tokens out of reach of page scripts.
 */
export const LoginBodySchema = z.object({
  email: EmailSchema,
  // Not run through PasswordSchema: a login must not reveal the password rules, and accounts
  // created before a rule change must still be able to sign in.
  password: z.string().min(1).max(PASSWORD_MAX_LENGTH),
  client: ClientKindSchema.default('web'),
  deviceLabel: DeviceLabelSchema.optional(),
})
export type LoginBody = z.infer<typeof LoginBodySchema>

/** Web sends the refresh cookie and no body. Mobile sends its stored refresh token. */
export const RefreshBodySchema = z.object({
  refreshToken: z.string().min(16).max(512).optional(),
})
export type RefreshBody = z.infer<typeof RefreshBodySchema>

export const LogoutBodySchema = RefreshBodySchema
export type LogoutBody = z.infer<typeof LogoutBodySchema>

export const VerifyEmailBodySchema = z.object({ token: EmailTokenSchema })
export type VerifyEmailBody = z.infer<typeof VerifyEmailBodySchema>

export const ForgotPasswordBodySchema = z.object({ email: EmailSchema })
export type ForgotPasswordBody = z.infer<typeof ForgotPasswordBodySchema>

export const ResetPasswordBodySchema = z.object({
  token: EmailTokenSchema,
  password: PasswordSchema,
})
export type ResetPasswordBody = z.infer<typeof ResetPasswordBodySchema>

/** The native app signs in with Google itself and sends the resulting ID token. */
export const GoogleMobileBodySchema = z.object({
  idToken: z.string().min(20).max(4096),
  deviceLabel: DeviceLabelSchema.optional(),
})
export type GoogleMobileBody = z.infer<typeof GoogleMobileBodySchema>

export const UpdateMeBodySchema = z.object({ name: NameSchema })
export type UpdateMeBody = z.infer<typeof UpdateMeBodySchema>

/** Accounts that have a password confirm with it before deleting. Google-only accounts send nothing. */
export const DeleteMeBodySchema = z.object({
  password: z.string().min(1).max(PASSWORD_MAX_LENGTH).optional(),
})
export type DeleteMeBody = z.infer<typeof DeleteMeBodySchema>

// ---------- responses ----------

export const UserSchema = z.object({
  id: IdSchema,
  email: z.string(),
  name: z.string().nullable(),
  role: UserRoleSchema,
  provider: AuthProviderSchema,
  emailVerified: z.boolean(),
  createdAt: IsoDateTimeSchema,
})
export type User = z.infer<typeof UserSchema>

export const TokensSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  tokenType: z.literal('Bearer'),
  /** Access token lifetime in seconds. */
  expiresIn: z.number().int().positive(),
})
export type Tokens = z.infer<typeof TokensSchema>

/** `tokens` is present for `client: 'mobile'` only. Web sessions live in httpOnly cookies. */
export const SessionSchema = z.object({
  user: UserSchema,
  tokens: TokensSchema.optional(),
})
export type Session = z.infer<typeof SessionSchema>

/**
 * A refresh can return an access token without a new refresh token: when the same refresh token
 * is presented twice within seconds (a retry after a lost response, or parallel requests), only
 * the first call gets the successor. The caller keeps what it has and tries again later.
 */
export const RefreshedTokensSchema = TokensSchema.extend({ refreshToken: z.string().optional() })
export type RefreshedTokens = z.infer<typeof RefreshedTokensSchema>

export const RefreshSessionSchema = z.object({
  user: UserSchema,
  tokens: RefreshedTokensSchema.optional(),
})
export type RefreshSession = z.infer<typeof RefreshSessionSchema>

/** Returned by endpoints that only acknowledge a request. */
export const AckSchema = z.object({ ok: z.literal(true) })
export type Ack = z.infer<typeof AckSchema>

export const SessionResponseSchema = dataResponse(SessionSchema)
export const RefreshSessionResponseSchema = dataResponse(RefreshSessionSchema)
export const UserResponseSchema = dataResponse(UserSchema)
export const AckResponseSchema = dataResponse(AckSchema)

/** Why a sign-in or token request was refused, for clients that want to react. */
export const AUTH_FAILURE_REASONS = [
  'invalid_credentials',
  'email_not_verified',
  'account_locked',
  'invalid_token',
  'token_reused',
  'google_unavailable',
] as const
export const AuthFailureReasonSchema = z.enum(AUTH_FAILURE_REASONS)
export type AuthFailureReason = z.infer<typeof AuthFailureReasonSchema>

/** `error.details` on auth failures. */
export const AuthFailureDetailsSchema = z.object({ reason: AuthFailureReasonSchema })
export type AuthFailureDetails = z.infer<typeof AuthFailureDetailsSchema>

// ---------- cookies ----------

/** Cookie names and lifetimes for the web session (AGENTS.md §5). */
export const AUTH_COOKIES = {
  access: 'access_token',
  refresh: 'refresh_token',
  /** The refresh cookie is only ever sent to the auth endpoints. */
  refreshPath: '/api/v1/auth',
  /**
   * A non-secret marker (`1`) that a login exists, readable by page scripts, so the header can
   * show "Account" instead of "Sign in" without a request. It grants nothing.
   */
  hint: 'signed_in',
} as const
