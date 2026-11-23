/**
 * Response helpers for App API route handlers (/api/v1/*). Every response is
 * `{ data }` or `{ error: { code, message, details? } }` (AGENTS.md §6).
 */
import { API_ERROR_STATUS, type ApiErrorBody, type ApiErrorCode } from '@medipedia/shared'
import { ZodError } from 'zod'

export const CACHE_CONTROL = {
  /** Public content: cached at the edge (AGENTS.md §7). */
  public: 'public, s-maxage=60, stale-while-revalidate=300',
  /** Authenticated, login-gated or mutating responses. */
  private: 'private, no-store',
} as const

export type CachePolicy = keyof typeof CACHE_CONTROL

export class ApiError extends Error {
  readonly code: ApiErrorCode
  readonly details?: unknown

  constructor(code: ApiErrorCode, message: string, details?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.details = details
  }

  get status(): number {
    return API_ERROR_STATUS[this.code]
  }
}

export function ok<T>(data: T, options: { cache: CachePolicy; status?: number }): Response {
  return Response.json(
    { data },
    {
      status: options.status ?? 200,
      headers: { 'Cache-Control': CACHE_CONTROL[options.cache] },
    },
  )
}

/** `{ data: T[], nextCursor }`, the envelope every list endpoint uses. */
export function okList<T>(
  items: readonly T[],
  nextCursor: string | null,
  options: { cache: CachePolicy },
): Response {
  return Response.json(
    { data: items, nextCursor },
    { status: 200, headers: { 'Cache-Control': CACHE_CONTROL[options.cache] } },
  )
}

export function errorResponse(error: unknown): Response {
  const apiError =
    error instanceof ApiError
      ? error
      : error instanceof ZodError
        ? new ApiError('validation_error', 'Invalid request.', error.issues)
        : new ApiError('internal_error', 'Something went wrong.')

  if (apiError.code === 'internal_error') {
    console.error(error)
  }

  const body: ApiErrorBody = {
    error: {
      code: apiError.code,
      message: apiError.message,
      ...(apiError.details === undefined ? {} : { details: apiError.details }),
    },
  }

  return Response.json(body, {
    status: apiError.status,
    headers: { 'Cache-Control': CACHE_CONTROL.private },
  })
}

/** Wraps a route handler so thrown ApiErrors and ZodErrors become typed error responses. */
export function handler<Args extends unknown[]>(
  fn: (...args: Args) => Promise<Response> | Response,
): (...args: Args) => Promise<Response> {
  return async (...args) => {
    try {
      return await fn(...args)
    } catch (error) {
      return errorResponse(error)
    }
  }
}
