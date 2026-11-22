import { z } from 'zod'

import { PAGINATION } from './constants'

/** Machine-readable error codes, one per HTTP status we use (AGENTS.md §6). */
export const API_ERROR_CODES = [
  'validation_error',
  'unauthorized',
  'forbidden',
  'not_found',
  'rate_limited',
  'internal_error',
] as const
export const ApiErrorCodeSchema = z.enum(API_ERROR_CODES)
export type ApiErrorCode = z.infer<typeof ApiErrorCodeSchema>

export const API_ERROR_STATUS: Record<ApiErrorCode, number> = {
  validation_error: 400,
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  rate_limited: 429,
  internal_error: 500,
}

/** `{ error: { code, message, details? } }` */
export const ApiErrorBodySchema = z.object({
  error: z.object({
    code: ApiErrorCodeSchema,
    message: z.string(),
    details: z.unknown().optional(),
  }),
})
export type ApiErrorBody = z.infer<typeof ApiErrorBodySchema>

/** `{ data: T }` */
export const dataResponse = <T extends z.ZodType>(data: T) => z.object({ data })

/** `{ data: T[], nextCursor: string | null }` */
export const paginatedResponse = <T extends z.ZodType>(item: T) =>
  z.object({
    data: z.array(item),
    nextCursor: z.string().nullable(),
  })

/** `?cursor=...&limit=20`. The limit is coerced from the query string. */
export const PaginationQuerySchema = z.object({
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(PAGINATION.maxLimit).default(PAGINATION.defaultLimit),
})
export type PaginationQuery = z.infer<typeof PaginationQuerySchema>

/** `GET /api/v1/health` */
export const HealthSchema = z.object({
  status: z.literal('ok'),
})
export const HealthResponseSchema = dataResponse(HealthSchema)
export type HealthResponse = z.infer<typeof HealthResponseSchema>
