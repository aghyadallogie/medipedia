/**
 * Keyset (cursor) pagination for list endpoints (AGENTS.md §6). Page N+1 starts strictly after
 * the last item of page N in the sort order, so pages stay correct while content is added or
 * edited, and it needs no OFFSET scan. The cursor is opaque to clients.
 */
import type { Where } from 'payload'
import { z } from 'zod'

export type SortDirection = 'asc' | 'desc'
export type SortSpec = { field: string; direction: SortDirection }
type Scalar = string | number

/** Rows with equal sort values are ordered by id, which makes the order total and stable. */
const TIEBREAKER: SortSpec = { field: 'id', direction: 'asc' }

const MAX_CURSOR_LENGTH = 512

const CursorPayloadSchema = z.object({
  v: z.literal(1),
  k: z.array(z.union([z.string(), z.number()])).min(1),
})

export function encodeCursor(values: readonly Scalar[]): string {
  return Buffer.from(JSON.stringify({ v: 1, k: values })).toString('base64url')
}

/** Returns the key values, or null when the cursor is malformed or not for this sort order. */
export function decodeCursor(cursor: string, expectedLength: number): Scalar[] | null {
  if (cursor.length === 0 || cursor.length > MAX_CURSOR_LENGTH) return null
  try {
    const parsed = CursorPayloadSchema.safeParse(
      JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')),
    )
    if (!parsed.success || parsed.data.k.length !== expectedLength) return null
    return parsed.data.k
  } catch {
    return null
  }
}

/** Payload `sort` argument for a sort spec, with the id tiebreaker appended. */
export function payloadSort(sort: readonly SortSpec[]): string[] {
  return [...sort, TIEBREAKER].map(({ field, direction }) =>
    direction === 'desc' ? `-${field}` : field,
  )
}

/**
 * "Everything after this row" for a multi-column sort: for each column, rows that tie on all
 * earlier columns and are beyond this one. Combined with OR.
 */
export function keysetWhere(sort: readonly SortSpec[], values: readonly Scalar[]): Where {
  const columns = [...sort, TIEBREAKER]
  if (values.length !== columns.length) {
    throw new Error(`Cursor has ${values.length} values for ${columns.length} sort columns`)
  }

  const branches: Where[] = columns.map((column, index) => {
    const conditions: Where[] = []
    for (let before = 0; before < index; before++) {
      const prior = columns[before]
      if (prior) conditions.push({ [prior.field]: { equals: values[before] } })
    }
    conditions.push({
      [column.field]: {
        [column.direction === 'asc' ? 'greater_than' : 'less_than']: values[index],
      },
    })
    return conditions.length === 1 && conditions[0] ? conditions[0] : { and: conditions }
  })

  return { or: branches }
}

/** Number of values a cursor must carry for this sort order. */
export const cursorLength = (sort: readonly SortSpec[]): number => sort.length + 1

export type Page<T> = { items: T[]; nextCursor: string | null }

/**
 * Splits `limit + 1` fetched rows into a page and the cursor for the next one.
 * Fetching one extra row is how we know whether another page exists.
 */
export function toPage<T extends { id: string }>(
  rows: readonly T[],
  limit: number,
  sort: readonly SortSpec[],
): Page<T> {
  if (rows.length <= limit) return { items: [...rows], nextCursor: null }

  const items = rows.slice(0, limit)
  const last = items.at(-1)
  if (!last) return { items, nextCursor: null }

  const values = [...sort.map((column) => column.field), 'id'].map((field) => {
    const value = (last as Record<string, unknown>)[field]
    if (typeof value !== 'string' && typeof value !== 'number') {
      throw new Error(`Cannot build a cursor: "${field}" is not a string or number`)
    }
    return value
  })
  return { items, nextCursor: encodeCursor(values) }
}
