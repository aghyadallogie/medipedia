/**
 * The only module allowed to read `process.env` (AGENTS.md §10, enforced by ESLint).
 *
 * Server variables are validated on the server only, so client components can import
 * `publicEnv` without needing secrets. A variable that a later phase introduces stays
 * optional here until that phase makes it required.
 */
import { z } from 'zod'

/** Treat `KEY=` (empty string) in a .env file as unset. */
const optionalString = (schema: z.ZodType<string>) =>
  z.preprocess((value) => (value === '' ? undefined : value), schema.optional())

const postgresUrl = z
  .string()
  .regex(/^postgres(ql)?:\/\//, 'must be a postgres:// or postgresql:// connection string')

const ServerEnvSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

    // Phase 1
    DATABASE_URL: postgresUrl,
    DATABASE_URL_UNPOOLED: postgresUrl,
    PAYLOAD_SECRET: z.string().min(32, 'must be at least 32 characters'),
    /** Set by the `migrate*` scripts so migrations use the direct (unpooled) connection. */
    PAYLOAD_MIGRATING: z.stringbool().default(false),

    /** Set by Vercel. Absent locally and in CI. */
    VERCEL_ENV: z.enum(['development', 'preview', 'production']).optional(),

    // Phase 2 (media uploads). Optional locally, where uploads fall back to disk.
    BLOB_READ_WRITE_TOKEN: optionalString(z.string()),

    // Phase 4 (learner auth, email)
    /** Signs learner access tokens. Different from PAYLOAD_SECRET. */
    JWT_SECRET: z.string().min(32, 'must be at least 32 characters'),
    // Google sign-in is switched on when both are set. Without them the buttons are hidden.
    GOOGLE_CLIENT_ID: optionalString(z.string()),
    GOOGLE_CLIENT_SECRET: optionalString(z.string()),
    /** Comma-separated extra Google client IDs (iOS, Android) accepted by the mobile endpoint. */
    GOOGLE_MOBILE_CLIENT_IDS: optionalString(z.string()),
    // Optional locally, where emails are printed to the console instead of sent.
    RESEND_API_KEY: optionalString(z.string()),
    EMAIL_FROM: optionalString(z.string()),

    // Phase 7 (rate limiting)
    UPSTASH_REDIS_REST_URL: optionalString(z.url()),
    UPSTASH_REDIS_REST_TOKEN: optionalString(z.string()),
  })
  .refine((env) => env.JWT_SECRET !== env.PAYLOAD_SECRET, {
    message: 'JWT_SECRET must differ from PAYLOAD_SECRET (AGENTS.md §5)',
    path: ['JWT_SECRET'],
  })
  // Vercel's filesystem is read-only and ephemeral, so uploads there must go to Blob.
  .refine(
    (env) =>
      env.VERCEL_ENV === undefined ||
      env.VERCEL_ENV === 'development' ||
      env.BLOB_READ_WRITE_TOKEN !== undefined,
    {
      message: 'BLOB_READ_WRITE_TOKEN is required on Vercel preview and production deployments',
      path: ['BLOB_READ_WRITE_TOKEN'],
    },
  )

  // Real emails must be sent from Vercel deployments: verification and password reset depend on them.
  .refine(
    (env) =>
      env.VERCEL_ENV === undefined ||
      env.VERCEL_ENV === 'development' ||
      (env.RESEND_API_KEY !== undefined && env.EMAIL_FROM !== undefined),
    {
      message:
        'RESEND_API_KEY and EMAIL_FROM are required on Vercel preview and production deployments',
      path: ['RESEND_API_KEY'],
    },
  )
  // Rate limits must be shared by every serverless instance, so Vercel deployments need Redis.
  .refine(
    (env) =>
      env.VERCEL_ENV === undefined ||
      env.VERCEL_ENV === 'development' ||
      (env.UPSTASH_REDIS_REST_URL !== undefined && env.UPSTASH_REDIS_REST_TOKEN !== undefined),
    {
      message:
        'UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are required on Vercel preview and production deployments',
      path: ['UPSTASH_REDIS_REST_URL'],
    },
  )
  // Rate limiting needs both halves of the credential pair.
  .refine(
    (env) =>
      (env.UPSTASH_REDIS_REST_URL === undefined) === (env.UPSTASH_REDIS_REST_TOKEN === undefined),
    {
      message: 'Set both UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN, or neither',
      path: ['UPSTASH_REDIS_REST_TOKEN'],
    },
  )
  // Google sign-in needs both halves of the credential pair.
  .refine(
    (env) => (env.GOOGLE_CLIENT_ID === undefined) === (env.GOOGLE_CLIENT_SECRET === undefined),
    {
      message: 'Set both GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET, or neither',
      path: ['GOOGLE_CLIENT_SECRET'],
    },
  )

const PublicEnvSchema = z.object({
  NEXT_PUBLIC_SITE_URL: z.url(),
  /** Where privacy requests and questions about the terms go. Shown on /terms and /privacy. */
  NEXT_PUBLIC_CONTACT_EMAIL: optionalString(z.email()),
})

export type ServerEnv = z.infer<typeof ServerEnvSchema>
export type PublicEnv = z.infer<typeof PublicEnvSchema>

type RawEnv = Record<string, string | undefined>

function formatIssues(error: z.ZodError): string {
  return error.issues
    .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
    .join('\n')
}

export function parseServerEnv(raw: RawEnv): ServerEnv {
  const result = ServerEnvSchema.safeParse(raw)
  if (!result.success) {
    throw new Error(`Invalid server environment variables:\n${formatIssues(result.error)}`)
  }
  return result.data
}

export function parsePublicEnv(raw: RawEnv): PublicEnv {
  const result = PublicEnvSchema.safeParse(raw)
  if (!result.success) {
    throw new Error(`Invalid public environment variables:\n${formatIssues(result.error)}`)
  }
  return result.data
}

const isServer = typeof window === 'undefined'

/** Server-only variables. Accessing this in the browser throws. */
export const env: ServerEnv = isServer
  ? parseServerEnv(process.env)
  : new Proxy({} as ServerEnv, {
      get() {
        throw new Error('Server environment variables are not available in the browser.')
      },
    })

/** `NEXT_PUBLIC_*` values, referenced literally so Next.js can inline them in client bundles. */
export const publicEnv: PublicEnv = parsePublicEnv({
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  NEXT_PUBLIC_CONTACT_EMAIL: process.env.NEXT_PUBLIC_CONTACT_EMAIL,
})
