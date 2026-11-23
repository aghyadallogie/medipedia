/**
 * Sign in with Google (AGENTS.md §5): the authorization-code flow with PKCE and `state`, written
 * by hand on top of `jose`. No OAuth library.
 *
 *   1. /auth/google          sends the browser to Google with a PKCE challenge, `state` and `nonce`
 *                            and remembers the secrets in a short-lived httpOnly cookie.
 *   2. /auth/google/callback gets `code` + `state` back, checks `state` against the cookie,
 *                            trades the code (and PKCE verifier) for an ID token at Google's token
 *                            endpoint, and verifies that token's signature against Google's JWKS.
 *   3. The caller finds or creates the user from the verified claims (see service.ts).
 *
 * The native apps skip steps 1 and 2: they sign in with Google themselves and send the ID token
 * to /auth/google/mobile, which goes through the same verification.
 */
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'

import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose'

import { env, publicEnv } from '@/env'
import { ApiError } from '@/server/http'

export const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
export const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
export const GOOGLE_JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs'
/** Google documents both spellings of its issuer. */
export const GOOGLE_ISSUERS = ['https://accounts.google.com', 'accounts.google.com']

export const GOOGLE_COOKIE = 'google_oauth'
export const GOOGLE_COOKIE_PATH = '/api/v1/auth/google'
export const GOOGLE_COOKIE_TTL_SECONDS = 10 * 60

export type GoogleConfig = {
  clientId: string
  clientSecret: string
  /** Client IDs of the native apps, whose ID tokens /auth/google/mobile accepts. */
  mobileClientIds: string[]
}

/**
 * Everything the flow reaches outside the process for or reads from configuration, in one object
 * so tests can replace it: no test ever contacts Google.
 */
export const googleDeps: {
  fetch: typeof fetch
  getKey: JWTVerifyGetKey
  getConfig: () => GoogleConfig | null
} = {
  fetch: (input, init) => fetch(input, init),
  // Created on first use: it caches Google's keys and honours their cache headers.
  getKey: (() => {
    let remote: ReturnType<typeof createRemoteJWKSet> | undefined
    return (header, token) =>
      (remote ??= createRemoteJWKSet(new URL(GOOGLE_JWKS_URL)))(header, token)
  })(),
  getConfig: () =>
    env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
      ? {
          clientId: env.GOOGLE_CLIENT_ID,
          clientSecret: env.GOOGLE_CLIENT_SECRET,
          mobileClientIds: (env.GOOGLE_MOBILE_CLIENT_IDS ?? '')
            .split(',')
            .map((id) => id.trim())
            .filter(Boolean),
        }
      : null,
}

const unavailable = () =>
  new ApiError('not_found', 'Sign in with Google is not available.', {
    reason: 'google_unavailable',
  })

export function requireGoogleConfig(): GoogleConfig {
  const config = googleDeps.getConfig()
  if (!config) throw unavailable()
  return config
}

export const googleRedirectUri = (): string =>
  new URL('/api/v1/auth/google/callback', publicEnv.NEXT_PUBLIC_SITE_URL).toString()

// ---------- PKCE, state and the cookie that carries them ----------

export const randomToken = (bytes = 32): string => randomBytes(bytes).toString('base64url')

/** S256 code challenge (RFC 7636). */
export const codeChallengeFor = (verifier: string): string =>
  createHash('sha256').update(verifier).digest('base64url')

export type GoogleFlowState = {
  state: string
  codeVerifier: string
  nonce: string
  /** Where to send the browser after signing in. A same-site path. */
  returnTo: string
}

export function newFlowState(returnTo: string): GoogleFlowState {
  return { state: randomToken(), codeVerifier: randomToken(48), nonce: randomToken(), returnTo }
}

export const encodeFlowState = (flow: GoogleFlowState): string =>
  Buffer.from(JSON.stringify(flow)).toString('base64url')

export function decodeFlowState(value: string | undefined): GoogleFlowState | null {
  if (!value) return null
  try {
    const parsed: unknown = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'))
    if (typeof parsed !== 'object' || parsed === null) return null
    const { state, codeVerifier, nonce, returnTo } = parsed as Record<string, unknown>
    if (
      typeof state !== 'string' ||
      typeof codeVerifier !== 'string' ||
      typeof nonce !== 'string' ||
      typeof returnTo !== 'string'
    ) {
      return null
    }
    return { state, codeVerifier, nonce, returnTo }
  } catch {
    return null
  }
}

/** Constant-time string comparison. */
export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a)
  const right = Buffer.from(b)
  return left.length === right.length && timingSafeEqual(left, right)
}

/**
 * Only same-site paths are valid destinations, so the callback cannot be turned into an open
 * redirect. Anything else becomes the account page.
 */
export function safeReturnTo(value: string | null | undefined, fallback = '/account'): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\'))
    return fallback
  if (/[\u0000-\u001f]/.test(value)) return fallback
  return value
}

// ---------- talking to Google ----------

export function buildAuthorizationUrl(
  config: GoogleConfig,
  flow: GoogleFlowState,
  redirectUri: string = googleRedirectUri(),
): string {
  const url = new URL(GOOGLE_AUTH_URL)
  url.search = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    state: flow.state,
    nonce: flow.nonce,
    code_challenge: codeChallengeFor(flow.codeVerifier),
    code_challenge_method: 'S256',
    // Let people pick the account instead of silently reusing whichever one is signed in.
    prompt: 'select_account',
  }).toString()
  return url.toString()
}

/** Trades the authorization code for Google's ID token. */
export async function exchangeCodeForIdToken(
  config: GoogleConfig,
  args: { code: string; codeVerifier: string; redirectUri?: string },
): Promise<string> {
  const response = await googleDeps.fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
    body: new URLSearchParams({
      code: args.code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: args.redirectUri ?? googleRedirectUri(),
      grant_type: 'authorization_code',
      code_verifier: args.codeVerifier,
    }),
    signal: AbortSignal.timeout(10_000),
  })
  if (!response.ok) throw new Error(`Google token endpoint answered ${response.status}`)
  const body: unknown = await response.json()
  const idToken =
    typeof body === 'object' && body !== null
      ? (body as { id_token?: unknown }).id_token
      : undefined
  if (typeof idToken !== 'string' || idToken === '') throw new Error('Google returned no ID token')
  return idToken
}

export type GoogleIdentity = {
  /** Google's stable account ID. Never reused, unlike an email address. */
  sub: string
  email: string
  name: string | null
}

/**
 * Verifies the signature (against Google's keys), issuer, audience and expiry of an ID token, and
 * requires a verified email address. Returns null for anything that does not check out, so a
 * caller cannot leak why.
 */
export async function verifyGoogleIdToken(
  idToken: string,
  options: { audiences: string[]; nonce?: string },
): Promise<GoogleIdentity | null> {
  if (options.audiences.length === 0) return null
  try {
    const { payload } = await jwtVerify(idToken, googleDeps.getKey, {
      issuer: GOOGLE_ISSUERS,
      audience: options.audiences,
      algorithms: ['RS256'],
    })
    if (options.nonce !== undefined) {
      if (typeof payload.nonce !== 'string' || !safeEqual(payload.nonce, options.nonce)) return null
    }
    const { sub, email, email_verified: emailVerified, name } = payload as Record<string, unknown>
    // Linking accounts by email is only safe when Google vouches that the address is the user's.
    if (typeof sub !== 'string' || sub === '') return null
    if (typeof email !== 'string' || email === '') return null
    if (emailVerified !== true && emailVerified !== 'true') return null
    return {
      sub,
      email: email.trim().toLowerCase(),
      name: typeof name === 'string' && name.trim() !== '' ? name.trim().slice(0, 80) : null,
    }
  } catch {
    return null
  }
}
