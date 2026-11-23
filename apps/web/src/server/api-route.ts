import type { z } from 'zod'

import { ApiError } from '@/server/http'

/** Parses `?a=1&b=2` with a shared schema. A ZodError becomes a 400 in `handler()`. */
export function parseQuery<S extends z.ZodType>(schema: S, request: Request): z.infer<S> {
  return schema.parse(Object.fromEntries(new URL(request.url).searchParams))
}

/** A document the caller asked for by slug or id that does not exist (or is not public). */
export function notFound(what: string): ApiError {
  return new ApiError('not_found', `${what} not found.`)
}

/** Route context for `[slug]` and `[id]` segments. Next 16 passes params as a promise. */
export type RouteContext<Params extends Record<string, string>> = {
  params: Promise<Params>
}
