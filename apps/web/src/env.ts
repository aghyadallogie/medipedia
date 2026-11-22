/**
 * The only module allowed to read `process.env` (AGENTS.md §10, enforced by ESLint).
 *
 * Server variables are validated on the server only, so client components can import
 * `publicEnv` without needing secrets. A variable that a later phase introduces stays
 * optional here until that phase makes it required.
 */
import { z } from 'zod'

/** Treat `KEY=` (empty string) in a .env file as unset. */
const optionalString = (schema: z.ZodString | z.ZodURL) =>
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

    // Phase 2 (media uploads)
    BLOB_READ_WRITE_TOKEN: optionalString(z.string()),

    // Phase 4 (learner auth, email)
    JWT_SECRET: optionalString(z.string().min(32, 'must be at least 32 characters')),
    GOOGLE_CLIENT_ID: optionalString(z.string()),
    GOOGLE_CLIENT_SECRET: optionalString(z.string()),
    RESEND_API_KEY: optionalString(z.string()),
    EMAIL_FROM: optionalString(z.string()),

    // Phase 7 (rate limiting)
    UPSTASH_REDIS_REST_URL: optionalString(z.url()),
    UPSTASH_REDIS_REST_TOKEN: optionalString(z.string()),
  })
  .refine((env) => env.JWT_SECRET === undefined || env.JWT_SECRET !== env.PAYLOAD_SECRET, {
    message: 'JWT_SECRET must differ from PAYLOAD_SECRET (AGENTS.md §5)',
    path: ['JWT_SECRET'],
  })

const PublicEnvSchema = z.object({
  NEXT_PUBLIC_SITE_URL: z.url(),
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
})
