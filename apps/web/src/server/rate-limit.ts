/**
 * Rate limiting (AGENTS.md §5, Phase 7).
 *
 * Counters live in Upstash Redis when `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are
 * set (required on Vercel preview and production, so every serverless instance shares them). Without
 * them, as in local development, a per-process in-memory window is used instead, which is only
 * good enough for one server. Under `NODE_ENV=test` limits are off unless a test turns them on.
 *
 * Keys are hashed before they reach Redis, so neither IP addresses nor email addresses are stored
 * there. If Redis cannot be reached the request is let through and the error is logged: a limiter
 * outage should not take sign-in down with it.
 */
import { createHash } from 'node:crypto'

import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

import { env } from '@/env'
import { ApiError } from '@/server/http'

export type RateRule = {
  /** Namespaces the counter, so two rules never share one. */
  name: string
  /** Requests allowed per window. */
  limit: number
  windowSeconds: number
}

const rule = (name: string, limit: number, windowSeconds: number): RateRule => ({
  name,
  limit,
  windowSeconds,
})

const MINUTE = 60
const HOUR = 3600

/**
 * Every limit in one place. "ip" rules count per client address, "email" rules per address in the
 * request body (so one mailbox cannot be flooded from many IPs), "user" rules per signed-in user.
 */
export const RATE_RULES = {
  login: rule('login', 10, 5 * MINUTE),
  register: rule('register', 5, HOUR),
  registerEmail: rule('register-email', 3, HOUR),
  forgotPassword: rule('forgot-password', 5, HOUR),
  forgotPasswordEmail: rule('forgot-password-email', 3, HOUR),
  resetPassword: rule('reset-password', 10, 15 * MINUTE),
  verifyEmail: rule('verify-email', 10, 15 * MINUTE),
  /** Generous: a page full of parallel requests can all try to renew the same session. */
  refresh: rule('refresh', 120, MINUTE),
  google: rule('google', 20, 10 * MINUTE),
  /** Payload's own credential routes for the admin panel (`/api/cms/users/*`). */
  adminAuth: rule('admin-auth', 10, 5 * MINUTE),
  // Per signed-in user.
  deleteAccount: rule('delete-account', 5, 15 * MINUTE),
  answer: rule('answer', 60, MINUTE),
  /** Every authenticated API call, so a real account cannot be used to scrape the content. */
  api: rule('api', 240, MINUTE),
} as const satisfies Record<string, RateRule>

type Verdict = { allowed: true } | { allowed: false; retryAfterSeconds: number }

// ---------- backends ----------

const memoryHits = new Map<string, number[]>()

/** A sliding window kept in this process. Only for development and tests. */
function checkMemory(key: string, { limit, windowSeconds }: RateRule): Verdict {
  const now = Date.now()
  const windowMs = windowSeconds * 1000
  const hits = (memoryHits.get(key) ?? []).filter((at) => now - at < windowMs)
  if (hits.length >= limit) {
    memoryHits.set(key, hits)
    const oldest = hits[0] ?? now
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((oldest + windowMs - now) / 1000)),
    }
  }
  hits.push(now)
  memoryHits.set(key, hits)
  return { allowed: true }
}

const redisLimiters = new Map<string, Ratelimit>()

function redisLimiter(current: RateRule): Ratelimit | null {
  const url = env.UPSTASH_REDIS_REST_URL
  const token = env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null
  let limiter = redisLimiters.get(current.name)
  if (!limiter) {
    limiter = new Ratelimit({
      redis: new Redis({ url, token }),
      limiter: Ratelimit.slidingWindow(current.limit, `${current.windowSeconds} s`),
      prefix: `medipedia:rl:${current.name}`,
    })
    redisLimiters.set(current.name, limiter)
  }
  return limiter
}

// ---------- switches for tests ----------

let enabled = env.NODE_ENV !== 'test'

/** Test hooks. Limits are off under `NODE_ENV=test` until a test calls `setEnabled(true)`. */
export const rateLimitTesting = {
  setEnabled(value: boolean): void {
    enabled = value
  },
  reset(): void {
    memoryHits.clear()
  },
}

// ---------- public API ----------

const digest = (value: string): string => createHash('sha256').update(value).digest('hex')

/**
 * The caller's address. Vercel overwrites `x-forwarded-for` (and sets `x-real-ip`) at its edge, so a
 * client cannot choose its own; elsewhere these headers are only as trustworthy as the proxy.
 */
export function clientIp(request: Request): string {
  const real = request.headers.get('x-real-ip')?.trim()
  if (real) return real
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  return forwarded || 'unknown'
}

export const rateLimited = (retryAfterSeconds: number): ApiError =>
  new ApiError('rate_limited', 'Too many requests. Wait a moment and try again.', {
    retryAfterSeconds,
  })

/** Counts one request against `rule` for `subject` (an IP, an email, a user id). */
export async function checkRateLimit(current: RateRule, subject: string): Promise<Verdict> {
  if (!enabled) return { allowed: true }
  const key = `${current.name}:${digest(subject)}`
  const redis = redisLimiter(current)
  if (!redis) return checkMemory(key, current)
  try {
    const result = await redis.limit(digest(subject))
    if (result.success) return { allowed: true }
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((result.reset - Date.now()) / 1000)),
    }
  } catch (error) {
    console.error('Rate limiter unavailable, letting the request through', error)
    return { allowed: true }
  }
}

/** Throws a 429 `rate_limited` error (with `Retry-After`) when `subject` is over `rule`. */
export async function enforceRateLimit(current: RateRule, subject: string): Promise<void> {
  const verdict = await checkRateLimit(current, subject)
  if (!verdict.allowed) throw rateLimited(verdict.retryAfterSeconds)
}

/** Per client address. */
export const limitByIp = (request: Request, current: RateRule) =>
  enforceRateLimit(current, clientIp(request))

/** Per email address from the request body, case-insensitive. */
export const limitByEmail = (email: string, current: RateRule) =>
  enforceRateLimit(current, email.trim().toLowerCase())
