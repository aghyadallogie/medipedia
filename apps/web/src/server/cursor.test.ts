import { describe, expect, it } from 'vitest'

import {
  cursorLength,
  decodeCursor,
  encodeCursor,
  keysetWhere,
  payloadSort,
  toPage,
  type SortSpec,
} from './cursor'

const byUpdatedDesc: SortSpec[] = [{ field: 'updatedAt', direction: 'desc' }]
const byTitleAsc: SortSpec[] = [{ field: 'title', direction: 'asc' }]

describe('cursor encoding', () => {
  it('round-trips values', () => {
    const cursor = encodeCursor(['2026-11-22T12:00:00.000Z', 'abc-123'])
    expect(decodeCursor(cursor, 2)).toEqual(['2026-11-22T12:00:00.000Z', 'abc-123'])
  })

  it('is URL-safe', () => {
    expect(encodeCursor(['a/b+c==', 'é'])).toMatch(/^[A-Za-z0-9_-]+$/)
  })

  it('rejects a cursor for a different sort order', () => {
    expect(decodeCursor(encodeCursor(['a', 'b']), 3)).toBeNull()
    expect(decodeCursor(encodeCursor(['a', 'b']), 1)).toBeNull()
  })

  it.each([
    ['empty', ''],
    ['not base64 json', '!!!not-a-cursor!!!'],
    ['json of the wrong shape', Buffer.from('{"k":[1]}').toString('base64url')],
    ['wrong version', Buffer.from('{"v":2,"k":["a"]}').toString('base64url')],
    ['non-scalar values', Buffer.from('{"v":1,"k":[{"a":1}]}').toString('base64url')],
    ['empty key list', Buffer.from('{"v":1,"k":[]}').toString('base64url')],
    ['oversized', 'A'.repeat(513)],
  ])('rejects %s', (_name, cursor) => {
    expect(decodeCursor(cursor, 1)).toBeNull()
  })
})

describe('payloadSort', () => {
  it('adds the id tiebreaker and prefixes descending columns', () => {
    expect(payloadSort(byUpdatedDesc)).toEqual(['-updatedAt', 'id'])
    expect(payloadSort(byTitleAsc)).toEqual(['title', 'id'])
  })

  it('counts one more cursor value than sort columns', () => {
    expect(cursorLength(byUpdatedDesc)).toBe(2)
  })
})

describe('keysetWhere', () => {
  it('asks for rows after the cursor in a descending order', () => {
    expect(keysetWhere(byUpdatedDesc, ['2026-01-01T00:00:00.000Z', 'id-1'])).toEqual({
      or: [
        { updatedAt: { less_than: '2026-01-01T00:00:00.000Z' } },
        {
          and: [
            { updatedAt: { equals: '2026-01-01T00:00:00.000Z' } },
            { id: { greater_than: 'id-1' } },
          ],
        },
      ],
    })
  })

  it('asks for rows after the cursor in an ascending order', () => {
    expect(keysetWhere(byTitleAsc, ['Beta', 'id-9'])).toEqual({
      or: [
        { title: { greater_than: 'Beta' } },
        { and: [{ title: { equals: 'Beta' } }, { id: { greater_than: 'id-9' } }] },
      ],
    })
  })

  it('handles several sort columns with mixed directions', () => {
    const sort: SortSpec[] = [
      { field: 'a', direction: 'desc' },
      { field: 'b', direction: 'asc' },
    ]
    expect(keysetWhere(sort, [5, 'x', 'id'])).toEqual({
      or: [
        { a: { less_than: 5 } },
        { and: [{ a: { equals: 5 } }, { b: { greater_than: 'x' } }] },
        { and: [{ a: { equals: 5 } }, { b: { equals: 'x' } }, { id: { greater_than: 'id' } }] },
      ],
    })
  })

  it('rejects the wrong number of values', () => {
    expect(() => keysetWhere(byTitleAsc, ['only-one'])).toThrow(/2 sort columns/)
  })
})

describe('toPage', () => {
  const row = (n: number) => ({ id: `id-${n}`, title: `T${n}`, updatedAt: `2026-01-0${n}` })

  it('returns everything and no cursor when the rows fit in the page', () => {
    expect(toPage([row(1), row(2)], 2, byTitleAsc)).toEqual({
      items: [row(1), row(2)],
      nextCursor: null,
    })
    expect(toPage([], 5, byTitleAsc)).toEqual({ items: [], nextCursor: null })
  })

  it('trims the extra row and points the cursor at the last item that was kept', () => {
    const page = toPage([row(1), row(2), row(3)], 2, byTitleAsc)
    expect(page.items).toEqual([row(1), row(2)])
    expect(decodeCursor(page.nextCursor ?? '', 2)).toEqual(['T2', 'id-2'])
  })

  it('builds the cursor from every sort column', () => {
    const sort: SortSpec[] = [
      { field: 'updatedAt', direction: 'desc' },
      { field: 'title', direction: 'asc' },
    ]
    const page = toPage([row(1), row(2)], 1, sort)
    expect(decodeCursor(page.nextCursor ?? '', 3)).toEqual(['2026-01-01', 'T1', 'id-1'])
  })

  it('refuses to build a cursor from a column that is not a string or number', () => {
    expect(() =>
      toPage(
        [
          { id: 'a', title: null },
          { id: 'b', title: 'x' },
        ],
        1,
        byTitleAsc,
      ),
    ).toThrow(/"title"/)
  })
})
